import { Markup } from "telegraf";

import { BotContext } from "../types.js";

export function renderError(ctx: BotContext) {
  return ctx.reply(
    "Сталася помилка. Спробуйте почати запис спочатку.",
    Markup.inlineKeyboard([[Markup.button.callback("Почати спочатку", "START_OVER")]]),
  );
}
