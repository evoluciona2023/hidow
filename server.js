import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import cron from "node-cron";
import { execFile } from "child_process";
import { chatHandler, streamHandler } from "./src/api/chat.js";
import { healthHandler } from "./src/api/health.js";
import { analyticsHandler } from "./src/api/analytics.js";
import { setupTelegramWebhook } from "./src/telegram/bot.js";
import { registerTelegramHandlers } from "./src/telegram/webhookHandler.js";
import { registerWhatsAppHandlers } from "./src/whatsapp/whatsappHandler.js";
import { purgeExpiredSessions } from "./src/agent/sessionStore.js";
import { logger } from "./src/utils/logger.js";

// ── Env validation ─────────────────────────────────────────────────
const REQUIRED = ["OPENAI_API_KEY", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"];
const missing = REQUIRED.filter(v => !process.env[v]);
if (missing.length) {
  console.error(`❌ Missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}

// ── Express ────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // for Twilio form-encoded webhooks
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(",") || "*" }));

const limiter = rateLimit({
  windowMs: 60_000, max: 60,
  standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
});
app.use("/api/chat", limiter);

// ── Routes ──────────────────────────────────────────────────────────
app.post("/api/chat", chatHandler);
app.post("/api/chat/stream", streamHandler);
app.get("/api/health", healthHandler);
app.get("/api/analytics", analyticsHandler);
app.use(express.static("."));

// ── Telegram ────────────────────────────────────────────────────────
if (process.env.TELEGRAM_BOT_TOKEN) {
  setupTelegramWebhook(app);
  registerTelegramHandlers();
  logger.info("Telegram bot initialized");
} else {
  logger.warn("TELEGRAM_BOT_TOKEN not set — Telegram disabled");
}

// ── WhatsApp (Twilio) ───────────────────────────────────────────────
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  registerWhatsAppHandlers(app);
  logger.info("WhatsApp (Twilio) channel initialized");
} else {
  logger.warn("TWILIO credentials not set — WhatsApp disabled");
}

// ── Session cleanup ─────────────────────────────────────────────────
const purged = purgeExpiredSessions();
if (purged > 0) logger.info(`Purged ${purged} expired sessions`);
setInterval(purgeExpiredSessions, 6 * 60 * 60 * 1000);

// ── Weekly price sync (every Monday at 3:00 AM) ─────────────────────
cron.schedule("0 3 * * 1", () => {
  logger.info("Running weekly price sync (scraper)...");
  execFile("node", ["scripts/scrape.js"], { cwd: process.cwd() }, (err, stdout, stderr) => {
    if (err) {
      logger.error("Weekly scrape failed", { error: err.message });
    } else {
      logger.info("Weekly price sync complete");
    }
  });
}, { timezone: "America/Chicago" });

// ── Start ───────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  const channels = ["web",
    process.env.TELEGRAM_BOT_TOKEN ? "telegram" : null,
    process.env.TWILIO_ACCOUNT_SID ? "whatsapp" : null,
  ].filter(Boolean).join(", ");

  logger.info(`HiDow Agent on http://localhost:${PORT} — Channels: ${channels}`);
  console.log(`\n   Test UI:   http://localhost:${PORT}/test.html`);
  console.log(`   Analytics: http://localhost:${PORT}/analytics.html\n`);
});
