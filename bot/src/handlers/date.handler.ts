import { logHandler } from "../logger.js";
import { renderDate } from "../render/date.js";
import { renderTime } from "../render/time.js";
import { booking } from "../session.js";
import { STEPS } from "../steps.js";
import { BotContext } from "../types.js";

export async function datePrevHandler(ctx: BotContext) {
  logHandler("datePrevHandler", ctx);
  const draft = booking(ctx);
  draft.datePage = Math.max((draft.datePage ?? 0) - 1, 0);
  await ctx.answerCbQuery();
  await renderDate(ctx);
}

export async function dateNextHandler(ctx: BotContext) {
  logHandler("dateNextHandler", ctx);
  const draft = booking(ctx);
  draft.datePage = (draft.datePage ?? 0) + 1;
  await ctx.answerCbQuery();
  await renderDate(ctx);
}

export async function dateInfoHandler(ctx: BotContext) {
  logHandler("dateInfoHandler", ctx);
  await ctx.answerCbQuery();
}

export async function dateSelectHandler(ctx: BotContext & { match: RegExpExecArray }) {
  logHandler("dateSelectHandler", ctx);
  const draft = booking(ctx);
  draft.dateISO = ctx.match[1];
  draft.timeHHMM = undefined;
  draft.timePage = 0;
  draft.step = STEPS.TIME;
  await ctx.answerCbQuery();
  await renderTime(ctx);
}
