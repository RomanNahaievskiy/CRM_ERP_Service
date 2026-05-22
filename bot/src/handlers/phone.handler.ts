import { logHandler } from "../logger.js";
import { renderConfirm } from "../render/confirm.js";
import { renderPhone } from "../render/phone.js";
import { booking } from "../session.js";
import { STEPS } from "../steps.js";
import { BotContext } from "../types.js";

export async function phoneUseSavedHandler(ctx: BotContext) {
  logHandler("phoneUseSavedHandler", ctx);
  const draft = booking(ctx);
  if (draft.step !== STEPS.PHONE_CHOICE || !draft.savedPhone) {
    await ctx.answerCbQuery();
    return;
  }

  draft.phone = draft.savedPhone;
  draft.fullName = [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(" ");
  draft.step = STEPS.CONFIRM;
  await ctx.answerCbQuery();
  await renderConfirm(ctx);
}

export async function phoneEnterOtherHandler(ctx: BotContext) {
  logHandler("phoneEnterOtherHandler", ctx);
  const draft = booking(ctx);
  draft.phone = undefined;
  draft.fullName = undefined;
  draft.step = STEPS.PHONE;
  await ctx.answerCbQuery();
  await renderPhone(ctx);
}
