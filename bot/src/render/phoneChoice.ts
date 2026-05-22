import { Markup } from "telegraf";

import { repository } from "../data/apiRepository.js";
import { formatPhoneForDisplay } from "../phoneDisplay.js";
import { booking } from "../session.js";
import { STEPS } from "../steps.js";
import { BotContext } from "../types.js";
import { buildBookingPath } from "./bookingPath.js";
import { renderPhone } from "./phone.js";
import { safeEditOrReply } from "./safeEditOrReply.js";

export async function renderPhoneChoice(ctx: BotContext) {
  const draft = booking(ctx);
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) {
    draft.step = STEPS.PHONE;
    return renderPhone(ctx);
  }

  const contact = await repository.getClientContactByTelegram(telegramUserId);
  if (!contact.found || !contact.phone) {
    draft.savedPhone = undefined;
    draft.step = STEPS.PHONE;
    return renderPhone(ctx);
  }

  draft.savedPhone = contact.phone;
  const path = await buildBookingPath(draft);

  return safeEditOrReply(
    ctx,
    `${path}У нас вже є ваш номер: ${formatPhoneForDisplay(contact.phone)}\n\nВикористати його для запису?`,
    Markup.inlineKeyboard([
      [Markup.button.callback("Використати цей номер", "PHONE_USE_SAVED")],
      [Markup.button.callback("Ввести інший", "PHONE_ENTER_OTHER")],
      [Markup.button.callback("Назад", "BACK")],
    ]),
  );
}
