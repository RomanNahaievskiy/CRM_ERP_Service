import { Markup } from "telegraf";

import { BotContext } from "../types.js";

// Telegram прибирає reply keyboard тільки через нове повідомлення з removeKeyboard.
export async function hideReplyKeyboard(ctx: BotContext) {
  try {
    const sentMessage = await ctx.reply("\u2063", Markup.removeKeyboard());
    await ctx.telegram.deleteMessage(sentMessage.chat.id, sentMessage.message_id).catch(() => undefined);
  } catch {
    // Якщо Telegram не дозволить сховати або видалити службове повідомлення, FSM не зупиняємо.
  }
}
