import { runAgent, runAgentStream } from "../agent/agentRunner.js";
import { trackEvent } from "../utils/analytics.js";
import { logger } from "../utils/logger.js";
import { v4 as uuidv4 } from "uuid";

// ── Standard (non-streaming) endpoint ─────────────────────────────
export async function chatHandler(req, res) {
  const { messages, sessionId } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array is required" });
  }

  const last = messages[messages.length - 1];
  if (!last || last.role !== "user" || !last.content?.trim()) {
    return res.status(400).json({ error: "Last message must be a non-empty user message" });
  }

  const sid = sessionId || uuidv4();

  // Track first message of a session as conversation_started
  if (!sessionId) trackEvent("conversation_started", { sessionId: sid, channel: "web" });

  try {
    const { reply, emailSent, products } = await runAgent(sid, last.content, "web");
    return res.json({ message: reply, emailSent, products, sessionId: sid });
  } catch (error) {
    logger.error("Chat API error", { error: error.message, sessionId: sid });
    return res.status(500).json({ error: "Agent unavailable. Please try again or call (314) 569-2888." });
  }
}

// ── Streaming endpoint (SSE) ───────────────────────────────────────
export async function streamHandler(req, res) {
  const { messages, sessionId } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array is required" });
  }

  const last = messages[messages.length - 1];
  if (!last || last.role !== "user" || !last.content?.trim()) {
    return res.status(400).json({ error: "Last message must be a non-empty user message" });
  }

  const sid = sessionId || uuidv4();
  if (!sessionId) trackEvent("conversation_started", { sessionId: sid, channel: "web" });

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Session-Id", sid);
  res.flushHeaders();

  const send = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    await runAgentStream(sid, last.content, "web", (chunk) => {
      send(chunk);
    });
  } catch (error) {
    logger.error("Stream error", { error: error.message, sessionId: sid });
    send({ type: "error", content: "Agent unavailable. Please try again or call (314) 569-2888." });
  } finally {
    res.write("data: [CLOSE]\n\n");
    res.end();
  }
}
