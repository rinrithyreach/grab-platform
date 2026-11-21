"use client";

import Link from "next/link";
import type { MerchantOffer } from "@/lib/api";
import { money } from "@/lib/brand";
import { addPartnerItem } from "@/lib/cart";
import { useT } from "@/lib/i18n";
import { merchantProductTitle } from "@/lib/merchant-content";
import { MAX_PARTNER_QTY, partnerTotals, setPartnerQty, usePartnerCart } from "@/lib/partner-cart";
import { toast } from "@/lib/toast";

const roundBtn = "grid h-9 w-9 place-items-center rounded-full font-bold disabled:cursor-not-allowed disabled:opacity-40";

/** "Add to cart", then − n + for one merchant product. */
export function PartnerAddButton({ offer }: { offer: MerchantOffer }) {
  const { t, lang } = useT();
  const title = merchantProductTitle(offer.title, lang, offer.merchant.service);
  const cart = usePartnerCart();
  const qty = cart.merchantId === offer.merchant.id ? cart.lines.find((l) => l.listingId === offer.id)?.qty ?? 0 : 0;

  function add() {
    const result = addPartnerItem(offer, (otherName) => window.confirm(t("cart.replace", { store: otherName })));
    if (result === "ok") { if (!qty) toast(t("store.added", { name: title })); }
    else if (result === "limit") toast(t("partner.limit"), "error");
  }

  if (!qty) return <button type="button" onClick={add} className="btn-primary h-10 w-full text-sm" aria-label={t("store.add", { name: title })}>+ {t("partner.add")}</button>;
  return (
    <div className="flex items-center justify-between gap-3 rounded-full bg-brand-soft p-1">
      <button type="button" onClick={() => setPartnerQty(offer.id, qty - 1)} aria-label={`${t("store.decrease")}: ${title}`} className={`${roundBtn} bg-background text-brand`}>−</button>
      <span className="text-sm font-semibold text-brand" aria-live="polite">{t("partner.inCart", { n: qty })}</span>
      <button type="button" onClick={add} disabled={qty >= MAX_PARTNER_QTY} aria-label={`${t("store.increase")}: ${title}`} className={`${roundBtn} bg-brand text-white dark:text-background`}>+</button>
    </div>
  );
}

/** Floating "View cart" bar for the partner storefront (same look as the food CartBar). */
export function PartnerCartBar({ merchantId }: { merchantId: string }) {
  const { t } = useT();
  const cart = usePartnerCart();
  const { count, subtotal } = partnerTotals(cart);
  if (!count || cart.merchantId !== merchantId) return null;
  return (
    <div className="floating-cart fixed inset-x-0 bottom-0 z-20 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <Link href="/cart" className="mx-auto flex max-w-xl items-center gap-3 rounded-2xl bg-brand px-4 py-3 text-white shadow-xl hover:bg-brand-strong dark:text-background">
        <span className="grid h-9 min-w-9 shrink-0 place-items-center rounded-full bg-white/20 px-2 font-bold">{count}</span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block font-semibold">{t("store.viewCart")}</span>
          <span className="block truncate text-sm opacity-85">{cart.merchantName} · {t("store.items", { n: count })}</span>
        </span>
        <span className="shrink-0 text-lg font-bold">{money(subtotal)}</span>
      </Link>
    </div>
  );
}
