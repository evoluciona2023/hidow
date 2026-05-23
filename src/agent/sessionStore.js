/**
 * File-based session store. Drop-in replacement for in-memory Map.
 * Each session = one JSON file in data/sessions/<sessionId>.json
 * TTL: 24 hours. Stale files are cleaned up on access.
 *
 * Production upgrade: swap the read/write functions with Redis calls —
 * the interface (getHistory / saveHistory / clearSession) stays identical.
 */
import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync, readdirSync, statSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SESSIONS_DIR = resolve(__dirname, "../../data/sessions");
const MAX_MESSAGES = 30;
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

mkdirSync(SESSIONS_DIR, { recursive: true });

function sessionPath(id) {
  // Sanitize ID to prevent path traversal
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, "_");
  return resolve(SESSIONS_DIR, `${safe}.json`);
}

function readSession(id) {
  const path = sessionPath(id);
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8"));
    // Expire stale sessions
    if (Date.now() - raw.updatedAt > TTL_MS) {
      unlinkSync(path);
      return null;
    }
    return raw;
  } catch {
    return null;
  }
}

export function getHistory(sessionId) {
  return readSession(sessionId)?.messages || [];
}

export function saveHistory(sessionId, messages) {
  const trimmed = messages.slice(-MAX_MESSAGES);
  const data = { sessionId, messages: trimmed, updatedAt: Date.now() };
  try {
    writeFileSync(sessionPath(sessionId), JSON.stringify(data), "utf8");
  } catch (e) {
    console.error("Session save error:", e.message);
  }
}

export function clearSession(sessionId) {
  const path = sessionPath(sessionId);
  if (existsSync(path)) {
    try { unlinkSync(path); } catch { /* ignore */ }
  }
}

export function getSessionMeta(sessionId) {
  const session = readSession(sessionId);
  if (!session) return null;
  return {
    sessionId,
    messageCount: session.messages.length,
    updatedAt: new Date(session.updatedAt).toISOString(),
    expiresAt: new Date(session.updatedAt + TTL_MS).toISOString(),
  };
}

// Purge all sessions older than TTL — call periodically if needed
export function purgeExpiredSessions() {
  let purged = 0;
  try {
    for (const file of readdirSync(SESSIONS_DIR)) {
      if (!file.endsWith(".json")) continue;
      const path = resolve(SESSIONS_DIR, file);
      try {
        const raw = JSON.parse(readFileSync(path, "utf8"));
        if (Date.now() - raw.updatedAt > TTL_MS) {
          unlinkSync(path);
          purged++;
        }
      } catch {
        unlinkSync(path); // corrupt file, delete it
        purged++;
      }
    }
  } catch { /* ignore */ }
  return purged;
}
