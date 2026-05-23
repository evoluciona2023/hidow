import { appendFileSync, existsSync, readFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../../data");
const LOG_FILE = resolve(DATA_DIR, "analytics.jsonl");

mkdirSync(DATA_DIR, { recursive: true });

export function trackEvent(event, data = {}) {
  const entry = { timestamp: new Date().toISOString(), event, ...data };
  try {
    appendFileSync(LOG_FILE, JSON.stringify(entry) + "\n", "utf8");
  } catch { /* non-fatal */ }
}

export function getAnalytics() {
  if (!existsSync(LOG_FILE)) return [];
  try {
    return readFileSync(LOG_FILE, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

export function buildSummary(events) {
  const summary = {
    total_conversations: new Set(),
    total_messages: 0,
    orders_completed: 0,
    handoffs_requested: 0,
    language: { en: 0, es: 0 },
    top_products: {},
    channel: { web: 0, telegram: 0 },
    by_day: {},
  };

  for (const e of events) {
    const day = e.timestamp.slice(0, 10);
    summary.by_day[day] = (summary.by_day[day] || 0) + 1;

    if (e.sessionId) summary.total_conversations.add(e.sessionId);
    if (e.channel) summary.channel[e.channel] = (summary.channel[e.channel] || 0) + 1;

    if (e.event === "message_sent") {
      summary.total_messages++;
      if (e.language) summary.language[e.language] = (summary.language[e.language] || 0) + 1;
    }
    if (e.event === "order_completed") summary.orders_completed++;
    if (e.event === "handoff_requested") summary.handoffs_requested++;
    if (e.event === "product_mentioned" && e.product) {
      summary.top_products[e.product] = (summary.top_products[e.product] || 0) + 1;
    }
  }

  summary.total_conversations = summary.total_conversations.size;

  // Sort top products
  summary.top_products = Object.entries(summary.top_products)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  return summary;
}
