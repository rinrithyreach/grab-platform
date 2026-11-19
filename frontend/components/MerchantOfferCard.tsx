"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { MerchantOffer } from "@/lib/api";
import { money } from "@/lib/brand";
import { useT } from "@/lib/i18n";
import { merchantProductText } from "@/lib/merchant-content";

/** Optional actions sit outside the product link so the whole card stays clickable. */
export default function MerchantOfferCard({ offer, preview = false, compact = false, children }: { offer: MerchantOffer; preview?: boolean; compact?: boolean; children?: ReactNode }) {
  const { t, lang } = useT();
  const { title, description } = merchantProductText(offer.title, offer.description, offer.merchant.service, lang);
  const href = offer.merchant.service === "GrabExpress"
    ? `/partners/${offer.merchant.id}/products/${offer.id}` : `/partners/${offer.merchant.id}`;
  const content = <>
    {/* 4:3 matches the product image format, so captions inside the images are not cropped. */}
    <div className="aspect-4/3 overflow-hidden bg-brand-soft">
      {/* Uploaded images are served by the API rather than the Next image host. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {offer.imageUrl && <img src={offer.imageUrl} alt={title} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />}
    </div>
    {compact ? <div className="space-y-1 p-4">
      <h3 className="line-clamp-1 font-bold">{title}</h3>
      <p className="line-clamp-1 text-xs text-muted">{offer.merchant.businessName}</p>
      <div className="flex items-center justify-between gap-2 pt-1"><p className="font-bold text-brand">{money(offer.price || 0)}</p><p className="text-xs font-semibold text-muted">{t(offer.merchant.service === "GrabFood" ? "nav.food" : offer.merchant.service === "GrabRide" ? "nav.ride" : "nav.express")}</p></div>
    </div> : <div className="space-y-1.5 p-3 sm:space-y-2 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-0.5"><p className="text-xs font-semibold text-brand">{offer.merchant.service}</p><p className="shrink-0 font-bold">{money(offer.price || 0)}</p></div>
      <h3 className="line-clamp-2 break-words font-bold sm:line-clamp-none sm:text-lg">{title}</h3>
      <p className="hidden text-sm text-muted sm:line-clamp-2">{description}</p>
      <p className="truncate border-t border-border pt-2 text-xs font-semibold sm:pt-3 sm:text-sm">{offer.merchant.businessName}</p>
      <p className="hidden text-xs text-muted sm:block">{offer.merchant.service === "GrabRide" ? offer.merchant.address : [offer.merchant.category === "Food" && offer.merchant.service === "GrabFood" ? t("nav.food") : offer.merchant.category, offer.merchant.city].filter(Boolean).join(" · ")}</p>
      {!preview && <p className="hidden pt-1 text-sm font-semibold text-brand sm:block">{t(offer.merchant.service === "GrabExpress" ? "partner.viewDetails" : "merchant.viewStore")} →</p>}
    </div>}
  </>;
  return preview
    ? <article className="card flex flex-col overflow-hidden">{content}{children && <div className="mt-auto px-3 pb-3 sm:px-5 sm:pb-5">{children}</div>}</article>
    : children
      ? <article className="card group flex flex-col overflow-hidden transition-shadow hover:shadow-lg">
          <Link href={href} className="block flex-1">{content}</Link>
          <div className="mt-auto px-3 pb-3 sm:px-5 sm:pb-5">{children}</div>
        </article>
      : <Link href={href} className="card group block overflow-hidden transition-shadow hover:shadow-lg">{content}</Link>;
}
