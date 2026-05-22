import { Telegraf, session } from "telegraf";

import { assertConfig, config } from "./config.js";
import { renderError } from "./render/error.js";
import { startReminderPolling } from "./reminders.js";
import { registerRoutes } from "./router.js";
import { BotContext } from "./types.js";

assertConfig();

const bot = new Telegraf<BotContext>(config.botToken);

bot.use(session({ defaultSession: () => ({}) }));
registerRoutes(bot);

bot.catch((error, ctx) => {
  console.error("Bot error", error);
  void renderError(ctx);
});

bot.launch();
const stopReminderPolling = startReminderPolling(bot);

console.log("Wash.bot client bot started");

process.once("SIGINT", () => {
  stopReminderPolling();
  bot.stop("SIGINT");
});
process.once("SIGTERM", () => {
  stopReminderPolling();
  bot.stop("SIGTERM");
});
