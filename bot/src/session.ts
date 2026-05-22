import { STEPS } from "./steps.js";
import { BookingDraft, BotContext } from "./types.js";

export function resetBooking(ctx: BotContext) {
  ctx.session.booking = {
    step: STEPS.SERVICE,
    optionIds: [],
  };

  return ctx.session.booking;
}

export function booking(ctx: BotContext): BookingDraft {
  if (!ctx.session.booking) {
    return resetBooking(ctx);
  }

  return ctx.session.booking;
}
