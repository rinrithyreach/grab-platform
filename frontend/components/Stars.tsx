"use client";

import { useT } from "@/lib/i18n";

/** Read-only star rating, e.g. ★★★★☆ for 4. */
export default function Stars({ value }: { value: number }) {
  const { t } = useT();
  const full = Math.round(value);
  return (
    <span role="img" aria-label={t("rides.stars", { n: value.toFixed(1) })} className="whitespace-nowrap text-amber-500">
      {"★".repeat(full)}<span className="text-border">{"★".repeat(5 - full)}</span>
    </span>
  );
}
