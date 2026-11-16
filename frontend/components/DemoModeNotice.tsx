"use client";

import { useT } from "@/lib/i18n";

/** Shown on ride pages when the backend can't be reached and rides are simulated. */
export default function DemoModeNotice() {
  const { t } = useT();
  return (
    <p className="mt-4 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm">
      <strong>{t("demo.title")}</strong> {t("demo.text")}
    </p>
  );
}
