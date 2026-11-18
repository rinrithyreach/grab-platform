"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { MerchantOrder, MerchantOrderStatus } from "@/lib/api";
import { errorMessage, useAuth } from "@/lib/auth";
import { money } from "@/lib/brand";
import { addPartnerItem } from "@/lib/cart";
import { useT, type MessageKey } from "@/lib/i18n";
import { toast } from "@/lib/toast";

const STEPS: { status: MerchantOrderStatus; label: MessageKey }[] = [
  { status: "Pending", label: "orders.stepPlaced" },
  { status: "Accepted", label: "orders.stepAccepted" },
  { status: "OnTheWay", label: "orders.stepOnTheWay" },
  { status: "Delivered", label: "orders.stepDelivered" },
];
const ENDED: MerchantOrderStatus[] = ["Rejected", "Cancelled"];

/** The signed-in customer's store orders, refreshed every 5 seconds while the page is visible. */
export function usePartnerOrders() {
  const { api, user } = useAuth();
  const customer = user?.role === "Customer" ? user.id : null;
  // Rows are tagged with their owner so another account never sees them, even for a moment.
  const [state, setState] = useState<{ owner: string | null; orders: MerchantOrder[]; error: boolean }>({ owner: null, orders: [], error: false });
  const mine = state.owner === customer && customer !== null;

  useEffect(() => {
    if (!customer) return;
    const ctrl = new AbortController();
    let busy = false;
    const refresh = async () => {
      if (busy) return;
      busy = true;
      try { const rows = await api.myOrders(1, ctrl.signal); if (!ctrl.signal.aborted) setState({ owner: customer, orders: rows, error: false }); }
      // Keep the last list; the timer retries.
      catch { if (!ctrl.signal.aborted) setState((s) => ({ owner: customer, orders: s.owner === customer ? s.orders : [], error: true })); }
      finally { busy = false; }
    };
    void refresh();
    const timer = setInterval(() => { if (document.visibilityState !== "hidden") void refresh(); }, 5000);
    window.addEventListener("focus", refresh);
    return () => { ctrl.abort(); clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [api, customer]);

  return {
    orders: mine ? state.orders : [],
    error: mine && state.error,
    replace: (o: MerchantOrder) => setState((s) => ({ ...s, orders: s.orders.map((x) => (x.id === o.id ? o : x)) })),
  };
}

export function PartnerOrderList({ orders, error, placed, onChanged }: {
  orders: MerchantOrder[]; error: boolean; placed: string | null; onChanged: (order: MerchantOrder) => void;
}) {
  const { api } = useAuth();
  const { t, dateLocale } = useT();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const placedOrder = placed ? orders.find((o) => o.id === placed) : undefined;

  async function cancel(order: MerchantOrder) {
    if (!window.confirm(t("orders.cancelConfirm"))) return;
    setBusy(order.id);
    try { onChanged(await api.cancelOrder(order.id)); toast(t("orders.cancelled")); }
    catch (err) { toast(errorMessage(err, t), "error"); }
    finally { setBusy(null); }
  }

  function orderAgain(order: MerchantOrder) {
    for (const [index, item] of order.items.entries()) {
      const result = addPartnerItem(
        { id: item.listingId, title: item.title, price: item.unitPrice, imageUrl: "", merchant: { id: order.merchantId, businessName: order.merchantName } },
        (otherName) => window.confirm(t("cart.replace", { store: otherName })), item.quantity);
      if (result === "declined" && index === 0) return;
      if (result === "limit") { toast(t("partner.limit"), "error"); break; }
    }
    // The cart page reloads the store's live prices and drops anything no longer sold.
    toast(t("orders.reordered"));
    router.push("/cart");
  }

  if (!orders.length && !error) return null;
  return (
    <section className="mt-6" aria-labelledby="partner-orders-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="partner-orders-title" className="text-xl font-bold">{t("orders.partnerTitle")}</h2>
        <p className="text-xs text-muted">{t("orders.live")}</p>
      </div>
      {error && <p role="status" className="mt-3 text-sm text-muted">{t("orders.loadError")}</p>}
      {placedOrder && <p className="mt-3 rounded-xl bg-brand-soft p-4 font-medium text-brand">{t("orders.partnerPlaced", { store: placedOrder.merchantName })}</p>}
      <div className="mt-3 space-y-4">
        {orders.map((o) => {
          const step = STEPS.findIndex((s) => s.status === o.status);
          const ended = ENDED.includes(o.status);
          return (
            <article key={o.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`/partners/${o.merchantId}`} className="font-semibold hover:text-brand">{o.merchantName}</Link>
                  <p className="text-sm text-muted">#{o.id.slice(0, 8).toUpperCase()} · {new Date(o.createdAt).toLocaleString(dateLocale)}</p>
                </div>
                <p className="font-bold">{money(o.total)}</p>
              </div>
              {!ended && (
                <ol className="mt-4 grid grid-cols-4 gap-2 text-xs">
                  {STEPS.map((s, i) => (
                    <li key={s.status}>
                      <div className={`h-1.5 rounded-full ${i <= step ? "bg-brand" : "bg-border"}`} />
                      <p className={`mt-1 ${i <= step ? "font-semibold text-brand" : "text-muted"}`}>{t(s.label)}</p>
                    </li>
                  ))}
                </ol>
              )}
              <p className={`mt-2 text-sm ${ended ? "font-medium text-red-600 dark:text-red-400" : ""}`} aria-live="polite">{t(`orders.status.${o.status}`)}</p>
              <dl className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
                {o.items.map((i) => (
                  <div key={i.listingId} className="flex justify-between gap-4"><dt>{i.quantity} × {i.title}</dt><dd className="shrink-0">{money(i.lineTotal)}</dd></div>
                ))}
                <div className="flex justify-between gap-4 text-muted"><dt>{t("cart.deliveryFee")}</dt><dd>{money(o.deliveryFee)}</dd></div>
              </dl>
              {o.note && <p className="mt-2 text-sm text-muted">📝 {o.note}</p>}
              <p className="mt-2 text-sm text-muted">📍 {o.deliveryAddress} · {t(o.paymentMethod === "Card" ? "cart.card" : "cart.cash")}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {o.status === "Pending" && (
                  <button type="button" onClick={() => void cancel(o)} disabled={busy === o.id} className="btn-outline h-9 text-sm hover:text-red-600">{t("orders.cancel")}</button>
                )}
                {(o.status === "Delivered" || ended) && (
                  <button type="button" onClick={() => orderAgain(o)} className="btn-primary h-9 text-sm">↻ {t("orders.orderAgain")}</button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
