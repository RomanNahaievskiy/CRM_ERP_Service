import { logHandler } from "../logger.js";
import { repository } from "../data/apiRepository.js";
import { renderOptions } from "../render/options.js";
import { renderVehicleData } from "../render/vehicleData.js";
import { renderVehicleType } from "../render/vehicleType.js";
import { booking } from "../session.js";
import { STEPS } from "../steps.js";
import { BotContext } from "../types.js";

export async function vehicleGroupHandler(ctx: BotContext & { match: RegExpExecArray }) {
  logHandler("vehicleGroupHandler", ctx);
  const draft = booking(ctx);
  draft.vehicleGroupId = ctx.match[1];
  draft.vehicleTypeId = undefined;
  draft.offeringId = undefined;
  draft.optionIds = [];
  draft.billingMode = "retail";
  draft.pricing = undefined;
  draft.step = STEPS.VEHICLE_TYPE;
  await ctx.answerCbQuery();
  await renderVehicleType(ctx);
}

export async function serviceOfferingHandler(ctx: BotContext & { match: RegExpExecArray }) {
  logHandler("serviceOfferingHandler", ctx);
  const draft = booking(ctx);
  draft.offeringId = ctx.match[1];
  const catalog = await repository.getCatalog();
  const offering = catalog.offerings.find((item) => item.id === draft.offeringId);
  draft.vehicleTypeId = offering?.vehicleTypeId;
  draft.optionIds = [];
  draft.billingMode = "retail";
  draft.pricing = undefined;
  draft.step = STEPS.OPTIONS;
  await ctx.answerCbQuery();
  await renderOptions(ctx);
}

export async function vehicleReenterHandler(ctx: BotContext) {
  logHandler("vehicleReenterHandler", ctx);
  const draft = booking(ctx);
  draft.vehicleNumber = undefined;
  draft.billingMode = undefined;
  draft.pricing = undefined;
  draft.vehicleGroupId = undefined;
  draft.vehicleTypeId = undefined;
  draft.offeringId = undefined;
  draft.optionIds = [];
  draft.step = STEPS.VEHICLE_DATA;
  await ctx.answerCbQuery();
  await renderVehicleData(ctx);
}
