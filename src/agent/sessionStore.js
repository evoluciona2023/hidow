import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { query, hasDatabase } from "../db/database.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SESSIONS_DIR = resolve(__dirname, "../../data/sessions");
const MAX_MESSAGES = 30;
const TTL_MS = 24 * 60 * 60 * 1000;

mkdirSync(SESSIONS_DIR, { recursive: true });

function safeId(id) { return id.replace(/[^a-zA-Z0-9_-]/g, "_"); }
function sessionPath(id) { return resolve(SESSIONS_DIR, `${safeId(id)}.json`); }

// ── PostgreSQL implementation ─────────────────────────────────────
async function pgGetHistory(sessionId) {
  const res = await query(
    "SELECT messages FROM sessions WHERE session_id = $1 AND updated_at > NOW() - INTERVAL '24 hours'",
    [sessionId]
  );
  return res.rows[0]?.messages || [];
}

async function pgSaveHistory(sessionId, messages) {
  const trimmed = messages.slice(-MAX_MESSAGES);
  await query(
    `INSERT INTO sessions (session_id, messages, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (session_id) DO UPDATE SET messages = $2, updated_at = NOW()`,
    [sessionId, JSON.stringify(trimmed)]
  );
}

async function pgGetAllActive() {
  const res = await query(
    `SELECT session_id, messages, updated_at FROM sessions
     WHERE updated_at > NOW() - INTERVAL '1 hour'
     ORDER BY updated_at DESC LIMIT 50`
  );
  return res.rows;
}

// ── File-based fallback ───────────────────────────────────────────
function fileGetHistory(sessionId) {
  const path = sessionPath(sessionId);
  if (!existsSync(path)) return [];
  try {
    const raw = JSON.parse(readFileSync(path, "utf8"));
    if (Date.now() - raw.updatedAt > TTL_MS) { unlinkSync(path); return []; }
    return raw.messages || [];
  } catch { return []; }
}

function fileSaveHistory(sessionId, messages) {
  const trimmed = messages.slice(-MAX_MESSAGES);
  try {
    writeFileSync(sessionPath(sessionId), JSON.stringify({ sessionId, messages: trimmed, updatedAt: Date.now() }), "utf8");
  } catch (e) { console.error("Session save error:", e.message); }
}

// ── Public API ────────────────────────────────────────────────────
export async function getHistory(sessionId) {
  if (hasDatabase()) return pgGetHistory(sessionId);
  return fileGetHistory(sessionId);
}

export async function saveHistory(sessionId, messages) {
  if (hasDatabase()) return pgSaveHistory(sessionId, messages);
  fileSaveHistory(sessionId, messages);
}

export async function getActiveSessions() {
  if (hasDatabase()) return pgGetAllActive();
  // File fallback: read all recent sessions
  const results = [];
  try {
    for (const file of readdirSync(SESSIONS_DIR)) {
      if (!file.endsWith(".json")) continue;
      try {
        const raw = JSON.parse(readFileSync(resolve(SESSIONS_DIR, file), "utf8"));
        if (Date.now() - raw.updatedAt < 60 * 60 * 1000) {
          results.push({ session_id: raw.sessionId, messages: raw.messages, updated_at: new Date(raw.updatedAt) });
        }
      } catch { /* skip */ }
    }
  } catch { /* ignore */ }
  return results.sort((a, b) => b.updated_at - a.updated_at).slice(0, 50);
}

export function clearSession(sessionId) {
  if (hasDatabase()) {
    query("DELETE FROM sessions WHERE session_id = $1", [sessionId]).catch(() => {});
    return;
  }
  const path = sessionPath(sessionId);
  if (existsSync(path)) try { unlinkSync(path); } catch { /* ignore */ }
}

export function purgeExpiredSessions() {
  if (hasDatabase()) {
    query("DELETE FROM sessions WHERE updated_at < NOW() - INTERVAL '24 hours'").catch(() => {});
    return 0;
  }
  let purged = 0;
  try {
    for (const file of readdirSync(SESSIONS_DIR)) {
      if (!file.endsWith(".json")) continue;
      const path = resolve(SESSIONS_DIR, file);
      try {
        const raw = JSON.parse(readFileSync(path, "utf8"));
        if (Date.now() - raw.updatedAt > TTL_MS) { unlinkSync(path); purged++; }
      } catch { unlinkSync(path); purged++; }
    }
  } catch { /* ignore */ }
  return purged;
}
