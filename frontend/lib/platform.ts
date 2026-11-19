"use client";

import { useSyncExternalStore } from "react";
import type { PlatformSettings } from "./admin-settings";

let current: PlatformSettings | null = null;
const listeners = new Set<() => void>();
export function setPlatformSettings(value: PlatformSettings) {
  current = value;
  listeners.forEach(listener => listener());
}
export function usePlatformSettings() {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => current, () => null);
}
