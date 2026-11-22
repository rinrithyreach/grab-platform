"use client";

import Image from "next/image";
import Link from "next/link";
import type { Store } from "@/lib/catalog";
import { useNow } from "@/lib/clock";
import { formatTime, isOpenAt } from "@/lib/hours";
import { useT } from "@/lib/i18n";
import { useStoreReviews } from "@/lib/reviews";
import { usePromotionLabel } from "@/lib/promotions";
import FavoriteButton from "./FavoriteButton";
import Icon from "./Icon";

/** `priority`: load this card's photo straight away (use for the first card on screen). */
export default function StoreCard({ store, priority = false }: { store: Store; priority?: boolean }) {
  const { t, pick, dateLocale } = useT();
  const now = useNow();
  const { average } = useStoreReviews(store.id);
  // The clock is 0 until the page is in the browser; show the store as open until then.
  const closed = now > 0 && !isOpenAt(store.hours, new Date(now));
  const promo = usePromotionLabel(store.id);

  return (
    // The heart is a sibling of the link (a button inside a link is invalid HTML).
    <div className="store-card card group relative min-w-0 overflow-hidden">
      <Link href={`/store/${store.id}`} className="block">
        <div className={`store-card-photo relative grid h-36 place-items-center overflow-hidden bg-brand-soft text-6xl sm:h-44 ${closed ? "grayscale" : ""}`}>
          {store.photo ? (
            <Image
              src={store.photo.src} alt="" fill preload={priority} fetchPriority={priority ? "high" : undefined} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : <span aria-hidden className="transition-transform group-hover:scale-110">{store.emoji}</span>}
          {closed && store.hours ? (
            <span className="absolute inset-x-0 bottom-0 bg-black/70 px-3 py-1.5 text-center text-sm font-semibold text-white">
              {t("hours.closedOpens", { time: formatTime(store.hours.open, dateLocale) })}
            </span>
          ) : promo && (
            <span className="store-promo absolute bottom-2 left-2 max-w-[calc(100%-1rem)] truncate rounded-lg bg-surface/95 px-2 py-1 text-[10px] font-bold text-brand backdrop-blur sm:bottom-3 sm:left-3 sm:text-xs">
              {promo}
            </span>
          )}
        </div>
        <div className="p-3 sm:p-4">
          <p className="line-clamp-2 text-sm font-bold leading-snug sm:text-base">{store.name}</p>
          <p className="mt-1 truncate text-xs text-muted sm:text-sm">
            {pick(store.cuisine, store.km?.cuisine)} · {"$".repeat(store.priceLevel)}
          </p>
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm">
            <span className="flex items-center gap-1 font-semibold"><Icon name="star" filled className="h-3 w-3 text-amber-400" />{average.toFixed(1)}</span>
            <span className="flex items-center gap-1 text-muted"><Icon name="clock" className="h-3 w-3" />{t("store.min", { n: store.etaMinutes })}</span>
          </p>
        </div>
      </Link>
      <FavoriteButton storeId={store.id} storeName={store.name} className="absolute right-3 top-3" />
    </div>
  );
}
