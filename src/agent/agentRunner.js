import OpenAI from "openai";
import https from "https";
import axios from "axios";
import { buildSystemPrompt } from "./systemPrompt.js";
import { tools } from "./tools.js";
import { getHistory, saveHistory } from "./sessionStore.js";
import { sendOrderConfirmationEmail, sendLeadCaptureEmail, sendHumanHandoffEmail } from "../email/emailService.js";
import { saveUserMemory, buildMemoryContext } from "./userMemory.js";
import { allProducts } from "../utils/productSearch.js";
import { trackEvent } from "../utils/analytics.js";
import { logger } from "../utils/logger.js";

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
let _client = null;
function getClient() {
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, httpAgent: httpsAgent });
  return _client;
}
const MODEL = "gpt-4o";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidEmail(e) { return EMAIL_RE.test(String(e).toLowerCase()); }
function detectLanguage(t) {
  return /\b(hola|quiero|tengo|dolor|gracias|comprar|precio|cómo|qué|cuál|me|mi|es|de|la|el|un|una|para)\b/i.test(t) ? "es" : "en";
}
function generateOrderRef() {
  return `ORD-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
}
function extractMentionedProducts(reply) {
  const lower = reply.toLowerCase();
  return allProducts
    .filter(p => lower.includes(p.name.toLowerCase()))
    .slice(0, 3)
    .map(p => ({ id: p.id, name: p.name, price: p.priceDisplay, url: p.url, image: p.image || null }));
}
function buildContext(messages) {
  return messages.slice(-4).map(m => (typeof m.content === "string" ? m.content : "")).join(" ");
}

async function notifyCRM(data) {
  const url = process.env.CRM_WEBHOOK_URL;
  if (!url) return;
  try {
    await axios.post(url, data, { timeout: 5000, httpsAgent });
    logger.info("CRM webhook sent");
  } catch (e) {
    logger.error("CRM webhook failed", { error: e.message });
  }
}

async function executeTool(toolName, toolArgs, messages) {
  // ── Order confirmation ──────────────────────────────────────────
  if (toolName === "send_order_confirmation") {
    if (!isValidEmail(toolArgs.customer_email)) {
      return {
        result: "Error: The email address format is invalid. Please ask the customer to provide a valid email.",
        emailSent: false,
      };
    }
    const orderRef = generateOrderRef();
    const res = await sendOrderConfirmationEmail({ ...toolArgs, orderRef });
    if (res.success) {
      trackEvent("order_completed", { sessionId: toolArgs.customer_email, language: toolArgs.language, orderRef });
      saveUserMemory(toolArgs.customer_email, {
        name: toolArgs.customer_name,
        language: toolArgs.language,
        newSession: false,
        purchase: {
          orderRef,
          items: toolArgs.order_items,
          total: toolArgs.order_total,
          date: new Date().toISOString(),
        },
      });
      notifyCRM({ orderRef, ...toolArgs, timestamp: new Date().toISOString() });
    }
    return {
      result: res.success
        ? `Email sent. Order reference: ${orderRef}. Mention this reference number to the customer.`
        : `Email failed: ${res.error}. Tell the customer to call (314) 569-2888.`,
      emailSent: res.success,
      orderRef: res.success ? orderRef : null,
    };
  }

  // ── Lead capture ────────────────────────────────────────────────
  if (toolName === "capture_lead") {
    if (!isValidEmail(toolArgs.email)) {
      return { result: "Error: Invalid email address. Ask the customer to provide a valid email.", emailSent: false };
    }
    const res = await sendLeadCaptureEmail(toolArgs);
    if (res.success) {
      trackEvent("lead_captured", { email: toolArgs.email, interests: toolArgs.interests });
      saveUserMemory(toolArgs.email, {
        name: toolArgs.name,
        language: toolArgs.language,
        newSession: true,
        productsViewed: toolArgs.interests.split(",").map(s => s.trim()),
      });
    }
    return {
      result: res.success ? "Lead captured successfully." : `Lead capture failed: ${res.error}`,
      emailSent: false,
    };
  }

  // ── Human handoff ────────────────────────────────────────────────
  if (toolName === "request_human_agent") {
    const res = await sendHumanHandoffEmail(toolArgs, messages);
    trackEvent("handoff_requested", { reason: toolArgs.reason, language: toolArgs.user_language });
    return { result: res.success ? "Human agent notified." : `Handoff failed: ${res.error}`, emailSent: false };
  }

  return { result: "Unknown tool.", emailSent: false };
}

// ── Non-streaming (Telegram / WhatsApp) ───────────────────────────
export async function runAgent(sessionId, userText, channel = "web") {
  const history = getHistory(sessionId);
  const messages = [...history, { role: "user", content: userText }];
  const context = buildContext(messages);
  const lang = detectLanguage(userText);

  trackEvent("message_sent", { sessionId, channel, language: lang });

  const memCtx = buildMemoryContext(sessionId); // session-based fallback

  const response = await getClient().chat.completions.create({
    model: MODEL,
    messages: [{ role: "system", content: buildSystemPrompt(channel, context, memCtx) }, ...messages],
    tools,
    tool_choice: "auto",
    temperature: 0.4,
  });

  const choice = response.choices[0];

  if (choice.finish_reason === "tool_calls") {
    const tc = choice.message.tool_calls[0];
    const { result, emailSent, orderRef } = await executeTool(tc.function.name, JSON.parse(tc.function.arguments), messages);

    const withTool = [
      ...messages, choice.message,
      { role: "tool", tool_call_id: tc.id, content: result },
    ];

    const followUp = await getClient().chat.completions.create({
      model: MODEL,
      messages: [{ role: "system", content: buildSystemPrompt(channel, context, memCtx) }, ...withTool],
      temperature: 0.4,
    });

    const reply = followUp.choices[0].message.content || "";
    saveHistory(sessionId, [...withTool, { role: "assistant", content: reply }]);
    return { reply, emailSent, orderRef, products: extractMentionedProducts(reply) };
  }

  const reply = choice.message.content || "";
  saveHistory(sessionId, [...messages, { role: "assistant", content: reply }]);
  const mentioned = extractMentionedProducts(reply);
  for (const p of mentioned) trackEvent("product_mentioned", { sessionId, product: p.name, channel });
  return { reply, emailSent: false, products: mentioned };
}

// ── Streaming (web widget) ─────────────────────────────────────────
export async function runAgentStream(sessionId, userText, channel, onChunk) {
  const history = getHistory(sessionId);
  const messages = [...history, { role: "user", content: userText }];
  const context = buildContext(messages);
  const lang = detectLanguage(userText);

  trackEvent("message_sent", { sessionId, channel, language: lang });

  const memCtx = buildMemoryContext(sessionId);
  let fullReply = "", emailSent = false, orderRef = null;
  let toolCall = null, toolArgs = "", finishReason = null;

  const stream = await getClient().chat.completions.create({
    model: MODEL,
    messages: [{ role: "system", content: buildSystemPrompt(channel, context, memCtx) }, ...messages],
    tools, tool_choice: "auto", temperature: 0.4, stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta;
    finishReason = chunk.choices[0]?.finish_reason || finishReason;
    if (delta?.content) { fullReply += delta.content; onChunk({ type: "text", content: delta.content }); }
    if (delta?.tool_calls) {
      const tc = delta.tool_calls[0];
      if (!toolCall) toolCall = { id: tc.id, name: tc.function?.name || "" };
      if (tc.function?.name && !toolCall.name) toolCall.name = tc.function.name;
      if (tc.function?.arguments) toolArgs += tc.function.arguments;
    }
  }

  if (finishReason === "tool_calls" && toolCall) {
    const parsed = JSON.parse(toolArgs);
    const res = await executeTool(toolCall.name, parsed, messages);
    emailSent = res.emailSent;
    orderRef = res.orderRef || null;

    const toolMessage = {
      role: "assistant", content: null,
      tool_calls: [{ id: toolCall.id, type: "function", function: { name: toolCall.name, arguments: toolArgs } }],
    };
    const withTool = [...messages, toolMessage, { role: "tool", tool_call_id: toolCall.id, content: res.result }];

    const followUp = await getClient().chat.completions.create({
      model: MODEL,
      messages: [{ role: "system", content: buildSystemPrompt(channel, context, memCtx) }, ...withTool],
      temperature: 0.4, stream: true,
    });

    for await (const chunk of followUp) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) { fullReply += content; onChunk({ type: "text", content }); }
    }

    saveHistory(sessionId, [...withTool, { role: "assistant", content: fullReply }]);
  } else {
    saveHistory(sessionId, [...messages, { role: "assistant", content: fullReply }]);
  }

  const mentioned = extractMentionedProducts(fullReply);
  for (const p of mentioned) trackEvent("product_mentioned", { sessionId, product: p.name, channel });

  onChunk({ type: "done", emailSent, orderRef, products: mentioned });
  logger.info("Stream complete", { sessionId, chars: fullReply.length, emailSent });
}
