"use client";

/**
 * User settings (language + theme), synced to the account and kept on this device.
 * The inline script in lib/settings-script.ts applies them before first paint;
 * this store keeps React in sync and re-applies on change.
 */
import { useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { SETTINGS_KEY, type Settings } from "./settings-script";
import { createLocalStore } from "./local-store";

export type { Lang, Theme, Settings } from "./settings-script";

const DEFAULTS: Settings = { lang: "en", theme: "light" };
const store = createLocalStore<Settings>(SETTINGS_KEY, DEFAULTS, (value): value is Settings => {
  const settings = value as { lang: unknown; theme: unknown };
  // Older saves may hold the removed "system" theme: keep what the person was seeing.
  if (settings.theme === "system") {
    settings.theme = typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return ["en", "km"].includes(settings.lang as string) && ["light", "dark"].includes(settings.theme as string);
}, { persistOnDevice: true });

function apply() {
  const state = store.get();
  const root = document.documentElement;
  root.dataset.theme = state.theme === "dark" ? "dark" : "light";
  root.lang = state.lang;
}

function subscribe(listener: () => void) {
  const unsubscribe = store.subscribe(() => { apply(); listener(); });
  apply();
  return unsubscribe;
}

export function useSettings() {
  return useSyncExternalStore(subscribe, store.get, store.getInitial);
}

type TransitionDocument = Document & { startViewTransition?: (update: () => void) => { finished?: Promise<void> } | undefined };
let fadeTimer: number | undefined;

export function updateSettings(patch: Partial<Settings>) {
  const current = store.get();
  const changed = (Object.keys(patch) as (keyof Settings)[]).some((key) => patch[key] !== current[key]);
  // flushSync renders the new language before the browser takes its "after" snapshot.
  const commit = () => flushSync(() => { store.update((state) => ({ ...state, ...patch })); apply(); });
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!changed || reduceMotion) return commit();

  const doc = document as TransitionDocument;
  const root = document.documentElement;
  if (typeof doc.startViewTransition === "function") {
    // Cross-fade the whole page from the old look/language to the new one. .settings-transition makes the
    // page fade as one picture: parts that stay still during page changes (navbar, admin sidebar) fade too.
    root.classList.add("settings-transition");
    const done = () => root.classList.remove("settings-transition");
    const transition = doc.startViewTransition(commit);
    if (transition?.finished) transition.finished.then(done, done); else done();
    return;
  }
  // Older browsers: briefly let colours ease instead of jumping (see .settings-fading in globals.css).
  root.classList.add("settings-fading");
  commit();
  window.clearTimeout(fadeTimer);
  fadeTimer = window.setTimeout(() => root.classList.remove("settings-fading"), 400);
}
