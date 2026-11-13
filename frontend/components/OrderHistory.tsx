"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { money } from "@/lib/brand";
import { getItem } from "@/lib/catalog";
import { useShop, type Order } from "@/lib/cart";
import { useT, type MessageKey } from "@/lib/i18n";

/** Demo delivery progress, worked out from how long ago the order was placed. */
function progress(order: Order, now: number): { step: number; label: MessageKey } {
  const mins = (now - Date.parse(order.createdAt)) / 60000;
  if (mins < 2) return { step: 0, label: "orders.preparing" };
  if (mins < 10) return { step: 1, label: "orders.onTheWay" };
  return { step: 2, label: "orders.delivered" };
}

const STEPS: MessageKey[] = ["orders.stepPreparing", "orders.stepOnTheWay", "orders.stepDelivered"];

export default function OrderHistory() {
  const placed = useSearchParams().get("placed");
  const { t, pick, dateLocale } = useT();
  const { orders } = useShop();
  // Re-check the time every 30s so the demo tracker moves forward by itself.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!orders.length) {
    return (
      <div className="card mt-6 p-10 text-center">
        <p className="text-5xl">🧾</p>
        <p className="mt-3 font-semibold">{t("orders.empty")}</p>
        <Link href="/food" className="btn-primary mt-5">{t("orders.orderFood")}</Link>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      {placed && orders.some((o) => o.id === placed) && (
        <p className="rounded-xl bg-brand-soft p-4 font-medium text-brand">{t("orders.placed", { id: placed })}</p>
      )}
      {orders.map((o) => {
        const p = progress(o, now);
        return (
          <article key={o.id} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <Link href={`/store/${o.storeId}`} className="font-semibold hover:text-brand">{o.storeName}</Link>
                <p className="text-sm text-muted">{o.id} · {new Date(o.createdAt).toLocaleString(dateLocale)}</p>
              </div>
              <p className="font-bold">{money(o.total)}</p>
            </div>

            <ol className="mt-4 grid grid-cols-3 gap-2 text-xs">
              {STEPS.map((s, i) => (
                <li key={s}>
                  <div className={`h-1.5 rounded-full ${i <= p.step ? "bg-brand" : "bg-border"}`} />
                  <p className={`mt-1 ${i <= p.step ? "font-semibold text-brand" : "text-muted"}`}>{t(s)}</p>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-sm">{t(p.label)}</p>

            <ul className="mt-3 space-y-0.5 border-t border-border pt-3 text-sm text-muted">
              {o.lines.map((l) => (
                <li key={l.itemId}>{l.qty} × {pick(l.name, getItem(o.storeId, l.itemId)?.km?.name)}</li>
              ))}
            </ul>
            <p className="mt-2 text-sm text-muted">📍 {o.address} · {t(o.payment === "Cash" ? "cart.cash" : "cart.card")}</p>
          </article>
        );
      })}
    </div>
  );
}
