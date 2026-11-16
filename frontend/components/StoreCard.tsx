"use client";

import Image from "next/image";
import Link from "next/link";
import type { Store } from "@/lib/catalog";
import { useNow } from "@/lib/clock";
import { formatTime, isOpenAt } from "@/lib/hours";
import { useT } from "@/lib/i18n";
import { useStoreReviews } from "@/lib/reviews";
import FavoriteButton from "./FavoriteButton";

/** `priority`: load this card's photo straight away (use for the first card on screen). */
export default function StoreCard({ store, priority = false }: { store: Store; priority?: boolean }) {
  const { t, pick, dateLocale } = useT();
  const now = useNow();
  const { average } = useStoreReviews(store.id);
  // The clock is 0 until the page is in the browser; show the store as open until then.
  const closed = now > 0 && !isOpenAt(store.hours, new Date(now));
  const promo = store.promo && pick(store.promo, store.km?.promo);

  return (
    // The heart is a sibling of the link (a button inside a link is invalid HTML).
    <div className="card group relative min-w-0 overflow-hidden transition-shadow hover:shadow-lg">
      <Link href={`/store/${store.id}`} className="block">
        <div className={`relative grid h-36 place-items-center overflow-hidden bg-brand-soft text-6xl ${closed ? "grayscale" : ""}`}>
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
            <span className="absolute left-3 top-3 max-w-[calc(100%-4.5rem)] truncate rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-black">
              {promo}
            </span>
          )}
        </div>
        <div className="p-4">
          <p className="font-semibold leading-tight">{store.name}</p>
          <p className="mt-1 text-sm text-muted">
            {pick(store.cuisine, store.km?.cuisine)} · {"$".repeat(store.priceLevel)}
          </p>
          <p className="mt-2 flex gap-3 text-sm">
            <span>⭐ {average.toFixed(1)}</span>
            <span className="text-muted">🕒 {t("store.min", { n: store.etaMinutes })}</span>
          </p>
        </div>
      </Link>
      <FavoriteButton storeId={store.id} storeName={store.name} className="absolute right-3 top-3" />
    </div>
  );
}
