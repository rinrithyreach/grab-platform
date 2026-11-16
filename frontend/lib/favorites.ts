"use client";

/** Stores the user has hearted ❤️, saved in the browser. */
import { useSyncExternalStore } from "react";
import { createLocalStore } from "./local-store";

const store = createLocalStore<{ storeIds: string[] }>("grab-favorites-v1", { storeIds: [] });

export const useFavorites = () => useSyncExternalStore(store.subscribe, store.get, store.getInitial).storeIds;

/** Adds or removes a store; returns true if it is now a favourite. */
export function toggleFavorite(storeId: string) {
  const isFav = store.get().storeIds.includes(storeId);
  store.update((s) => ({ storeIds: isFav ? s.storeIds.filter((id) => id !== storeId) : [storeId, ...s.storeIds] }));
  return !isFav;
}
