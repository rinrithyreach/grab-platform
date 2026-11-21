"use client";

/**
 * When the tab is hidden during a page fade (switching tabs, minimising, or a dev
 * hot reload while the editor has focus), Chrome skips the View Transition with
 * "Transition was aborted because of invalid state. Document hidden". React ignores
 * this harmless skip only when the message is exactly "...invalid state", so the
 * newer Chrome wording surfaced as a "Recoverable InvalidStateError". This shim
 * restores the wording React recognises; every other error passes through unchanged.
 */
const SKIPPED = "Transition was aborted because of invalid state";

function normalize(error: unknown): never {
  if (error instanceof DOMException && error.name === "InvalidStateError" && error.message !== SKIPPED && error.message.startsWith(SKIPPED))
    throw new DOMException(SKIPPED, "InvalidStateError");
  throw error;
}

type Patched = Document & { __vtGuard?: true };
if (typeof document !== "undefined" && typeof document.startViewTransition === "function" && !(document as Patched).__vtGuard) {
  (document as Patched).__vtGuard = true;
  const original = document.startViewTransition;
  document.startViewTransition = function (this: Document, ...args: Parameters<Document["startViewTransition"]>) {
    const transition = original.apply(this, args);
    for (const key of ["ready", "finished", "updateCallbackDone"] as const) {
      const promise = transition[key];
      let wrapped: Promise<void> | undefined;
      // Lazy, so a promise nobody reads never becomes an extra unhandled rejection.
      Object.defineProperty(transition, key, { configurable: true, get: () => (wrapped ??= promise.catch(normalize)) });
    }
    return transition;
  } as Document["startViewTransition"];
}

export default function ViewTransitionGuard() {
  return null;
}
