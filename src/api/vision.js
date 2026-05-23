import OpenAI from "openai";
import https from "https";
import { allProducts } from "../utils/productSearch.js";
import { logger } from "../utils/logger.js";

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
let _client = null;
function getClient() {
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, httpAgent: httpsAgent });
  return _client;
}

export async function visionHandler(req, res) {
  const { imageBase64, mimeType = "image/jpeg", sessionId } = req.body;
  if (!imageBase64) return res.status(400).json({ error: "No image provided" });

  try {
    const response = await getClient().chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "user",
        content: [
          {
            type: "text",
            text: `You are a HiDow TENS/EMS therapy expert. Analyze this image and identify:
1. What body part or area of pain is visible
2. What type of pain or condition it might indicate
3. Which HiDow products would be most beneficial

Available products: ${allProducts.slice(0, 15).map(p => `${p.name} (${p.priceDisplay}) - ${p.category}`).join(", ")}

Respond in 2-3 sentences. Be specific about which HiDow product to recommend and why.`
          },
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${imageBase64}` }
          }
        ]
      }],
      max_tokens: 200,
    });

    const recommendation = response.choices[0].message.content;
    logger.info("Vision analysis complete", { sessionId });
    res.json({ recommendation });
  } catch (e) {
    logger.error("Vision error", { error: e.message });
    res.status(500).json({ error: "Could not analyze image" });
  }
}
