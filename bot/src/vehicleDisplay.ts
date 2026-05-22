import { BookingDraft } from "./types.js";

// В UI показуємо номер із серверних контрактних даних, якщо бекенд знайшов транспорт.
export function getDisplayVehicleNumber(draft: BookingDraft) {
  return draft.pricing?.vehicle?.vehicleNumber ?? draft.vehicleNumber;
}
