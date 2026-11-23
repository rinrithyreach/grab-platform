"use client";

/**
 * Styled "Are you sure?" pop-ups that replace the browser's window.confirm().
 * <ConfirmDialog /> in the root layout shows them one at a time.
 *
 *   if (!(await confirmDialog({ title: "Cancel order?", tone: "danger" }))) return;
 */
import { useSyncExternalStore } from "react";

export interface ConfirmOptions {
  title: string;
  message?: string;
  /** Text on the confirm button (defaults to "Confirm"). */
  confirmLabel?: string;
  /** Text on the cancel button (defaults to "Cancel"). */
  cancelLabel?: string;
  /** "danger" paints the confirm button red for destructive actions. */
  tone?: "default" | "danger";
}
export interface PendingConfirm extends ConfirmOptions { id: number; resolve: (ok: boolean) => void }

let queue: PendingConfirm[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  return new Promise((resolve) => {
    queue = [...queue, { ...options, id: nextId++, resolve }];
    emit();
  });
}

/** Answer the dialog on screen; the next queued one (if any) appears after it. */
export function settleConfirm(id: number, ok: boolean) {
  const current = queue.find((d) => d.id === id);
  if (!current) return;
  queue = queue.filter((d) => d !== current);
  emit();
  current.resolve(ok);
}

/** The question on screen right now, or null (outside React). */
export const currentConfirm = () => queue[0] ?? null;

export function useConfirmQueue() {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => queue[0] ?? null,
    () => null,
  );
}

type ReplaceText = (key: "dialog.replaceTitle" | "dialog.replaceConfirm" | "cart.replace", vars?: Record<string, string | number>) => string;

/** The shared "Start a new cart?" question, ready to pass to withReplaceConfirm. */
export const askReplaceCart = (t: ReplaceText) => (store: string) => confirmDialog({
  title: t("dialog.replaceTitle"),
  message: t("cart.replace", { store }),
  confirmLabel: t("dialog.replaceConfirm"),
});

/**
 * The cart helpers ask "replace the other store's cart?" through a synchronous callback,
 * and change nothing until it returns true. This runs them once declining, and if they
 * asked, shows the styled dialog and runs them again with the answer.
 */
export async function withReplaceConfirm<R>(
  run: (confirmReplace: (otherStoreName: string) => boolean) => R,
  ask: (otherStoreName: string) => Promise<boolean>,
): Promise<R> {
  const seen: { name: string | null } = { name: null };
  const first = run((name) => { seen.name ??= name; return false; });
  if (seen.name === null) return first;
  return (await ask(seen.name)) ? run(() => true) : first;
}
