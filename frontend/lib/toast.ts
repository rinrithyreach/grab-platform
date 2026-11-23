"use client";

/**
 * Small pop-up messages ("Added to cart ✓"). Call `toast("text")` from anywhere;
 * <Toaster /> in the root layout shows them for a few seconds.
 *
 *   toast("Saved");                                   // green success
 *   toast("Card declined", "error");                  // red, stays a little longer
 *   toast("Back online", "info");
 *   toast("You're offline", "warning", { duration: 0 }); // stays until dismissed
 *   toast("Order #12 accepted", "success", { title: "Order update", action: { label: "View", href: "/orders" } });
 *
 * Hovering or focusing a toast pauses its timer so it can be read or clicked.
 */
import { useSyncExternalStore } from "react";

export type ToastTone = "success" | "error" | "info" | "warning";
export interface ToastAction { label: string; href?: string; onClick?: () => void }
export interface ToastOptions {
  /** Bold first line above the text. */
  title?: string;
  /** Milliseconds on screen; 0 keeps it until dismissed. Defaults depend on the tone. */
  duration?: number;
  /** One button inside the toast (e.g. "View" or "Undo"). */
  action?: ToastAction;
  /** Replaces an existing toast with the same key instead of stacking a copy. */
  key?: string;
}
export interface Toast { id: number; text: string; tone: ToastTone; title?: string; action?: ToastAction; key?: string; duration: number }

const DURATION: Record<ToastTone, number> = { success: 3200, info: 3600, warning: 5000, error: 5500 };
const MAX_VISIBLE = 4;

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const timers = new Map<number, { handle: ReturnType<typeof setTimeout> | null; remaining: number; started: number }>();
const EMPTY: Toast[] = [];

function emit() { listeners.forEach((l) => l()); }

function startTimer(id: number, ms: number) {
  if (ms <= 0) { timers.set(id, { handle: null, remaining: 0, started: 0 }); return; }
  timers.set(id, { handle: setTimeout(() => dismissToast(id), ms), remaining: ms, started: Date.now() });
}

export function toast(text: string, tone: ToastTone = "success", options: ToastOptions = {}) {
  const id = nextId++;
  const duration = options.duration ?? DURATION[tone];
  const replaced = options.key ? toasts.find((t) => t.key === options.key) : undefined;
  if (replaced) clearTimer(replaced.id);
  const rest = toasts.filter((t) => t !== replaced);
  // Keep the newest few on screen; older ones leave early.
  const kept = rest.slice(-(MAX_VISIBLE - 1));
  rest.slice(0, rest.length - kept.length).forEach((t) => clearTimer(t.id));
  toasts = [...kept, { id, text, tone, title: options.title, action: options.action, key: options.key, duration }];
  startTimer(id, duration);
  emit();
  return id;
}

function clearTimer(id: number) {
  const timer = timers.get(id);
  if (timer?.handle) clearTimeout(timer.handle);
  timers.delete(id);
}

export function dismissToast(id: number) {
  clearTimer(id);
  const next = toasts.filter((t) => t.id !== id);
  if (next.length === toasts.length) return;
  toasts = next;
  emit();
}

export function dismissAllToasts() {
  toasts.forEach((t) => clearTimer(t.id));
  toasts = [];
  emit();
}

/** Stop the countdown while the pointer or keyboard focus is on the toast. */
export function pauseToast(id: number) {
  const timer = timers.get(id);
  if (!timer?.handle) return;
  clearTimeout(timer.handle);
  timers.set(id, { handle: null, remaining: Math.max(800, timer.remaining - (Date.now() - timer.started)), started: 0 });
}

export function resumeToast(id: number) {
  const timer = timers.get(id);
  if (!timer || timer.handle || timer.remaining <= 0) return;
  startTimer(id, timer.remaining);
}

/** The toasts on screen right now (outside React). */
export const currentToasts = () => toasts;

export function useToasts() {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => toasts,
    () => EMPTY,
  );
}
