import { repository } from "./data/apiRepository.js";
import { PricingSummary } from "./types.js";

export async function calculatePricing(
  offeringId: string,
  optionIds: string[],
  vehicleNumber?: string,
  billingMode?: "retail" | "contract",
): Promise<PricingSummary> {
  return repository.resolvePricing({
    serviceOfferingId: offeringId,
    optionIds,
    vehicleNumber,
    billingMode,
  });
}

export function addMinutes(date: Date, minutes: number) {
  const result = new Date(date);
  result.setMinutes(result.getMinutes() + minutes);
  return result;
}
