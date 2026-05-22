import { Markup } from "telegraf";

import { booking } from "../session.js";
import { BotContext } from "../types.js";
import { buildBookingPath } from "./bookingPath.js";

export async function renderPhone(ctx: BotContext) {
  const path = await buildBookingPath(booking(ctx));
  return ctx.reply(
    `${path}Надішліть номер телефону текстом або кнопкою контакту.`,
    Markup.keyboard([
      [Markup.button.contactRequest("Надіслати контакт")],
      ["Назад"],
    ])
      .resize()
      .oneTime(),
  );
}
