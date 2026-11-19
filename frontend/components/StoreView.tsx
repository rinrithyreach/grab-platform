"use client";

import Image from "next/image";
import type { Store } from "@/lib/catalog";
import { useNow } from "@/lib/clock";
import { formatTime, isOpen24h, isOpenAt } from "@/lib/hours";
import { useT } from "@/lib/i18n";
import { useStoreReviews } from "@/lib/reviews";
import BackButton from "./BackButton";
import MenuItemCard from "./MenuItemCard";
import CartBar from "./CartBar";
import FavoriteButton from "./FavoriteButton";
import Stars from "./Stars";

export default function StoreView({ store }: { store: Store }) {
  const { t, pick, dateLocale } = useT();
  const now = useNow();
  const { reviews, average, count } = useStoreReviews(store.id);
  const popular = store.items.filter((i) => i.popular);
  const isMart = store.kind === "mart";
  const promo = store.promo && pick(store.promo, store.km?.promo);
  // The clock is 0 until the page is in the browser; show the store as open until then.
  const closed = now > 0 && !isOpenAt(store.hours, new Date(now));
  const hoursText = !store.hours || isOpen24h(store.hours)
    ? t("hours.open24")
    : `${formatTime(store.hours.open, dateLocale)} – ${formatTime(store.hours.close, dateLocale)}`;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 pb-32">
      <BackButton href={isMart ? "/mart" : "/food"} />

      {store.photo && (
        <div className={`relative mb-4 h-44 overflow-hidden rounded-2xl sm:h-56 ${closed ? "grayscale" : ""}`}>
          <Image src={store.photo.src} alt="" fill preload fetchPriority="high" sizes="(min-width: 896px) 896px, 100vw" className="object-cover" />
        </div>
      )}
      <section className="card relative flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-5 sm:p-6">
        <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-brand-soft text-5xl sm:h-24 sm:w-24" aria-hidden>{store.emoji}</div>
        <div className="min-w-0 pr-12">
          <h1 className="text-2xl font-bold sm:text-3xl">{store.name}</h1>
          <p className="mt-1 text-muted">{pick(store.cuisine, store.km?.cuisine)} · {"$".repeat(store.priceLevel)}</p>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <a href="#reviews" className="-my-1.5 inline-block py-1.5 hover:text-brand">⭐ {average.toFixed(1)} <span className="text-muted">({t("reviews.count", { n: count })})</span></a>
            <span>🕒 {t("store.min", { n: store.etaMinutes })}</span>
            <span className={closed ? "font-semibold text-red-600 dark:text-red-400" : "text-muted"}>
              {closed ? t("hours.closed") : t("hours.openNow")} · {hoursText}
            </span>
            {promo && <span className="rounded-full bg-accent/20 px-2 font-medium">🏷️ {promo}</span>}
          </p>
        </div>
        <FavoriteButton storeId={store.id} storeName={store.name} className="absolute right-4 top-4 border border-border" />
      </section>

      {closed && store.hours && (
        <p role="status" className="mt-4 rounded-xl bg-red-50 p-4 text-sm font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
          🔒 {t("hours.closedBanner", { time: formatTime(store.hours.open, dateLocale) })}
        </p>
      )}

      {popular.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-bold">{t("store.popular")}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {popular.map((i) => <MenuItemCard key={i.id} storeId={store.id} item={i} closed={closed} />)}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-xl font-bold">{t(isMart ? "store.allProducts" : "store.fullMenu")}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {store.items.map((i) => <MenuItemCard key={i.id} storeId={store.id} item={i} closed={closed} />)}
        </div>
      </section>

      <section id="reviews" className="mt-10 scroll-mt-24">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-xl font-bold">{t("reviews.title")}</h2>
          <p className="text-sm text-muted"><Stars value={average} /> {average.toFixed(1)} · {t("reviews.count", { n: count })}</p>
        </div>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {reviews.map((r) => (
            <li key={r.id} className="card p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{r.name}</p>
                <Stars value={r.rating} />
              </div>
              {r.comment && <p className="mt-1 text-sm">{pick(r.comment, r.km)}</p>}
              <p className="mt-2 text-xs text-muted">{new Date(r.createdAt).toLocaleDateString(dateLocale)}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">{t("reviews.howTo")}</p>
      </section>

      <CartBar />
    </div>
  );
}
