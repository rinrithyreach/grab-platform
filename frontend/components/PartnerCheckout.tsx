"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, type OrderPaymentMethod } from "@/lib/api";
import { errorMessage, useAuth } from "@/lib/auth";
import { money } from "@/lib/brand";
import { isValidAddress } from "@/lib/cart";
import { useT, type MessageKey } from "@/lib/i18n";
import { merchantProductTitle } from "@/lib/merchant-content";
import { clearPartnerCart, clearSubmittedPartnerCart, MAX_PARTNER_QTY, partnerTotals, refreshPartnerCart, setPartnerQty, usePartnerCart } from "@/lib/partner-cart";
import { useProfile } from "@/lib/profile";
import { toast } from "@/lib/toast";
import BackButton from "./BackButton";
import LoginRequired from "./LoginRequired";

const PAYMENTS: { value: OrderPaymentMethod; icon: string; label: MessageKey }[] = [
  { value: "Cash", icon: "💵", label: "cart.cash" },
  { value: "Card", icon: "💳", label: "cart.card" },
];
const ADDRESS_ICON = { home: "🏠", work: "💼", other: "📍" } as const;
const qtyBtn = "grid h-8 w-8 place-items-center rounded-full border border-border font-bold hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-40";

/**
 * Cart + checkout for a merchant partner's products. The order is saved by the API
 * (the store sees it on its dashboard) and the API re-prices every line.
 */
export default function PartnerCheckout() {
  const router = useRouter();
  const { t, lang } = useT();
  const { api, user, ready } = useAuth();
  const cart = usePartnerCart();
  const { addresses } = useProfile();
  const { count, subtotal, deliveryFee, total } = partnerTotals(cart);
  const [address, setAddress] = useState("");
  const [addressError, setAddressError] = useState(false);
  const [payment, setPayment] = useState<OrderPaymentMethod>("Cash");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [checked, setChecked] = useState(false);
  const merchantId = cart.merchantId;

  /** Reloads the store's live prices; products it no longer sells are removed. */
  async function syncWithStore(id: string, signal?: AbortSignal) {
    try {
      const store = await api.merchantStorefront(id, signal);
      if (refreshPartnerCart(id, store.merchant.businessName, store.listings)) toast(t("partner.removed"), "error");
    } catch (err) {
      // 404: the store has nothing published any more, so nothing in this cart can be ordered.
      if (err instanceof ApiError && err.status === 404 && refreshPartnerCart(id, "", [])) toast(t("partner.removed"), "error");
    }
  }

  useEffect(() => {
    if (!merchantId) return;
    const ctrl = new AbortController();
    void syncWithStore(merchantId, ctrl.signal).finally(() => { if (!ctrl.signal.aborted) setChecked(true); });
    return () => ctrl.abort();
    // Only re-check when the cart switches store; syncWithStore reads the latest api/t.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantId]);

  function chooseAddress(text: string) {
    setAddress(text);
    setAddressError(!isValidAddress(text));
  }

  async function checkout(e: React.FormEvent) {
    e.preventDefault();
    if (!merchantId || busy) return;
    if (!isValidAddress(address)) {
      setAddressError(true);
      document.getElementById("partner-address")?.focus();
      return;
    }
    setBusy(true); setError("");
    try {
      const order = await api.placeOrder({
        merchantId, paymentMethod: payment, deliveryAddress: address.trim(), note: note.trim(),
        items: cart.lines.map((l) => ({ listingId: l.listingId, quantity: l.qty })),
      });
      clearSubmittedPartnerCart(cart);
      router.push(`/orders?partner=${encodeURIComponent(order.id)}`);
    } catch (err) {
      setError(errorMessage(err, t));
      // 409/404: a product or the store changed — show the customer the current cart.
      if (err instanceof ApiError && (err.status === 409 || err.status === 404)) await syncWithStore(merchantId);
      setBusy(false);
    }
  }

  const signedInCustomer = user?.role === "Customer";
  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 lg:grid-cols-[1fr_380px]">
      <section className="min-w-0">
        <BackButton href={`/partners/${merchantId}`} />
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold">{t("cart.title")}</h1>
            <p className="mt-1 truncate text-muted">{t("cart.from")} <Link href={`/partners/${merchantId}`} className="font-medium text-brand">{cart.merchantName}</Link></p>
          </div>
          <button type="button" onClick={clearPartnerCart} className="shrink-0 text-sm text-muted hover:text-red-600">{t("cart.clear")}</button>
        </div>
        <ul className="card mt-4 divide-y divide-border">
          {cart.lines.map((l) => (
            <li key={l.listingId} className="flex items-center gap-3 p-4">
              {/* Uploaded images are served by the API rather than the Next image host. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {l.imageUrl ? <img src={l.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" /> : <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-brand-soft" aria-hidden>🛍️</span>}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{merchantProductTitle(l.title, lang)}</p>
                <p className="text-sm text-muted">{t("cart.each", { price: money(l.price) })}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button type="button" onClick={() => setPartnerQty(l.listingId, l.qty - 1)} aria-label={`${t("store.decrease")}: ${merchantProductTitle(l.title, lang)}`} className={qtyBtn}>−</button>
                <span className="w-5 text-center font-semibold">{l.qty}</span>
                <button type="button" onClick={() => setPartnerQty(l.listingId, l.qty + 1)} disabled={l.qty >= MAX_PARTNER_QTY} aria-label={`${t("store.increase")}: ${merchantProductTitle(l.title, lang)}`} className={qtyBtn}>+</button>
              </div>
              <p className="w-16 shrink-0 text-right font-semibold">{money(l.price * l.qty)}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">{checked ? t("partner.priceNote") : t("partner.loadingCart")}</p>
      </section>

      <form onSubmit={checkout} className="card h-fit space-y-4 p-5 lg:sticky lg:top-24" noValidate>
        <h2 className="text-lg font-bold">{t("cart.checkout")}</h2>
        {!ready ? <p role="status" className="text-sm text-muted">{t("common.loading")}</p>
          : !user ? <LoginRequired what="loginRequired.placeOrder" returnTo="/cart" />
          : !signedInCustomer ? <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{t("partner.merchantAccount")}</p>
          : <fieldset disabled={busy} className="space-y-4">
            <div>
              <label className="label" htmlFor="partner-address">{t("cart.address")}</label>
              {addresses.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {addresses.map((a) => (
                    <button type="button" key={a.label} onClick={() => chooseAddress(a.text)} aria-pressed={address === a.text}
                      className={`rounded-full border px-3 py-1 text-sm ${address === a.text ? "border-brand bg-brand-soft text-brand" : "border-border hover:bg-brand-soft"}`}>
                      {ADDRESS_ICON[a.label]} {t(`profile.${a.label}`)}
                    </button>
                  ))}
                </div>
              )}
              <input
                id="partner-address" required maxLength={300} autoComplete="street-address" value={address}
                className={`input ${addressError ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""}`}
                onChange={(e) => { setAddress(e.target.value); if (addressError && isValidAddress(e.target.value)) setAddressError(false); }}
                onBlur={() => address.trim() && setAddressError(!isValidAddress(address))}
                aria-invalid={addressError} aria-describedby={addressError ? "partner-address-error" : undefined}
                placeholder={t("cart.addressPh")}
              />
              {addressError && <p id="partner-address-error" role="alert" className="mt-1.5 text-sm text-red-600 dark:text-red-400">{t("cart.addressInvalid")}</p>}
            </div>
            <div>
              <span className="label">{t("cart.payment")}</span>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENTS.map((p) => (
                  <button type="button" key={p.value} onClick={() => setPayment(p.value)} aria-pressed={payment === p.value}
                    className={`rounded-xl border px-2 py-2.5 text-sm font-medium ${payment === p.value ? "border-brand bg-brand-soft text-brand" : "border-border"}`}>
                    <span aria-hidden>{p.icon}</span> {t(p.label)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label" htmlFor="partner-note">{t("cart.note")}</label>
              <input id="partner-note" maxLength={500} className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("cart.notePh")} />
            </div>
          </fieldset>}
        <dl className="space-y-1 border-t border-border pt-4 text-sm">
          <div className="flex justify-between"><dt className="text-muted">{t("cart.subtotal")} · {t("store.items", { n: count })}</dt><dd>{money(subtotal)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">{t("cart.deliveryFee")}</dt><dd>{money(deliveryFee)}</dd></div>
          <div className="flex justify-between pt-1 text-base font-bold"><dt>{t("cart.total")}</dt><dd>{money(total)}</dd></div>
        </dl>
        {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}
        {signedInCustomer && (
          <button type="submit" className="btn-primary w-full" disabled={busy || !count}>
            {busy ? t("partner.placing") : t("cart.placeOrder", { total: money(total) })}
          </button>
        )}
        <p className="text-center text-xs text-muted">{t("partner.payNote")}</p>
      </form>
    </div>
  );
}
