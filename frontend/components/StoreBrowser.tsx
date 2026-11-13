"use client";

import { useState } from "react";
import { STORES, type StoreKind } from "@/lib/catalog";
import StoreCard from "./StoreCard";

const SORTS = {
  recommended: "Recommended",
  rating: "Top rated",
  fastest: "Fastest",
} as const;

export default function StoreBrowser({ kind }: { kind: StoreKind }) {
  const stores = STORES.filter((s) => s.kind === kind);
  const categories = ["All", ...new Set(stores.map((s) => s.cuisine))];
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState<keyof typeof SORTS>("recommended");

  const results = (() => {
    const q = query.trim().toLowerCase();
    const list = stores.filter((s) =>
      (category === "All" || s.cuisine === category) &&
      (!q || s.name.toLowerCase().includes(q) || s.items.some((i) => i.name.toLowerCase().includes(q))),
    );
    if (sort === "rating") list.sort((a, b) => b.rating - a.rating);
    if (sort === "fastest") list.sort((a, b) => a.etaMinutes - b.etaMinutes);
    return list;
  })();

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          className="input sm:max-w-sm"
          placeholder={kind === "food" ? "Search restaurants or dishes…" : "Search stores or products…"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select className="input sm:w-44" value={sort} onChange={(e) => setSort(e.target.value as keyof typeof SORTS)}>
          {Object.entries(SORTS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              category === c ? "border-brand bg-brand text-white dark:text-background" : "border-border bg-surface hover:bg-brand-soft"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {results.length ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((s) => <StoreCard key={s.id} store={s} />)}
        </div>
      ) : (
        <p className="mt-10 text-center text-muted">No matches. Try another search.</p>
      )}
    </div>
  );
}
