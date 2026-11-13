"use client";

/**
 * Cart + order history, saved in the browser (localStorage).
 * A tiny external store read with useSyncExternalStore so the server render
 * (empty cart) and the first client render always match.
 */
import { useSyncExternalStore } from "react";
import { DELIVERY_FEE } from "./brand";
import { getItem, getStore } from "./catalog";

export interface CartLine { itemId: string; qty: number }
export interface Cart { storeId: string | null; lines: CartLine[] }
export interface OrderLine { itemId: string; name: string; price: number; qty: number }
export interface Order {
  id: string; storeId: string; storeName: string; lines: OrderLine[];
  subtotal: number; deliveryFee: number; total: number;
  address: string; payment: "Cash" | "Card"; note: string; createdAt: string;
}
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

/** Returns false if the cart holds items from another store and the user declined to clear it. */
export function addToCart(storeId: string, itemId: string) {
  load();
  let { cart } = state;
  if (cart.storeId && cart.storeId !== storeId && cart.lines.length > 0) {
    const other = getStore(cart.storeId)?.name ?? "another store";
    if (!window.confirm(`Your cart has items from ${other}. Start a new cart?`)) return false;
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
  set({ ...state, cart: { storeId: lines.length ? state.cart.storeId : null, lines } });
}

export function clearCart() {
  load();
  set({ ...state, cart: { storeId: null, lines: [] } });
}

export function cartDetails(cart: Cart) {
  const store = cart.storeId ? getStore(cart.storeId) : undefined;
  const lines: OrderLine[] = store
    ? cart.lines.flatMap((l) => {
        const item = getItem(store.id, l.itemId);
        return item ? [{ itemId: item.id, name: item.name, price: item.price, qty: l.qty }] : [];
      })
    : [];
  const subtotal = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
  const deliveryFee = lines.length ? DELIVERY_FEE : 0;
  const count = lines.reduce((sum, l) => sum + l.qty, 0);
  return { store, lines, subtotal, deliveryFee, total: subtotal + deliveryFee, count };
}

export function placeOrder(address: string, payment: Order["payment"], note: string) {
  load();
  const { store, lines, subtotal, deliveryFee, total } = cartDetails(state.cart);
  if (!store || !lines.length) return null;
  const order: Order = {
    id: `ORD-${Date.now().toString(36).toUpperCase()}`,
    storeId: store.id, storeName: store.name, lines, subtotal, deliveryFee, total,
    address, payment, note, createdAt: new Date().toISOString(),
  };
  set({ cart: { storeId: null, lines: [] }, orders: [order, ...state.orders] });
  return order;
}
