import { Telegraf } from "telegraf";

import { backHandler } from "./handlers/back.handler.js";
import { confirmHandler } from "./handlers/confirm.handler.js";
import { contactHandler } from "./handlers/contact.handler.js";
import {
  dateInfoHandler,
  dateNextHandler,
  datePrevHandler,
  dateSelectHandler,
} from "./handlers/date.handler.js";
import {
  optionsDoneHandler,
  optionsToggleHandler,
} from "./handlers/options.handler.js";
import {
  phoneEnterOtherHandler,
  phoneUseSavedHandler,
} from "./handlers/phone.handler.js";
import { serviceHandler } from "./handlers/service.handler.js";
import { startFlowHandler, startHandler } from "./handlers/start.handler.js";
import { textHandler } from "./handlers/text.handler.js";
import {
  timeInfoHandler,
  timeNextHandler,
  timePrevHandler,
  timeSelectHandler,
} from "./handlers/time.handler.js";
import {
  serviceOfferingHandler,
  vehicleGroupHandler,
  vehicleReenterHandler,
} from "./handlers/vehicle.handler.js";
import { BotContext } from "./types.js";

export function registerRoutes(bot: Telegraf<BotContext>) {
  bot.start(startHandler);
  bot.action(["START_FLOW", "START_OVER"], startFlowHandler);

  bot.action(/^SERVICE_(.+)$/, serviceHandler);
  bot.action(/^GROUP_(.+)$/, vehicleGroupHandler);
  bot.action(/^OFFER_(.+)$/, serviceOfferingHandler);
  bot.action("VEHICLE_REENTER", vehicleReenterHandler);

  bot.action(/^OPT_TOGGLE_(.+)$/, optionsToggleHandler);
  bot.action("OPT_DONE", optionsDoneHandler);

  bot.action("PHONE_USE_SAVED", phoneUseSavedHandler);
  bot.action("PHONE_ENTER_OTHER", phoneEnterOtherHandler);

  bot.action("DATE_PREV", datePrevHandler);
  bot.action("DATE_NEXT", dateNextHandler);
  bot.action("DATE_INFO", dateInfoHandler);
  bot.action(/^DATE_(\d{4}-\d{2}-\d{2})$/, dateSelectHandler);

  bot.action("TIME_PREV", timePrevHandler);
  bot.action("TIME_NEXT", timeNextHandler);
  bot.action("TIME_INFO", timeInfoHandler);
  bot.action(/^TIME_(\d{2}:\d{2})$/, timeSelectHandler);

  bot.on("contact", contactHandler);
  bot.on("text", textHandler);

  bot.action("CONFIRM", confirmHandler);
  bot.action("BACK", backHandler);
}
