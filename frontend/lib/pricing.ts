/**
 * All the money maths for the cart, in one place with no React or browser code,
 * so it can be tested on its own (tests/pricing.test.mjs).
 */
import { DELIVERY_FEE } from "./brand";
import { getItem, getStore, type MenuItem } from "./catalog";
import { getPromotionRules, matchesPromotion, promotionStatus, promotionTotals } from "./promotion-rules";
import type { Deal } from "./catalog";
import type { Currency } from "./currency";

export interface CartLine {
  itemId: string;
  qty: number;
  /** Chosen item options as "groupId:choiceId", e.g. ["size:large", "spice:hot"]. */
  options?: string[];
}
export interface Cart { storeId: string | null; lines: CartLine[]; promoCode?: string; tip?: number }

export interface OrderLine {
  itemId: string;
  name: string;
  /** Price of ONE unit including its options. */
  price: number;
  qty: number;
  /** Option names for display, e.g. ["Large", "Hot"]. */
  options?: string[];
  /** The option keys, so "Order again" can rebuild the same line. */
  optionIds?: string[];
}
export type PaymentMethod = "Cash" | "Card" | "Wallet";
export interface Order {
  id: string; storeId: string; storeName: string; lines: OrderLine[];
  subtotal: number; discount?: number; promoCode?: string; codeDiscount?: number;
  promotionLabel?: string;
  deliveryFee: number; tip?: number; total: number;
  address: string; payment: PaymentMethod; note: string; createdAt: string;
  /** Normalized number the rider calls on delivery; missing on older saved orders. */
  contactPhone?: string;
  /** What the customer pays in; missing on older saved orders (= USD). Wallet orders are always USD. */
  currency?: Currency;
}

/** Rider tip choices shown at checkout. */
export const TIP_OPTIONS = [0, 0.5, 1, 2];

/**
 * Legacy demo code definitions retained for existing imports.
 * Checkout reads the current rules from Promotions & coupons in the admin dashboard.
 */
export const PROMO_CODES: Record<string, { kind: "amount" | "percent" | "freeDelivery"; value: number; minSubtotal?: number; maxDiscount?: number }> = {
  GROUP6: { kind: "amount", value: 1, minSubtotal: 3 },               // $1 off orders of $3+
  WELCOME10: { kind: "percent", value: 10, maxDiscount: 3 },          // 10% off, up to $3
  FREESHIP: { kind: "freeDelivery", value: 0 },                       // free delivery
};

export const round = (n: number) => Math.round(n * 100) / 100;

/** Identifies a cart line: the same dish with different options is a separate line. */
export function lineKey(line: Pick<CartLine, "itemId" | "options">) {
  return `${line.itemId}|${[...(line.options ?? [])].sort().join(",")}`;
}

/** The option choices a line has, looked up in the menu. */
export function chosenOptions(item: MenuItem, options: string[] = []) {
  return options.flatMap((key) => {
    const [groupId, choiceId] = key.split(":");
    const group = item.options?.find((g) => g.id === groupId);
    const choice = group?.choices.find((c) => c.id === choiceId);
    return group && choice ? [{ group, choice }] : [];
  });
}

/** Unit price of an item with the chosen options. */
export function unitPrice(item: MenuItem, options: string[] = []) {
  return round(item.price + chosenOptions(item, options).reduce((sum, o) => sum + o.choice.price, 0));
}

/** The default choices for an item (first choice of every required group). */
export function defaultOptions(item: MenuItem) {
  return (item.options ?? []).filter((g) => g.required).map((g) => `${g.id}:${g.choices[0].id}`);
}

/**
 * A delivery address must be at least 5 characters and contain both
 * letters and numbers (e.g. "House 12, St. 271"). Works for Khmer letters and digits too.
 */
export function isValidAddress(address: string) {
  const a = address.trim();
  return a.length >= 5 && /\p{L}/u.test(a) && /\p{Nd}/u.test(a);
}

/** True when the wallet has enough money for this total. */
export const canPayWithWallet = (balance: number, total: number) =>
  Number.isFinite(balance) && Number.isFinite(total) && balance >= 0 && total >= 0 && round(balance) >= round(total);

/**
 * Works out the cart totals: item options, the store's deal, a promo code, delivery and tip.
 * `pastOrders` is needed for "first order" deals; leave it out when only the item count matters.
 */
export function cartDetails(cart: Cart, pastOrders: Order[] = []) {
  const store = cart.storeId ? getStore(cart.storeId) : undefined;
  const lines: (OrderLine & { key: string; optionIds: string[] })[] = store
    ? cart.lines.flatMap((l) => {
        const item = getItem(store.id, l.itemId);
        if (!item) return [];
        const optionIds = l.options ?? [];
        return [{
          key: lineKey(l), itemId: item.id, name: item.name, qty: l.qty, optionIds,
          price: unitPrice(item, optionIds),
          options: chosenOptions(item, optionIds).map((o) => o.choice.name),
        }];
      })
    : [];
  const subtotal = round(lines.reduce((sum, l) => sum + l.price * l.qty, 0));
  const count = lines.reduce((sum, l) => sum + l.qty, 0);
  const normalFee = lines.length ? DELIVERY_FEE : 0;

  const promotionLines = lines.map(l => ({ productId: l.itemId, price: l.price, qty: l.qty }));
  const totals = promotionTotals(store?.id ?? "", promotionLines, cart.promoCode, pastOrders.length === 0, normalFee);
  const { discount, deliveryFee, codeDiscount, codeValid, promoCode, promotionLabel } = totals;
  const available = getPromotionRules().filter(p => !p.code && promotionStatus(p) === "Active"
    && matchesPromotion(p, store?.id ?? "", promotionLines) && (!p.firstOrderOnly || pastOrders.length === 0));
  const candidate = totals.promotion ?? available[0];
  const deal: Deal | undefined = candidate?.kind === "buyGetFree" ? { type: "buyGetFree", buy: candidate.buyQuantity, free: candidate.freeQuantity }
    : candidate?.kind === "percent" ? { type: "percentOff", percent: candidate.value, minSubtotal: candidate.minSubtotal, firstOrderOnly: candidate.firstOrderOnly }
    : candidate?.kind === "freeDelivery" ? { type: "freeDelivery" } : undefined;
  const dealApplied = discount > 0 || deliveryFee < normalFee;
  const amountToUnlock = available.length && !dealApplied ? Math.max(0, Math.min(...available.map(p => p.minSubtotal)) - subtotal) : 0;

  // 3. Tip for the rider
  const tip = lines.length ? round(Math.max(0, cart.tip ?? 0)) : 0;

  return {
    store, lines, count, subtotal, discount, normalFee, deliveryFee, tip,
    promoCode, codeDiscount, codeValid, codeError: totals.codeError,
    total: round(Math.max(0, subtotal - discount - codeDiscount) + deliveryFee + tip),
    deal, dealApplied, amountToUnlock, promotionLabel: promotionLabel || candidate?.name || "",
  };
}
