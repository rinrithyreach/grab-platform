"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useNow } from "@/lib/clock";
import { money } from "@/lib/brand";
import { getItem, getStore } from "@/lib/catalog";
import { reorder, useShop, type Order, type OrderLine, type PaymentMethod } from "@/lib/cart";
import { chosenOptions } from "@/lib/pricing";
import { addReview, useReviewedOrders } from "@/lib/reviews";
import { toast } from "@/lib/toast";
import { useT, type MessageKey } from "@/lib/i18n";
import RideMap from "./RideMap";

// Demo delivery timeline (minutes after ordering).
const PREPARING_UNTIL = 2;
const DELIVERED_AT = 10;

/** Demo delivery progress, worked out from how long ago the order was placed. */
function progress(order: Order, now: number): { step: number; label: MessageKey; rider: number } {
  const mins = (now - Date.parse(order.createdAt)) / 60000;
  // Unknown time, clock not ready yet (0) or a time in the future: treat as just placed.
  if (!Number.isFinite(mins) || now === 0 || mins < PREPARING_UNTIL) return { step: 0, label: "orders.preparing", rider: 0 };
  if (mins < DELIVERED_AT) return { step: 1, label: "orders.onTheWay", rider: (mins - PREPARING_UNTIL) / (DELIVERED_AT - PREPARING_UNTIL) };
  return { step: 2, label: "orders.delivered", rider: 1 };
}

const STEPS: MessageKey[] = ["orders.stepPreparing", "orders.stepOnTheWay", "orders.stepDelivered"];
const PAYMENT_LABEL: Record<PaymentMethod, MessageKey> = { Cash: "cart.cash", Card: "cart.card", Wallet: "wallet.name" };

/** Dish name (+ its options) in the current language. */
function useLineText() {
  const { pick } = useT();
  return (storeId: string, l: OrderLine) => {
    const item = getItem(storeId, l.itemId);
    const name = pick(l.name, item?.km?.name);
    const opts = item ? chosenOptions(item, l.optionIds).map((o) => pick(o.choice.name, o.choice.km)) : l.options ?? [];
    return opts.length ? `${name} (${opts.join(", ")})` : name;
  };
}

/** Full price breakdown of one order. */
function Receipt({ order }: { order: Order }) {
  const { t, pick } = useT();
  const lineText = useLineText();
  const store = getStore(order.storeId);
  const promoLabel = store?.promo ? pick(store.promo, store.km?.promo) : "";
  const row = "flex justify-between gap-4";
  return (
    <dl className="mt-3 space-y-1 rounded-xl bg-background p-4 text-sm">
      {order.lines.map((l, i) => (
        <div key={i} className={row}>
          <dt>{l.qty} × {lineText(order.storeId, l)}</dt>
          <dd className="shrink-0">{money(l.price * l.qty)}</dd>
        </div>
      ))}
      <div className={`${row} mt-2 border-t border-border pt-2 text-muted`}><dt>{t("cart.subtotal")}</dt><dd>{money(order.subtotal)}</dd></div>
      {!!order.discount && <div className={`${row} text-brand`}><dt>{t("cart.promo", { promo: promoLabel })}</dt><dd>−{money(order.discount)}</dd></div>}
      {!!order.codeDiscount && <div className={`${row} text-brand`}><dt>{t("cart.promo", { promo: order.promoCode ?? "" })}</dt><dd>−{money(order.codeDiscount)}</dd></div>}
      <div className={`${row} text-muted`}><dt>{t("cart.deliveryFee")}</dt><dd>{order.deliveryFee ? money(order.deliveryFee) : t("cart.free")}</dd></div>
      {!!order.tip && <div className={`${row} text-muted`}><dt>{t("cart.tipLine")}</dt><dd>{money(order.tip)}</dd></div>}
      <div className={`${row} pt-1 text-base font-bold`}><dt>{t("cart.total")}</dt><dd>{money(order.total)}</dd></div>
      {order.note && <p className="pt-2 text-muted">📝 {order.note}</p>}
    </dl>
  );
}

/**
 * Map with the rider moving from the store to the customer.
 * There's no address lookup, so the customer's point is placed 1–2 km from the store,
 * always in the same spot for the same address.
 */
function DeliveryTracker({ order, rider }: { order: Order; rider: number }) {
  const { t } = useT();
  const store = getStore(order.storeId);
  const [from, to] = useMemo(() => {
    const loc = store?.location ?? { lat: 11.5564, lng: 104.9282 };
    let hash = 0;
    for (const ch of order.address) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    const angle = (hash % 360) * (Math.PI / 180);
    const km = 1 + ((hash >> 9) % 100) / 100; // 1.0–2.0 km
    const deg = km / 111;
    return [
      { name: order.storeName, km: order.storeName, lat: loc.lat, lng: loc.lng },
      { name: order.address, km: order.address, lat: loc.lat + deg * Math.sin(angle), lng: loc.lng + deg * Math.cos(angle) },
    ];
  }, [store, order.storeName, order.address]);
  const minsLeft = Math.max(1, Math.ceil((1 - rider) * (DELIVERED_AT - PREPARING_UNTIL)));
  return (
    <div className="mt-3 space-y-2">
      <RideMap from={from} to={to} rider={rider} label={t("orders.trackLabel", { store: order.storeName })} />
      <p className="text-sm font-medium text-brand">🛵 {t("orders.arrivingIn", { n: minsLeft })}</p>
    </div>
  );
}

/** Star rating + comment for a delivered order; saved as a review on the store page. */
function RateOrder({ order, onDone }: { order: Order; onDone: () => void }) {
  const { t } = useT();
  const { user } = useAuth();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  return (
    <form
      className="mt-3 space-y-3 rounded-xl bg-background p-4"
      onSubmit={(e) => {
        e.preventDefault();
        addReview({ storeId: order.storeId, orderId: order.id, rating, comment: comment.trim(), name: user?.fullName.split(" ")[0] ?? t("reviews.you") });
        toast(t("rides.thanks"));
        onDone();
      }}
    >
      <p className="text-sm font-semibold">{t("reviews.rateStore", { store: order.storeName })}</p>
      <div className="flex gap-1" role="radiogroup" aria-label={t("rides.rating")}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            type="button" key={n} role="radio" aria-checked={rating === n} aria-label={t("rides.stars", { n })}
            onClick={() => setRating(n)}
            className={`text-2xl ${n <= rating ? "" : "opacity-30 grayscale"}`}
          >⭐</button>
        ))}
      </div>
      <input className="input" maxLength={300} aria-label={t("reviews.commentLabel")} placeholder={t("reviews.commentPh")} value={comment} onChange={(e) => setComment(e.target.value)} />
      <div className="flex gap-2">
        <button className="btn-primary h-9 text-sm">{t("rides.submitReview")}</button>
        <button type="button" className="btn-outline h-9 text-sm" onClick={onDone}>{t("common.cancel")}</button>
      </div>
    </form>
  );
}

export default function OrderHistory() {
  const placed = useSearchParams().get("placed");
  const { t, dateLocale } = useT();
  const lineText = useLineText();
  const router = useRouter();
  const { orders } = useShop();
  const reviewed = useReviewedOrders();
  // Which extra panel is open on which order: receipt, tracking map or rating form.
  const [panel, setPanel] = useState<{ id: string; kind: "receipt" | "track" | "rate" } | null>(null);
  // Shared clock (lib/clock.ts): fresh when this page appears, then every 30s, so the tracker moves by itself.
  const now = useNow();

  function orderAgain(o: Order) {
    const ok = reorder(o, (otherId) => window.confirm(t("cart.replace", { store: getStore(otherId)?.name ?? "" })));
    if (ok) { toast(t("orders.reordered")); router.push("/cart"); }
  }
  const toggle = (id: string, kind: "receipt" | "track" | "rate") =>
    setPanel((p) => (p?.id === id && p.kind === kind ? null : { id, kind }));
  const isOpen = (id: string, kind: string) => panel?.id === id && panel.kind === kind;

  if (!orders.length) {
    return (
      <div className="card mt-6 p-10 text-center">
        <p className="text-5xl" aria-hidden>🧾</p>
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

            {isOpen(o.id, "receipt") ? <Receipt order={o} /> : (
              <ul className="mt-3 space-y-0.5 border-t border-border pt-3 text-sm text-muted">
                {o.lines.map((l, i) => <li key={i}>{l.qty} × {lineText(o.storeId, l)}</li>)}
              </ul>
            )}
            {isOpen(o.id, "track") && p.step === 1 && <DeliveryTracker order={o} rider={p.rider} />}
            {isOpen(o.id, "rate") && <RateOrder order={o} onDone={() => setPanel(null)} />}

            <p className="mt-2 text-sm text-muted">📍 {o.address} · {t(PAYMENT_LABEL[o.payment] ?? "cart.cash")}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {p.step === 1 && (
                <button onClick={() => toggle(o.id, "track")} aria-expanded={isOpen(o.id, "track")} className="btn-primary h-9 text-sm">
                  🛵 {t(isOpen(o.id, "track") ? "orders.hideMap" : "orders.track")}
                </button>
              )}
              <button onClick={() => toggle(o.id, "receipt")} aria-expanded={isOpen(o.id, "receipt")} className="btn-outline h-9 text-sm">
                🧾 {t(isOpen(o.id, "receipt") ? "orders.hideReceipt" : "orders.viewReceipt")}
              </button>
              {p.step === 2 && !reviewed.has(o.id) && !isOpen(o.id, "rate") && (
                <button onClick={() => toggle(o.id, "rate")} className="btn-outline h-9 text-sm">⭐ {t("reviews.rateOrder")}</button>
              )}
              {reviewed.has(o.id) && <span className="rounded-full bg-background px-3 py-1.5 text-sm text-muted">{t("rides.reviewed")}</span>}
              <button onClick={() => orderAgain(o)} className={`${p.step === 1 ? "btn-outline" : "btn-primary"} h-9 text-sm`}>↻ {t("orders.orderAgain")}</button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
