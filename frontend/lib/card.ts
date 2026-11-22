/**
 * Card entry helpers for checkout (Visa and Mastercard only).
 * Card details are checked in the browser and never stored or sent anywhere:
 * this project has no payment processor, so orders only record "Card".
 */

export type CardBrand = "visa" | "mastercard";
export interface CardInput { number: string; name: string; expiry: string; cvc: string }
export type CardField = keyof CardInput;
export type CardError = "required" | "invalid" | "brand" | "expired";
export type CardErrors = Partial<Record<CardField, CardError>>;

export const EMPTY_CARD: CardInput = { number: "", name: "", expiry: "", cvc: "" };
/** Order the fields appear in, so the first invalid one can be focused. */
export const CARD_FIELDS: CardField[] = ["number", "name", "expiry", "cvc"];

export const digitsOnly = (value: string) => value.replace(/\D/g, "");

/** Visa starts with 4; Mastercard with 51–55 or 2221–2720. */
export function cardBrand(value: string): CardBrand | null {
  const d = digitsOnly(value);
  if (d.startsWith("4")) return "visa";
  const two = Number(d.slice(0, 2)), four = Number(d.slice(0, 4));
  if (d.length >= 2 && two >= 51 && two <= 55) return "mastercard";
  if (d.length >= 4 && four >= 2221 && four <= 2720) return "mastercard";
  return null;
}

/** "4242424242424242" → "4242 4242 4242 4242" (max 19 digits). */
export function formatCardNumber(value: string): string {
  return digitsOnly(value).slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 ");
}

/** "1228" → "12/28"; typing "3" becomes "03/". */
export function formatExpiry(value: string): string {
  let d = digitsOnly(value).slice(0, 4);
  if (d.length === 1 && Number(d) > 1) d = `0${d}`;
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

export function luhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let n = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return digits.length > 0 && sum % 10 === 0;
}

export function validateCard(card: CardInput, now = new Date()): CardErrors {
  const errors: CardErrors = {};
  const number = digitsOnly(card.number);
  const brand = cardBrand(number);
  if (!number) errors.number = "required";
  else if (!brand) errors.number = "brand";
  else if (!(brand === "visa" ? [13, 16, 19] : [16]).includes(number.length) || !luhn(number)) errors.number = "invalid";

  const name = card.name.trim();
  if (!name) errors.name = "required";
  else if (name.length < 2 || name.length > 60 || !/^[\p{L}][\p{L} .'-]*$/u.test(name)) errors.name = "invalid";

  const match = /^(\d{2})\/(\d{2})$/.exec(card.expiry);
  if (!card.expiry) errors.expiry = "required";
  else if (!match || Number(match[1]) < 1 || Number(match[1]) > 12) errors.expiry = "invalid";
  else {
    // A card works until the last day of its expiry month.
    const endOfMonth = new Date(2000 + Number(match[2]), Number(match[1]), 1);
    if (endOfMonth <= now) errors.expiry = "expired";
  }

  if (!card.cvc) errors.cvc = "required";
  else if (!/^\d{3}$/.test(card.cvc)) errors.cvc = "invalid";
  return errors;
}

export const cardIsValid = (card: CardInput, now?: Date) => Object.keys(validateCard(card, now)).length === 0;
