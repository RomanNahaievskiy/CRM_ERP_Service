import { Markup } from "telegraf";

import { repository } from "../data/apiRepository.js";
import { BotContext } from "../types.js";
import { safeEditOrReply } from "./safeEditOrReply.js";

export async function renderService(ctx: BotContext) {
  const services = await repository.listServices();
  const buttons = services.map((service) => [
    Markup.button.callback(service.title, `SERVICE_${service.id}`),
  ]);

  return safeEditOrReply(
    ctx,
    "Оберіть послугу:",
    Markup.inlineKeyboard(buttons),
  );
}

export async function sendService(ctx: BotContext) {
  const services = await repository.listServices();
  const buttons = services.map((service) => [
    Markup.button.callback(service.title, `SERVICE_${service.id}`),
  ]);

  return ctx.reply(
    "Оберіть послугу:",
    Markup.inlineKeyboard(buttons),
  );
}
