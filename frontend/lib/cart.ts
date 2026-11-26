"use client";

/**
 * Cart + order history. Signed-in state syncs through the account-data API;
 * localStorage is the retry cache. Guest state stays local until imported.
 * A tiny external store read with useSyncExternalStore so the server render
 * (empty cart) and the first client render always match.
 * The price maths lives in lib/pricing.ts.
 */
import { recordId } from "./record-id";
import { useSyncExternalStore } from "react";
import { getItem, getStore } from "./catalog";
import { createLocalStore } from "./local-store";
import { clearPartnerCart, partnerCart, putPartnerItem, type PartnerOffer } from "./partner-cart";
import { cartDetails, lineKey, type Cart, type Order, type PaymentMethod } from "./pricing";
import { promotionTotals, subscribePromotions, getPromotionRules, DEFAULT_PROMOTIONS } from "./promotion-rules";
import { payFromWallet } from "./wallet";
import { normalizePhoneNumber } from "./phone";
import type { Currency } from "./currency";

export {
  cartDetails, isValidAddress, lineKey, PROMO_CODES, TIP_OPTIONS,
  type Cart, type CartLine, type Order, type OrderLine, type PaymentMethod,
} from "./pricing";

interface State { cart: Cart; orders: Order[] }

const EMPTY: State = { cart: { storeId: null, lines: [] }, orders: [] };
const shop = createLocalStore<State>("grab-shop-v1", EMPTY, (value): value is State => {
  const s = value as State;
  return !!s?.cart && Array.isArray(s.cart.lines) && Array.isArray(s.orders)
    && (s.cart.storeId === null || typeof s.cart.storeId === "string")
    && s.cart.lines.every((l) => l && typeof l.itemId === "string" && Number.isSafeInteger(l.qty) && l.qty > 0
      && (l.options === undefined || (Array.isArray(l.options) && l.options.every((o) => typeof o === "string"))))
    && s.orders.every((o) => o && typeof o.id === "string" && typeof o.storeId === "string" && typeof o.storeName === "string"
      && typeof o.address === "string" && typeof o.createdAt === "string" && Number.isFinite(o.total)
      && Array.isArray(o.lines) && o.lines.every((l) => l && typeof l.name === "string" && typeof l.itemId === "string"
        && Number.isFinite(l.price) && Number.isSafeInteger(l.qty) && l.qty > 0));
});

export function useShop() {
  useSyncExternalStore(subscribePromotions, getPromotionRules, () => DEFAULT_PROMOTIONS);
  return useSyncExternalStore(shop.subscribe, shop.get, shop.getInitial);
}

/**
 * One store per cart, across the food cart and the partner cart.
 * Returns false when the user keeps their other cart.
 */
function leavePartnerCart(confirmReplace: (otherStoreName: string) => boolean) {
  const partner = partnerCart();
  if (!partner.lines.length) return true;
  if (!confirmReplace(partner.merchantName)) return false;
  clearPartnerCart();
  return true;
}

/**
 * Add one of an item (with its chosen options) to the cart.
 * The cart holds one store at a time. If it has items from another store,
 * `confirmReplace(otherStoreName)` decides whether to start a new cart.
 * Returns false if the user declined.
 */
export function addToCart(storeId: string, itemId: string, confirmReplace: (otherStoreName: string) => boolean, options: string[] = [], qty = 1) {
  if (getStore(storeId)?.kind !== "food" || !getItem(storeId, itemId) || !Number.isSafeInteger(qty) || qty <= 0) return false;
  if (!leavePartnerCart(confirmReplace)) return false;
  const state = shop.get();
  let { cart } = state;
  if (cart.storeId && cart.storeId !== storeId && cart.lines.length > 0) {
    if (!confirmReplace(getStore(cart.storeId)?.name ?? "")) return false;
    cart = { storeId: null, lines: [] };
  }
  const key = lineKey({ itemId, options });
  const existing = cart.lines.find((l) => lineKey(l) === key);
  const lines = existing
    ? cart.lines.map((l) => (lineKey(l) === key ? { ...l, qty: l.qty + qty } : l))
    : [...cart.lines, { itemId, qty, ...(options.length ? { options } : {}) }];
  shop.set({ ...state, cart: { ...cart, storeId, lines } });
  return true;
}

/** Change the quantity of one cart line (identified by lineKey). 0 removes it. */
export function setQty(key: string, qty: number) {
  const state = shop.get();
  if (!Number.isSafeInteger(qty) || qty < 0) return;
  const lines = state.cart.lines
    .map((l) => (lineKey(l) === key ? { ...l, qty } : l))
    .filter((l) => l.qty > 0);
  shop.set({ ...state, cart: lines.length ? { ...state.cart, lines } : { storeId: null, lines: [] } });
}

export function clearCart() {
  const state = shop.get();
  shop.set({ ...state, cart: { storeId: null, lines: [] } });
}

export function setTip(tip: number) {
  const state = shop.get();
  if (!Number.isFinite(tip) || tip < 0) return;
  shop.set({ ...state, cart: { ...state.cart, tip } });
}

/** "ok", "invalid" (unknown code) or "minSpend" (cart too small). */
export function applyPromoCode(raw: string): "ok" | "invalid" | "minSpend" {
  const state = shop.get();
  const code = raw.trim().toUpperCase();
  const details = cartDetails(state.cart, state.orders);
  const result = promotionTotals(state.cart.storeId ?? "", details.lines.map(l => ({ productId: l.itemId, price: l.price, qty: l.qty })), code, state.orders.length === 0);
  if (result.codeError) return result.codeError;
  if (!result.codeValid) return "invalid";
  shop.set({ ...state, cart: { ...state.cart, promoCode: code } });
  return "ok";
}

export function removePromoCode() {
  const state = shop.get();
  shop.set({ ...state, cart: { ...state.cart, promoCode: undefined } });
}

/**
 * Put a past order's items back in the cart ("Order again").
 * Returns "declined" if the user kept their current cart, "unavailable" if none of the items are sold any more.
 */
export function reorder(order: Order, confirmReplace: (otherStoreName: string) => boolean): "ok" | "declined" | "unavailable" {
  const lines = order.lines
    .filter((l) => getItem(order.storeId, l.itemId))
    .map((l) => ({ itemId: l.itemId, qty: l.qty, ...(l.optionIds?.length ? { options: l.optionIds } : {}) }));
  if (!lines.length) return "unavailable";
  if (!leavePartnerCart(confirmReplace)) return "declined";
  const state = shop.get();
  const { cart } = state;
  if (cart.lines.length && cart.storeId && cart.storeId !== order.storeId && !confirmReplace(getStore(cart.storeId)?.name ?? "")) return "declined";
  shop.set({ ...state, cart: { storeId: order.storeId, lines } });
  return "ok";
}

/**
 * Add a merchant partner's product to the cart (one store per cart, like addToCart).
 * Returns "ok", "declined" (user kept their other cart) or "limit" (quantity/line limit reached).
 */
export function addPartnerItem(offer: PartnerOffer, confirmReplace: (otherStoreName: string) => boolean, qty = 1): "ok" | "declined" | "limit" {
  const { cart } = shop.get();
  if (cart.lines.length) {
    if (!confirmReplace(getStore(cart.storeId ?? "")?.name ?? "")) return "declined";
    clearCart();
  }
  const partner = partnerCart();
  if (partner.lines.length && partner.merchantId !== offer.merchant.id) {
    if (!confirmReplace(partner.merchantName)) return "declined";
    clearPartnerCart();
  }
  return putPartnerItem(offer, qty) ? "ok" : "limit";
}

/**
 * Places the order. "Wallet" payment needs a logged-in user (`userId`): it fails with
 * "loginRequired" for guests and "insufficient" if the balance is too low.
 * A contact phone the rider can call is required ("phone" when it is not a valid number).
 */
export function placeOrder(address: string, payment: PaymentMethod, note: string, userId: string | null | undefined, currency: Currency, contactPhone: string): { order: Order } | { error: "empty" | "insufficient" | "loginRequired" | "phone" } {
  const state = shop.get();
  const { store, lines, subtotal, discount, promotionLabel, promoCode, codeDiscount, codeValid, deliveryFee, tip, total } = cartDetails(state.cart, state.orders);
  if (!store || store.kind !== "food" || !lines.length) return { error: "empty" };
  // Checked before the wallet is charged, so a bad number never costs the customer anything.
  const phone = normalizePhoneNumber(contactPhone);
  if (!phone) return { error: "phone" };
  if (payment === "Wallet" && !userId) return { error: "loginRequired" };
  if (payment === "Wallet" && !payFromWallet(userId, total, store.name)) return { error: "insufficient" };
  const order: Order = {
    id: `ORD-${recordId()}`,
    storeId: store.id, storeName: store.name,
    lines: lines.map(({ itemId, name, price, qty, options, optionIds }) => ({ itemId, name, price, qty, options, optionIds })),
    subtotal, discount, promotionLabel,
    promoCode: codeValid ? promoCode : undefined, codeDiscount: codeValid ? codeDiscount : 0,
    deliveryFee, tip, total, address, payment, note, contactPhone: phone, createdAt: new Date().toISOString(),
    // The wallet holds US dollars, so wallet payments are always USD.
    currency: payment === "Wallet" ? "USD" : currency,
  };
  shop.set({ cart: { storeId: null, lines: [] }, orders: [order, ...state.orders] });
  return { order };
}
