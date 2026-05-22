import { logHandler } from "../logger.js";
import { repository } from "../data/apiRepository.js";
import { renderDate } from "../render/date.js";
import { renderOptions } from "../render/options.js";
import { booking } from "../session.js";
import { STEPS } from "../steps.js";
import { BotContext } from "../types.js";

export async function optionsToggleHandler(ctx: BotContext & { match: RegExpExecArray }) {
  logHandler("optionsToggleHandler", ctx);
  const draft = booking(ctx);
  const optionId = ctx.match[1];
  const availableOptions = draft.offeringId
    ? await repository.listOptionsForOffering(draft.offeringId)
    : [];
  if (!availableOptions.some((option) => option.id === optionId)) {
    await ctx.answerCbQuery("Ця опція недоступна для вибраної послуги.");
    return renderOptions(ctx);
  }

  draft.optionIds = draft.optionIds.includes(optionId)
    ? draft.optionIds.filter((id) => id !== optionId)
    : [...draft.optionIds, optionId];
  await ctx.answerCbQuery();
  await renderOptions(ctx);
}

export async function optionsDoneHandler(ctx: BotContext) {
  logHandler("optionsDoneHandler", ctx);
  const draft = booking(ctx);
  draft.step = STEPS.DATE;
  draft.datePage = 0;
  draft.timePage = 0;
  await ctx.answerCbQuery();
  await renderDate(ctx);
}
