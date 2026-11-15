"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { money } from "@/lib/brand";
import { getItem, getStore } from "@/lib/catalog";
import { reorder, useShop, type Order, type PaymentMethod } from "@/lib/cart";
import { toast } from "@/lib/toast";
import { useT, type MessageKey } from "@/lib/i18n";

/** Demo delivery progress, worked out from how long ago the order was placed. */
function progress(order: Order, now: number): { step: number; label: MessageKey } {
  const mins = (now - Date.parse(order.createdAt)) / 60000;
  if (mins < 2) return { step: 0, label: "orders.preparing" };
  if (mins < 10) return { step: 1, label: "orders.onTheWay" };
  return { step: 2, label: "orders.delivered" };
}

const STEPS: MessageKey[] = ["orders.stepPreparing", "orders.stepOnTheWay", "orders.stepDelivered"];
const PAYMENT_LABEL: Record<PaymentMethod, MessageKey> = { Cash: "cart.cash", Card: "cart.card", Wallet: "wallet.name" };

/** Full price breakdown of one order. */
function Receipt({ order }: { order: Order }) {
  const { t, pick } = useT();
  const store = getStore(order.storeId);
  const promoLabel = store?.promo ? pick(store.promo, store.km?.promo) : "";
  const row = "flex justify-between gap-4";
  return (
    <dl className="mt-3 space-y-1 rounded-xl bg-background p-4 text-sm">
      {order.lines.map((l) => (
        <div key={l.itemId} className={row}>
          <dt>{l.qty} × {pick(l.name, getItem(order.storeId, l.itemId)?.km?.name)}</dt>
          <dd>{money(l.price * l.qty)}</dd>
        </div>
      ))}
      <div className={`${row} mt-2 border-t border-border pt-2 text-muted`}><dt>{t("cart.subtotal")}</dt><dd>{money(order.subtotal)}</dd></div>
      {!!order.discount && <div className={`${row} text-brand`}><dt>{t("cart.promo", { promo: promoLabel })}</dt><dd>−{money(order.discount)}</dd></div>}
      {!!order.codeDiscount && <div className={`${row} text-brand`}><dt>{t("cart.promo", { promo: order.promoCode ?? "" })}</dt><dd>−{money(order.codeDiscount)}</dd></div>}
      <div className={`${row} text-muted`}><dt>{t("cart.deliveryFee")}</dt><dd>{order.deliveryFee ? money(order.deliveryFee) : t("cart.free")}</dd></div>
      <div className={`${row} pt-1 text-base font-bold`}><dt>{t("cart.total")}</dt><dd>{money(order.total)}</dd></div>
      {order.note && <p className="pt-2 text-muted">📝 {order.note}</p>}
    </dl>
  );
}

export default function OrderHistory() {
  const placed = useSearchParams().get("placed");
  const { t, pick, dateLocale } = useT();
  const router = useRouter();
  const { orders } = useShop();
  const [openReceipt, setOpenReceipt] = useState<string | null>(null);

  function orderAgain(o: Order) {
    const ok = reorder(o, (otherId) => window.confirm(t("cart.replace", { store: getStore(otherId)?.name ?? "" })));
    if (ok) { toast(t("orders.reordered")); router.push("/cart"); }
  }
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
        <p className="rounded-xl bg-brand-soft p-4 font-medium text-brand">
          {/* Mart orders are packed, food orders are prepared */}
          {t(getStore(orders.find((o) => o.id === placed)!.storeId)?.kind === "mart" ? "orders.placedMart" : "orders.placed", { id: placed })}
        </p>
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

            {openReceipt === o.id ? <Receipt order={o} /> : (
              <ul className="mt-3 space-y-0.5 border-t border-border pt-3 text-sm text-muted">
                {o.lines.map((l) => (
                  <li key={l.itemId}>{l.qty} × {pick(l.name, getItem(o.storeId, l.itemId)?.km?.name)}</li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-sm text-muted">📍 {o.address} · {t(PAYMENT_LABEL[o.payment] ?? "cart.cash")}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => setOpenReceipt(openReceipt === o.id ? null : o.id)}
                aria-expanded={openReceipt === o.id}
                className="btn-outline h-9 text-sm"
              >
                🧾 {t(openReceipt === o.id ? "orders.hideReceipt" : "orders.viewReceipt")}
              </button>
              <button onClick={() => orderAgain(o)} className="btn-primary h-9 text-sm">↻ {t("orders.orderAgain")}</button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
