"use client";

/**
 * Cart for products published by merchant partners (/partners/[id]).
 * Kept on this device; the order itself is saved by the API, which re-prices
 * every line from the database at checkout. Titles/prices here are only for display.
 *
 * Use lib/cart.ts `addPartnerItem` to add items: it keeps "one store per cart"
 * across both the food cart and this one.
 */
import { useSyncExternalStore } from "react";
import { DELIVERY_FEE } from "./brand";
import { createLocalStore } from "./local-store";

export const MAX_PARTNER_QTY = 50;
export const MAX_PARTNER_LINES = 30;

export interface PartnerLine { listingId: string; title: string; price: number; imageUrl: string; qty: number }
export interface PartnerCart { merchantId: string | null; merchantName: string; lines: PartnerLine[] }
/** The fields of a storefront listing the cart needs. */
export interface PartnerOffer { id: string; title: string; price: number; imageUrl: string; merchant: { id: string; businessName: string } }

const EMPTY: PartnerCart = { merchantId: null, merchantName: "", lines: [] };
const validLine = (l: PartnerLine) => !!l && typeof l.listingId === "string" && typeof l.title === "string"
  && typeof l.imageUrl === "string" && Number.isFinite(l.price) && l.price > 0
  && Number.isSafeInteger(l.qty) && l.qty > 0 && l.qty <= MAX_PARTNER_QTY;
const store = createLocalStore<PartnerCart>("grab-partner-cart-v1", EMPTY, (value): value is PartnerCart => {
  const c = value as PartnerCart;
  return !!c && (c.merchantId === null || typeof c.merchantId === "string") && typeof c.merchantName === "string"
    && Array.isArray(c.lines) && c.lines.length <= MAX_PARTNER_LINES && c.lines.every(validLine);
});

export const usePartnerCart = () => useSyncExternalStore(store.subscribe, store.get, store.getInitial);
export const partnerCart = () => store.get();

const round = (n: number) => Math.round(n * 100) / 100;

/** Item count and money totals. Same flat delivery fee the API charges. */
export function partnerTotals(cart: PartnerCart) {
  const count = cart.lines.reduce((n, l) => n + l.qty, 0);
  const subtotal = round(cart.lines.reduce((sum, l) => sum + l.price * l.qty, 0));
  const deliveryFee = cart.lines.length ? DELIVERY_FEE : 0;
  return { count, subtotal, deliveryFee, total: round(subtotal + deliveryFee) };
}

/** Adds without asking. Starts a new cart if the item is from another merchant. Returns false when a limit is reached. */
export function putPartnerItem(offer: PartnerOffer, qty = 1) {
  if (!Number.isSafeInteger(qty) || qty <= 0 || !Number.isFinite(offer.price) || !(offer.price > 0)) return false;
  const current = store.get();
  const cart = current.merchantId === offer.merchant.id ? current : EMPTY;
  const existing = cart.lines.find((l) => l.listingId === offer.id);
  if ((existing?.qty ?? 0) + qty > MAX_PARTNER_QTY || (!existing && cart.lines.length >= MAX_PARTNER_LINES)) return false;
  const line = { listingId: offer.id, title: offer.title, price: offer.price, imageUrl: offer.imageUrl };
  const lines = existing
    ? cart.lines.map((l) => (l.listingId === offer.id ? { ...l, ...line, qty: l.qty + qty } : l))
    : [...cart.lines, { ...line, qty }];
  store.set({ merchantId: offer.merchant.id, merchantName: offer.merchant.businessName, lines });
  return true;
}

/** Changes one line's quantity; 0 removes it. */
export function setPartnerQty(listingId: string, qty: number) {
  if (!Number.isSafeInteger(qty) || qty < 0 || qty > MAX_PARTNER_QTY) return;
  const cart = store.get();
  const lines = cart.lines.map((l) => (l.listingId === listingId ? { ...l, qty } : l)).filter((l) => l.qty > 0);
  store.set(lines.length ? { ...cart, lines } : EMPTY);
}

export function clearPartnerCart() {
  if (store.get().lines.length || store.get().merchantId) store.set(EMPTY);
}

/** A completed request must not erase a cart edited while it was in flight. */
export function clearSubmittedPartnerCart(submitted: PartnerCart) {
  if (store.get() === submitted) clearPartnerCart();
}

/**
 * Brings the cart up to date with the merchant's current storefront: new titles/prices
 * are shown and products that were unpublished are removed. Returns how many lines were removed.
 */
export function refreshPartnerCart(merchantId: string, merchantName: string, listings: { id: string; title: string; price: number; imageUrl: string }[]) {
  const cart = store.get();
  if (cart.merchantId !== merchantId || !cart.lines.length) return 0;
  const byId = new Map(listings.map((l) => [l.id, l]));
  const lines = cart.lines.flatMap((l) => {
    const live = byId.get(l.listingId);
    return live ? [{ ...l, title: live.title, price: live.price, imageUrl: live.imageUrl }] : [];
  });
  const removed = cart.lines.length - lines.length;
  const next = lines.length ? { merchantId, merchantName, lines } : EMPTY;
  if (JSON.stringify(next) !== JSON.stringify(cart)) store.set(next);
  return removed;
}
