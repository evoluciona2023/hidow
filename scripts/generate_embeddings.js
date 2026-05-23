#!/usr/bin/env node
/**
 * Run once to pre-generate product embeddings for semantic search.
 * Usage: node scripts/generate_embeddings.js
 * Requires: OPENAI_API_KEY env var
 */
import "dotenv/config";
import { generateEmbeddings } from "../src/utils/embeddings.js";

console.log("Generating product embeddings...");
console.log("Requires OPENAI_API_KEY to be set.\n");

if (!process.env.OPENAI_API_KEY) {
  console.error("ERROR: OPENAI_API_KEY is not set.");
  process.exit(1);
}

try {
  const results = await generateEmbeddings();
  console.log(`\n✅ Done — ${results.length} product embeddings saved to data/product_embeddings.json`);
  console.log("Semantic search is now active.");
} catch (e) {
  console.error("Failed to generate embeddings:", e.message);
  process.exit(1);
}
