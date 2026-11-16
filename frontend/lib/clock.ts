"use client";

/**
 * The current time as React state, shared by every component that needs it.
 * It is refreshed the moment a component starts using it and then every 5 seconds,
 * so it is never stale (e.g. when Next.js shows a page that was kept in memory).
 * The server and first browser render use 0, which callers treat as "just now".
 */
import { useSyncExternalStore } from "react";

let now = 0;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function tick() {
  now = Date.now();
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  now = Date.now(); // fresh time for this component right away
  if (!timer) timer = setInterval(tick, 5_000);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) { clearInterval(timer); timer = undefined; }
  };
}

export function useNow() {
  return useSyncExternalStore(subscribe, () => now, () => 0);
}
