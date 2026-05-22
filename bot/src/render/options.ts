import { Markup } from "telegraf";

import { repository } from "../data/apiRepository.js";
import { formatOptionTerms, formatTotalPrice } from "../priceDisplay.js";
import { calculatePricing } from "../pricing.js";
import { booking } from "../session.js";
import { BotContext } from "../types.js";
import { buildBookingPath } from "./bookingPath.js";
import { safeEditOrReply } from "./safeEditOrReply.js";

export async function renderOptions(ctx: BotContext) {
  const draft = booking(ctx);
  if (!draft.offeringId) {
    return safeEditOrReply(
      ctx,
      "Спочатку потрібно обрати тип транспорту.",
      Markup.inlineKeyboard([[Markup.button.callback("Назад", "BACK")]]),
    );
  }

  const options = await repository.listOptionsForOffering(draft.offeringId);
  const summary = await calculatePricing(
    draft.offeringId,
    draft.optionIds,
    draft.vehicleNumber,
    draft.billingMode,
  );
  draft.pricing = summary;
  const path = await buildBookingPath(draft);

  const buttons = options.map((option) => {
    const selected = draft.optionIds.includes(option.id);
    const marker = selected ? "[x]" : "[ ]";
    const optionTerms = summary.optionItems?.find((item) => item.id === option.id);
    const price = optionTerms?.price ?? option.price;
    const duration = optionTerms?.extraDurationMinutes ?? option.extraDurationMinutes;
    const terms = formatOptionTerms(summary.billingMode, price, duration);

    return [
      Markup.button.callback(
        `${marker} ${option.title} (${terms})`,
        `OPT_TOGGLE_${option.id}`,
      ),
    ];
  });

  buttons.push([
    Markup.button.callback("Назад", "BACK"),
    Markup.button.callback("Продовжити", "OPT_DONE"),
  ]);

  return safeEditOrReply(
    ctx,
    `${path}${options.length > 0 ? "Додаткові опції:" : "Додаткових опцій для цієї послуги немає."}\n\n` +
      `${summary.billingMode === "contract" ? "Режим: договір\n" : ""}` +
      `Поточна вартість: ${formatTotalPrice(summary)}\n` +
      `Тривалість: ${summary.totalDurationMinutes} хв`,
    Markup.inlineKeyboard(buttons),
  );
}
