/**
 * Lightweight keyword-based product retrieval (RAG).
 * Scores each product against the user's query and conversation history,
 * returns the top N most relevant ones.
 *
 * No embeddings or external APIs needed — fast, free, deterministic.
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const { products } = JSON.parse(
  readFileSync(resolve(__dirname, "../../data/products.json"), "utf8")
);

// Keyword → categories/products that should score higher
const INTENT_MAP = {
  // Pain areas
  back:         ["wireless", "wired"],
  espalda:      ["wireless", "wired"],
  neck:         ["wireless", "wired", "wraps"],
  cuello:       ["wireless", "wired", "wraps"],
  shoulder:     ["wireless", "wired"],
  hombro:       ["wireless", "wired"],
  knee:         ["wired", "wraps"],
  rodilla:      ["wired", "wraps"],
  hand:         ["wraps"],
  mano:         ["wraps"],
  wrist:        ["wraps"],
  muñeca:       ["wraps"],
  elbow:        ["wraps"],
  codo:         ["wraps"],
  foot:         ["wraps"],
  pie:          ["wraps"],
  eye:          ["vibration"],
  ojo:          ["vibration"],
  head:         ["heat"],
  cabeza:       ["heat"],
  muscle:       ["wireless", "wired", "percussion"],
  músculo:      ["wireless", "wired", "percussion"],

  // Technology keywords
  wireless:     ["wireless"],
  inalámbrico:  ["wireless"],
  wired:        ["wired"],
  cable:        ["wired"],
  massage:      ["percussion", "vibration"],
  masaje:       ["percussion", "vibration"],
  compression:  ["percussion"],
  "red light":  ["heat"],
  "luz roja":   ["heat"],
  heat:         ["heat"],
  calor:        ["heat"],

  // Use case
  sport:        ["wireless", "percussion"],
  deporte:      ["wireless", "percussion"],
  recover:      ["percussion", "wireless"],
  recuper:      ["percussion", "wireless"],
  sleep:        ["vibration", "heat"],
  dormir:       ["vibration", "heat"],
  arthritis:    ["wired", "wraps"],
  artritis:     ["wired", "wraps"],
  fibro:        ["wired", "wireless"],
  sciatica:     ["wired", "wireless"],
  ciática:      ["wired", "wireless"],

  // Price signals
  cheap:        ["accessories", "pads"],
  barato:       ["accessories", "pads"],
  affordable:   ["accessories", "pads"],
  económico:    ["accessories", "pads"],
  best:         ["wireless"],
  mejor:        ["wireless"],
  professional: ["wireless", "wired"],
  profesional:  ["wireless", "wired"],

  // Specific product names (partial)
  spot:         ["hidow-spot"],
  "pro touch":  ["pro-touch-6-12"],
  "4-9":        ["wireless-4-9"],
  "xp micro":   ["xp-micro"],
  "xpd":        ["xpd-12", "xpds-18", "xpds-4-24"],
  ocuwave:      ["ocuwave"],
  "massage gun":["hd-mini2", "m3-mini3"],
  conductor:    ["perfect-conductor"],
  gloves:       ["acugloves"],
  guantes:      ["acugloves"],
  slippers:     ["acuslippers"],
  zapatillas:   ["acuslippers"],
};

/**
 * Score a product against a query string.
 * Returns a number 0-100.
 */
function scoreProduct(product, queryLower) {
  let score = 0;

  // Direct name match (highest weight)
  if (queryLower.includes(product.name.toLowerCase())) score += 50;
  if (queryLower.includes(product.id)) score += 40;

  // Description keyword match
  const descWords = (product.description || "").toLowerCase();
  const nameWords = product.name.toLowerCase();

  // Check intent map matches
  for (const [keyword, targets] of Object.entries(INTENT_MAP)) {
    if (!queryLower.includes(keyword)) continue;

    for (const target of targets) {
      // Target is a category
      if (product.category === target) {
        score += 15;
      }
      // Target is a product id
      if (product.id === target) {
        score += 30;
      }
    }
  }

  // Pain area overlap
  for (const area of product.pain_areas || []) {
    if (queryLower.includes(area)) score += 10;
  }

  // Description overlap with query words
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 3);
  for (const word of queryWords) {
    if (descWords.includes(word)) score += 3;
    if (nameWords.includes(word)) score += 5;
  }

  // Boost best-sellers when query is generic
  if (product.badge === "best-seller" && queryLower.length < 40) score += 5;

  return score;
}

/**
 * Returns the most relevant products for a given query.
 * Falls back to top products by category variety if no strong match.
 *
 * @param {string} query         User's message (and recent history)
 * @param {number} topN          Max products to return (default 6)
 * @returns {object[]}           Subset of products array
 */
export function findRelevantProducts(query, topN = 6) {
  const q = query.toLowerCase();

  const scored = products.map(p => ({ product: p, score: scoreProduct(p, q) }));
  scored.sort((a, b) => b.score - a.score);

  const top = scored.slice(0, topN).map(s => s.product);

  // If nothing scored meaningfully, return a curated default set
  const hasSignal = scored[0].score > 10;
  if (!hasSignal) {
    return products.filter(p =>
      ["pro-touch-6-12", "wireless-4-9", "hidow-spot", "xp-micro", "perfect-conductor", "acugloves"].includes(p.id)
    );
  }

  return top;
}

/**
 * Build a compact summary of a product for use in the prompt.
 * Much shorter than the full JSON — saves ~70% of tokens.
 */
export function formatProductForPrompt(p) {
  const parts = [
    `**${p.name}** — ${p.priceDisplay} USD`,
    `Category: ${p.categoryLabel}`,
  ];
  if (p.description) parts.push(`Description: ${p.description}`);
  if (p.badge) parts.push(`Badge: ${p.badge}`);
  if (p.pain_areas?.length) parts.push(`Best for: ${p.pain_areas.join(", ")}`);
  parts.push(`URL: ${p.url}`);
  return parts.join("\n");
}

export { products as allProducts };
