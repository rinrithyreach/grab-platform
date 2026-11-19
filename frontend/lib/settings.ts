"use client";

/**
 * User settings (language + theme), synced to the account and kept on this device.
 * The inline script in lib/settings-script.ts applies them before first paint;
 * this store keeps React in sync and re-applies on change.
 */
import { useSyncExternalStore } from "react";
import { SETTINGS_KEY, type Settings } from "./settings-script";
import { createLocalStore } from "./local-store";

export type { Lang, Theme, Settings } from "./settings-script";

const DEFAULTS: Settings = { lang: "en", theme: "system" };
const store = createLocalStore<Settings>(SETTINGS_KEY, DEFAULTS, (value): value is Settings => {
  const settings = value as Settings;
  return ["en", "km"].includes(settings.lang) && ["light", "dark", "system"].includes(settings.theme);
}, { persistOnDevice: true });

function apply() {
  const state = store.get();
  const root = document.documentElement;
  const dark = state.theme === "dark" ||
    (state.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.dataset.theme = dark ? "dark" : "light";
  root.lang = state.lang;
}

function subscribe(listener: () => void) {
  const unsubscribe = store.subscribe(() => { apply(); listener(); });
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystemChange = () => apply();
  media.addEventListener("change", onSystemChange);
  apply();
  return () => { unsubscribe(); media.removeEventListener("change", onSystemChange); };
}

export function useSettings() {
  return useSyncExternalStore(subscribe, store.get, store.getInitial);
}

export function updateSettings(patch: Partial<Settings>) {
  store.update((state) => ({ ...state, ...patch }));
  apply();
}
