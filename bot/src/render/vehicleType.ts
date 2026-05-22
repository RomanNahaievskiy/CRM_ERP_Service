import { Markup } from "telegraf";

import { repository } from "../data/apiRepository.js";
import { booking } from "../session.js";
import { BotContext } from "../types.js";
import { buildBookingPath } from "./bookingPath.js";
import { safeEditOrReply } from "./safeEditOrReply.js";

export async function renderVehicleType(ctx: BotContext) {
  const draft = booking(ctx);
  if (!draft.serviceId || !draft.vehicleGroupId) {
    return safeEditOrReply(
      ctx,
      "Спочатку потрібно обрати послугу і групу транспорту.",
      Markup.inlineKeyboard([[Markup.button.callback("Назад", "BACK")]]),
    );
  }

  const catalog = await repository.getCatalog();
  const offerings = await repository.listOfferingsForServiceAndGroup(
    draft.serviceId,
    draft.vehicleGroupId,
  );

  const buttons = offerings.map((offering) => {
    const vehicleType = catalog.vehicleTypes.find((item) => item.id === offering.vehicleTypeId);
    return [
      Markup.button.callback(
        `${vehicleType?.title ?? offering.vehicleTypeId} - ${offering.price} грн`,
        `OFFER_${offering.id}`,
      ),
    ];
  });
  buttons.push([Markup.button.callback("Назад", "BACK")]);

  const path = await buildBookingPath(draft);
  return safeEditOrReply(
    ctx,
    `${path}Оберіть тип транспорту:`,
    Markup.inlineKeyboard(buttons),
  );
}
