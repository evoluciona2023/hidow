/**
 * Adapts agent text to Telegram MarkdownV1 format.
 * Telegram supports: *bold*, _italic_, `code`, [text](url)
 * Does NOT support: ##headers, **double asterisk**, HTML tags
 */
export function formatForTelegram(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "*$1*")          // **bold** → *bold*
    .replace(/^#{1,3}\s+(.+)$/gm, "*$1*")        // ## Header → *Header*
    .replace(/<[^>]*>/g, "")                       // strip any HTML
    .trim();
}

const MAX_CHUNK = 4000; // Telegram limit is 4096

export function splitMessage(text) {
  if (text.length <= MAX_CHUNK) return [text];
  const chunks = [];
  let remaining = text;
  while (remaining.length > 0) {
    let cut = remaining.lastIndexOf("\n", MAX_CHUNK);
    if (cut <= 0) cut = MAX_CHUNK;
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).trim();
  }
  return chunks;
}
