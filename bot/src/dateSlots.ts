const SLOT_STEP_MINUTES = 15;
const WORKDAY_START = "08:00";
const WORKDAY_END = "20:00";

export function nextDates(count = 7) {
  const dates: string[] = [];
  const today = new Date();

  for (let i = 0; i < count; i += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    dates.push(toDateISO(date));
  }

  return dates;
}

export function freeTimeSlots(dateISO: string, durationMinutes: number) {
  // TODO: Replace with backend availability. This stub ignores existing bookings/resources.
  const start = timeToMinutes(WORKDAY_START);
  const end = timeToMinutes(WORKDAY_END);
  const slots: string[] = [];

  for (let current = start; current + durationMinutes <= end; current += SLOT_STEP_MINUTES) {
    slots.push(minutesToTime(current));
  }

  if (dateISO === toDateISO(new Date())) {
    return slots.filter((slot) => timeToMinutes(slot) > currentTimeMinutes());
  }

  return slots;
}

export function formatDate(dateISO?: string) {
  if (!dateISO) {
    return "не вибрано";
  }

  return new Date(`${dateISO}T00:00:00`).toLocaleDateString("uk-UA", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

export function toStartDate(dateISO: string, timeHHMM: string) {
  return new Date(`${dateISO}T${timeHHMM}:00`);
}

export function pageItems<T>(items: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(page, 0), totalPages - 1);
  const start = safePage * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    page: safePage,
    totalPages,
    hasPrev: safePage > 0,
    hasNext: safePage < totalPages - 1,
  };
}

function toDateISO(date: Date) {
  return date.toISOString().slice(0, 10);
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function currentTimeMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}
