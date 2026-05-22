import { Markup } from "telegraf";

import { formatDate } from "../dateSlots.js";
import { formatPhoneForDisplay } from "../phoneDisplay.js";
import { booking } from "../session.js";
import { BotContext } from "../types.js";
import { buildBookingPath } from "./bookingPath.js";
import { safeEditOrReply } from "./safeEditOrReply.js";

type DoneBooking = {
  id: string;
  startsAt?: string;
  location?: {
    title: string;
    address?: string;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  operator?: {
    title: string;
    phone: string;
    telegramUsername?: string;
  } | null;
};

export async function renderDone(ctx: BotContext, result: DoneBooking) {
  const draft = booking(ctx);
  const path = await buildBookingPath(draft, "Деталі запису:");
  const lines = [
    "Запис створено.",
    "",
    `Номер запису: ${result.id}`,
    "",
    path.trim(),
    "",
    `Чекаємо вас ${formatArrivalTime(draft.dateISO, draft.timeHHMM)}.`,
  ].filter(Boolean);

  const locationText = formatLocation(result.location);
  if (locationText) {
    lines.push("", locationText);
  }

  const operatorText = formatOperator(result.operator);
  if (operatorText) {
    lines.push(
      "",
      `Якщо потрібно відмінити запис, зв'яжіться з адміністратором: ${operatorText}.`,
    );
  }

  return safeEditOrReply(
    ctx,
    lines.join("\n"),
    Markup.inlineKeyboard(buildDoneButtons(result.location)),
  );
}

function formatArrivalTime(dateISO?: string, timeHHMM?: string) {
  if (!dateISO || !timeHHMM) {
    return "у вибраний час";
  }

  return `${formatDate(dateISO)} о ${timeHHMM}`;
}

function formatLocation(location: DoneBooking["location"]) {
  if (!location) {
    return "";
  }

  const lines: string[] = [];
  if (location.address) {
    lines.push(`Адреса: ${location.address}`);
  }

  return lines.join("\n");
}

function buildDoneButtons(location: DoneBooking["location"]) {
  const buttons = [];
  const mapUrl = buildMapUrl(location);
  if (mapUrl) {
    buttons.push([Markup.button.url("Побудувати маршрут", mapUrl)]);
  }

  buttons.push([Markup.button.callback("Новий запис", "START_OVER")]);
  return buttons;
}

function buildMapUrl(location: DoneBooking["location"]) {
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

function formatOperator(operator: DoneBooking["operator"]) {
  if (!operator) {
    return "";
  }

  const parts = [formatPhoneForDisplay(operator.phone)];
  if (operator.telegramUsername) {
    parts.push(`@${operator.telegramUsername.replace(/^@/, "")}`);
  }

  return parts.join(", ");
}
