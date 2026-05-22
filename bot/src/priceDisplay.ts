import { PricingSummary } from "./types.js";

// Для контрактних клієнтів не показуємо конкретну суму в UI бота.
export function formatTotalPrice(summary: PricingSummary) {
  return summary.billingMode === "contract"
    ? "Ціна згідно умов договору"
    : `${summary.totalPrice} грн`;
}

// Опції для контракту теж не мають розкривати індивідуальні ціни.
export function formatOptionTerms(
  billingMode: PricingSummary["billingMode"],
  price: number,
  durationMinutes: number,
) {
  if (billingMode === "contract") {
    return `${durationMinutes} хв`;
  }

  return `+${price} грн / +${durationMinutes} хв`;
}
