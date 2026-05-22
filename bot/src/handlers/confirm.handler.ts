import { randomUUID } from "node:crypto";

import { repository } from "../data/apiRepository.js";
import { toStartDate } from "../dateSlots.js";
import { logHandler } from "../logger.js";
import { addMinutes, calculatePricing } from "../pricing.js";
import { renderDone } from "../render/done.js";
import { renderPhone } from "../render/phone.js";
import { renderTime } from "../render/time.js";
import { booking } from "../session.js";
import { STEPS } from "../steps.js";
import { BotContext } from "../types.js";

export async function confirmHandler(ctx: BotContext) {
  logHandler("confirmHandler", ctx);
  const draft = booking(ctx);
  if (!draft.offeringId || !draft.dateISO || !draft.timeHHMM || !draft.phone) {
    await ctx.answerCbQuery("Запис неповний");
    return;
  }

  const pricing = await calculatePricing(
    draft.offeringId,
    draft.optionIds,
    draft.vehicleNumber,
    draft.billingMode,
  );
  draft.pricing = pricing;
  const startsAt = toStartDate(draft.dateISO, draft.timeHHMM);
  const endsAt = addMinutes(startsAt, pricing.totalDurationMinutes);
  draft.bookingRequestId = draft.bookingRequestId ?? randomUUID();
  let result;
  try {
    result = await repository.createBooking({
      idempotencyKey: draft.bookingRequestId,
      telegramUserId: ctx.from?.id,
      telegramChatId: ctx.chat?.id,
      username: ctx.from?.username,
      fullName: draft.fullName,
      phone: draft.phone,
      serviceOfferingId: draft.offeringId,
      optionIds: draft.optionIds,
      billingMode: pricing.billingMode,
      vehicleNumber: draft.vehicleNumber,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      totalPrice: pricing.totalPrice,
      totalDurationMinutes: pricing.totalDurationMinutes,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("API 409")) {
      draft.timeHHMM = undefined;
      draft.timePage = 0;
      draft.step = STEPS.TIME;
      await ctx.answerCbQuery("Цей час уже зайняли. Оберіть інший слот.");
      await renderTime(ctx);
      return;
    }

    if (error instanceof Error && error.message.includes("Invalid phone number")) {
      draft.phone = undefined;
      draft.fullName = undefined;
      draft.step = STEPS.PHONE;
      await ctx.answerCbQuery("Не вдалося розпізнати номер телефону.");
      await renderPhone(ctx);
      return;
    }

    throw error;
  }

  draft.step = STEPS.DONE;
  await ctx.answerCbQuery();
  await renderDone(ctx, result);
}
