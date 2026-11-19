"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError, type MerchantStorefront as Storefront } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { MERCHANT_SERVICES } from "@/lib/merchant";
import { merchantBusinessDescription } from "@/lib/merchant-content";
import { refreshPartnerCart } from "@/lib/partner-cart";
import { formatRideWorkSchedule } from "@/lib/ride-work-schedule";
import { toast } from "@/lib/toast";
import MerchantOfferCard from "./MerchantOfferCard";
import { PartnerAddButton, PartnerCartBar } from "./PartnerCartControls";

export default function MerchantStorefront({ id }: { id: string }) {
  const { api } = useAuth();
  const { t, lang } = useT();
  const [data, setData] = useState<Storefront | null>(null);
  const [error, setError] = useState<"missing" | "network" | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const ctrl = new AbortController();
    let busy = false;
    const refresh = () => {
      if (busy) return;
      busy = true;
      void api.merchantStorefront(id, ctrl.signal).then((store) => {
        setData(store); setError(null);
        // Keep the cart's prices current and drop products the store has unpublished.
        if (refreshPartnerCart(store.merchant.id, store.merchant.businessName, store.listings)) toast(t("partner.removed"), "error");
      })
        .catch((err) => { if (!ctrl.signal.aborted) { setError(err instanceof ApiError && err.status === 404 ? "missing" : "network"); if (err instanceof ApiError && err.status === 404) setData(null); } })
        .finally(() => { busy = false; });
    };
    refresh();
    const timer = setInterval(() => { if (document.visibilityState !== "hidden") refresh(); }, 5000);
    window.addEventListener("focus", refresh);
    return () => { ctrl.abort(); clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [api, id, retry, t]);

  if (!data) return <div className="mx-auto max-w-6xl space-y-5 px-4 py-10">{error ? <><p role="alert">{t(error === "missing" ? "merchant.notFound" : "merchant.unavailable")}</p><button className="btn-outline" onClick={() => { setError(null); setRetry((n) => n + 1); }}>{t("merchant.retry")}</button></> : <p role="status">{t("merchant.loading")}</p>}</div>;
  const merchant = data.merchant;
  const service = MERCHANT_SERVICES.find((s) => s.id === merchant.service)!;
  return <div className="mx-auto max-w-6xl px-4 pb-28 pt-8">
    <Link href={service.href} className="text-sm font-semibold text-brand">← {merchant.service}</Link>
    <section className="card mt-5 grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.5fr_1fr]">
      <div><p className="text-sm font-semibold text-brand">{service.emoji} {merchant.service} · {merchant.category === "Food" && merchant.service === "GrabFood" ? t("nav.food") : merchant.category}</p><h1 className="mt-3 break-words text-3xl font-bold">{merchant.businessName}</h1><p className="mt-4 whitespace-pre-line text-muted">{merchantBusinessDescription(merchant.businessName, merchant.description, merchant.service, lang)}</p></div>
      <div className="rounded-xl bg-brand-soft p-5"><dl className="space-y-4 text-sm"><div><dt className="font-semibold">{t("merchant.location")}</dt><dd className="mt-1">{[merchant.address, merchant.city].filter(Boolean).join(", ")}</dd></div>{merchant.openingHours && <div><dt className="font-semibold">{t("merchant.hours")}</dt><dd className="mt-1">{formatRideWorkSchedule(merchant.openingHours, (day) => t(`merchant.day.${day}`))}</dd></div>}</dl><a href={`tel:${merchant.contactPhone}`} className="btn-primary mt-5 w-full">{t("merchant.contact")}</a><p className="mt-2 text-center text-sm">{merchant.contactPhone}</p>{merchant.email && <a className="mt-3 block break-all text-center text-sm font-medium text-brand" href={`mailto:${merchant.email}`}>{merchant.email}</a>}<p className="mt-4 text-xs leading-relaxed text-muted">{t("merchant.contactHint")}</p></div>
    </section>
    <h2 className="mt-10 text-2xl font-bold">{t("merchant.offers")}</h2>
    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{data.listings.map((listing) => <MerchantOfferCard key={listing.id} offer={listing} preview={merchant.service !== "GrabExpress"}><PartnerAddButton offer={listing} /></MerchantOfferCard>)}</div>
    <PartnerCartBar merchantId={merchant.id} />
  </div>;
}
