"use client";

/**
 * Small pop-up messages ("Added to cart ✓"). Call `toast("text")` from anywhere;
 * <Toaster /> in the root layout shows them for a few seconds.
 */
import { useSyncExternalStore } from "react";

export interface Toast { id: number; text: string; tone: "success" | "error" | "info" }

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const EMPTY: Toast[] = [];

function emit() { listeners.forEach((l) => l()); }

export function toast(text: string, tone: Toast["tone"] = "success") {
  const id = nextId++;
  toasts = [...toasts.slice(-2), { id, text, tone }]; // keep at most 3 on screen
  emit();
  setTimeout(() => dismissToast(id), 2800);
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function useToasts() {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => toasts,
    () => EMPTY,
  );
}
