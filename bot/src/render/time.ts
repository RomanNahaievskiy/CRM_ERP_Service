import { Markup } from "telegraf";

import { repository } from "../data/apiRepository.js";
import { pageItems } from "../dateSlots.js";
import { booking } from "../session.js";
import { BotContext } from "../types.js";
import { buildBookingPath } from "./bookingPath.js";
import { buildPageNavigationRow, chunkRows, renderConfig } from "./renderConfig.js";
import { safeEditOrReply } from "./safeEditOrReply.js";

export async function renderTime(ctx: BotContext) {
  const draft = booking(ctx);
  if (!draft.dateISO || !draft.offeringId) {
    return safeEditOrReply(
      ctx,
      "Спочатку потрібно обрати дату.",
      Markup.inlineKeyboard([[Markup.button.callback("Назад", "BACK")]]),
    );
  }

  const slots = await repository.listAvailableTimeSlots(
    draft.dateISO,
    draft.offeringId,
    draft.optionIds,
    draft.vehicleNumber,
    draft.billingMode,
  );
  const page = pageItems(slots, draft.timePage ?? 0, renderConfig.times.pageSize);
  draft.timePage = page.page;

  const rows = chunkRows(page.items, renderConfig.times.columns).map((row) =>
    row.map((slot) => Markup.button.callback(slot, `TIME_${slot}`)),
  );

  const navigationRow = buildPageNavigationRow(page, "TIME_PREV", "TIME_NEXT", "TIME_INFO", {
    prev: "Назад",
    next: "Далі",
  });
  if (navigationRow) {
    rows.push(
      navigationRow.map((button) => Markup.button.callback(button.text, button.action)),
    );
  }

  rows.push([Markup.button.callback("Повернутися", "BACK")]);

  const path = await buildBookingPath(draft);
  const message = slots.length > 0 ? "Оберіть час:" : "На цю дату вільних слотів немає.";
  return safeEditOrReply(ctx, `${path}${message}`, Markup.inlineKeyboard(rows));
}
