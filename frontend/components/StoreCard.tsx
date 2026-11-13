import Link from "next/link";
import type { Store } from "@/lib/catalog";

export default function StoreCard({ store }: { store: Store }) {
  return (
    <Link href={`/store/${store.id}`} className="card group overflow-hidden transition-shadow hover:shadow-lg">
      <div className="relative grid h-36 place-items-center bg-brand-soft text-6xl transition-transform group-hover:scale-[1.02]">
        {store.emoji}
        {store.promo && (
          <span className="absolute left-3 top-3 rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-black">
            {store.promo}
          </span>
        )}
      </div>
      <div className="p-4">
        <p className="font-semibold leading-tight">{store.name}</p>
        <p className="mt-1 text-sm text-muted">
          {store.cuisine} · {"$".repeat(store.priceLevel)}
        </p>
        <p className="mt-2 flex gap-3 text-sm">
          <span>⭐ {store.rating.toFixed(1)}</span>
          <span className="text-muted">🕒 {store.etaMinutes} min</span>
        </p>
      </div>
    </Link>
  );
}
