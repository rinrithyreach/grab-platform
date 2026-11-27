"use client";

import { useActivePromotions, usePromotionLabel } from "@/lib/promotions";

/**
 * Offers that apply to a product. `productOnly` leaves out store-wide and platform-wide
 * offers (a store page already lists those once at the top) and shows a compact tag.
 */
export default function PromotionBadge({ storeId, productId, productOnly = false }: { storeId: string; productId: string; productOnly?: boolean }) {
  const label = usePromotionLabel(storeId, productId);
  const own = useActivePromotions(storeId, productId).filter((p) => p.productId === productId);
  if (productOnly) return own.length ? <span className="storefront-deal-tag">🏷️ {own.map((p) => p.name).join(" · ")}</span> : null;
  return label ? <p className="mt-1 line-clamp-2 text-xs font-medium text-brand">{label}</p> : null;
}
