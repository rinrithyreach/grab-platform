/**
 * All the money maths for the cart, in one place with no React or browser code,
 * so it can be tested on its own (tests/pricing.test.mjs).
 */
import { DELIVERY_FEE } from "./brand";
import { getItem, getStore, type MenuItem } from "./catalog";

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
  deliveryFee: number; tip?: number; total: number;
  address: string; payment: PaymentMethod; note: string; createdAt: string;
}

/** Rider tip choices shown at checkout. */
export const TIP_OPTIONS = [0, 0.5, 1, 2];

/**
 * Promo codes typed at checkout (demo). They stack with the store's own deal.
 * Add or change codes here.
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

  // 1. The store's own deal
  const deal = store?.deal;
  let discount = 0;
  let deliveryFee = normalFee;
  let dealApplied = false;
  let amountToUnlock = 0; // how much more to spend to unlock a minimum-spend deal
  if (deal && lines.length) {
    if (deal.type === "freeDelivery") {
      deliveryFee = 0;
      dealApplied = true;
    } else if (deal.type === "percentOff") {
      const firstOrderOk = !deal.firstOrderOnly || pastOrders.length === 0;
      const minOk = subtotal >= (deal.minSubtotal ?? 0);
      if (firstOrderOk && minOk) {
        discount = round((subtotal * deal.percent) / 100);
        dealApplied = true;
      } else if (firstOrderOk && deal.minSubtotal) {
        amountToUnlock = round(deal.minSubtotal - subtotal);
      }
    } else if (deal.type === "buyGetFree") {
      const group = deal.buy + deal.free;
      // Count the same dish across lines (e.g. two bubble teas with different sugar levels).
      const perItem = new Map<string, { qty: number; cheapest: number }>();
      for (const l of lines) {
        const p = perItem.get(l.itemId) ?? { qty: 0, cheapest: Infinity };
        perItem.set(l.itemId, { qty: p.qty + l.qty, cheapest: Math.min(p.cheapest, l.price) });
      }
      discount = round([...perItem.values()].reduce((sum, p) => sum + Math.floor(p.qty / group) * deal.free * p.cheapest, 0));
      dealApplied = discount > 0;
    }
  }

  // 2. Promo code typed at checkout (applied after the store deal)
  let codeDiscount = 0;
  const promoCode = cart.promoCode && PROMO_CODES[cart.promoCode] ? cart.promoCode : undefined;
  const code = promoCode ? PROMO_CODES[promoCode] : undefined;
  const codeValid = !!code && lines.length > 0 && subtotal >= (code.minSubtotal ?? 0);
  if (code && codeValid) {
    const afterDeal = subtotal - discount;
    if (code.kind === "amount") codeDiscount = Math.min(code.value, afterDeal);
    if (code.kind === "percent") codeDiscount = Math.min(round((afterDeal * code.value) / 100), code.maxDiscount ?? Infinity);
    if (code.kind === "freeDelivery") deliveryFee = 0;
    codeDiscount = round(codeDiscount);
  }

  // 3. Tip for the rider
  const tip = lines.length ? round(Math.max(0, cart.tip ?? 0)) : 0;

  return {
    store, lines, count, subtotal, discount, normalFee, deliveryFee, tip,
    promoCode, codeDiscount, codeValid,
    total: round(Math.max(0, subtotal - discount - codeDiscount) + deliveryFee + tip),
    deal, dealApplied, amountToUnlock,
  };
}
