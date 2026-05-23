import { bot } from "./bot.js";
import { runAgent } from "../agent/agentRunner.js";
import { formatForTelegram, splitMessage } from "./telegramFormatter.js";
import { clearSession } from "../agent/sessionStore.js";

const WELCOME = `👋 Welcome to *HiDow International*!

I'm your personal wellness assistant. I can help you with:
• Questions about TENS/EMS technology
• Product information & pricing
• Placing an order

🇪🇸 También hablo español. ¡Escríbeme en tu idioma!

How can I help you today?`;

const HELP = `Here's what I can help you with:

💡 *Ask me anything*, like:
• "What is TENS?"
• "Show me wireless devices"
• "I have back pain — what do you recommend?"
• "I want to buy the Pro Touch 6-12"

📞 Need human support? Call (314) 569-2888`;

export function registerTelegramHandlers() {
  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text) return;

    if (text === "/start") {
      await bot.sendMessage(chatId, WELCOME, { parse_mode: "Markdown" });
      return;
    }

    if (text === "/help") {
      await bot.sendMessage(chatId, HELP, { parse_mode: "Markdown" });
      return;
    }

    if (text === "/reset") {
      clearSession(chatId.toString());
      await bot.sendMessage(chatId, "🔄 Session cleared! Starting fresh. How can I help you?");
      return;
    }

    await bot.sendChatAction(chatId, "typing");

    try {
      const { reply } = await runAgent(chatId.toString(), text, "telegram");
      const formatted = formatForTelegram(reply);
      const chunks = splitMessage(formatted);

      for (const chunk of chunks) {
        await bot.sendMessage(chatId, chunk, { parse_mode: "Markdown" });
      }
    } catch (error) {
      console.error(`Telegram agent error [${chatId}]:`, error.message);
      await bot.sendMessage(
        chatId,
        "⚠️ Sorry, I'm having trouble right now. Please try again or call (314) 569-2888."
      );
    }
  });

  bot.on("polling_error", (error) => {
    console.error("Telegram polling error:", error.message);
  });

  console.log("✅ Telegram message handlers registered");
}
