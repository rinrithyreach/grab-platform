"use client";

import { useCallback, useEffect, useRef } from "react";

const CLOSE_MS = 180;
const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Plays the closing animation (.is-closing in admin.css) on a dialog, then runs `done`.
 * Falls back to a timer so `done` always runs, even when the animation is skipped.
 */
export function closeDialogSmoothly(el: HTMLDialogElement | null, done: () => void) {
  if (!el || !el.open || reduceMotion()) { done(); return; }
  let finished = false;
  const finish = () => { if (finished) return; finished = true; el.classList.remove("is-closing"); done(); };
  el.classList.add("is-closing");
  el.addEventListener("animationend", (e) => { if (e.target === el) finish(); });
  window.setTimeout(finish, CLOSE_MS + 80);
}

/** Opens a modal <dialog> on mount and closes it with an animation. Blocked while `busy`. */
export function useAdminDialog(onClose: () => void, busy: boolean) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closing = useRef(false);
  useEffect(() => { const el = dialog.current; el?.showModal(); return () => el?.close(); }, []);
  const close = useCallback(() => {
    if (busy || closing.current) return;
    closing.current = true;
    closeDialogSmoothly(dialog.current, onClose);
  }, [busy, onClose]);
  return { dialog, ref: dialog, close };
}
