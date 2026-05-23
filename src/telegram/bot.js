import TelegramBot from "node-telegram-bot-api";
import { logger } from "../utils/logger.js";

const isDev = process.env.NODE_ENV !== "production";

// In development: use polling (no HTTPS required)
// In production: use webhook (requires public HTTPS URL)
export const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
  polling: isDev,
  webHook: false,
  request: { agentOptions: { rejectUnauthorized: false } },
});

if (isDev) {
  logger.info("Telegram bot in POLLING mode (development)");
} else {
  logger.info("Telegram bot in WEBHOOK mode (production)");
}

export function setupTelegramWebhook(app) {
  if (isDev) {
    // In polling mode the bot already receives updates — no webhook needed
    logger.info("Telegram: skipping webhook setup (polling mode active)");
    return;
  }
  app.post("/telegram/webhook", (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  });
  logger.info("Telegram webhook endpoint: POST /telegram/webhook");
}
