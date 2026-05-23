import twilio from "twilio";
import { runAgent } from "../agent/agentRunner.js";
import { trackEvent } from "../utils/analytics.js";
import { logger } from "../utils/logger.js";

// Lazily initialize Twilio client only when credentials are present
function getTwilioClient() {
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

export function registerWhatsAppHandlers(app) {
  app.post("/whatsapp/webhook", async (req, res) => {
    // Twilio sends form-encoded body
    const { Body, From, To, ProfileName } = req.body;
    if (!Body?.trim()) return res.sendStatus(200);

    // sessionId based on WhatsApp number (strip "whatsapp:" prefix)
    const sessionId = `wa_${From.replace(/[^0-9]/g, "")}`;
    const displayName = ProfileName || From;

    logger.info("WhatsApp message", { from: From, chars: Body.length });
    trackEvent("message_sent", { sessionId, channel: "whatsapp" });

    try {
      const { reply } = await runAgent(sessionId, Body, "whatsapp");

      // Twilio WhatsApp has a 1600-char limit per message
      const chunks = splitMessage(reply, 1500);
      const client = getTwilioClient();

      for (const chunk of chunks) {
        await client.messages.create({ body: chunk, from: To, to: From });
      }
    } catch (error) {
      logger.error("WhatsApp agent error", { error: error.message, sessionId });
      try {
        const client = getTwilioClient();
        await client.messages.create({
          body: "Sorry, I'm having trouble. Please call (314) 569-2888.",
          from: To, to: From,
        });
      } catch { /* ignore secondary failure */ }
    }

    res.sendStatus(200);
  });

  logger.info("WhatsApp webhook endpoint: POST /whatsapp/webhook");
}

function splitMessage(text, maxLen = 1500) {
  if (text.length <= maxLen) return [text];
  const chunks = [];
  let remaining = text;
  while (remaining.length > 0) {
    let cut = remaining.lastIndexOf("\n", maxLen);
    if (cut <= 0) cut = maxLen;
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).trim();
  }
  return chunks;
}
