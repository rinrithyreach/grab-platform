"use client";

/** Home-page search across restaurants and dishes, in English or Khmer. */
import Link from "next/link";
import { useId, useState } from "react";
import { money } from "@/lib/brand";
import { STORES } from "@/lib/catalog";
import { useT } from "@/lib/i18n";
import { matchesSearch } from "@/lib/search";

const MAX_STORES = 4;
const MAX_ITEMS = 6;

export default function GlobalSearch() {
  const { t, pick } = useT();
  const [q, setQ] = useState("");
  const resultsId = useId();
  const query = q.trim();

  const stores = query ? STORES.filter((s) => s.kind === "food" && matchesSearch(query, s.name, s.cuisine, s.km?.cuisine)).slice(0, MAX_STORES) : [];
  const items = query
    ? STORES.filter((s) => s.kind === "food").flatMap((s) => s.items.filter((i) => matchesSearch(query, i.name, i.km?.name)).map((i) => ({ store: s, item: i }))).slice(0, MAX_ITEMS)
    : [];

  return (
    <section className="mx-auto mt-10 max-w-3xl px-4" role="search">
      <label htmlFor="global-search" className="sr-only">{t("search.label")}</label>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg" aria-hidden>🔍</span>
        <input
          id="global-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("search.placeholder")}
          aria-controls={resultsId}
          className="input h-14 rounded-full pl-12 text-base shadow-sm"
          autoComplete="off"
        />
      </div>

      <div id={resultsId} aria-live="polite">
        {query && (
          <div className="card mt-3 p-2">
            {!stores.length && !items.length && <p className="p-4 text-center text-muted">{t("search.none", { q: q.trim() })}</p>}

            {stores.length > 0 && (
              <>
                <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-muted">{t("search.stores")}</p>
                <ul>
                  {stores.map((s) => (
                    <li key={s.id}>
                      <Link href={`/store/${s.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-brand-soft">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-xl" aria-hidden>{s.emoji}</span>
                        <span className="min-w-0">
                          <span className="block font-semibold">{s.name}</span>
                          <span className="block text-sm text-muted">{pick(s.cuisine, s.km?.cuisine)} · ⭐ {s.rating.toFixed(1)}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {items.length > 0 && (
              <>
                <p className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-muted">{t("search.items")}</p>
                <ul>
                  {items.map(({ store, item }) => (
                    <li key={`${store.id}-${item.id}`}>
                      <Link href={`/store/${store.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-brand-soft">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-xl" aria-hidden>{item.emoji}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{pick(item.name, item.km?.name)}</span>
                          <span className="block truncate text-sm text-muted">{store.name}</span>
                        </span>
                        <span className="shrink-0 font-semibold text-brand">{money(item.price)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
