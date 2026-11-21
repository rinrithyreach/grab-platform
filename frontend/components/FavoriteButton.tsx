"use client";

import { toggleFavorite, useFavorites } from "@/lib/favorites";
import { useT } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import Icon from "./Icon";

export default function FavoriteButton({ storeId, storeName, className = "" }: { storeId: string; storeName: string; className?: string }) {
  const { t } = useT();
  const isFav = useFavorites().includes(storeId);
  return (
    <button
      type="button"
      onClick={() => toast(t(toggleFavorite(storeId) ? "fav.added" : "fav.removed", { name: storeName }), "info")}
      aria-pressed={isFav}
      aria-label={t(isFav ? "fav.remove" : "fav.add", { name: storeName })}
      title={t(isFav ? "fav.remove" : "fav.add", { name: storeName })}
      className={`favorite-button grid h-10 w-10 place-items-center rounded-full bg-surface/95 shadow-sm backdrop-blur ${isFav ? "text-brand" : "text-muted"} ${className}`}
    >
      <Icon name="heart" filled={isFav} />
    </button>
  );
}
