"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MerchantOffer } from "@/lib/api";
import { money } from "@/lib/brand";
import { addPartnerItem } from "@/lib/cart";
import { askReplaceCart, withReplaceConfirm } from "@/lib/dialog";
import { useT } from "@/lib/i18n";
import { merchantProductTitle } from "@/lib/merchant-content";
import { MAX_PARTNER_QTY, partnerTotals, setPartnerQty, usePartnerCart } from "@/lib/partner-cart";
import { toast } from "@/lib/toast";
import Icon from "./Icon";

const roundBtn = "grid h-9 w-9 place-items-center rounded-full font-bold disabled:cursor-not-allowed disabled:opacity-40";

/**
 * Choose a quantity before adding a product from its detail page. Existing cart limits still apply.
 * `buyNow` (GrabExpress) adds a second button that adds the quantity and goes straight to the cart.
 */
export function PartnerProductPurchase({ offer, buyNow = false }: { offer: MerchantOffer; buyNow?: boolean }) {
  const { t, lang, pick } = useT();
  const router = useRouter();
  const cart = usePartnerCart(); const [quantity, setQuantity] = useState(1);
  const inCart = cart.merchantId === offer.merchant.id ? cart.lines.find(l => l.listingId === offer.id)?.qty ?? 0 : 0;
  const remaining = Math.max(0, MAX_PARTNER_QTY - inCart);
  const qty = Math.min(quantity, Math.max(1, remaining));
  const title = merchantProductTitle(offer.title, lang, offer.merchant.service);
  async function add(thenCheckout = false) {
    if (!remaining) return;
    const result = await withReplaceConfirm(confirmReplace => addPartnerItem(offer, confirmReplace, qty), askReplaceCart(t));
    if (result === "ok") { setQuantity(1); if (thenCheckout) router.push("/cart"); else toast(t("store.added", { name: title })); }
    else if (result === "limit") toast(t("partner.limit"), "error");
  }
  return <div className="food-purchase-panel">
    <div className="food-purchase-label"><span>{pick("How many would you like?", "តើអ្នកចង់បានប៉ុន្មាន?")}</span><span>{money(offer.price)} {pick("each", "ក្នុងមួយមុខ")}</span></div>
    <div className="food-purchase-row">
      <div className="food-quantity" role="group" aria-label={pick("Quantity", "ចំនួន")}>
        <button type="button" aria-label={t("store.decrease")} disabled={qty <= 1 || !remaining} onClick={() => setQuantity(qty - 1)}>−</button>
        <output aria-live="polite">{qty}</output>
        <button type="button" aria-label={t("store.increase")} disabled={qty >= remaining} onClick={() => setQuantity(qty + 1)}>+</button>
      </div>
      <button type="button" className="food-add-button" onClick={() => add()} disabled={!remaining} aria-label={t("store.add", { name: title })}>
        <Icon name="bag" /><span>{remaining ? t("partner.add") : pick("Cart limit reached", "កន្ត្រកដល់ចំនួនកំណត់")}</span><strong>{money(offer.price * qty)}</strong>
      </button>
    </div>
    {buyNow && <button type="button" className="express-buy-now" onClick={() => add(true)} disabled={!remaining}>{pick("Buy now", "ទិញឥឡូវ")}</button>}
    <p className="food-checkout-note">{pick("Delivery and promotions are calculated at checkout.", "ថ្លៃដឹកជញ្ជូន និងប្រូម៉ូសិននឹងត្រូវគណនានៅពេលបញ្ជាទិញ។")}</p>
    {inCart > 0 && <Link href="/cart" className="food-added-note"><Icon name="check" /><span>{t("partner.inCart", { n: inCart })}</span><strong>{t("store.viewCart")} <span aria-hidden>→</span></strong></Link>}
  </div>;
}

/** "Add to cart", then − n + for one merchant product. */
export function PartnerAddButton({ offer }: { offer: MerchantOffer }) {
  const { t, lang } = useT();
  const title = merchantProductTitle(offer.title, lang, offer.merchant.service);
  const cart = usePartnerCart();
  const qty = cart.merchantId === offer.merchant.id ? cart.lines.find((l) => l.listingId === offer.id)?.qty ?? 0 : 0;

  async function add() {
    const result = await withReplaceConfirm((confirmReplace) => addPartnerItem(offer, confirmReplace), askReplaceCart(t));
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

/**
 * Phones and tablets: price and Add to cart pinned above the bottom navigation, so buying never needs scrolling back up.
 * Once the product is in the cart it also links to the cart with the count.
 */
export function PartnerStickyBuyBar({ offer, title }: { offer: MerchantOffer; title: string }) {
  const { t, pick } = useT();
  const cart = usePartnerCart();
  const inCart = cart.merchantId === offer.merchant.id ? cart.lines.find((l) => l.listingId === offer.id)?.qty ?? 0 : 0;
  const { count } = partnerTotals(cart);
  async function add() {
    const result = await withReplaceConfirm((confirmReplace) => addPartnerItem(offer, confirmReplace), askReplaceCart(t));
    if (result === "ok") toast(t("store.added", { name: title }));
    else if (result === "limit") toast(t("partner.limit"), "error");
  }
  return (
    <div className="express-buy-bar lg:hidden">
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <span className="min-w-0 flex-1 leading-tight"><span className="block truncate text-xs text-muted">{title}</span><span className="block text-lg font-extrabold text-brand">{money(offer.price)}</span></span>
        {count > 0 && cart.merchantId === offer.merchant.id && <Link href="/cart" className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-border bg-surface" aria-label={`${t("store.viewCart")} (${count})`}><Icon name="bag" /><span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-white dark:text-background">{count}</span></Link>}
        <button type="button" onClick={add} disabled={inCart >= MAX_PARTNER_QTY} className="btn-primary h-12 shrink-0 px-5 text-sm" aria-label={t("store.add", { name: title })}>{inCart ? pick(`Add another (${inCart})`, `បន្ថែមទៀត (${inCart})`) : t("partner.add")}</button>
      </div>
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
