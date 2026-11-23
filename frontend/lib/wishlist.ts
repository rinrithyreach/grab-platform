"use client";

/**
 * Saved merchant products (the ♡ on product cards). Signed-in changes sync through the
 * shared account-data API, like favourite stores.
 *
 * The notification watcher checks saved products in the background and alerts when one
 * drops in price, sells out (the merchant stops selling it) or comes back in stock.
 * What it last saw lives in a separate, device-only status store.
 */
import { useSyncExternalStore } from "react";
import type { MerchantOffer, MerchantServiceKind } from "./api";
import { createLocalStore } from "./local-store";

export interface WishItem {
  listingId: string;
  merchantId: string;
  merchantName: string;
  title: string;
  /** Price when it was saved (USD). */
  price: number;
  imageUrl: string;
  service: MerchantServiceKind | "";
  addedAt: string;
}
export const MAX_WISHLIST = 60;
/** Fired on window when a product is saved, so the watcher checks it right away. */
export const WISHLIST_CHANGED = "grab:wishlist";
const changed = () => { try { window.dispatchEvent(new window.Event(WISHLIST_CHANGED)); } catch { /* checked on the next round */ } };

const text = (value: unknown, max: number) => typeof value === "string" && value.length <= max;
function validItem(value: unknown): value is WishItem {
  const item = value as WishItem;
  return !!item && typeof item === "object" && text(item.listingId, 64) && !!item.listingId && text(item.merchantId, 64) && !!item.merchantId
    && text(item.merchantName, 200) && text(item.title, 200) && Number.isFinite(item.price) && item.price >= 0
    && text(item.imageUrl, 500) && text(item.service, 20) && text(item.addedAt, 40);
}

const store = createLocalStore<{ items: WishItem[] }>("grab-wishlist-v1", { items: [] }, (value): value is { items: WishItem[] } => {
  const state = value as { items: unknown };
  if (!Array.isArray(state.items)) return false;
  state.items = state.items.filter(validItem).slice(0, MAX_WISHLIST); // drop corrupt entries instead of losing the list
  return true;
});

export const useWishlist = () => useSyncExternalStore(store.subscribe, store.get, store.getInitial).items;
export const wishlistItems = () => store.get().items;

function fromOffer(offer: MerchantOffer): WishItem {
  return {
    listingId: offer.id, merchantId: offer.merchant.id, merchantName: offer.merchant.businessName,
    title: offer.title, price: offer.price, imageUrl: offer.imageUrl ?? "", service: offer.merchant.service,
    addedAt: new Date().toISOString(),
  };
}

/** Saves or removes a product; returns true if it is now saved. */
export function toggleWishlist(offer: MerchantOffer) {
  const saved = store.get().items.some((item) => item.listingId === offer.id);
  store.update((s) => ({ items: saved ? s.items.filter((item) => item.listingId !== offer.id) : [fromOffer(offer), ...s.items].slice(0, MAX_WISHLIST) }));
  if (!saved) changed();
  return !saved;
}

export function removeFromWishlist(listingId: string) {
  store.update((s) => ({ items: s.items.filter((item) => item.listingId !== listingId) }));
}

/**
 * "Notify me when it's back" on a product that isn't sold right now. Details are unknown
 * until the merchant sells it again; the watcher fills them in then.
 */
export function watchForRestock(merchantId: string, listingId: string) {
  if (store.get().items.some((item) => item.listingId === listingId)) return;
  const entry: WishItem = { listingId, merchantId, merchantName: "", title: "", price: 0, imageUrl: "", service: "", addedAt: new Date().toISOString() };
  store.update((s) => ({ items: [entry, ...s.items].slice(0, MAX_WISHLIST) }));
  changed();
}

/** Fill in details that were missing when the product was saved (never overwrites the saved price). */
export function fillWishItem(offer: MerchantOffer) {
  const current = store.get().items.find((item) => item.listingId === offer.id);
  if (!current || (current.title && current.merchantName && current.imageUrl)) return;
  const fresh = fromOffer(offer);
  store.update((s) => ({ items: s.items.map((item) => item.listingId !== offer.id ? item : {
    ...item, title: item.title || fresh.title, merchantName: item.merchantName || fresh.merchantName,
    imageUrl: item.imageUrl || fresh.imageUrl, service: item.service || fresh.service, price: item.price || fresh.price,
  }) }));
}

/* ---------- What the watcher last saw (this device only) ---------- */

export interface WishStatus { available: boolean; price: number; checkedAt: string }
const statusStore = createLocalStore<{ status: Record<string, WishStatus> }>("grab-wishlist-status-v1", { status: {} });

export const useWishStatus = () => useSyncExternalStore(statusStore.subscribe, statusStore.get, statusStore.getInitial).status;
export const wishStatus = () => statusStore.get().status;
export function setWishStatus(next: Record<string, WishStatus>) { statusStore.set({ status: next }); }
