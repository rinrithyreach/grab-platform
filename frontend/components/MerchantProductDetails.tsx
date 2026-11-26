"use client";

import { refreshWhileVisible } from "@/lib/visible-refresh";
import { useEffect, useState } from "react";
import { ApiError, type MerchantOffer } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import BackButton from "./BackButton";
import FoodProductDetails from "./FoodProductDetails";
import ExpressProductDetails from "./ExpressProductDetails";
import { useWishlist, watchForRestock } from "@/lib/wishlist";
import { toast } from "@/lib/toast";
import { ProductDetailSkeleton } from "./Skeleton";

export default function MerchantProductDetails({ merchantId, listingId }: { merchantId: string; listingId: string }) {
  const { api } = useAuth();
  const { t } = useT();
  const [offer, setOffer] = useState<MerchantOffer | null>(null);
  const [others, setOthers] = useState<MerchantOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<"missing" | "network" | null>(null);
  const [retry, setRetry] = useState(0);
  const watching = useWishlist().some((item) => item.listingId === listingId);

  useEffect(() => refreshWhileVisible(signal =>
    api.merchantStorefront(merchantId, signal).then((store) => {
      if (signal.aborted) return;
      const product = store.listings.find((listing) => listing.id === listingId) ?? null;
      setOffer(product);
      setOthers(store.listings);
      setError(product ? null : "missing");
    }).catch((err) => {
      if (signal.aborted) return;
      setOffer(null);
      setError(err instanceof ApiError && err.status === 404 ? "missing" : "network");
    }).finally(() => { if (!signal.aborted) setLoading(false); })
  ), [api, merchantId, listingId, retry]);

  if (loading) return <ProductDetailSkeleton />;
  if (!offer) return <div className="mx-auto max-w-5xl space-y-5 px-4 py-10">
    <BackButton href={`/partners/${merchantId}`} />
    <p role="alert">{t(error === "missing" ? "partner.productUnavailable" : "merchant.unavailable")}</p>
    {error === "network" && <button type="button" className="btn-outline" onClick={() => { setLoading(true); setRetry((n) => n + 1); }}>{t("merchant.retry")}</button>}
    {/* Sold out (unpublished) products can be watched for a restock alert. */}
    {error === "missing" && (watching
      ? <p role="status" className="flex items-center gap-2 font-semibold text-brand"><span aria-hidden>🔔</span>{t("wish.watching")}</p>
      : <button type="button" className="btn-primary" onClick={() => { watchForRestock(merchantId, listingId); toast(t("wish.watching")); }}>🔔 {t("wish.notifyBack")}</button>)}
  </div>;

  if (offer.merchant.service === "GrabFood") return <FoodProductDetails key={offer.id} offer={offer} others={others} />;

  return <ExpressProductDetails key={offer.id} offer={offer} others={others} />;
}
