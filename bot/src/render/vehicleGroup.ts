import { Markup } from "telegraf";

import { repository } from "../data/apiRepository.js";
import { booking } from "../session.js";
import { BotContext } from "../types.js";
import { buildBookingPath } from "./bookingPath.js";
import { safeEditOrReply } from "./safeEditOrReply.js";

export async function renderVehicleGroup(ctx: BotContext) {
  const draft = booking(ctx);
  if (!draft.serviceId) {
    return renderMissingState(ctx);
  }

  const groups = await repository.listVehicleGroupsForService(draft.serviceId);
  const buttons = groups.map((group) => [Markup.button.callback(group.title, `GROUP_${group.id}`)]);
  buttons.push([Markup.button.callback("Назад", "BACK")]);

  const path = await buildBookingPath(draft);
  return safeEditOrReply(ctx, `${path}Оберіть групу транспорту:`, Markup.inlineKeyboard(buttons));
}

function renderMissingState(ctx: BotContext) {
  return safeEditOrReply(
    ctx,
    "Спочатку потрібно обрати послугу.",
    Markup.inlineKeyboard([[Markup.button.callback("До послуг", "START_FLOW")]]),
  );
}
