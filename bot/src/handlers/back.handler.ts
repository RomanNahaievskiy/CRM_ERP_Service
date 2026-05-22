import { logHandler } from "../logger.js";
import { renderDate } from "../render/date.js";
import { renderOptions } from "../render/options.js";
import { renderPhoneChoice } from "../render/phoneChoice.js";
import { renderService } from "../render/service.js";
import { renderTime } from "../render/time.js";
import { renderVehicleData } from "../render/vehicleData.js";
import { renderVehicleGroup } from "../render/vehicleGroup.js";
import { renderVehicleType } from "../render/vehicleType.js";
import { booking } from "../session.js";
import { STEPS } from "../steps.js";
import { BotContext } from "../types.js";

export async function backHandler(ctx: BotContext) {
  logHandler("backHandler", ctx);
  await ctx.answerCbQuery();
  const draft = booking(ctx);

  switch (draft.step) {
    case STEPS.VEHICLE_GROUP:
      draft.step = STEPS.VEHICLE_DATA;
      clearAfterStep(draft, STEPS.VEHICLE_DATA);
      return renderVehicleData(ctx);
    case STEPS.VEHICLE_TYPE:
      draft.step = STEPS.VEHICLE_GROUP;
      clearAfterStep(draft, STEPS.VEHICLE_GROUP);
      return renderVehicleGroup(ctx);
    case STEPS.OPTIONS:
      if (draft.pricing?.contractFound) {
        draft.step = STEPS.VEHICLE_DATA;
        clearAfterStep(draft, STEPS.VEHICLE_DATA);
        return renderVehicleData(ctx);
      }
      draft.step = STEPS.VEHICLE_TYPE;
      clearAfterStep(draft, STEPS.VEHICLE_TYPE);
      return renderVehicleType(ctx);
    case STEPS.VEHICLE_DATA:
      draft.step = STEPS.SERVICE;
      clearAfterStep(draft, STEPS.SERVICE);
      return renderService(ctx);
    case STEPS.DATE:
      draft.step = STEPS.OPTIONS;
      clearAfterStep(draft, STEPS.OPTIONS);
      return renderOptions(ctx);
    case STEPS.TIME:
      draft.step = STEPS.DATE;
      clearAfterStep(draft, STEPS.DATE);
      return renderDate(ctx);
    case STEPS.PHONE_CHOICE:
      draft.step = STEPS.TIME;
      clearAfterStep(draft, STEPS.TIME);
      return renderTime(ctx);
    case STEPS.PHONE:
      draft.step = STEPS.TIME;
      clearAfterStep(draft, STEPS.TIME);
      return renderTime(ctx);
    case STEPS.CONFIRM:
      draft.step = STEPS.PHONE_CHOICE;
      clearAfterStep(draft, STEPS.PHONE_CHOICE);
      return renderPhoneChoice(ctx);
    default:
      draft.step = STEPS.SERVICE;
      clearAfterStep(draft, STEPS.SERVICE);
      return renderService(ctx);
  }
}

function clearAfterStep(
  draft: ReturnType<typeof booking>,
  step: (typeof STEPS)[keyof typeof STEPS],
) {
  if (step === STEPS.SERVICE) {
    draft.serviceId = undefined;
    draft.vehicleGroupId = undefined;
    draft.vehicleTypeId = undefined;
    draft.offeringId = undefined;
    draft.optionIds = [];
    draft.billingMode = undefined;
    draft.pricing = undefined;
    draft.vehicleNumber = undefined;
    draft.dateISO = undefined;
    draft.datePage = 0;
    draft.timeHHMM = undefined;
    draft.timePage = 0;
    draft.savedPhone = undefined;
    draft.phone = undefined;
    draft.fullName = undefined;
    return;
  }

  if (step === STEPS.VEHICLE_DATA) {
    draft.vehicleNumber = undefined;
    draft.billingMode = undefined;
    draft.pricing = undefined;
    draft.vehicleGroupId = undefined;
    draft.vehicleTypeId = undefined;
    draft.offeringId = undefined;
    draft.optionIds = [];
    draft.dateISO = undefined;
    draft.datePage = 0;
    draft.timeHHMM = undefined;
    draft.timePage = 0;
    draft.savedPhone = undefined;
    draft.phone = undefined;
    draft.fullName = undefined;
    return;
  }

  if (step === STEPS.VEHICLE_GROUP) {
    draft.vehicleGroupId = undefined;
    draft.vehicleTypeId = undefined;
    draft.offeringId = undefined;
    draft.optionIds = [];
    draft.billingMode = undefined;
    draft.pricing = undefined;
    draft.dateISO = undefined;
    draft.datePage = 0;
    draft.timeHHMM = undefined;
    draft.timePage = 0;
    draft.savedPhone = undefined;
    draft.phone = undefined;
    draft.fullName = undefined;
    return;
  }

  if (step === STEPS.VEHICLE_TYPE) {
    draft.vehicleTypeId = undefined;
    draft.offeringId = undefined;
    draft.optionIds = [];
    draft.billingMode = "retail";
    draft.pricing = undefined;
    draft.dateISO = undefined;
    draft.datePage = 0;
    draft.timeHHMM = undefined;
    draft.timePage = 0;
    draft.savedPhone = undefined;
    draft.phone = undefined;
    draft.fullName = undefined;
    return;
  }

  if (step === STEPS.OPTIONS) {
    draft.dateISO = undefined;
    draft.datePage = 0;
    draft.timeHHMM = undefined;
    draft.timePage = 0;
    draft.savedPhone = undefined;
    draft.phone = undefined;
    draft.fullName = undefined;
    return;
  }

  if (step === STEPS.DATE) {
    draft.dateISO = undefined;
    draft.timeHHMM = undefined;
    draft.timePage = 0;
    draft.savedPhone = undefined;
    draft.phone = undefined;
    draft.fullName = undefined;
    return;
  }

  if (step === STEPS.TIME) {
    draft.timeHHMM = undefined;
    draft.savedPhone = undefined;
    draft.phone = undefined;
    draft.fullName = undefined;
    return;
  }

  if (step === STEPS.PHONE_CHOICE) {
    draft.savedPhone = undefined;
    draft.phone = undefined;
    draft.fullName = undefined;
    return;
  }

  if (step === STEPS.PHONE) {
    draft.phone = undefined;
    draft.fullName = undefined;
  }
}
