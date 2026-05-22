import { formatDate } from "../dateSlots.js";
import { repository } from "../data/apiRepository.js";
import { BookingDraft } from "../types.js";
import { getDisplayVehicleNumber } from "../vehicleDisplay.js";

export async function buildBookingPath(draft: BookingDraft, heading = "Поточний запис:") {
  const catalog = await repository.getCatalog();
  const offering = catalog.offerings.find((item) => item.id === draft.offeringId);
  const service = catalog.services.find((item) => item.id === (draft.serviceId ?? offering?.serviceId));
  const group = catalog.vehicleGroups.find((item) => item.id === draft.vehicleGroupId);
  const vehicleType = catalog.vehicleTypes.find(
    (item) => item.id === (draft.vehicleTypeId ?? offering?.vehicleTypeId),
  );
  const selectedOptions = catalog.options.filter((option) => draft.optionIds.includes(option.id));
  const vehicleNumber = getDisplayVehicleNumber(draft);

  const lines = [heading];

  if (service) {
    lines.push(`Послуга: ${service.title}`);
  }
  if (group) {
    lines.push(`Група: ${group.title}`);
  }
  if (vehicleType) {
    lines.push(`Транспорт: ${vehicleType.title}`);
  }
  if (selectedOptions.length > 0) {
    lines.push(`Опції: ${selectedOptions.map((option) => option.title).join(", ")}`);
  }
  if (vehicleNumber) {
    lines.push(`Номер: ${vehicleNumber}`);
  }
  if (draft.dateISO) {
    lines.push(`Дата: ${formatDate(draft.dateISO)}`);
  }
  if (draft.timeHHMM) {
    lines.push(`Час: ${draft.timeHHMM}`);
  }

  return lines.length > 1 ? `${lines.join("\n")}\n\n` : "";
}
