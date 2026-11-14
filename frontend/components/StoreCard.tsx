"use client";

import Link from "next/link";
import type { Store } from "@/lib/catalog";
import { useT } from "@/lib/i18n";

export default function StoreCard({ store }: { store: Store }) {
  const { t, pick } = useT();
  const promo = store.promo && pick(store.promo, store.km?.promo);
  return (
    <Link href={`/store/${store.id}`} className="card group min-w-0 overflow-hidden transition-shadow hover:shadow-lg">
      <div className="relative grid h-36 place-items-center bg-brand-soft text-6xl transition-transform group-hover:scale-[1.02]">
        {store.emoji}
        {promo && (
          <span className="absolute left-3 top-3 max-w-[calc(100%-1.5rem)] truncate rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-black">
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
          <span>⭐ {store.rating.toFixed(1)}</span>
          <span className="text-muted">🕒 {t("store.min", { n: store.etaMinutes })}</span>
        </p>
      </div>
    </Link>
  );
}
