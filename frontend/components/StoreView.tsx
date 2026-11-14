"use client";

import BackButton from "./BackButton";
import type { Store } from "@/lib/catalog";
import { useT } from "@/lib/i18n";
import MenuItemCard from "./MenuItemCard";
import CartBar from "./CartBar";

export default function StoreView({ store }: { store: Store }) {
  const { t, pick } = useT();
  const popular = store.items.filter((i) => i.popular);
  const isMart = store.kind === "mart";
  const promo = store.promo && pick(store.promo, store.km?.promo);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 pb-32">
      <BackButton href={isMart ? "/mart" : "/food"} />

      <section className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-5 sm:p-6">
        <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-brand-soft text-5xl sm:h-24 sm:w-24">{store.emoji}</div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold sm:text-3xl">{store.name}</h1>
          <p className="mt-1 text-muted">{pick(store.cuisine, store.km?.cuisine)} · {"$".repeat(store.priceLevel)}</p>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <span>⭐ {store.rating.toFixed(1)}</span>
            <span>🕒 {t("store.min", { n: store.etaMinutes })}</span>
            {promo && <span className="rounded-full bg-accent/20 px-2 font-medium">🏷️ {promo}</span>}
          </p>
        </div>
      </section>

      {popular.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-bold">{t("store.popular")}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {popular.map((i) => <MenuItemCard key={i.id} storeId={store.id} item={i} />)}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-xl font-bold">{t(isMart ? "store.allProducts" : "store.fullMenu")}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {store.items.map((i) => <MenuItemCard key={i.id} storeId={store.id} item={i} />)}
        </div>
      </section>

      <CartBar />
    </div>
  );
}
