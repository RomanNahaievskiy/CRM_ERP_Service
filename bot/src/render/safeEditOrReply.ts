import { Markup } from "telegraf";

import { BotContext } from "../types.js";

type InlineKeyboard = ReturnType<typeof Markup.inlineKeyboard>;

export async function safeEditOrReply(
  ctx: BotContext,
  text: string,
  keyboard?: InlineKeyboard,
) {
  try {
    await ctx.editMessageText(text, keyboard);
  } catch {
    await ctx.reply(text, keyboard);
  }
}
