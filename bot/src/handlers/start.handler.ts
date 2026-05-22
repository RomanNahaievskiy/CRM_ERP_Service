import { logHandler } from "../logger.js";
import { renderService, sendService } from "../render/service.js";
import { renderStart } from "../render/start.js";
import { resetBooking } from "../session.js";
import { STEPS } from "../steps.js";
import { BotContext } from "../types.js";

export async function startHandler(ctx: BotContext) {
  logHandler("startHandler", ctx);
  resetBooking(ctx);
  await renderStart(ctx);
}

export async function startFlowHandler(ctx: BotContext) {
  logHandler("startFlowHandler", ctx);
  const previousStep = ctx.session.booking?.step;
  const draft = resetBooking(ctx);
  draft.step = STEPS.SERVICE;
  await ctx.answerCbQuery();
  if (previousStep === STEPS.DONE) {
    await sendService(ctx);
    return;
  }

  await renderService(ctx);
}
