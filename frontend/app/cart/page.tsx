"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { money } from "@/lib/brand";
import { getItem } from "@/lib/catalog";
import { cartDetails, clearCart, isValidAddress, placeOrder, setQty, useShop, type Order } from "@/lib/cart";
import { useT } from "@/lib/i18n";
import BackButton from "@/components/BackButton";

export default function CartPage() {
  const router = useRouter();
  const { t, pick } = useT();
  const { cart } = useShop();
  const { store, lines, subtotal, deliveryFee, total } = cartDetails(cart);
  const [address, setAddress] = useState("");
  const [payment, setPayment] = useState<Order["payment"]>("Cash");
  const [note, setNote] = useState("");
  const [addressError, setAddressError] = useState(false);

  if (!store || !lines.length) {
    return (
      <div className="mx-auto max-w-xl px-4 py-8 text-center">
        <div className="text-left"><BackButton href="/" /></div>
        <p className="mt-10 text-6xl">🛒</p>
        <h1 className="mt-4 text-2xl font-bold">{t("cart.emptyTitle")}</h1>
        <p className="mt-2 text-muted">{t("cart.emptyText")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/food" className="btn-primary">{t("cart.browseFood")}</Link>
          <Link href="/mart" className="btn-outline">{t("cart.goMart")}</Link>
        </div>
      </div>
    );
  }

  function checkout(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidAddress(address)) {
      setAddressError(true);
      document.getElementById("address")?.focus();
      return;
    }
    const order = placeOrder(address.trim(), payment, note.trim());
    if (order) router.push(`/orders?placed=${order.id}`);
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 lg:grid-cols-[1fr_360px]">
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
      </section>

      <form onSubmit={checkout} className="card h-fit space-y-4 p-5 lg:sticky lg:top-24">
        <h2 className="text-lg font-bold">{t("cart.checkout")}</h2>
        <div>
          <label className="label" htmlFor="address">{t("cart.address")}</label>
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
        </div>
        <div>
          <span className="label">{t("cart.payment")}</span>
          <div className="grid grid-cols-2 gap-2">
            {(["Cash", "Card"] as const).map((p) => (
              <button
                type="button" key={p} onClick={() => setPayment(p)} aria-pressed={payment === p}
                className={`h-11 rounded-xl border font-medium ${payment === p ? "border-brand bg-brand-soft text-brand" : "border-border"}`}
              >
                {p === "Cash" ? `💵 ${t("cart.cash")}` : `💳 ${t("cart.card")}`}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="note">{t("cart.note")}</label>
          <input id="note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("cart.notePh")} />
        </div>
        <dl className="space-y-1 border-t border-border pt-4 text-sm">
          <div className="flex justify-between"><dt className="text-muted">{t("cart.subtotal")}</dt><dd>{money(subtotal)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">{t("cart.deliveryFee")}</dt><dd>{money(deliveryFee)}</dd></div>
          <div className="flex justify-between pt-1 text-base font-bold"><dt>{t("cart.total")}</dt><dd>{money(total)}</dd></div>
        </dl>
        <button type="submit" className="btn-primary w-full">{t("cart.placeOrder", { total: money(total) })}</button>
        <p className="text-center text-xs text-muted">{t("cart.demo")}</p>
      </form>
    </div>
  );
}
