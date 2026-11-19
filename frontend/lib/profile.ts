"use client";

/** Saved delivery addresses. The shared local store syncs signed-in state through the API. */
import { useSyncExternalStore } from "react";
import { createLocalStore } from "./local-store";

export type AddressLabel = "home" | "work" | "other";
export interface SavedAddress { label: AddressLabel; text: string }
interface ProfileState { addresses: SavedAddress[] }

const store = createLocalStore<ProfileState>("grab-profile-v1", { addresses: [] }, (value): value is ProfileState => {
  const addresses = (value as ProfileState)?.addresses;
  return Array.isArray(addresses) && addresses.length <= 3 && addresses.every((a) => a
    && ["home", "work", "other"].includes(a.label) && typeof a.text === "string" && a.text.length <= 300)
    && new Set(addresses.map((a) => a.label)).size === addresses.length;
});

export const useProfile = () => useSyncExternalStore(store.subscribe, store.get, store.getInitial);

export function saveAddress(label: AddressLabel, text: string) {
  if (!["home", "work", "other"].includes(label) || !text.trim() || text.trim().length > 300) return;
  store.update((s) => ({
    addresses: [...s.addresses.filter((a) => a.label !== label), { label, text: text.trim() }]
      .sort((a, b) => ["home", "work", "other"].indexOf(a.label) - ["home", "work", "other"].indexOf(b.label)),
  }));
}

export function removeAddress(label: AddressLabel) {
  store.update((s) => ({ addresses: s.addresses.filter((a) => a.label !== label) }));
}
