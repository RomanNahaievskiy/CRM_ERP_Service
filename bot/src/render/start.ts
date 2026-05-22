import { Markup } from "telegraf";

import { safeEditOrReply } from "./safeEditOrReply.js";
import { BotContext } from "../types.js";

export function renderStart(ctx: BotContext) {
  return safeEditOrReply(
    ctx,
    "Вітаємо у Wash.bot.\n\nНатисніть кнопку нижче, щоб створити запис.",
    Markup.inlineKeyboard([[Markup.button.callback("Записатися", "START_FLOW")]]),
  );
}
