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
import { query, hasDatabase } from "../db/database.js";
import { logger } from "../utils/logger.js";

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
let _client = null;
function getClient() {
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, httpAgent: httpsAgent });
  return _client;
}

// Route simple queries to gpt-4o-mini, complex ones to gpt-4o
const MODEL_SMART = "gpt-4o";
const MODEL_FAST  = "gpt-4o-mini";
const COMPLEX_RE  = /comprar|buy|order|pagar|checkout|compare|cuál es mejor|which is better|difference|diferencia|código|promo|discount|envío|shipping|quiero|want to/i;

function selectModel(userText, history) {
  const isComplex = COMPLEX_RE.test(userText) || history.length > 6;
  return isComplex ? MODEL_SMART : MODEL_FAST;
}

// Detect frustrated users → auto-escalate
const FRUSTRATION_RE = /no entiendo|no funciona|no me ayudas|not helping|useless|inútil|frustr|molest|enojad|otra vez|again|repite|repeat|terrible|horrible|awful/i;
function isFrustrated(messages) {
  const userMsgs = messages.filter(m => m.role === "user").map(m =>
    typeof m.content === "string" ? m.content.toLowerCase() : ""
  );
  if (userMsgs.length >= 2 && userMsgs.at(-1) === userMsgs.at(-2)) return true;
  return FRUSTRATION_RE.test(userMsgs.at(-1) || "");
}

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

// ── Discount code validation ──────────────────────────────────────
async function validateDiscount(code, orderTotal) {
  if (hasDatabase()) {
    const res = await query(
      `SELECT * FROM discount_codes
       WHERE code = UPPER($1) AND active = TRUE
         AND (expires_at IS NULL OR expires_at > NOW())
         AND (max_uses IS NULL OR used_count < max_uses)`,
      [code]
    );
    if (!res.rows[0]) return { valid: false };
    const dc = res.rows[0];
    await query("UPDATE discount_codes SET used_count = used_count + 1 WHERE code = $1", [dc.code]);
    const amount = Math.round(orderTotal * dc.discount_percent) / 100;
    return { valid: true, code: dc.code, percent: dc.discount_percent, amount, newTotal: orderTotal - amount };
  }
  // Fallback static codes for file-based mode
  const STATIC = { HIDOW10: 10, WELCOME15: 15, PAIN20: 20 };
  const pct = STATIC[code.toUpperCase()];
  if (!pct) return { valid: false };
  const amount = Math.round(orderTotal * pct) / 100;
  return { valid: true, code: code.toUpperCase(), percent: pct, amount, newTotal: orderTotal - amount };
}

// ── Product comparison ────────────────────────────────────────────
function buildComparisonTable(nameA, nameB) {
  const find = (name) => allProducts.find(p =>
    p.name.toLowerCase().includes(name.toLowerCase()) ||
    p.id.toLowerCase().includes(name.toLowerCase().replace(/\s+/g, "-"))
  );
  const a = find(nameA);
  const b = find(nameB);
  if (!a || !b) return `Could not find one or both products. Available: ${allProducts.map(p => p.name).join(", ")}`;

  const rows = [
    ["Price", a.priceDisplay, b.priceDisplay],
    ["Category", a.category, b.category],
    ["Description", (a.description || "").slice(0, 80), (b.description || "").slice(0, 80)],
  ];

  const table = [
    `| Feature | ${a.name} | ${b.name} |`,
    "|---|---|---|",
    ...rows.map(([f, av, bv]) => `| ${f} | ${av || "—"} | ${bv || "—"} |`),
  ].join("\n");

  return `${table}\n\nLinks: [${a.name}](${a.url}) · [${b.name}](${b.url})`;
}

// ── Tool executor ─────────────────────────────────────────────────
async function executeTool(toolName, toolArgs, messages) {
  if (toolName === "send_order_confirmation") {
    if (!isValidEmail(toolArgs.customer_email)) {
      return { result: "Error: Invalid email. Ask the customer for a valid email.", emailSent: false };
    }
    const orderRef = generateOrderRef();
    const res = await sendOrderConfirmationEmail({ ...toolArgs, orderRef });
    if (res.success) {
      await trackEvent("order_completed", { sessionId: toolArgs.customer_email, language: toolArgs.language, orderRef });
      await saveUserMemory(toolArgs.customer_email, {
        name: toolArgs.customer_name, language: toolArgs.language, newSession: false,
        purchase: { orderRef, items: toolArgs.order_items, total: toolArgs.order_total, date: new Date().toISOString() },
      });
      notifyCRM({ orderRef, ...toolArgs, timestamp: new Date().toISOString() });
    }
    return {
      result: res.success
        ? `Email sent. Order reference: ${orderRef}. Mention this to the customer.`
        : `Email failed: ${res.error}. Tell customer to call (314) 569-2888.`,
      emailSent: res.success,
      orderRef: res.success ? orderRef : null,
    };
  }

  if (toolName === "capture_lead") {
    if (!isValidEmail(toolArgs.email)) {
      return { result: "Error: Invalid email. Ask for a valid one.", emailSent: false };
    }
    const res = await sendLeadCaptureEmail(toolArgs);
    if (res.success) {
      await trackEvent("lead_captured", { email: toolArgs.email, interests: toolArgs.interests });
      await saveUserMemory(toolArgs.email, {
        name: toolArgs.name, language: toolArgs.language, newSession: true,
        productsViewed: toolArgs.interests.split(",").map(s => s.trim()),
      });
    }
    return { result: res.success ? "Lead captured." : `Lead failed: ${res.error}`, emailSent: false };
  }

  if (toolName === "request_human_agent") {
    const res = await sendHumanHandoffEmail(toolArgs, messages);
    await trackEvent("handoff_requested", { reason: toolArgs.reason, language: toolArgs.user_language });
    return { result: res.success ? "Human agent notified." : `Handoff failed: ${res.error}`, emailSent: false };
  }

  if (toolName === "compare_products") {
    const table = buildComparisonTable(toolArgs.product_a, toolArgs.product_b);
    await trackEvent("products_compared", { product_a: toolArgs.product_a, product_b: toolArgs.product_b });
    return { result: table, emailSent: false };
  }

  if (toolName === "apply_discount_code") {
    const dc = await validateDiscount(toolArgs.code, toolArgs.order_total);
    if (!dc.valid) return { result: `Code "${toolArgs.code}" is invalid or expired.`, emailSent: false };
    await trackEvent("discount_applied", { code: dc.code, percent: dc.percent });
    return {
      result: `Code ${dc.code} applied: ${dc.percent}% off. Discount: $${dc.amount.toFixed(2)}. New total: $${dc.newTotal.toFixed(2)}.`,
      emailSent: false,
      discountCode: dc.code,
      discountAmount: dc.amount,
      newTotal: dc.newTotal,
    };
  }

  return { result: "Unknown tool.", emailSent: false };
}

// ── Non-streaming (Telegram / WhatsApp / SMS) ─────────────────────
export async function runAgent(sessionId, userText, channel = "web") {
  const history = await getHistory(sessionId);
  const messages = [...history, { role: "user", content: userText }];
  const context = buildContext(messages);
  const lang = detectLanguage(userText);

  await trackEvent("message_sent", { sessionId, channel, language: lang });

  // Auto-escalate frustrated users
  if (isFrustrated(messages)) {
    logger.info("Frustration detected, injecting escalation hint", { sessionId });
  }

  const memCtx = await buildMemoryContext(sessionId);
  const model = selectModel(userText, history);

  const response = await getClient().chat.completions.create({
    model,
    messages: [{ role: "system", content: buildSystemPrompt(channel, context, memCtx) }, ...messages],
    tools, tool_choice: "auto", temperature: 0.4,
  });

  const choice = response.choices[0];

  if (choice.finish_reason === "tool_calls") {
    const tc = choice.message.tool_calls[0];
    const { result, emailSent, orderRef } = await executeTool(tc.function.name, JSON.parse(tc.function.arguments), messages);
    const withTool = [...messages, choice.message, { role: "tool", tool_call_id: tc.id, content: result }];
    const followUp = await getClient().chat.completions.create({
      model: MODEL_SMART,
      messages: [{ role: "system", content: buildSystemPrompt(channel, context, memCtx) }, ...withTool],
      temperature: 0.4,
    });
    const reply = followUp.choices[0].message.content || "";
    await saveHistory(sessionId, [...withTool, { role: "assistant", content: reply }]);
    return { reply, emailSent, orderRef, products: extractMentionedProducts(reply) };
  }

  const reply = choice.message.content || "";
  await saveHistory(sessionId, [...messages, { role: "assistant", content: reply }]);
  const mentioned = extractMentionedProducts(reply);
  for (const p of mentioned) await trackEvent("product_mentioned", { sessionId, product: p.name, channel });
  return { reply, emailSent: false, products: mentioned };
}

// ── Streaming (web widget) ─────────────────────────────────────────
export async function runAgentStream(sessionId, userText, channel, onChunk) {
  const history = await getHistory(sessionId);
  const messages = [...history, { role: "user", content: userText }];
  const context = buildContext(messages);
  const lang = detectLanguage(userText);

  await trackEvent("message_sent", { sessionId, channel, language: lang });

  const memCtx = await buildMemoryContext(sessionId);
  const model = selectModel(userText, history);
  let fullReply = "", emailSent = false, orderRef = null;
  let toolCall = null, toolArgs = "", finishReason = null;

  const stream = await getClient().chat.completions.create({
    model, messages: [{ role: "system", content: buildSystemPrompt(channel, context, memCtx) }, ...messages],
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
    const res = await executeTool(toolCall.name, JSON.parse(toolArgs), messages);
    emailSent = res.emailSent;
    orderRef = res.orderRef || null;

    const toolMessage = {
      role: "assistant", content: null,
      tool_calls: [{ id: toolCall.id, type: "function", function: { name: toolCall.name, arguments: toolArgs } }],
    };
    const withTool = [...messages, toolMessage, { role: "tool", tool_call_id: toolCall.id, content: res.result }];

    const followUp = await getClient().chat.completions.create({
      model: MODEL_SMART,
      messages: [{ role: "system", content: buildSystemPrompt(channel, context, memCtx) }, ...withTool],
      temperature: 0.4, stream: true,
    });

    for await (const chunk of followUp) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) { fullReply += content; onChunk({ type: "text", content }); }
    }
    await saveHistory(sessionId, [...withTool, { role: "assistant", content: fullReply }]);
  } else {
    await saveHistory(sessionId, [...messages, { role: "assistant", content: fullReply }]);
  }

  const mentioned = extractMentionedProducts(fullReply);
  for (const p of mentioned) await trackEvent("product_mentioned", { sessionId, product: p.name, channel });
  onChunk({ type: "done", emailSent, orderRef, products: mentioned });
  logger.info("Stream complete", { sessionId, model, chars: fullReply.length, emailSent });
}
