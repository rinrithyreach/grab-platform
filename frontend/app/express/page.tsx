"use client";

import Link from "next/link";
import BackButton from "@/components/BackButton";
import MerchantOffers from "@/components/MerchantOffers";
import { useT } from "@/lib/i18n";

/**
 * GrabExpress shop: partner products only. The delivery location is asked at
 * checkout (/cart), so there is no sender/recipient form on this page.
 */
export default function ExpressPage() {
  const { t } = useT();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <BackButton href="/" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl font-bold">{t("express.title")}</h1><p className="mt-1 text-muted">{t("express.subtitle")}</p></div>
        <Link href="/orders" className="btn-outline">{t("nav.myOrders")}</Link>
      </div>
      <MerchantOffers service="GrabExpress" />
    </div>
  );
}
