"use client";

import { toggleFavorite, useFavorites } from "@/lib/favorites";
import { useT } from "@/lib/i18n";
import { toast } from "@/lib/toast";

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
      className={`grid h-10 w-10 place-items-center rounded-full bg-white/90 text-lg shadow-md backdrop-blur transition-transform hover:scale-110 ${className}`}
    >
      <span aria-hidden>{isFav ? "❤️" : "🤍"}</span>
    </button>
  );
}
