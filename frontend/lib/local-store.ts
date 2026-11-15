"use client";

/**
 * Tiny helper for browser-saved data (localStorage) that React can read safely
 * with useSyncExternalStore. The server render and the first browser render both
 * use `initial`, so there is never a hydration mismatch; saved values appear right after.
 *
 *   const store = createLocalStore("key", { ... });
 *   export const useThing = () => useSyncExternalStore(store.subscribe, store.get, store.getInitial);
 */
export function createLocalStore<T extends object>(key: string, initial: T) {
  let state = initial;
  let loaded = false;
  const listeners = new Set<() => void>();

  function load() {
    if (loaded || typeof window === "undefined") return;
    loaded = true;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) state = { ...initial, ...JSON.parse(raw) };
    } catch { /* storage blocked or corrupt: keep defaults */ }
  }

  const get = () => { load(); return state; };
  const set = (next: T) => {
    load();
    state = next;
    try { window.localStorage.setItem(key, JSON.stringify(next)); } catch { /* ignore */ }
    listeners.forEach((l) => l());
  };

  return {
    get,
    set,
    update: (fn: (s: T) => T) => set(fn(get())),
    getInitial: () => initial,
    subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
  };
}
