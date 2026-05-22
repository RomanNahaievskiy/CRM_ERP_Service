import { logHandler } from "../logger.js";
import { renderConfirm } from "../render/confirm.js";
import { hideReplyKeyboard } from "../render/hideReplyKeyboard.js";
import { booking } from "../session.js";
import { STEPS } from "../steps.js";
import { BotContext } from "../types.js";

export async function contactHandler(ctx: BotContext) {
  logHandler("contactHandler", ctx);
  const draft = booking(ctx);
  if (!ctx.message || draft.step !== STEPS.PHONE || !("contact" in ctx.message)) {
    return;
  }

  draft.phone = ctx.message.contact.phone_number;
  draft.fullName = [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(" ");
  draft.step = STEPS.CONFIRM;
  await hideReplyKeyboard(ctx);
  await renderConfirm(ctx);
}
