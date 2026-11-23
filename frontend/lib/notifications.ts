"use client";

/**
 * The notification inbox behind the 🔔 in the navbar.
 *
 *   notify({ id: `order:${id}:Accepted`, kind: "order", title: "Order update", body: "…", href: "/orders" });
 *
 * Each signed-in account (and guests) has its own list, saved in this browser (newest first,
 * at most MAX_ITEMS). An `id` that is already in the list is ignored, so two open tabs that
 * notice the same change only add it once.
 */
import { useSyncExternalStore } from "react";

export type NotificationKind = "order" | "ride" | "wallet" | "account" | "merchant" | "system" | "product" | "wishlist";
export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** Page to open when the notification is clicked. */
  href?: string;
  createdAt: number;
  read: boolean;
}
export type NotifyInput = Omit<AppNotification, "id" | "createdAt" | "read"> & { id?: string };

const MAX_ITEMS = 50;
const PREFIX = "grab-notifications:";
const KINDS = new Set<NotificationKind>(["order", "ride", "wallet", "account", "merchant", "system", "product", "wishlist"]);
const PREFS_KEY = "grab-notify-prefs";
const EMPTY: AppNotification[] = [];

let owner = "guest";
let items: AppNotification[] = EMPTY;
let loaded = false;
let listening = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const storageKey = () => `${PREFIX}${owner}`;

function valid(value: unknown): value is AppNotification {
  const n = value as AppNotification;
  return !!n && typeof n === "object" && typeof n.id === "string" && KINDS.has(n.kind) && typeof n.title === "string"
    && typeof n.body === "string" && Number.isFinite(n.createdAt) && typeof n.read === "boolean"
    && (n.href === undefined || (typeof n.href === "string" && n.href.startsWith("/")));
}

function read(): AppNotification[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(storageKey()) ?? "[]");
    return Array.isArray(value) ? value.filter(valid).slice(0, MAX_ITEMS) : EMPTY;
  } catch { return EMPTY; }
}

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  items = read();
  if (!listening) {
    listening = true;
    // Another tab added or read a notification.
    window.addEventListener("storage", (event) => {
      if (event.key !== storageKey() && event.key !== PREFS_KEY && event.key !== null) return;
      items = read();
      prefs = readPrefs();
      emit();
    });
  }
}

function save(next: AppNotification[]) {
  items = next;
  try { window.localStorage.setItem(storageKey(), JSON.stringify(next)); } catch { /* memory copy still works */ }
  emit();
}

/** Switch to the signed-in account's inbox (null = guest). */
export function selectNotificationOwner(id: string | null) {
  const next = id ?? "guest";
  if (next === owner && loaded) return;
  owner = next;
  loaded = false;
  load();
  emit();
}

/** Adds a notification. Returns false when one with the same id already exists. */
export function notify(input: NotifyInput): boolean {
  if (typeof window === "undefined") return false;
  load();
  const id = input.id ?? `${input.kind}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  // Re-read so a copy just added by another tab is respected.
  const current = read();
  if (current.some((n) => n.id === id)) { items = current; return false; }
  const entry: AppNotification = { kind: input.kind, title: input.title, body: input.body, href: input.href, id, createdAt: Date.now(), read: false };
  save([entry, ...current].slice(0, MAX_ITEMS));
  return true;
}

export function markNotificationRead(id: string) {
  load();
  if (items.some((n) => n.id === id && !n.read)) save(items.map((n) => n.id === id ? { ...n, read: true } : n));
}

export function markAllNotificationsRead() {
  load();
  if (items.some((n) => !n.read)) save(items.map((n) => n.read ? n : { ...n, read: true }));
}

export function removeNotification(id: string) {
  load();
  save(items.filter((n) => n.id !== id));
}

export function clearNotifications() {
  load();
  save([]);
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export function useNotifications() {
  return useSyncExternalStore(subscribe, () => { load(); return items; }, () => EMPTY);
}

export function useUnreadCount() {
  return useSyncExternalStore(subscribe, () => { load(); return items.reduce((n, item) => n + (item.read ? 0 : 1), 0); }, () => 0);
}

/* ---------- Which product alerts the person wants (this device) ---------- */

export interface NotifyPrefs {
  /** Newly published products from merchants. */
  newProducts: boolean;
  /** Saved products that come back after selling out. */
  restock: boolean;
  /** Price drops and sell-outs of saved products. */
  wishlist: boolean;
}
const DEFAULT_PREFS: NotifyPrefs = { newProducts: true, restock: true, wishlist: true };
let prefs: NotifyPrefs | null = null;

function readPrefs(): NotifyPrefs {
  try {
    const value = JSON.parse(window.localStorage.getItem(PREFS_KEY) ?? "{}") as Partial<NotifyPrefs>;
    return {
      newProducts: typeof value.newProducts === "boolean" ? value.newProducts : DEFAULT_PREFS.newProducts,
      restock: typeof value.restock === "boolean" ? value.restock : DEFAULT_PREFS.restock,
      wishlist: typeof value.wishlist === "boolean" ? value.wishlist : DEFAULT_PREFS.wishlist,
    };
  } catch { return DEFAULT_PREFS; }
}

export function notifyPrefs(): NotifyPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  load();
  return prefs ??= readPrefs();
}

export function setNotifyPref(key: keyof NotifyPrefs, on: boolean) {
  prefs = { ...notifyPrefs(), [key]: on };
  try { window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* memory copy still works */ }
  emit();
}

export function useNotifyPrefs() {
  return useSyncExternalStore(subscribe, notifyPrefs, () => DEFAULT_PREFS);
}

/* ---------- Logout vs. session expiry ---------- */

/** Fired on window by lib/auth.tsx when the person logs out themselves (not a token expiry or 401). */
export const LOGOUT_EVENT = "grab:logout";
