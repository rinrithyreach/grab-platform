"use client";

import { usePromotionLabel } from "@/lib/promotions";

export default function PromotionBadge({ storeId, productId }: { storeId: string; productId: string }) {
  const label = usePromotionLabel(storeId, productId);
  return label ? <p className="mt-1 line-clamp-2 text-xs font-medium text-brand">{label}</p> : null;
}
