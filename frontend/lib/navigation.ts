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
