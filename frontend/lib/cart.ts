"use client";

/**
 * Cart + order history, saved in the browser (localStorage).
 * A tiny external store read with useSyncExternalStore so the server render
 * (empty cart) and the first client render always match.
 */
import { useSyncExternalStore } from "react";
import { DELIVERY_FEE } from "./brand";
import { getItem, getStore } from "./catalog";
import { payFromWallet } from "./wallet";

export interface CartLine { itemId: string; qty: number }
export interface Cart { storeId: string | null; lines: CartLine[]; promoCode?: string }
export interface OrderLine { itemId: string; name: string; price: number; qty: number }
export interface Order {
  id: string; storeId: string; storeName: string; lines: OrderLine[];
  subtotal: number; discount?: number; promoCode?: string; codeDiscount?: number;
  deliveryFee: number; total: number;
  address: string; payment: PaymentMethod; note: string; createdAt: string;
}
export type PaymentMethod = "Cash" | "Card" | "Wallet";

/**
 * Promo codes typed at checkout (demo). They stack with the store's own deal.
 * Add or change codes here.
 */
export const PROMO_CODES: Record<string, { kind: "amount" | "percent" | "freeDelivery"; value: number; minSubtotal?: number; maxDiscount?: number }> = {
  GROUP6: { kind: "amount", value: 1, minSubtotal: 3 },               // $1 off orders of $3+
  WELCOME10: { kind: "percent", value: 10, maxDiscount: 3 },          // 10% off, up to $3
  FREESHIP: { kind: "freeDelivery", value: 0 },                       // free delivery
};
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
 * The cart holds one store at a time. If it has items from another store,
 * `confirmReplace(otherStoreId)` decides whether to start a new cart.
 * Returns false if the user declined.
 */
export function addToCart(storeId: string, itemId: string, confirmReplace: (otherStoreId: string) => boolean) {
  load();
  let { cart } = state;
  if (cart.storeId && cart.storeId !== storeId && cart.lines.length > 0) {
    if (!confirmReplace(cart.storeId)) return false;
    cart = { storeId: null, lines: [] };
  }
  const existing = cart.lines.find((l) => l.itemId === itemId);
  const lines = existing
    ? cart.lines.map((l) => (l.itemId === itemId ? { ...l, qty: l.qty + 1 } : l))
    : [...cart.lines, { itemId, qty: 1 }];
  set({ ...state, cart: { storeId, lines } });
  return true;
}

export function setQty(itemId: string, qty: number) {
  load();
  const lines = state.cart.lines
    .map((l) => (l.itemId === itemId ? { ...l, qty } : l))
    .filter((l) => l.qty > 0);
  set({ ...state, cart: lines.length ? { ...state.cart, lines } : { storeId: null, lines: [] } });
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
  const lines = order.lines.filter((l) => getItem(order.storeId, l.itemId)).map((l) => ({ itemId: l.itemId, qty: l.qty }));
  set({ ...state, cart: { storeId: lines.length ? order.storeId : null, lines } });
  return lines.length > 0;
}

export function clearCart() {
  load();
  set({ ...state, cart: { storeId: null, lines: [] } });
}

/**
 * Works out the cart totals, including the store's promotion.
 * `pastOrders` is needed for "first order" deals; leave it out when only the item count matters.
 */
export function cartDetails(cart: Cart, pastOrders: Order[] = []) {
  const store = cart.storeId ? getStore(cart.storeId) : undefined;
  const lines: OrderLine[] = store
    ? cart.lines.flatMap((l) => {
        const item = getItem(store.id, l.itemId);
        return item ? [{ itemId: item.id, name: item.name, price: item.price, qty: l.qty }] : [];
      })
    : [];
  const subtotal = round(lines.reduce((sum, l) => sum + l.price * l.qty, 0));
  const count = lines.reduce((sum, l) => sum + l.qty, 0);
  const normalFee = lines.length ? DELIVERY_FEE : 0;

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
      discount = round(lines.reduce((sum, l) => sum + Math.floor(l.qty / group) * deal.free * l.price, 0));
      dealApplied = discount > 0;
    }
  }

  // Promo code typed at checkout (applied after the store deal).
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

  return {
    store, lines, count, subtotal, discount, normalFee, deliveryFee,
    promoCode, codeDiscount, codeValid,
    total: round(Math.max(0, subtotal - discount - codeDiscount + deliveryFee)),
    deal, dealApplied, amountToUnlock,
  };
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * A delivery address must be at least 5 characters and contain both
 * letters and numbers (e.g. "House 12, St. 271"). Works for Khmer letters and digits too.
 */
export function isValidAddress(address: string) {
  const a = address.trim();
  return a.length >= 5 && /\p{L}/u.test(a) && /\p{Nd}/u.test(a);
}

/** Places the order. With "Wallet" payment it fails with "insufficient" if the balance is too low. */
export function placeOrder(address: string, payment: PaymentMethod, note: string): { order: Order } | { error: "empty" | "insufficient" } {
  load();
  const { store, lines, subtotal, discount, promoCode, codeDiscount, codeValid, deliveryFee, total } = cartDetails(state.cart, state.orders);
  if (!store || !lines.length) return { error: "empty" };
  if (payment === "Wallet" && !payFromWallet(total, store.name)) return { error: "insufficient" };
  const order: Order = {
    id: `ORD-${Date.now().toString(36).toUpperCase()}`,
    storeId: store.id, storeName: store.name, lines, subtotal, discount,
    promoCode: codeValid ? promoCode : undefined, codeDiscount: codeValid ? codeDiscount : 0,
    deliveryFee, total, address, payment, note, createdAt: new Date().toISOString(),
  };
  set({ cart: { storeId: null, lines: [] }, orders: [order, ...state.orders] });
  return { order };
}
