"use client";

import { useSyncExternalStore } from "react";
import type { ProductCategory } from "./category-types";

const EMPTY: ProductCategory[] = [];
let categories = EMPTY;
const listeners = new Set<() => void>();
export function setCategories(value: ProductCategory[]) { categories = value; listeners.forEach(l => l()); }
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const useCategories = () => useSyncExternalStore(subscribe, () => categories, () => EMPTY);
