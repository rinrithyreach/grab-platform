"use client";

/**
 * Cart + order history, saved in the browser (localStorage).
 * A tiny external store read with useSyncExternalStore so the server render
 * (empty cart) and the first client render always match.
 * The price maths lives in lib/pricing.ts.
 */
import { useSyncExternalStore } from "react";
import { getItem } from "./catalog";
import { cartDetails, lineKey, PROMO_CODES, type Cart, type Order, type PaymentMethod } from "./pricing";
import { payFromWallet } from "./wallet";

export {
  cartDetails, isValidAddress, lineKey, PROMO_CODES, TIP_OPTIONS,
  type Cart, type CartLine, type Order, type OrderLine, type PaymentMethod,
} from "./pricing";

interface State { cart: Cart; orders: Order[] }

const KEY = "grab-shop-v1";
const EMPTY: State = { cart: { storeId: null, lines: [] }, orders: [] };
let state: State = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = { ...EMPTY, ...JSON.parse(raw) };
  } catch { /* storage blocked or corrupt — start empty */ }
}

function set(next: State) {
  state = next;
  try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useShop() {
  return useSyncExternalStore(subscribe, () => { load(); return state; }, () => EMPTY);
}

/**
 * Add one of an item (with its chosen options) to the cart.
 * The cart holds one store at a time. If it has items from another store,
 * `confirmReplace(otherStoreId)` decides whether to start a new cart.
 * Returns false if the user declined.
 */
export function addToCart(storeId: string, itemId: string, confirmReplace: (otherStoreId: string) => boolean, options: string[] = [], qty = 1) {
  load();
  let { cart } = state;
  if (cart.storeId && cart.storeId !== storeId && cart.lines.length > 0) {
    if (!confirmReplace(cart.storeId)) return false;
    cart = { storeId: null, lines: [] };
  }
  const key = lineKey({ itemId, options });
  const existing = cart.lines.find((l) => lineKey(l) === key);
  const lines = existing
    ? cart.lines.map((l) => (lineKey(l) === key ? { ...l, qty: l.qty + qty } : l))
    : [...cart.lines, { itemId, qty, ...(options.length ? { options } : {}) }];
  set({ ...state, cart: { ...cart, storeId, lines } });
  return true;
}

/** Change the quantity of one cart line (identified by lineKey). 0 removes it. */
export function setQty(key: string, qty: number) {
  load();
  const lines = state.cart.lines
    .map((l) => (lineKey(l) === key ? { ...l, qty } : l))
    .filter((l) => l.qty > 0);
  set({ ...state, cart: lines.length ? { ...state.cart, lines } : { storeId: null, lines: [] } });
}

export function clearCart() {
  load();
  set({ ...state, cart: { storeId: null, lines: [] } });
}

export function setTip(tip: number) {
  load();
  set({ ...state, cart: { ...state.cart, tip } });
}

/** "ok", "invalid" (unknown code) or "minSpend" (cart too small). */
export function applyPromoCode(raw: string): "ok" | "invalid" | "minSpend" {
  load();
  const code = raw.trim().toUpperCase();
  const promo = PROMO_CODES[code];
  if (!promo) return "invalid";
  if (promo.minSubtotal && cartDetails(state.cart).subtotal < promo.minSubtotal) return "minSpend";
  set({ ...state, cart: { ...state.cart, promoCode: code } });
  return "ok";
}

export function removePromoCode() {
  load();
  set({ ...state, cart: { ...state.cart, promoCode: undefined } });
}

/** Put a past order's items back in the cart ("Order again"). Returns false if the user declined to replace the cart. */
export function reorder(order: Order, confirmReplace: (otherStoreId: string) => boolean) {
  load();
  const { cart } = state;
  if (cart.lines.length && cart.storeId && cart.storeId !== order.storeId && !confirmReplace(cart.storeId)) return false;
  const lines = order.lines
    .filter((l) => getItem(order.storeId, l.itemId))
    .map((l) => ({ itemId: l.itemId, qty: l.qty, ...(l.optionIds?.length ? { options: l.optionIds } : {}) }));
  set({ ...state, cart: { storeId: lines.length ? order.storeId : null, lines } });
  return lines.length > 0;
}

/** Places the order. With "Wallet" payment it fails with "insufficient" if the balance is too low. */
export function placeOrder(address: string, payment: PaymentMethod, note: string): { order: Order } | { error: "empty" | "insufficient" } {
  load();
  const { store, lines, subtotal, discount, promoCode, codeDiscount, codeValid, deliveryFee, tip, total } = cartDetails(state.cart, state.orders);
  if (!store || !lines.length) return { error: "empty" };
  if (payment === "Wallet" && !payFromWallet(total, store.name)) return { error: "insufficient" };
  const order: Order = {
    id: `ORD-${Date.now().toString(36).toUpperCase()}`,
    storeId: store.id, storeName: store.name,
    lines: lines.map(({ itemId, name, price, qty, options, optionIds }) => ({ itemId, name, price, qty, options, optionIds })),
    subtotal, discount,
    promoCode: codeValid ? promoCode : undefined, codeDiscount: codeValid ? codeDiscount : 0,
    deliveryFee, tip, total, address, payment, note, createdAt: new Date().toISOString(),
  };
  set({ cart: { storeId: null, lines: [] }, orders: [order, ...state.orders] });
  return { order };
}
