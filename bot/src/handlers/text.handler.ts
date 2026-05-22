import { Markup } from "telegraf";

import { repository } from "../data/apiRepository.js";
import { logHandler } from "../logger.js";
import { renderConfirm } from "../render/confirm.js";
import { hideReplyKeyboard } from "../render/hideReplyKeyboard.js";
import { renderOptions } from "../render/options.js";
import { renderTime } from "../render/time.js";
import { renderVehicleGroup } from "../render/vehicleGroup.js";
import { booking } from "../session.js";
import { STEPS } from "../steps.js";
import { BotContext, PricingSummary } from "../types.js";

export async function textHandler(ctx: BotContext) {
  logHandler("textHandler", ctx);
  const draft = booking(ctx);
  if (!ctx.message || !("text" in ctx.message)) {
    return;
  }

  const text = ctx.message.text.trim();

  if (draft.step === STEPS.PHONE && text === "Назад") {
    draft.phone = undefined;
    draft.fullName = undefined;
    draft.step = STEPS.TIME;
    await hideReplyKeyboard(ctx);
    await renderTime(ctx);
    return;
  }

  if (draft.step === STEPS.VEHICLE_DATA) {
    draft.vehicleNumber = text.toUpperCase();
    draft.billingMode = undefined;
    draft.pricing = await repository.resolvePricing({
      serviceId: draft.serviceId,
      vehicleNumber: draft.vehicleNumber,
      billingMode: "auto",
      optionIds: [],
    });
    // Якщо транспорт знайдено в контрактах, далі працюємо з канонічним номером із БД.
    draft.vehicleNumber =
      draft.pricing.vehicle?.vehicleNumber ?? draft.vehicleNumber;

    if (draft.pricing.contractFound && draft.pricing.offeringId) {
      draft.billingMode = "contract";
      draft.offeringId = draft.pricing.offeringId ?? undefined;
      draft.vehicleTypeId = draft.pricing.vehicleTypeId ?? undefined;
      draft.vehicleGroupId = draft.pricing.vehicleGroupId ?? undefined;
      draft.step = STEPS.OPTIONS;
      await renderOptions(ctx);
      return;
    }

    if (
      draft.pricing.contractMatched &&
      draft.pricing.contractUnavailableReason
    ) {
      if (
        draft.pricing.contractUnavailableReason === "service_offering_not_found"
      ) {
        await ctx.reply(
          contractServiceUnavailableMessage(draft.pricing),
          Markup.inlineKeyboard([
            [Markup.button.callback("Обрати іншу послугу", "START_FLOW")],
            [Markup.button.callback("Ввести інший номер", "VEHICLE_REENTER")],
            [Markup.button.callback("Назад", "BACK")],
          ]),
        );
        return;
      }

      await ctx.reply(
        contractUnavailableMessage(draft.pricing.contractUnavailableReason),
      );
    }

    draft.step = STEPS.VEHICLE_GROUP;
    await renderVehicleGroup(ctx);
    return;
  }

  if (draft.step === STEPS.PHONE) {
    draft.phone = text;
    draft.fullName = [ctx.from?.first_name, ctx.from?.last_name]
      .filter(Boolean)
      .join(" ");
    draft.step = STEPS.CONFIRM;
    await hideReplyKeyboard(ctx);
    await renderConfirm(ctx);
    return;
  }

  await ctx.reply(
    "Скористайтеся кнопками для продовження.",
    Markup.inlineKeyboard([
      [Markup.button.callback("Почати запис", "START_FLOW")],
    ]),
  );
}

function contractServiceUnavailableMessage(pricing: PricingSummary) {
  const vehicleNumber = pricing.vehicle?.vehicleNumber ?? "цей номер";
  const vehicleType =
    pricing.vehicle?.vehicleTypeTitle ?? "визначений у договорі тип транспорту";

  return (
    `Номер ${vehicleNumber} відповідає типу транспорту: ${vehicleType}, ` +
    "тому вибрана послуга недоступна."
  );
}

function contractUnavailableMessage(reason: string) {
  const reasonText =
    reason === "vehicle_inactive"
      ? "транспорт у договорі зараз неактивний"
      : reason === "company_inactive"
        ? "компанія за договором зараз неактивна"
        : reason === "contract_not_started"
          ? "договір ще не почав діяти"
          : reason === "contract_expired"
            ? "строк дії договору завершився"
            : reason === "service_offering_not_found"
              ? "для цього транспорту не налаштовано вибрану послугу"
              : "договір зараз неактивний";

  return `Знайшли цей номер у контрактних даних, але ${reasonText}. Продовжимо як звичайне retail-бронювання.`;
}
