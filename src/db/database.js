import pg from "pg";
import { logger } from "../utils/logger.js";

const { Pool } = pg;

let pool = null;

export function getPool() {
  if (!pool && process.env.DATABASE_URL) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
    });
    pool.on("error", (err) => logger.error("PG pool error", { error: err.message }));
    logger.info("PostgreSQL pool initialized");
  }
  return pool;
}

export function hasDatabase() {
  return !!process.env.DATABASE_URL;
}

export async function query(sql, params = []) {
  const p = getPool();
  if (!p) throw new Error("No DATABASE_URL configured");
  const client = await p.connect();
  try {
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}
