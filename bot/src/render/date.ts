import { Markup } from "telegraf";

import { formatDate, nextDates, pageItems } from "../dateSlots.js";
import { booking } from "../session.js";
import { BotContext } from "../types.js";
import { buildBookingPath } from "./bookingPath.js";
import { buildPageNavigationRow, chunkRows, renderConfig } from "./renderConfig.js";
import { safeEditOrReply } from "./safeEditOrReply.js";

export async function renderDate(ctx: BotContext) {
  const draft = booking(ctx);
  const page = pageItems(
    nextDates(renderConfig.dates.lookaheadDays),
    draft.datePage ?? 0,
    renderConfig.dates.pageSize,
  );
  draft.datePage = page.page;

  const buttons = chunkRows(page.items, renderConfig.dates.columns).map((row) =>
    row.map((dateISO) => Markup.button.callback(formatDate(dateISO), `DATE_${dateISO}`)),
  );

  const navigationRow = buildPageNavigationRow(page, "DATE_PREV", "DATE_NEXT", "DATE_INFO", {
    prev: "Назад",
    next: "Далі",
  });
  if (navigationRow) {
    buttons.push(
      navigationRow.map((button) => Markup.button.callback(button.text, button.action)),
    );
  }

  buttons.push([Markup.button.callback("Повернутися", "BACK")]);

  const path = await buildBookingPath(draft);
  return safeEditOrReply(ctx, `${path}Оберіть дату:`, Markup.inlineKeyboard(buttons));
}
