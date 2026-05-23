import "dotenv/config";
import * as Sentry from "@sentry/node";
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
import { registerSmsHandlers } from "./src/sms/smsHandler.js";
import { purgeExpiredSessions, getActiveSessions } from "./src/agent/sessionStore.js";
import { getAnalytics, buildSummary } from "./src/utils/analytics.js";
import { runMigrations } from "./src/db/migrate.js";
import { logger } from "./src/utils/logger.js";
import { createTransport } from "nodemailer";

// ── Env validation ─────────────────────────────────────────────────
const REQUIRED = ["OPENAI_API_KEY", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"];
const missing = REQUIRED.filter(v => !process.env[v]);
if (missing.length) {
  console.error(`❌ Missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}

// ── Sentry ─────────────────────────────────────────────────────────
if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1 });
  logger.info("Sentry initialized");
}

// ── Express ────────────────────────────────────────────────────────
const app = express();
if (process.env.SENTRY_DSN) Sentry.setupExpressErrorHandler(app);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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

// Live conversations endpoint
app.get("/api/conversations", async (req, res) => {
  try {
    const sessions = await getActiveSessions();
    const conversations = sessions.map(s => ({
      sessionId: s.session_id,
      messageCount: (s.messages || []).length,
      lastMessage: (s.messages || []).at(-1)?.content?.slice(0, 100) || "",
      updatedAt: s.updated_at,
      channel: s.session_id.startsWith("wa_") ? "whatsapp"
             : s.session_id.startsWith("sms_") ? "sms"
             : s.session_id.startsWith("tg_") ? "telegram" : "web",
    }));
    res.json({ conversations, total: conversations.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.use(express.static("."));
app.use(express.static("widget/dist"));

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

// ── SMS (Twilio) ────────────────────────────────────────────────────
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  registerSmsHandlers(app);
  logger.info("SMS (Twilio) channel initialized");
}

// ── Database migrations ──────────────────────────────────────────────
await runMigrations();

// ── Session cleanup ─────────────────────────────────────────────────
const purged = purgeExpiredSessions();
if (purged > 0) logger.info(`Purged ${purged} expired sessions`);
setInterval(purgeExpiredSessions, 6 * 60 * 60 * 1000);

// ── Weekly price sync (every Monday at 3:00 AM) ─────────────────────
cron.schedule("0 3 * * 1", () => {
  logger.info("Running weekly price sync (scraper)...");
  execFile("node", ["scripts/scrape.js"], { cwd: process.cwd() }, (err) => {
    if (err) logger.error("Weekly scrape failed", { error: err.message });
    else logger.info("Weekly price sync complete");
  });
}, { timezone: "America/Chicago" });

// ── Weekly analytics report (every Monday at 8:00 AM) ──────────────
cron.schedule("0 8 * * 1", async () => {
  logger.info("Sending weekly analytics report...");
  try {
    const events = await getAnalytics(7);
    const s = buildSummary(events);
    const convRate = s.total_conversations > 0
      ? ((s.orders_completed / s.total_conversations) * 100).toFixed(1)
      : "0.0";

    const transport = createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      tls: { rejectUnauthorized: false },
    });

    await transport.sendMail({
      from: process.env.SMTP_FROM,
      to: process.env.ORDERS_BCC_EMAIL || process.env.SMTP_FROM,
      subject: `📊 HiDow Weekly Report — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      html: `
        <h2>HiDow Agent — Weekly Summary</h2>
        <table style="border-collapse:collapse;width:100%;max-width:500px">
          <tr><td style="padding:8px;border:1px solid #ddd"><b>Conversations</b></td><td style="padding:8px;border:1px solid #ddd">${s.total_conversations}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd"><b>Messages</b></td><td style="padding:8px;border:1px solid #ddd">${s.total_messages}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd"><b>Orders</b></td><td style="padding:8px;border:1px solid #ddd">${s.orders_completed}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd"><b>Leads</b></td><td style="padding:8px;border:1px solid #ddd">${s.leads_captured}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd"><b>Handoffs</b></td><td style="padding:8px;border:1px solid #ddd">${s.handoffs_requested}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd"><b>Conversion rate</b></td><td style="padding:8px;border:1px solid #ddd">${convRate}%</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd"><b>Top product</b></td><td style="padding:8px;border:1px solid #ddd">${s.top_products[0]?.name || "—"} (${s.top_products[0]?.count || 0})</td></tr>
        </table>
        <p style="color:#888;font-size:12px;margin-top:16px">HiDow Agent · <a href="https://hidow-production.up.railway.app/analytics.html">Full dashboard</a></p>
      `,
    });
    logger.info("Weekly report sent");
  } catch (e) {
    logger.error("Weekly report failed", { error: e.message });
  }
}, { timezone: "America/Chicago" });

// ── Start ───────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  const channels = ["web",
    process.env.TELEGRAM_BOT_TOKEN ? "telegram" : null,
    process.env.TWILIO_ACCOUNT_SID ? "whatsapp+sms" : null,
  ].filter(Boolean).join(", ");

  logger.info(`HiDow Agent on http://localhost:${PORT} — Channels: ${channels}`);
  console.log(`\n   Test UI:        http://localhost:${PORT}/test.html`);
  console.log(`   Analytics:      http://localhost:${PORT}/analytics.html`);
  console.log(`   Conversations:  http://localhost:${PORT}/conversations.html\n`);
});
