import OpenAI from "openai";
import https from "https";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { allProducts } from "./productSearch.js";
import { logger } from "./logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = resolve(__dirname, "../../data/product_embeddings.json");
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

let _client = null;
function getClient() {
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, httpAgent: httpsAgent });
  return _client;
}

let embeddingsCache = null;

function cosineSim(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; normA += a[i] ** 2; normB += b[i] ** 2; }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function embed(text) {
  const res = await getClient().embeddings.create({ model: "text-embedding-3-small", input: text });
  return res.data[0].embedding;
}

export async function loadEmbeddings() {
  if (embeddingsCache) return embeddingsCache;
  if (existsSync(CACHE_PATH)) {
    try {
      embeddingsCache = JSON.parse(readFileSync(CACHE_PATH, "utf8"));
      logger.info(`Loaded ${embeddingsCache.length} product embeddings from cache`);
      return embeddingsCache;
    } catch { /* regenerate */ }
  }
  return null;
}

export async function generateEmbeddings() {
  logger.info("Generating product embeddings...");
  const results = [];
  for (const p of allProducts) {
    const text = `${p.name} ${p.category} ${p.description || ""} ${(p.pain_areas || []).join(" ")}`;
    try {
      const vector = await embed(text);
      results.push({ id: p.id, vector });
    } catch (e) {
      logger.error(`Embedding failed for ${p.id}`, { error: e.message });
    }
  }
  writeFileSync(CACHE_PATH, JSON.stringify(results), "utf8");
  embeddingsCache = results;
  logger.info(`Generated ${results.length} product embeddings`);
  return results;
}

export async function semanticSearch(query, topN = 6) {
  const embeddings = await loadEmbeddings();
  if (!embeddings || !embeddings.length) return null; // fall back to keyword search

  try {
    const queryVec = await embed(query);
    const scored = embeddings.map(e => ({
      id: e.id,
      score: cosineSim(queryVec, e.vector),
    })).sort((a, b) => b.score - a.score).slice(0, topN);

    const productMap = Object.fromEntries(allProducts.map(p => [p.id, p]));
    return scored.map(s => productMap[s.id]).filter(Boolean);
  } catch (e) {
    logger.error("Semantic search failed", { error: e.message });
    return null;
  }
}
