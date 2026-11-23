/**
 * Paying in US dollars or Khmer riel. Prices and the wallet are always in USD;
 * at checkout and top-up the customer chooses which currency they hand over.
 *
 *   usdToKhr(6)            // 24600
 *   formatPaid(6, "KHR")   // "24,600៛"
 *
 * The fixed demo rate matches the backend (Models/MerchantOrder.cs Currencies.KhrPerUsd).
 */
export type Currency = "USD" | "KHR";
export const CURRENCIES: Currency[] = ["USD", "KHR"];
export const KHR_PER_USD = 4100;

export const isCurrency = (value: unknown): value is Currency => value === "USD" || value === "KHR";

/** USD → riel, rounded to the nearest 100 ៛ (the smallest note in everyday use). Works in whole cents to avoid float drift. */
export function usdToKhr(usd: number, rate = KHR_PER_USD) {
  return Math.round((Math.round(usd * 100) * rate) / 10_000) * 100;
}

/** "24,600៛" */
export function riel(khr: number) {
  return `${Math.round(khr).toLocaleString("en-US")}៛`;
}

/** A USD amount shown in the currency the customer pays with. */
export function formatPaid(usd: number, currency: Currency = "USD", rate = KHR_PER_USD) {
  return currency === "KHR" ? riel(usdToKhr(usd, rate)) : `$${usd.toFixed(2)}`;
}
