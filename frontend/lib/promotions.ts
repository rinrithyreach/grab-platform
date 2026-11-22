"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_PROMOTIONS, getPromotionRules, promotionStatus, subscribePromotions } from "./promotion-rules";

export const usePromotions = () => useSyncExternalStore(subscribePromotions, getPromotionRules, () => DEFAULT_PROMOTIONS);

export function usePromotionLabel(storeId: string, productId?: string) {
  const rules = usePromotions();
  return rules.filter(p => promotionStatus(p) === "Active" && (!p.storeId || p.storeId === storeId)
    && (!p.productId || p.productId === productId)).map(p => p.code ? `${p.name} · ${p.code}` : p.name).join(" · ");
}
