"use client";

/**
 * User settings (language + theme), saved in localStorage.
 * The inline script in lib/settings-script.ts applies them before first paint;
 * this store keeps React in sync and re-applies on change.
 */
import { useSyncExternalStore } from "react";
import { SETTINGS_KEY, type Settings } from "./settings-script";

export type { Lang, Theme, Settings } from "./settings-script";

const DEFAULTS: Settings = { lang: "en", theme: "system" };
let state: Settings = DEFAULTS;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (raw) state = { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* storage blocked — keep defaults */ }
}

function apply() {
  const root = document.documentElement;
  const dark = state.theme === "dark" ||
    (state.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.dataset.theme = dark ? "dark" : "light";
  root.lang = state.lang;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystemChange = () => { load(); apply(); };
  media.addEventListener("change", onSystemChange);
  return () => { listeners.delete(listener); media.removeEventListener("change", onSystemChange); };
}

export function useSettings() {
  return useSyncExternalStore(subscribe, () => { load(); return state; }, () => DEFAULTS);
}

export function updateSettings(patch: Partial<Settings>) {
  load();
  state = { ...state, ...patch };
  try { window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(state)); } catch { /* ignore */ }
  apply();
  listeners.forEach((l) => l());
}
