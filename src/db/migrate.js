import { query, hasDatabase } from "./database.js";
import { logger } from "../utils/logger.js";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sessions (
  session_id VARCHAR(255) PRIMARY KEY,
  messages JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_memory (
  email VARCHAR(255) PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS discount_codes (
  code VARCHAR(50) PRIMARY KEY,
  discount_percent INTEGER NOT NULL,
  max_uses INTEGER DEFAULT NULL,
  used_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ DEFAULT NULL,
  active BOOLEAN DEFAULT TRUE
);

INSERT INTO discount_codes (code, discount_percent, max_uses) VALUES
  ('HIDOW10', 10, 100),
  ('WELCOME15', 15, 50),
  ('PAIN20', 20, 30)
ON CONFLICT (code) DO NOTHING;
`;

export async function runMigrations() {
  if (!hasDatabase()) {
    logger.info("No DATABASE_URL — using file-based storage");
    return;
  }
  try {
    await query(SCHEMA);
    logger.info("Database migrations complete");
  } catch (err) {
    logger.error("Migration failed", { error: err.message });
    throw err;
  }
}
