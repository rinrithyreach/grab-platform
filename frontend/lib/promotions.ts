"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_PROMOTIONS, getPromotionRules, promotionStatus, subscribePromotions, type Promotion } from "./promotion-rules";

export const usePromotions = () => useSyncExternalStore(subscribePromotions, getPromotionRules, () => DEFAULT_PROMOTIONS);

const applies = (p: Promotion, storeId: string, productId?: string) =>
  promotionStatus(p) === "Active" && (!p.storeId || p.storeId === storeId) && (!p.productId || p.productId === productId);

/** Active offers for a store (or one of its products), including platform-wide ones. */
export function useActivePromotions(storeId: string, productId?: string) {
  return usePromotions().filter((p) => applies(p, storeId, productId));
}

export function usePromotionLabel(storeId: string, productId?: string) {
  return useActivePromotions(storeId, productId).map(p => p.code ? `${p.name} · ${p.code}` : p.name).join(" · ");
}
