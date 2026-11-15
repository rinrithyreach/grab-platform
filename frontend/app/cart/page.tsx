"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { money } from "@/lib/brand";
import { getItem } from "@/lib/catalog";
import {
  applyPromoCode, cartDetails, clearCart, isValidAddress, placeOrder, removePromoCode, setQty, useShop,
  type PaymentMethod,
} from "@/lib/cart";
import { useT, type MessageKey } from "@/lib/i18n";
import { useProfile } from "@/lib/profile";
import { toast } from "@/lib/toast";
import { useWallet } from "@/lib/wallet";
import BackButton from "@/components/BackButton";

const PAYMENTS: { value: PaymentMethod; icon: string; label: MessageKey }[] = [
  { value: "Cash", icon: "💵", label: "cart.cash" },
  { value: "Card", icon: "💳", label: "cart.card" },
  { value: "Wallet", icon: "👛", label: "wallet.name" },
];
const ADDRESS_ICON = { home: "🏠", work: "💼", other: "📍" } as const;

export default function CartPage() {
  const router = useRouter();
  const { t, pick } = useT();
  const { cart, orders } = useShop();
  const { addresses } = useProfile();
  const { balance } = useWallet();
  const {
    store, lines, subtotal, discount, normalFee, deliveryFee, total, deal, amountToUnlock,
    promoCode, codeDiscount, codeValid,
  } = cartDetails(cart, orders);
  const promoLabel = store?.promo ? pick(store.promo, store.km?.promo) : "";
  // For "buy X get Y": how many more of one item until the next free one.
  const buyGetGap = deal?.type === "buyGetFree" && !discount
    ? Math.min(...lines.map((l) => deal.buy + deal.free - (l.qty % (deal.buy + deal.free))))
    : 0;
  const [address, setAddress] = useState("");
  const [payment, setPayment] = useState<PaymentMethod>("Cash");
  const [note, setNote] = useState("");
  const [addressError, setAddressError] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState("");
  const [payError, setPayError] = useState("");

  if (!store || !lines.length) {
    return (
      <div className="mx-auto max-w-xl px-4 py-8 text-center">
        <div className="text-left"><BackButton href="/" /></div>
        <p className="mt-10 text-6xl" aria-hidden>🛒</p>
        <h1 className="mt-4 text-2xl font-bold">{t("cart.emptyTitle")}</h1>
        <p className="mt-2 text-muted">{t("cart.emptyText")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/food" className="btn-primary">{t("cart.browseFood")}</Link>
          <Link href="/mart" className="btn-outline">{t("cart.goMart")}</Link>
        </div>
      </div>
    );
  }

  function chooseAddress(text: string) {
    setAddress(text);
    setAddressError(!isValidAddress(text));
  }

  function applyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!codeInput.trim()) return;
    const result = applyPromoCode(codeInput);
    if (result === "ok") { setCodeError(""); setCodeInput(""); toast(t("cart.codeApplied")); }
    else setCodeError(t(result === "minSpend" ? "cart.codeMinSpend" : "cart.codeInvalid"));
  }

  function checkout(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidAddress(address)) {
      setAddressError(true);
      document.getElementById("address")?.focus();
      return;
    }
    const result = placeOrder(address.trim(), payment, note.trim());
    if ("error" in result) {
      if (result.error === "insufficient") setPayError(t("wallet.insufficient", { balance: money(balance) }));
      return;
    }
    router.push(`/orders?placed=${result.order.id}`);
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 lg:grid-cols-[1fr_380px]">
      <section className="min-w-0">
        <BackButton href={`/store/${store.id}`} />
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold">{t("cart.title")}</h1>
            <p className="mt-1 truncate text-muted">{t("cart.from")} <Link href={`/store/${store.id}`} className="font-medium text-brand">{store.name}</Link></p>
          </div>
          <button onClick={clearCart} className="shrink-0 text-sm text-muted hover:text-red-600">{t("cart.clear")}</button>
        </div>

        <ul className="card mt-4 divide-y divide-border">
          {lines.map((l) => (
            <li key={l.itemId} className="flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{pick(l.name, getItem(store.id, l.itemId)?.km?.name)}</p>
                <p className="text-sm text-muted">{t("cart.each", { price: money(l.price) })}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button onClick={() => setQty(l.itemId, l.qty - 1)} aria-label={t("store.decrease")} className="grid h-8 w-8 place-items-center rounded-full border border-border font-bold hover:bg-brand-soft">−</button>
                <span className="w-5 text-center font-semibold">{l.qty}</span>
                <button onClick={() => setQty(l.itemId, l.qty + 1)} aria-label={t("store.increase")} className="grid h-8 w-8 place-items-center rounded-full border border-border font-bold hover:bg-brand-soft">+</button>
              </div>
              <p className="w-14 shrink-0 text-right font-semibold">{money(l.price * l.qty)}</p>
            </li>
          ))}
        </ul>

        {/* Promo code */}
        <div className="card mt-4 p-4">
          {promoCode ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm">
                🏷️ <span className="font-semibold">{promoCode}</span>{" "}
                <span className={codeValid ? "text-brand" : "text-muted"}>{codeValid ? t("cart.codeActive") : t("cart.codeMinSpend")}</span>
              </p>
              <button onClick={removePromoCode} className="shrink-0 text-sm text-muted hover:text-red-600">{t("cart.codeRemove")}</button>
            </div>
          ) : (
            <form onSubmit={applyCode}>
              <label className="label" htmlFor="promo">{t("cart.codeLabel")}</label>
              <div className="flex gap-2">
                <input
                  id="promo" className="input uppercase" value={codeInput} autoComplete="off"
                  onChange={(e) => { setCodeInput(e.target.value); setCodeError(""); }}
                  placeholder="GROUP6" aria-invalid={!!codeError} aria-describedby={codeError ? "promo-error" : undefined}
                />
                <button className="btn-outline shrink-0">{t("cart.codeApply")}</button>
              </div>
              {codeError && <p id="promo-error" role="alert" className="mt-1.5 text-sm text-red-600 dark:text-red-400">{codeError}</p>}
            </form>
          )}
        </div>
      </section>

      <form onSubmit={checkout} className="card h-fit space-y-4 p-5 lg:sticky lg:top-24" noValidate>
        <h2 className="text-lg font-bold">{t("cart.checkout")}</h2>
        <div>
          <label className="label" htmlFor="address">{t("cart.address")}</label>
          {addresses.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {addresses.map((a) => (
                <button
                  type="button" key={a.label} onClick={() => chooseAddress(a.text)}
                  aria-pressed={address === a.text}
                  className={`rounded-full border px-3 py-1 text-sm ${address === a.text ? "border-brand bg-brand-soft text-brand" : "border-border hover:bg-brand-soft"}`}
                >
                  {ADDRESS_ICON[a.label]} {t(`profile.${a.label}`)}
                </button>
              ))}
            </div>
          )}
          <input
            id="address"
            className={`input ${addressError ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""}`}
            required
            autoComplete="street-address"
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              // Clear the error as soon as the address becomes valid.
              if (addressError && isValidAddress(e.target.value)) setAddressError(false);
            }}
            onBlur={() => address.trim() && setAddressError(!isValidAddress(address))}
            aria-invalid={addressError}
            aria-describedby={addressError ? "address-error" : undefined}
            placeholder={t("cart.addressPh")}
          />
          {addressError && (
            <p id="address-error" role="alert" className="mt-1.5 text-sm text-red-600 dark:text-red-400">{t("cart.addressInvalid")}</p>
          )}
          {addresses.length === 0 && (
            <p className="mt-1.5 text-xs text-muted"><Link href="/profile" className="text-brand underline">{t("cart.saveAddressHint")}</Link></p>
          )}
        </div>
        <div>
          <span className="label">{t("cart.payment")}</span>
          <div className="grid grid-cols-3 gap-2">
            {PAYMENTS.map((p) => (
              <button
                type="button" key={p.value} onClick={() => { setPayment(p.value); setPayError(""); }} aria-pressed={payment === p.value}
                className={`rounded-xl border px-2 py-2.5 text-sm font-medium ${payment === p.value ? "border-brand bg-brand-soft text-brand" : "border-border"}`}
              >
                <span aria-hidden>{p.icon}</span> {t(p.label)}
              </button>
            ))}
          </div>
          {payment === "Wallet" && (
            <p className={`mt-1.5 text-sm ${balance < total ? "text-red-600 dark:text-red-400" : "text-muted"}`}>
              {t("wallet.balanceLine", { balance: money(balance) })}{" "}
              {balance < total && <Link href="/wallet" className="font-semibold underline">{t("wallet.topUp")}</Link>}
            </p>
          )}
          {payError && <p role="alert" className="mt-1.5 text-sm text-red-600 dark:text-red-400">{payError}</p>}
        </div>
        <div>
          <label className="label" htmlFor="note">{t("cart.note")}</label>
          <input id="note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("cart.notePh")} />
        </div>
        {amountToUnlock > 0 && (
          <p className="rounded-xl bg-accent/15 px-3 py-2 text-sm">{t("cart.promoUnlock", { amount: money(amountToUnlock), promo: promoLabel })}</p>
        )}
        {buyGetGap > 0 && (
          <p className="rounded-xl bg-accent/15 px-3 py-2 text-sm">{t("cart.promoBuyGet", { promo: promoLabel, n: buyGetGap })}</p>
        )}
        <dl className="space-y-1 border-t border-border pt-4 text-sm">
          <div className="flex justify-between"><dt className="text-muted">{t("cart.subtotal")}</dt><dd>{money(subtotal)}</dd></div>
          {discount > 0 && (
            <div className="flex justify-between font-medium text-brand">
              <dt>{t("cart.promo", { promo: promoLabel })}</dt><dd>−{money(discount)}</dd>
            </div>
          )}
          {codeDiscount > 0 && (
            <div className="flex justify-between font-medium text-brand">
              <dt>{t("cart.promo", { promo: promoCode ?? "" })}</dt><dd>−{money(codeDiscount)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-muted">{t("cart.deliveryFee")}</dt>
            <dd>
              {deliveryFee === 0 && normalFee > 0 ? (
                <><s className="mr-1.5 text-muted">{money(normalFee)}</s><span className="font-medium text-brand">{t("cart.free")}</span></>
              ) : money(deliveryFee)}
            </dd>
          </div>
          <div className="flex justify-between pt-1 text-base font-bold"><dt>{t("cart.total")}</dt><dd>{money(total)}</dd></div>
        </dl>
        <button type="submit" className="btn-primary w-full">{t("cart.placeOrder", { total: money(total) })}</button>
        <p className="text-center text-xs text-muted">{t("cart.demo")}</p>
      </form>
    </div>
  );
}
