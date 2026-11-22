"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError, type MerchantOffer } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/brand";
import { useT } from "@/lib/i18n";
import BackButton from "./BackButton";
import { PartnerAddButton, PartnerCartBar } from "./PartnerCartControls";
import PromotionBadge from "./PromotionBadge";
import CategoryBadge from "./CategoryBadge";
import FoodProductDetails from "./FoodProductDetails";

export default function MerchantProductDetails({ merchantId, listingId }: { merchantId: string; listingId: string }) {
  const { api } = useAuth();
  const { t } = useT();
  const [offer, setOffer] = useState<MerchantOffer | null>(null);
  const [others, setOthers] = useState<MerchantOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<"missing" | "network" | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    api.merchantStorefront(merchantId, ctrl.signal).then((store) => {
      if (ctrl.signal.aborted) return;
      const product = store.listings.find((listing) => listing.id === listingId) ?? null;
      setOffer(product);
      setOthers(store.listings);
      setError(product ? null : "missing");
    }).catch((err) => {
      if (ctrl.signal.aborted) return;
      setOffer(null);
      setError(err instanceof ApiError && err.status === 404 ? "missing" : "network");
    }).finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [api, merchantId, listingId, retry]);

  if (loading) return <p role="status" className="mx-auto max-w-5xl px-4 py-10 text-muted">{t("merchant.loading")}</p>;
  if (!offer) return <div className="mx-auto max-w-5xl space-y-5 px-4 py-10">
    <BackButton href={`/partners/${merchantId}`} />
    <p role="alert">{t(error === "missing" ? "partner.productUnavailable" : "merchant.unavailable")}</p>
    {error === "network" && <button type="button" className="btn-outline" onClick={() => { setLoading(true); setRetry((n) => n + 1); }}>{t("merchant.retry")}</button>}
  </div>;

  if (offer.merchant.service === "GrabFood") return <FoodProductDetails key={offer.id} offer={offer} others={others} />;

  return <div className="mx-auto max-w-5xl px-4 pb-28 pt-8">
    <BackButton href={`/partners/${merchantId}`} />
    <div className="card mt-4 grid overflow-hidden lg:grid-cols-2">
      <div className="aspect-square bg-brand-soft">
        {/* Merchant images are served by the API. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={offer.imageUrl} alt={offer.title} className="h-full w-full object-contain" />
      </div>
      <div className="flex flex-col gap-5 p-6 sm:p-8">
        <p className="text-sm font-semibold text-brand">{offer.merchant.service} · {offer.merchant.businessName}</p>
        <h1 className="break-words text-3xl font-bold">{offer.title}</h1>
        <p className="text-2xl font-bold text-brand">{money(offer.price)}</p>
        <PromotionBadge storeId={merchantId} productId={listingId} />
        <CategoryBadge categoryId={offer.categoryId} />
        <p className="whitespace-pre-line text-muted">{offer.description}</p>
        <div className="mt-auto space-y-3 pt-4">
          <PartnerAddButton offer={offer} />
          <Link href={`/partners/${merchantId}`} className="btn-outline w-full">{t("merchant.offers")}</Link>
        </div>
      </div>
    </div>
    <PartnerCartBar merchantId={merchantId} />
  </div>;
}
