import { logHandler } from "../logger.js";
import { renderVehicleData } from "../render/vehicleData.js";
import { booking } from "../session.js";
import { STEPS } from "../steps.js";
import { BotContext } from "../types.js";

export async function serviceHandler(ctx: BotContext & { match: RegExpExecArray }) {
  logHandler("serviceHandler", ctx);
  const draft = booking(ctx);
  draft.serviceId = ctx.match[1];
  draft.vehicleGroupId = undefined;
  draft.vehicleTypeId = undefined;
  draft.offeringId = undefined;
  draft.optionIds = [];
  draft.billingMode = undefined;
  draft.pricing = undefined;
  draft.vehicleNumber = undefined;
  draft.step = STEPS.VEHICLE_DATA;
  await ctx.answerCbQuery();
  await renderVehicleData(ctx);
}
