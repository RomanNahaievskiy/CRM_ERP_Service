import { Markup } from "telegraf";

import { formatPhoneForDisplay } from "../phoneDisplay.js";
import { formatTotalPrice } from "../priceDisplay.js";
import { calculatePricing } from "../pricing.js";
import { booking } from "../session.js";
import { BotContext } from "../types.js";
import { buildBookingPath } from "./bookingPath.js";
import { safeEditOrReply } from "./safeEditOrReply.js";

export async function renderConfirm(ctx: BotContext) {
  const draft = booking(ctx);

  if (!draft.offeringId) {
    return safeEditOrReply(ctx, "Запис неповний. Почніть спочатку.");
  }

  const summary = await calculatePricing(
    draft.offeringId,
    draft.optionIds,
    draft.vehicleNumber,
    draft.billingMode,
  );
  draft.pricing = summary;
  const path = await buildBookingPath(draft, "Дані запису:");

  return safeEditOrReply(
    ctx,
    `Перевірте дані:\n\n${path}` +
      `Телефон: ${formatPhoneForDisplay(draft.phone)}\n` +
      `${summary.billingMode === "contract" ? "Режим: договір\n" : ""}` +
      `Вартість: ${formatTotalPrice(summary)}\n` +
      `Тривалість: ${summary.totalDurationMinutes} хв`,
    Markup.inlineKeyboard([
      [Markup.button.callback("Підтвердити", "CONFIRM")],
      [Markup.button.callback("Назад", "BACK")],
      [Markup.button.callback("Почати спочатку", "START_OVER")],
    ]),
  );
}
