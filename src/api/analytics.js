import { getAnalytics, buildSummary } from "../utils/analytics.js";

export function analyticsHandler(_req, res) {
  const events = getAnalytics();
  const summary = buildSummary(events);
  res.json({ summary, recentEvents: events.slice(-50).reverse() });
}
