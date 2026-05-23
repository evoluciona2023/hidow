import { query, hasDatabase } from "../db/database.js";
import { getAnalytics, buildSummary } from "../utils/analytics.js";
import { logger } from "../utils/logger.js";

function requireAdmin(req, res) {
  const token = req.headers["x-admin-token"];
  const expected = process.env.ADMIN_PASSWORD || "hidow-admin-2025";
  if (token !== expected) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

export async function adminSummaryHandler(req, res) {
  if (!requireAdmin(req, res)) return;
  try {
    const events = await getAnalytics(30);
    const summary = buildSummary(events);

    let orders = [], discountCodes = [];
    if (hasDatabase()) {
      const oRes = await query("SELECT * FROM orders ORDER BY created_at DESC LIMIT 50");
      orders = oRes.rows;
      const dRes = await query("SELECT * FROM discount_codes ORDER BY code");
      discountCodes = dRes.rows;
    }

    res.json({ summary, orders, discountCodes });
  } catch (e) {
    logger.error("Admin summary error", { error: e.message });
    res.status(500).json({ error: e.message });
  }
}

export async function adminOrdersHandler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (!hasDatabase()) return res.json({ orders: [] });
  try {
    const result = await query("SELECT * FROM orders ORDER BY created_at DESC LIMIT 100");
    res.json({ orders: result.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

export async function adminDiscountHandler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (!hasDatabase()) return res.json({ ok: false, error: "No database" });
  const { action, code, discount_percent, max_uses } = req.body;
  try {
    if (action === "create") {
      await query(
        "INSERT INTO discount_codes (code, discount_percent, max_uses) VALUES (UPPER($1), $2, $3) ON CONFLICT (code) DO UPDATE SET discount_percent=$2, max_uses=$3, active=TRUE",
        [code, discount_percent, max_uses || null]
      );
    } else if (action === "deactivate") {
      await query("UPDATE discount_codes SET active=FALSE WHERE code=UPPER($1)", [code]);
    } else if (action === "activate") {
      await query("UPDATE discount_codes SET active=TRUE WHERE code=UPPER($1)", [code]);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

export async function adminCsvHandler(req, res) {
  if (!requireAdmin(req, res)) return;
  try {
    const events = await getAnalytics(30);
    const header = "timestamp,event,sessionId,channel,language,product,orderRef\n";
    const rows = events.map(e =>
      [e.timestamp, e.event, e.sessionId || "", e.channel || "", e.language || "", e.product || "", e.orderRef || ""]
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    ).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="hidow-analytics-${new Date().toISOString().slice(0,10)}.csv"`);
    res.send(header + rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

export async function orderStatusHandler(req, res) {
  const { orderRef } = req.params;
  if (!hasDatabase()) return res.json({ status: "confirmed", message: "Order received. A HiDow representative will contact you." });
  try {
    const result = await query("SELECT * FROM orders WHERE order_ref = $1", [orderRef.toUpperCase()]);
    if (!result.rows[0]) return res.status(404).json({ error: "Order not found" });
    const order = result.rows[0];
    res.json({
      orderRef: order.order_ref,
      status: order.status,
      customerName: order.customer_name,
      items: order.order_items,
      total: order.order_total,
      createdAt: order.created_at,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
