/**
 * Cross-session user memory, keyed by email.
 * Stores: name, language, pain areas, products viewed, purchase history.
 * Files: data/user_memory/<sanitized_email>.json
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MEM_DIR = resolve(__dirname, "../../data/user_memory");
mkdirSync(MEM_DIR, { recursive: true });

function memPath(email) {
  const safe = email.toLowerCase().replace(/[^a-z0-9@._-]/g, "_");
  return resolve(MEM_DIR, `${safe}.json`);
}

export function getUserMemory(email) {
  if (!email) return null;
  const path = memPath(email);
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return null; }
}

export function saveUserMemory(email, updates) {
  if (!email) return;
  const path = memPath(email);
  const existing = getUserMemory(email) || {};
  const merged = {
    ...existing,
    ...updates,
    email,
    updatedAt: new Date().toISOString(),
    sessions: (existing.sessions || 0) + (updates.newSession ? 1 : 0),
    productsViewed: [...new Set([...(existing.productsViewed || []), ...(updates.productsViewed || [])])],
    purchaseHistory: [...(existing.purchaseHistory || []), ...(updates.purchase ? [updates.purchase] : [])],
  };
  delete merged.newSession;
  delete merged.productsViewed; // re-add deduplicated
  merged.productsViewed = [...new Set([...(existing.productsViewed || []), ...(updates.productsViewed || [])])];
  try { writeFileSync(path, JSON.stringify(merged, null, 2), "utf8"); } catch { /* non-fatal */ }
}

export function buildMemoryContext(email) {
  const mem = getUserMemory(email);
  if (!mem) return "";
  const parts = [];
  if (mem.name)                          parts.push(`User's name: ${mem.name}`);
  if (mem.language)                      parts.push(`Preferred language: ${mem.language}`);
  if (mem.painAreas?.length)             parts.push(`Known pain areas: ${mem.painAreas.join(", ")}`);
  if (mem.productsViewed?.length)        parts.push(`Previously interested in: ${mem.productsViewed.slice(-5).join(", ")}`);
  if (mem.purchaseHistory?.length) {
    const last = mem.purchaseHistory[mem.purchaseHistory.length - 1];
    parts.push(`Last purchase: ${last.items?.map(i => i.product_name).join(", ")} on ${last.date?.slice(0, 10)}`);
  }
  if (mem.sessions > 1)                  parts.push(`Returning customer (${mem.sessions} sessions)`);
  return parts.length ? `\n## RETURNING USER CONTEXT\n${parts.join("\n")}\n` : "";
}
