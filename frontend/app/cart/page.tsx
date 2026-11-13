"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { money } from "@/lib/brand";
import { cartDetails, clearCart, placeOrder, setQty, useShop, type Order } from "@/lib/cart";

export default function CartPage() {
  const router = useRouter();
  const { cart } = useShop();
  const { store, lines, subtotal, deliveryFee, total } = cartDetails(cart);
  const [address, setAddress] = useState("");
  const [payment, setPayment] = useState<Order["payment"]>("Cash");
  const [note, setNote] = useState("");

  if (!store || !lines.length) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <p className="text-6xl">🛒</p>
        <h1 className="mt-4 text-2xl font-bold">Your cart is empty</h1>
        <p className="mt-2 text-muted">Find something tasty or pick up your groceries.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/food" className="btn-primary">Browse food</Link>
          <Link href="/mart" className="btn-outline">Go to Mart</Link>
        </div>
      </div>
    );
  }

  function checkout(e: React.FormEvent) {
    e.preventDefault();
    const order = placeOrder(address.trim(), payment, note.trim());
    if (order) router.push(`/orders?placed=${order.id}`);
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 lg:grid-cols-[1fr_360px]">
      <section>
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold">Your cart</h1>
            <p className="mt-1 text-muted">From <Link href={`/store/${store.id}`} className="font-medium text-brand">{store.name}</Link></p>
          </div>
          <button onClick={clearCart} className="text-sm text-muted hover:text-red-600">Clear cart</button>
        </div>

        <ul className="card mt-4 divide-y divide-border">
          {lines.map((l) => (
            <li key={l.itemId} className="flex items-center gap-4 p-4">
              <div className="flex-1">
                <p className="font-medium">{l.name}</p>
                <p className="text-sm text-muted">{money(l.price)} each</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setQty(l.itemId, l.qty - 1)} aria-label="Decrease" className="grid h-8 w-8 place-items-center rounded-full border border-border font-bold hover:bg-brand-soft">−</button>
                <span className="w-5 text-center font-semibold">{l.qty}</span>
                <button onClick={() => setQty(l.itemId, l.qty + 1)} aria-label="Increase" className="grid h-8 w-8 place-items-center rounded-full border border-border font-bold hover:bg-brand-soft">+</button>
              </div>
              <p className="w-16 text-right font-semibold">{money(l.price * l.qty)}</p>
            </li>
          ))}
        </ul>
      </section>

      <form onSubmit={checkout} className="card h-fit space-y-4 p-5 lg:sticky lg:top-24">
        <h2 className="text-lg font-bold">Checkout</h2>
        <div>
          <label className="label" htmlFor="address">Delivery address</label>
          <input id="address" className="input" required minLength={5} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, building, room…" />
        </div>
        <div>
          <span className="label">Payment</span>
          <div className="grid grid-cols-2 gap-2">
            {(["Cash", "Card"] as const).map((p) => (
              <button
                type="button" key={p} onClick={() => setPayment(p)}
                className={`h-11 rounded-xl border font-medium ${payment === p ? "border-brand bg-brand-soft text-brand" : "border-border"}`}
              >
                {p === "Cash" ? "💵 Cash" : "💳 Card"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="note">Note for rider (optional)</label>
          <input id="note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. no chili, call on arrival" />
        </div>
        <dl className="space-y-1 border-t border-border pt-4 text-sm">
          <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{money(subtotal)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Delivery fee</dt><dd>{money(deliveryFee)}</dd></div>
          <div className="flex justify-between pt-1 text-base font-bold"><dt>Total</dt><dd>{money(total)}</dd></div>
        </dl>
        <button type="submit" className="btn-primary w-full">Place order · {money(total)}</button>
        <p className="text-center text-xs text-muted">Demo checkout — no real payment is taken.</p>
      </form>
    </div>
  );
}
