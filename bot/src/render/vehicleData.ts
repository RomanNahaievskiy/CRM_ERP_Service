import { Markup } from "telegraf";

import { booking } from "../session.js";
import { BotContext } from "../types.js";
import { buildBookingPath } from "./bookingPath.js";
import { safeEditOrReply } from "./safeEditOrReply.js";

export async function renderVehicleData(ctx: BotContext) {
  const path = await buildBookingPath(booking(ctx));
  return safeEditOrReply(
    ctx,
    `${path}Введіть державний номер транспорту.\n\nНаприклад: AA1234BB`,
    Markup.inlineKeyboard([[Markup.button.callback("Назад", "BACK")]]),
  );
}
