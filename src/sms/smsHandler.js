import twilio from "twilio";
import { runAgent } from "../agent/agentRunner.js";
import { trackEvent } from "../utils/analytics.js";
import { logger } from "../utils/logger.js";

export function registerSmsHandlers(app) {
  app.post("/sms/webhook", async (req, res) => {
    const { Body, From } = req.body;
    if (!Body?.trim()) return res.sendStatus(200);

    const sessionId = `sms_${From.replace(/[^0-9]/g, "")}`;
    logger.info("SMS message", { from: From, chars: Body.length });
    await trackEvent("message_sent", { sessionId, channel: "sms" });

    try {
      const { reply } = await runAgent(sessionId, Body, "sms");
      const twiml = new twilio.twiml.MessagingResponse();
      // SMS: 160 char limit per segment — split if needed
      const chunks = splitSms(reply);
      chunks.forEach(c => twiml.message(c));
      res.type("text/xml").send(twiml.toString());
    } catch (error) {
      logger.error("SMS agent error", { error: error.message, sessionId });
      const twiml = new twilio.twiml.MessagingResponse();
      twiml.message("Sorry, I'm having trouble. Please call (314) 569-2888.");
      res.type("text/xml").send(twiml.toString());
    }
  });

  logger.info("SMS webhook endpoint: POST /sms/webhook");
}

function splitSms(text, maxLen = 320) {
  if (text.length <= maxLen) return [text];
  const chunks = [];
  let remaining = text;
  while (remaining.length > 0) {
    let cut = remaining.lastIndexOf(" ", maxLen);
    if (cut <= 0) cut = maxLen;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  return chunks;
}
