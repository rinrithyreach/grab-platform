"use client";

/**
 * Tiny helper for browser-saved data (localStorage) that React can read safely
 * with useSyncExternalStore. The server render and the first browser render both
 * use `initial`, so there is never a hydration mismatch; saved values appear right after.
 *
 *   const store = createLocalStore("key", { ... });
 *   export const useThing = () => useSyncExternalStore(store.subscribe, store.get, store.getInitial);
 */
export function createLocalStore<T extends object>(key: string, initial: T, validate?: (value: unknown) => value is T) {
  let state = initial;
  let loaded = false;
  const listeners = new Set<() => void>();

  function parse(raw: string | null): T {
    if (!raw) return initial;
    try {
      const value: unknown = JSON.parse(raw);
      if (!value || typeof value !== "object" || Array.isArray(value)) return initial;
      const merged = { ...initial, ...value };
      if (validate) return validate(merged) ? merged : initial;
      // Reject corrupt top-level values rather than crashing every subscriber.
      for (const field of Object.keys(initial) as (keyof T)[]) {
        const a = initial[field], b = merged[field];
        if (Array.isArray(a) ? !Array.isArray(b) : typeof a !== typeof b || (typeof b === "number" && !Number.isFinite(b))) return initial;
      }
      return merged;
    } catch { return initial; }
  }

  function load() {
    if (loaded || typeof window === "undefined") return;
    loaded = true;
    try {
      const raw = window.localStorage.getItem(key);
      state = parse(raw);
    } catch { /* storage blocked or corrupt: keep defaults */ }
  }

  const get = () => { load(); return state; };
  const set = (next: T) => {
    load();
    state = next;
    try { window.localStorage.setItem(key, JSON.stringify(next)); } catch { /* ignore */ }
    listeners.forEach((l) => l());
  };

  function onStorage(event: StorageEvent) {
    if (event.key !== key && event.key !== null) return;
    state = parse(event.newValue);
    loaded = true;
    listeners.forEach((listener) => listener());
  }

  return {
    get,
    set,
    update: (fn: (s: T) => T) => set(fn(get())),
    getInitial: () => initial,
    subscribe: (l: () => void) => {
      if (!listeners.size) window.addEventListener("storage", onStorage);
      listeners.add(l);
      return () => {
        listeners.delete(l);
        if (!listeners.size) { window.removeEventListener("storage", onStorage); loaded = false; }
      };
    },
  };
}
