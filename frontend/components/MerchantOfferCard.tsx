"use client";

import Link from "next/link";
import type { MerchantOffer } from "@/lib/api";
import { money } from "@/lib/brand";
import { useT } from "@/lib/i18n";

export default function MerchantOfferCard({ offer, preview = false }: { offer: MerchantOffer; preview?: boolean }) {
  const { t } = useT();
  const content = <>
    <div className="aspect-[16/10] overflow-hidden bg-brand-soft">
      {/* Uploaded images are served by the API rather than the Next image host. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {offer.imageUrl && <img src={offer.imageUrl} alt={offer.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />}
    </div>
    <div className="space-y-2 p-5">
      <div className="flex items-start justify-between gap-3"><p className="text-xs font-semibold text-brand">{offer.merchant.service}</p><p className="shrink-0 font-bold">{money(offer.price || 0)}</p></div>
      <h3 className="break-words text-lg font-bold">{offer.title}</h3>
      <p className="line-clamp-2 text-sm text-muted">{offer.description}</p>
      <p className="border-t border-border pt-3 text-sm font-semibold">{offer.merchant.businessName}</p>
      <p className="text-xs text-muted">{offer.merchant.service === "GrabRide" ? offer.merchant.address : [offer.merchant.category, offer.merchant.city].filter(Boolean).join(" · ")}</p>
      {!preview && <p className="pt-1 text-sm font-semibold text-brand">{t("merchant.viewStore")} →</p>}
    </div>
  </>;
  return preview
    ? <article className="card overflow-hidden">{content}</article>
    : <Link href={`/partners/${offer.merchant.id}`} className="card group block overflow-hidden transition-shadow hover:shadow-lg">{content}</Link>;
}
