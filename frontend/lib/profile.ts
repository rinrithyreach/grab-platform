"use client";

/** The user's saved delivery addresses (Home / Work / Other), kept in the browser. */
import { useSyncExternalStore } from "react";
import { createLocalStore } from "./local-store";

export type AddressLabel = "home" | "work" | "other";
export interface SavedAddress { label: AddressLabel; text: string }
interface ProfileState { addresses: SavedAddress[] }

const store = createLocalStore<ProfileState>("grab-profile-v1", { addresses: [] });

export const useProfile = () => useSyncExternalStore(store.subscribe, store.get, store.getInitial);

export function saveAddress(label: AddressLabel, text: string) {
  store.update((s) => ({
    addresses: [...s.addresses.filter((a) => a.label !== label), { label, text: text.trim() }]
      .sort((a, b) => ["home", "work", "other"].indexOf(a.label) - ["home", "work", "other"].indexOf(b.label)),
  }));
}

export function removeAddress(label: AddressLabel) {
  store.update((s) => ({ addresses: s.addresses.filter((a) => a.label !== label) }));
}
