import { query, hasDatabase } from "../db/database.js";
import { appendFileSync } from "fs";
import { resolve } from "path";
import { logger } from "../utils/logger.js";

export async function feedbackHandler(req, res) {
  const { sessionId, messageIndex, rating } = req.body;
  if (!sessionId || !rating || !["up", "down"].includes(rating)) {
    return res.status(400).json({ error: "Invalid feedback payload" });
  }
  try {
    if (hasDatabase()) {
      await query(
        "INSERT INTO message_feedback (session_id, message_index, rating) VALUES ($1, $2, $3)",
        [sessionId, messageIndex ?? -1, rating]
      );
    } else {
      const entry = JSON.stringify({ sessionId, messageIndex, rating, ts: new Date().toISOString() });
      try { appendFileSync(resolve("data/feedback.jsonl"), entry + "\n", "utf8"); } catch {}
    }
    logger.info("Feedback received", { sessionId, rating });
    res.json({ ok: true });
  } catch (e) {
    logger.error("Feedback error", { error: e.message });
    res.status(500).json({ error: e.message });
  }
}
