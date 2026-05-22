import { Markup, Telegraf } from "telegraf";

import { repository, ReminderDelivery } from "./data/apiRepository.js";
import { BotContext } from "./types.js";

const DEFAULT_POLL_INTERVAL_MS = 60_000;
const DEFAULT_BATCH_SIZE = 20;

let isPolling = false;

export function startReminderPolling(bot: Telegraf<BotContext>) {
  void pollReminders(bot); // Start immediately on bot launch
  const timer = setInterval(() => {
    void pollReminders(bot);
  }, DEFAULT_POLL_INTERVAL_MS);

  return () => clearInterval(timer);
}

async function pollReminders(bot: Telegraf<BotContext>) {
  if (isPolling) {
    return;
  }

  isPolling = true;
  try {
    const reminders = await repository.claimDueReminders(DEFAULT_BATCH_SIZE);
    for (const reminder of reminders) {
      await deliverReminder(bot, reminder);
    }
  } catch (error) {
    console.error("Reminder polling failed", error);
  } finally {
    isPolling = false;
  }
}

async function deliverReminder(
  bot: Telegraf<BotContext>,
  reminder: ReminderDelivery,
) {
  try {
    await bot.telegram.sendMessage(
      reminder.client.telegramChatId,
      buildReminderMessage(reminder),
      {
        parse_mode: "HTML",
        ...buildReminderKeyboard(reminder),
      },
    );
    await repository.markReminderSent(reminder.id);
  } catch (error) {
    console.error("Reminder delivery failed", reminder.id, error);
    await repository.markReminderFailed(reminder.id, error);
  }
}

function buildReminderMessage(reminder: ReminderDelivery) {
  const booking = reminder.booking;
  const lines = [
    "🔔 Нагадування про запис",
    "",
    `Ви записані на <b>${escapeHtml(booking.serviceTitle)}</b>.`,
    `Час: <b>${formatDateTime(booking.startsAt)}</b>`,
  ];

  if (booking.vehicleNumber) {
    lines.push(`Транспорт: ${escapeHtml(booking.vehicleNumber)}`);
  }

  if (booking.location?.address) {
    lines.push(`Адреса: ${escapeHtml(booking.location.address)}`);
  }

  lines.push("", `Номер запису: ${escapeHtml(booking.externalId)}`);
  return lines.join("\n");
}

function buildReminderKeyboard(reminder: ReminderDelivery) {
  const buttons = [];
  const mapUrl = buildMapUrl(reminder.booking.location);
  if (mapUrl) {
    buttons.push([Markup.button.url("Побудувати маршрут", mapUrl)]);
  }

  const operatorUrl = buildOperatorUrl(reminder.booking.operator);
  if (operatorUrl) {
    buttons.push([Markup.button.url("Зв'язатися з оператором", operatorUrl)]);
  }

  buttons.push([Markup.button.callback("Новий запис", "START_OVER")]);
  return Markup.inlineKeyboard(buttons);
}

function buildMapUrl(location: ReminderDelivery["booking"]["location"]) {
  if (
    !location ||
    location.latitude === null ||
    location.latitude === undefined ||
    location.longitude === null ||
    location.longitude === undefined
  ) {
    return "";
  }

  return `https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}`;
}

function buildOperatorUrl(operator: ReminderDelivery["booking"]["operator"]) {
  const username = operator?.telegramUsername?.replace(/^@/, "");
  if (!username) {
    return "";
  }

  return `https://t.me/${username}`;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
