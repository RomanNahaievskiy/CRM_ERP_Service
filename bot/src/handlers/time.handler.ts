import { logHandler } from "../logger.js";
import { renderPhoneChoice } from "../render/phoneChoice.js";
import { renderTime } from "../render/time.js";
import { booking } from "../session.js";
import { STEPS } from "../steps.js";
import { BotContext } from "../types.js";

export async function timePrevHandler(ctx: BotContext) {
  logHandler("timePrevHandler", ctx);
  const draft = booking(ctx);
  draft.timePage = Math.max((draft.timePage ?? 0) - 1, 0);
  await ctx.answerCbQuery();
  await renderTime(ctx);
}

export async function timeNextHandler(ctx: BotContext) {
  logHandler("timeNextHandler", ctx);
  const draft = booking(ctx);
  draft.timePage = (draft.timePage ?? 0) + 1;
  await ctx.answerCbQuery();
  await renderTime(ctx);
}

export async function timeInfoHandler(ctx: BotContext) {
  logHandler("timeInfoHandler", ctx);
  await ctx.answerCbQuery();
}

export async function timeSelectHandler(ctx: BotContext & { match: RegExpExecArray }) {
  logHandler("timeSelectHandler", ctx);
  const draft = booking(ctx);
  draft.timeHHMM = ctx.match[1];
  draft.step = STEPS.PHONE_CHOICE;
  await ctx.answerCbQuery();
  await deleteTimeSlotMessage(ctx);
  await renderPhoneChoice(ctx);
}

async function deleteTimeSlotMessage(ctx: BotContext) {
  try {
    await ctx.deleteMessage();
  } catch {
    // Якщо Telegram не дозволить видалити повідомлення, сам сценарій бронювання не ламаємо.
  }
}
