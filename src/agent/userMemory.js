import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { query, hasDatabase } from "../db/database.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MEM_DIR = resolve(__dirname, "../../data/user_memory");
mkdirSync(MEM_DIR, { recursive: true });

function memPath(email) {
  const safe = email.toLowerCase().replace(/[^a-z0-9@._-]/g, "_");
  return resolve(MEM_DIR, `${safe}.json`);
}

function mergeMemory(existing, updates) {
  const merged = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
    sessions: (existing.sessions || 0) + (updates.newSession ? 1 : 0),
    productsViewed: [...new Set([...(existing.productsViewed || []), ...(updates.productsViewed || [])])],
    purchaseHistory: [...(existing.purchaseHistory || []), ...(updates.purchase ? [updates.purchase] : [])],
  };
  delete merged.newSession;
  delete merged.purchase;
  return merged;
}

// ── PostgreSQL ────────────────────────────────────────────────────
async function pgGet(email) {
  const res = await query("SELECT data FROM user_memory WHERE email = $1", [email]);
  return res.rows[0]?.data || null;
}

async function pgSave(email, updates) {
  const existing = await pgGet(email) || {};
  const merged = mergeMemory(existing, updates);
  await query(
    `INSERT INTO user_memory (email, data, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (email) DO UPDATE SET data = $2, updated_at = NOW()`,
    [email, JSON.stringify(merged)]
  );
}

// ── File fallback ─────────────────────────────────────────────────
function fileGet(email) {
  const path = memPath(email);
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return null; }
}

function fileSave(email, updates) {
  const existing = fileGet(email) || {};
  const merged = mergeMemory(existing, updates);
  try { writeFileSync(memPath(email), JSON.stringify(merged, null, 2), "utf8"); } catch { /* non-fatal */ }
}

// ── Public API ────────────────────────────────────────────────────
export async function getUserMemory(email) {
  if (!email) return null;
  if (hasDatabase()) return pgGet(email);
  return fileGet(email);
}

export async function saveUserMemory(email, updates) {
  if (!email) return;
  if (hasDatabase()) return pgSave(email, updates);
  fileSave(email, updates);
}

export async function buildMemoryContext(email) {
  const mem = await getUserMemory(email);
  if (!mem) return "";
  const parts = [];
  if (mem.name)                   parts.push(`User's name: ${mem.name}`);
  if (mem.language)               parts.push(`Preferred language: ${mem.language}`);
  if (mem.painAreas?.length)      parts.push(`Known pain areas: ${mem.painAreas.join(", ")}`);
  if (mem.productsViewed?.length) parts.push(`Previously interested in: ${mem.productsViewed.slice(-5).join(", ")}`);
  if (mem.purchaseHistory?.length) {
    const last = mem.purchaseHistory[mem.purchaseHistory.length - 1];
    parts.push(`Last purchase: ${last.items?.map(i => i.product_name).join(", ")} on ${last.date?.slice(0, 10)}`);
  }
  if (mem.sessions > 1) parts.push(`Returning customer (${mem.sessions} sessions)`);
  return parts.length ? `\n## RETURNING USER CONTEXT\n${parts.join("\n")}\n` : "";
}
