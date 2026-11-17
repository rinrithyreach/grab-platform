"use client";

export type AccountValues = Record<string, object>;
export interface AccountCache { version: number; base: AccountValues; data: AccountValues; pending: boolean; revision: number }
export const ACCOUNT_KEYS = ["grab-shop-v1", "grab-express-demo-v1", "grab-wallet-v1", "grab-profile-v1", "grab-favorites-v1", "grab-reviews-v1", "grab-settings"];
const accountKeys = new Set(ACCOUNT_KEYS);
const stores = new Map<string, { reload: () => void; isInitial: (value: object) => boolean }>();
const changeListeners = new Set<() => void>();
let account: string | null = null;
let cache: AccountCache = { version: 0, base: {}, data: {}, pending: false, revision: 0 };
let listening = false;
const cacheKey = () => `grab-account:${account}`;
const object = (value: unknown): value is Record<string, object> => !!value && typeof value === "object" && !Array.isArray(value);

function readCache(raw: string | null): AccountCache {
  try {
    const value = JSON.parse(raw ?? "null");
    if (value && Number.isSafeInteger(value.version) && value.version >= 0 && object(value.base) && object(value.data)
      && typeof value.pending === "boolean" && Number.isSafeInteger(value.revision)) return value;
  } catch { /* defaults */ }
  return { version: 0, base: {}, data: {}, pending: false, revision: 0 };
}
function persistCache() {
  if (account) try { window.localStorage.setItem(cacheKey(), JSON.stringify(cache)); } catch { /* memory remains usable */ }
}
function notifyStores() { stores.forEach((store, key) => { if (accountKeys.has(key)) store.reload(); }); }
function onAccountStorage(event: StorageEvent) {
  if (!account || (event.key !== cacheKey() && event.key !== null)) return;
  cache = readCache(event.newValue); notifyStores(); changeListeners.forEach((listener) => listener());
}
export function selectLocalAccount(owner: string | null) {
  if (account === owner) return;
  account = owner;
  let raw: string | null = null;
  try { raw = owner ? window.localStorage.getItem(cacheKey()) : null; } catch { /* defaults */ }
  cache = readCache(raw);
  if (!listening && typeof window !== "undefined") { window.addEventListener("storage", onAccountStorage); listening = true; }
  notifyStores();
}
export const activeLocalAccount = () => account;
export const getAccountCache = () => cache;
export function replaceAccountCache(next: AccountCache) { cache = next; persistCache(); notifyStores(); }
export function subscribeAccountChanges(listener: () => void) { changeListeners.add(listener); return () => { changeListeners.delete(listener); }; }

export function availableDeviceData(): AccountValues {
  const data: AccountValues = {};
  if (!account) return data;
  for (const key of ACCOUNT_KEYS) {
    if (cache.data[key]) continue; // Never overwrite an existing server section during import.
    try {
      const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? "null");
      if (object(value) && !stores.get(key)?.isInitial(value)) data[key] = value;
    } catch { /* skip corrupt legacy data */ }
  }
  return data;
}
export function importDeviceData() {
  const imported = availableDeviceData();
  if (!Object.keys(imported).length) return;
  cache = { ...cache, data: { ...cache.data, ...imported }, pending: true, revision: cache.revision + 1 };
  persistCache(); notifyStores(); changeListeners.forEach((listener) => listener());
}
export function backUpPendingData() {
  if (account && cache.pending) try { window.localStorage.setItem(`grab-backup:${account}:${Date.now()}`, JSON.stringify(cache)); } catch { /* best effort */ }
}

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
      const raw = account && accountKeys.has(key) ? JSON.stringify(cache.data[key] ?? initial) : window.localStorage.getItem(key);
      state = parse(raw);
    } catch { /* storage blocked or corrupt: keep defaults */ }
  }

  const get = () => { load(); return state; };
  const set = (next: T) => {
    load();
    state = next;
    if (account && accountKeys.has(key)) {
      cache = { ...cache, data: { ...cache.data, [key]: next }, pending: true, revision: cache.revision + 1 };
      persistCache(); changeListeners.forEach((listener) => listener());
    } else try { window.localStorage.setItem(key, JSON.stringify(next)); } catch { /* ignore */ }
    listeners.forEach((l) => l());
  };

  function onStorage(event: StorageEvent) {
    if (account && accountKeys.has(key)) return;
    if (event.key !== key && event.key !== null) return;
    state = parse(event.newValue);
    loaded = true;
    listeners.forEach((listener) => listener());
  }

  stores.set(key, {
    reload: () => { loaded = false; load(); listeners.forEach((listener) => listener()); },
    isInitial: (value) => JSON.stringify(value) === JSON.stringify(initial),
  });
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
