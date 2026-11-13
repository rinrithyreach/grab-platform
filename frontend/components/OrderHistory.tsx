"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { money } from "@/lib/brand";
import { useShop, type Order } from "@/lib/cart";

/** Demo delivery progress, worked out from how long ago the order was placed. */
function progress(order: Order) {
  const mins = (Date.now() - Date.parse(order.createdAt)) / 60000;
  if (mins < 2) return { step: 0, label: "Store is preparing your order" };
  if (mins < 10) return { step: 1, label: "Rider is on the way" };
  return { step: 2, label: "Delivered" };
}

const STEPS = ["Preparing", "On the way", "Delivered"];

export default function OrderHistory() {
  const placed = useSearchParams().get("placed");
  const { orders } = useShop();

  if (!orders.length) {
    return (
      <div className="card mt-6 p-10 text-center">
        <p className="text-5xl">🧾</p>
        <p className="mt-3 font-semibold">No orders yet</p>
        <Link href="/food" className="btn-primary mt-5">Order food</Link>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      {placed && orders.some((o) => o.id === placed) && (
        <p className="rounded-xl bg-brand-soft p-4 font-medium text-brand">✅ Order {placed} placed! Your food is being prepared.</p>
      )}
      {orders.map((o) => {
        const p = progress(o);
        return (
          <article key={o.id} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <Link href={`/store/${o.storeId}`} className="font-semibold hover:text-brand">{o.storeName}</Link>
                <p className="text-sm text-muted">{o.id} · {new Date(o.createdAt).toLocaleString()}</p>
              </div>
              <p className="font-bold">{money(o.total)}</p>
            </div>

            <ol className="mt-4 grid grid-cols-3 gap-2 text-xs">
              {STEPS.map((s, i) => (
                <li key={s}>
                  <div className={`h-1.5 rounded-full ${i <= p.step ? "bg-brand" : "bg-border"}`} />
                  <p className={`mt-1 ${i <= p.step ? "font-semibold text-brand" : "text-muted"}`}>{s}</p>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-sm">{p.label}</p>

            <ul className="mt-3 space-y-0.5 border-t border-border pt-3 text-sm text-muted">
              {o.lines.map((l) => <li key={l.itemId}>{l.qty} × {l.name}</li>)}
            </ul>
            <p className="mt-2 text-sm text-muted">📍 {o.address} · {o.payment}</p>
          </article>
        );
      })}
    </div>
  );
}
