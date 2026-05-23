# HiDow Agent — Deployment Guide

## Prerequisites
- Node.js 20+
- A Gmail account with an App Password enabled
- An OpenAI API key (gpt-4o access)
- (Optional) Telegram Bot Token, Twilio credentials

---

## 1. Local Development

```bash
# Install dependencies
npm install

# Build the widget
cd widget && npm install && npm run build && cd ..

# Start the server
node server.js
```

Open http://localhost:3001/test.html — the widget and test UI load from the built files.

---

## 2. Docker

```bash
# Build
docker build -t hidow-agent .

# Run (reads .env automatically via --env-file)
docker run -p 3001:3001 --env-file .env \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  hidow-agent
```

Or with Compose:

```bash
docker compose up -d
```

**Note:** The weekly scraper (`scripts/scrape.js`) requires Google Chrome. It will be skipped in Docker unless you install Chrome in the image. The data directory is mounted as a volume so scraped data persists across restarts.

---

## 3. Railway (recommended for production)

1. Push this repo to GitHub.
2. Create a new Railway project → "Deploy from GitHub repo".
3. Set all environment variables from `.env` in the Railway dashboard under **Variables**.
4. Railway auto-detects `railway.json` and deploys with `node server.js`.
5. The service URL will be something like `https://hidow-agent-production.up.railway.app`.

### Register Telegram Webhook (after deploy)

Replace `<TOKEN>` and `<URL>` with your values:

```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<URL>/telegram/webhook
```

Verify:

```
https://api.telegram.org/bot<TOKEN>/getWebhookInfo
```

---

## 4. Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | ✅ | OpenAI API key with gpt-4o access |
| `SMTP_USER` | ✅ | Gmail address |
| `SMTP_PASS` | ✅ | Gmail App Password (16-char, no spaces) |
| `SMTP_FROM` | ✅ | From address (same as SMTP_USER) |
| `ORDERS_BCC_EMAIL` | — | BCC address for all order emails |
| `TELEGRAM_BOT_TOKEN` | — | From @BotFather — omit to disable Telegram |
| `TWILIO_ACCOUNT_SID` | — | Twilio Account SID — omit to disable WhatsApp |
| `TWILIO_AUTH_TOKEN` | — | Twilio Auth Token |
| `TWILIO_WHATSAPP_FROM` | — | `whatsapp:+14155238886` (Sandbox) or your number |
| `CRM_WEBHOOK_URL` | — | POST endpoint for order notifications |
| `ALLOWED_ORIGINS` | — | Comma-separated CORS origins |
| `PORT` | — | Default: 3001 |
| `NODE_ENV` | — | `production` enables Telegram webhook mode |

---

## 5. Weekly Price Sync

The scraper runs automatically every Monday at 3:00 AM (America/Chicago) via the built-in cron job.

To run manually:

```bash
node scripts/scrape.js
```

Requires Chrome at `C:\Program Files\Google\Chrome\Application\chrome.exe` (Windows) or adjust the `CHROME_PATH` in the script for Linux/Mac.

---

## 6. Analytics Dashboard

Available at `/analytics.html` — auto-refreshes every 30 seconds.

API endpoint: `GET /api/analytics`
