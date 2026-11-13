"use client";

import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { useT } from "@/lib/i18n";

export default function Footer() {
  const { t } = useT();
  return (
    <footer className="mt-16 border-t border-border bg-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <p className="text-lg font-extrabold text-brand">{BRAND.name}</p>
          <p className="mt-2 text-sm text-muted">{t("brand.tagline")}</p>
        </div>
        <div>
          <p className="font-semibold">{t("footer.services")}</p>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            <li><Link href="/ride" className="hover:text-brand">{t("footer.bookRide")}</Link></li>
            <li><Link href="/food" className="hover:text-brand">{t("footer.foodDelivery")}</Link></li>
            <li><Link href="/mart" className="hover:text-brand">{t("nav.mart")}</Link></li>
          </ul>
        </div>
        <div>
          <p className="font-semibold">{t("footer.about")}</p>
          <p className="mt-2 text-sm text-muted">{t("footer.aboutText")}</p>
        </div>
      </div>
    </footer>
  );
}
