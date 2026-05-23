export function healthHandler(_req, res) {
  res.json({
    status: "ok",
    channels: ["web", process.env.TELEGRAM_BOT_TOKEN ? "telegram" : null].filter(Boolean),
    timestamp: new Date().toISOString(),
  });
}
