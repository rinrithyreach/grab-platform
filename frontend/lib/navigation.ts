"use client";

import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const getServerSnapshot = () => "";

/** A redirect can change the URL before a shared layout finishes hydrating. */
export function useHydratedPathname() {
  const pathname = usePathname();
  // Use neutral link styling for the server HTML and its first hydration render.
  return useSyncExternalStore(subscribe, () => pathname ?? "", getServerSnapshot);
}

/**
 * In-app page trail, so "← Back" can return to the page the user actually came from
 * (Ride → Food → Back lands on Ride) instead of always going up to a fixed parent.
 */
const trail: string[] = [];

export function recordVisit(pathname: string) {
  if (!pathname || trail[trail.length - 1] === pathname) return;
  // Landing on the page before the current one means the user went back.
  if (trail[trail.length - 2] === pathname) trail.pop();
  else trail.push(pathname);
}

/** True when there is an earlier page of this site to go back to. */
export function hasInAppHistory() {
  return trail.length > 1;
}
