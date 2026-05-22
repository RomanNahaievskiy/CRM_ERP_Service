import "dotenv/config";

export const config = {
  botToken: process.env.BOT_TOKEN ?? "",
  apiBaseUrl: process.env.API_BASE_URL ?? "http://127.0.0.1:8000/api",
};

export function assertConfig() {
  if (!config.botToken) {
    throw new Error("BOT_TOKEN is required");
  }
}
