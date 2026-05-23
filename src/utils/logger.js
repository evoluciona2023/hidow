import winston from "winston";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { mkdirSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = resolve(__dirname, "../../logs");
mkdirSync(LOGS_DIR, { recursive: true });

const { combine, timestamp, printf, colorize, json } = winston.format;

const consoleFormat = printf(({ level, message, timestamp, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
  return `${timestamp} [${level}] ${message}${metaStr}`;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: combine(timestamp({ format: "HH:mm:ss" }), json()),
  transports: [
    new winston.transports.Console({
      format: combine(timestamp({ format: "HH:mm:ss" }), colorize(), consoleFormat),
    }),
    new winston.transports.File({
      filename: resolve(LOGS_DIR, "error.log"),
      level: "error",
    }),
    new winston.transports.File({
      filename: resolve(LOGS_DIR, "combined.log"),
      maxsize: 5 * 1024 * 1024, // 5 MB
      maxFiles: 3,
      tailable: true,
    }),
  ],
});
