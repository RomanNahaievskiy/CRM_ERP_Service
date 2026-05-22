import { BotContext } from "./types.js";

export function logHandler(name: string, ctx: BotContext) {
  const userId = ctx.from?.id ?? "unknown";
  const chatId = ctx.chat?.id ?? "unknown";
  console.log(`[handler:${name}] user=${userId}`);
}
