"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, type MerchantOrder, type MerchantServiceKind, type OrderPaymentMethod, type OrderQuote } from "@/lib/api";
import { errorMessage, useAuth } from "@/lib/auth";
import { money } from "@/lib/brand";
import { isValidAddress } from "@/lib/cart";
import { useT, type MessageKey } from "@/lib/i18n";
import { merchantProductTitle } from "@/lib/merchant-content";
import { clearPartnerCart, clearSubmittedPartnerCart, MAX_PARTNER_QTY, partnerTotals, refreshPartnerCart, setPartnerQty, usePartnerCart } from "@/lib/partner-cart";
import { usePromotions } from "@/lib/promotions";
import { toast } from "@/lib/toast";
import BackButton from "./BackButton";
import LoginRequired from "./LoginRequired";
import DeliveryAddressField from "./DeliveryAddressField";
import CardPaymentFields from "./CardPaymentFields";
import { CARD_FIELDS, EMPTY_CARD, validateCard } from "@/lib/card";
import { normalizePhoneNumber } from "@/lib/phone";
import { rememberGuestOrder } from "@/lib/guest-orders";

const PAYMENTS: { value: OrderPaymentMethod; icon: string; label: MessageKey }[] = [
  { value: "Cash", icon: "💵", label: "cart.cash" },
  { value: "Card", icon: "💳", label: "cart.card" },
];
const qtyBtn = "grid h-8 w-8 place-items-center rounded-full border border-border font-bold hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-40";

/**
 * Cart + checkout for a merchant partner's products. The order is saved by the API
 * (the store sees it on its dashboard) and the API re-prices every line.
 */
export default function PartnerCheckout() {
  const router = useRouter();
  const { t, lang, pick } = useT();
  const { api, user, ready } = useAuth();
  const cart = usePartnerCart();
  const displayed = partnerTotals(cart);
  const { count } = displayed;
  const rules = usePromotions();
  const [codeInput, setCodeInput] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [quoteState, setQuoteState] = useState<{ key: string; quote: OrderQuote | null; error: string }>({ key: "", quote: null, error: "" });
  const [quoteRevision, setQuoteRevision] = useState(0);
  const [storeState, setStoreState] = useState<{ id: string; service?: MerchantServiceKind; failed?: boolean } | null>(null);
  const guest = ready && !user && storeState?.id === cart.merchantId && storeState.service === "GrabExpress";
  const signedInCustomer = user?.role === "Customer";
  const canCheckout = signedInCustomer || guest;
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactChecked, setContactChecked] = useState(false);
  const nameInvalid = contactName.trim().length < 2 || contactName.trim().length > 120 || !/\p{L}/u.test(contactName) || /\p{Cc}/u.test(contactName);
  const phoneInvalid = !normalizePhoneNumber(contactPhone);
  const quoteKey = JSON.stringify([user?.id, guest, cart.merchantId, cart.lines, promoCode, rules, quoteRevision]);
  const quote = quoteState.key === quoteKey ? quoteState.quote : null;
  const subtotal = quote?.subtotal ?? displayed.subtotal;
  const deliveryFee = quote?.deliveryFee ?? displayed.deliveryFee;
  const total = quote?.total ?? displayed.total;
  const [address, setAddress] = useState("");
  const [addressError, setAddressError] = useState(false);
  const [detectingAddress, setDetectingAddress] = useState(false);
  const [payment, setPayment] = useState<OrderPaymentMethod>("Cash");
  const [note, setNote] = useState("");
  // Card details stay in memory only; the API receives just the payment method.
  const [card, setCard] = useState(EMPTY_CARD);
  const [cardChecked, setCardChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [checked, setChecked] = useState(false);
  const merchantId = cart.merchantId;

  useEffect(() => {
    if (!merchantId || !cart.lines.length || !canCheckout) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      (guest ? api.quoteGuestOrder : api.quoteOrder)({ merchantId, items: cart.lines.map(l => ({ listingId: l.listingId, quantity: l.qty })), promoCode: promoCode || undefined }, ctrl.signal)
        .then(quote => { if (!ctrl.signal.aborted) setQuoteState({ key: quoteKey, quote, error: "" }); })
        .catch(err => { if (!ctrl.signal.aborted) setQuoteState({ key: quoteKey, quote: null, error: errorMessage(err, t) }); });
    }, 150);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [api, merchantId, cart.lines, canCheckout, guest, quoteKey, promoCode, rules, t]);

  /** Reloads the store's live prices; products it no longer sells are removed. */
  async function syncWithStore(id: string, signal?: AbortSignal) {
    try {
      const store = await api.merchantStorefront(id, signal);
      if (signal?.aborted) return;
      setStoreState({ id, service: store.merchant.service });
      if (refreshPartnerCart(id, store.merchant.businessName, store.listings)) toast(t("partner.removed"), "error");
    } catch (err) {
      if (signal?.aborted) return;
      setStoreState({ id, failed: true });
      // 404: the store has nothing published any more, so nothing in this cart can be ordered.
      if (err instanceof ApiError && err.status === 404 && refreshPartnerCart(id, "", [])) toast(t("partner.removed"), "error");
    }
  }

  useEffect(() => {
    if (!merchantId) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => { void syncWithStore(merchantId, ctrl.signal).finally(() => { if (!ctrl.signal.aborted) setChecked(true); }); }, 0);
    return () => { clearTimeout(timer); ctrl.abort(); };
    // Only re-check when the cart switches store; syncWithStore reads the latest api/t.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantId]);


  async function checkout(e: React.FormEvent) {
    e.preventDefault();
    if (!merchantId || !canCheckout || busy || !quote || detectingAddress) return;
    if (guest && (nameInvalid || phoneInvalid)) {
      setContactChecked(true);
      document.getElementById(nameInvalid ? "partner-contact-name" : "partner-contact-phone")?.focus();
      return;
    }
    if (!isValidAddress(address)) {
      setAddressError(true);
      document.getElementById("partner-address")?.focus();
      return;
    }
    if (payment === "Card") {
      const cardErrors = validateCard(card);
      const first = CARD_FIELDS.find((f) => cardErrors[f]);
      if (first) { setCardChecked(true); document.getElementById(`partner-card-${first}`)?.focus(); return; }
    }
    setBusy(true); setError("");
    try {
      const request = {
        merchantId, paymentMethod: payment, deliveryAddress: address.trim(), note: note.trim(),
        promoCode: promoCode || undefined,
        expectedTotal: quote.total,
        items: cart.lines.map((l) => ({ listingId: l.listingId, quantity: l.qty })),
      };
      let order: MerchantOrder;
      if (guest) {
        const result = await api.placeGuestOrder({ order: request, contactName: contactName.trim(), contactPhone: normalizePhoneNumber(contactPhone)! });
        order = result.order;
        rememberGuestOrder(order.id, result.accessToken);
      } else order = await api.placeOrder(request);
      clearSubmittedPartnerCart(cart);
      router.push(`/orders?${guest ? "guest" : "partner"}=${encodeURIComponent(order.id)}`);
    } catch (err) {
      setError(errorMessage(err, t));
      // 409/404: a product or the store changed — show the customer the current cart.
      if (err instanceof ApiError && (err.status === 409 || err.status === 404)) await syncWithStore(merchantId);
      setQuoteRevision(v => v + 1);
      setBusy(false);
    }
  }

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
          : !user && storeState?.id !== merchantId ? <p role="status" className="text-sm text-muted">{t("common.loading")}</p>
          : !user && storeState?.failed ? <div role="alert" className="text-sm"><p>{pick("Unable to load this store.", "មិនអាចផ្ទុកហាងនេះបានទេ។")}</p><button type="button" className="mt-2 text-brand" onClick={() => merchantId && void syncWithStore(merchantId)}>{pick("Try again", "ព្យាយាមម្ដងទៀត")}</button></div>
          : !user && !guest ? <LoginRequired what="loginRequired.placeOrder" returnTo="/cart" />
          : !canCheckout ? <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{t("partner.merchantAccount")}</p>
          : <fieldset disabled={busy} className="space-y-4">
            {guest && <div className="space-y-3 rounded-xl bg-brand-soft p-3">
              <div><h3 className="font-semibold">{pick("Guest checkout", "បញ្ជាទិញដោយមិនចាំបាច់ចូលគណនី")}</h3><p className="mt-1 text-xs text-muted">{pick("Provide the recipient's details so the store and courier can process your GrabExpress order.", "សូមបញ្ចូលព័ត៌មានអ្នកទទួល ដើម្បីឱ្យហាង និងអ្នកដឹកជញ្ជូនអាចដំណើរការការបញ្ជាទិញ GrabExpress របស់អ្នក។")}</p></div>
              <div><label className="label" htmlFor="partner-contact-name">{pick("Recipient full name", "ឈ្មោះពេញអ្នកទទួល")} *</label>
                <input id="partner-contact-name" className="input" autoComplete="shipping name" maxLength={120} required value={contactName} onChange={e => setContactName(e.target.value)} aria-invalid={contactChecked && nameInvalid} aria-describedby={contactChecked && nameInvalid ? "partner-name-error" : undefined} />
                {contactChecked && nameInvalid && <p id="partner-name-error" role="alert" className="mt-1 text-xs text-red-600">{pick("Enter the recipient's full name.", "សូមបញ្ចូលឈ្មោះពេញរបស់អ្នកទទួល។")}</p>}
              </div>
              <div><label className="label" htmlFor="partner-contact-phone">{pick("Contact phone number", "លេខទូរសព្ទទំនាក់ទំនង")} *</label>
                <input id="partner-contact-phone" className="input" type="tel" inputMode="tel" autoComplete="shipping tel" maxLength={30} required value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="012 345 678" aria-invalid={contactChecked && phoneInvalid} aria-describedby={contactChecked && phoneInvalid ? "partner-phone-error" : undefined} />
                {contactChecked && phoneInvalid && <p id="partner-phone-error" role="alert" className="mt-1 text-xs text-red-600">{pick("Enter a valid phone number we can call for delivery.", "សូមបញ្ចូលលេខទូរសព្ទត្រឹមត្រូវសម្រាប់ទំនាក់ទំនងពេលដឹកជញ្ជូន។")}</p>}
              </div>
            </div>}
            <div>
              <label className="label" htmlFor="partner-promo">{t("cart.codeLabel")}</label>
              <div className="flex gap-2"><input id="partner-promo" className="input uppercase" autoComplete="off" maxLength={32} value={codeInput} onChange={e => setCodeInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (codeInput.trim()) setPromoCode(codeInput.trim().toUpperCase()); } }} />
                <button type="button" className="btn-primary shrink-0" disabled={!codeInput.trim()} onClick={() => setPromoCode(codeInput.trim().toUpperCase())}>{t("cart.codeApply")}</button></div>
              {promoCode && <div className="mt-2 flex items-center justify-between text-sm"><span>{promoCode}{quote?.promoCode ? ` · ${t("cart.codeApplied")}` : ""}</span><button type="button" className="text-muted" onClick={() => { setPromoCode(""); setCodeInput(""); }}>{t("cart.codeRemove")}</button></div>}
              {quoteState.key === quoteKey && quoteState.error && <p role="alert" className="mt-2 text-sm text-red-600">{quoteState.error}</p>}
              {!quote && quoteState.key !== quoteKey && <p role="status" className="mt-2 text-xs text-muted">{pick("Checking prices and promotions…", "កំពុងពិនិត្យតម្លៃ និងប្រូម៉ូសិន…")}</p>}
            </div>
            <DeliveryAddressField key={`${user?.id ?? "guest"}:${merchantId}`} id="partner-address" value={address} onChange={setAddress} invalid={addressError} onInvalidChange={setAddressError} onDetectingChange={setDetectingAddress} disabled={busy} />
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
              {payment === "Card" && <div className="mt-3"><CardPaymentFields value={card} onChange={setCard} showAllErrors={cardChecked} idPrefix="partner-card" /></div>}
            </div>
            <div>
              <label className="label" htmlFor="partner-note">{t("cart.note")}</label>
              <input id="partner-note" maxLength={500} className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("cart.notePh")} />
            </div>
          </fieldset>}
        <dl className="space-y-1 border-t border-border pt-4 text-sm">
          <div className="flex justify-between"><dt className="text-muted">{t("cart.subtotal")} · {t("store.items", { n: count })}</dt><dd>{money(subtotal)}</dd></div>
          {!!quote?.discount && <div className="flex justify-between gap-3 text-brand"><dt>{t("cart.promo", { promo: quote.promotionNames.join(" · ") })}</dt><dd>−{money(quote.discount)}</dd></div>}
          {!!quote?.codeDiscount && <div className="flex justify-between text-brand"><dt>{t("cart.promo", { promo: quote.promoCode ?? "" })}</dt><dd>−{money(quote.codeDiscount)}</dd></div>}
          <div className="flex justify-between"><dt className="text-muted">{t("cart.deliveryFee")}</dt><dd>{money(deliveryFee)}</dd></div>
          <div className="flex justify-between pt-1 text-base font-bold"><dt>{t("cart.total")}</dt><dd>{money(total)}</dd></div>
        </dl>
        {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}
        {canCheckout && (
          <button type="submit" className="btn-primary w-full" disabled={busy || !count || !quote || detectingAddress}>
            {busy ? t("partner.placing") : t("cart.placeOrder", { total: money(total) })}
          </button>
        )}
        <p className="text-center text-xs text-muted">{t("partner.payNote")}</p>
      </form>
    </div>
  );
}
