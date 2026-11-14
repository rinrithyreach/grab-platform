"use client";

import { useState } from "react";
import { STORES, type StoreKind } from "@/lib/catalog";
import { useT } from "@/lib/i18n";
import StoreCard from "./StoreCard";
import Select from "./Select";

type Sort = "recommended" | "rating" | "fastest";

export default function StoreBrowser({ kind }: { kind: StoreKind }) {
  const { t, pick } = useT();
  const stores = STORES.filter((s) => s.kind === kind);
  const categories = [...new Map(stores.map((s) => [s.cuisine, pick(s.cuisine, s.km?.cuisine)])).entries()];
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState<Sort>("recommended");

  const q = query.trim().toLowerCase();
  const results = stores.filter((s) =>
    (category === "All" || s.cuisine === category) &&
    (!q || [s.name, s.km?.cuisine ?? "", ...s.items.flatMap((i) => [i.name, i.km?.name ?? ""])]
      .some((text) => text.toLowerCase().includes(q))),
  );
  if (sort === "rating") results.sort((a, b) => b.rating - a.rating);
  if (sort === "fastest") results.sort((a, b) => a.etaMinutes - b.etaMinutes);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          className="input sm:max-w-sm"
          placeholder={t(kind === "food" ? "browse.searchFood" : "browse.searchMart")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Select<Sort>
          className="sm:w-48"
          label={t("browse.sort")}
          value={sort}
          onChange={setSort}
          options={[
            { value: "recommended", label: t("browse.recommended") },
            { value: "rating", label: t("browse.rating") },
            { value: "fastest", label: t("browse.fastest") },
          ]}
        />
      </div>

      <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {[["All", t("browse.all")] as const, ...categories].map(([value, label]) => (
          <button
            key={value}
            onClick={() => setCategory(value)}
            className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              category === value ? "border-brand bg-brand text-white dark:text-background" : "border-border bg-surface hover:bg-brand-soft"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {results.length ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((s) => <StoreCard key={s.id} store={s} />)}
        </div>
      ) : (
        <p className="mt-10 text-center text-muted">{t("browse.noMatches")}</p>
      )}
    </div>
  );
}
