"use client";

import { useT } from "@/lib/i18n";

/** Hidden until focused with Tab: lets keyboard users jump past the navbar. */
export default function SkipLink() {
  const { t } = useT();
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[70] focus:rounded-full focus:bg-brand focus:px-4 focus:py-2 focus:font-semibold focus:text-white"
    >
      {t("a11y.skip")}
    </a>
  );
}
