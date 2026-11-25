"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, type MerchantOrder, type MerchantOrderStatus } from "@/lib/api";
import { errorMessage, useAuth } from "@/lib/auth";
import { money } from "@/lib/brand";
import { useT, type MessageKey } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { formatPaid } from "@/lib/currency";
import { confirmDialog } from "@/lib/dialog";
import { ListSkeleton } from "./Skeleton";

/** The next step the store can take for each status (Reject/Cancel → Rejected is offered beside it). */
const NEXT: Partial<Record<MerchantOrderStatus, { status: MerchantOrderStatus; label: MessageKey }>> = {
  Pending: { status: "Accepted", label: "merchant.order.accept" },
  Accepted: { status: "OnTheWay", label: "merchant.order.onTheWay" },
  OnTheWay: { status: "Delivered", label: "merchant.order.delivered" },
};
const BADGE: Record<MerchantOrderStatus, string> = {
  Pending: "bg-accent/20 text-foreground",
  Accepted: "bg-brand-soft text-brand",
  OnTheWay: "bg-brand-soft text-brand",
  Delivered: "bg-background text-muted",
  Rejected: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  Cancelled: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
};

/** Polls the store's orders every 5 seconds; `onPending` reports how many are waiting for a response. */
export default function MerchantOrders({ onPending }: { onPending?: (count: number) => void }) {
  const { api } = useAuth();
  const { t, dateLocale } = useT();
  const [orders, setOrders] = useState<MerchantOrder[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const rows = await api.merchantOrders(1, signal);
      if (signal?.aborted) return;
      setOrders(rows); setError("");
      onPending?.(rows.filter((o) => o.status === "Pending").length);
    } catch (err) { if (!signal?.aborted) setError(errorMessage(err, t)); }
  }, [api, t, onPending]);

  useEffect(() => {
    const ctrl = new AbortController();
    let running = false;
    const refresh = async () => {
      if (running) return;
      running = true;
      try { await load(ctrl.signal); } finally { running = false; }
    };
    void refresh();
    const timer = setInterval(() => { if (document.visibilityState !== "hidden") void refresh(); }, 5000);
    window.addEventListener("focus", refresh);
    return () => { ctrl.abort(); clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [load]);

  async function move(order: MerchantOrder, status: MerchantOrderStatus) {
    if (status === "Rejected" && !(await confirmDialog({
      title: t(order.status === "Pending" ? "dialog.rejectOrder" : "dialog.cancelOrder"),
      message: t(order.status === "Pending" ? "merchant.order.rejectConfirm" : "merchant.order.cancelConfirm"),
      confirmLabel: t(order.status === "Pending" ? "dialog.rejectOrder" : "dialog.cancelOrder"),
      cancelLabel: t("dialog.keep"),
      tone: "danger",
    }))) return;
    setBusy(order.id);
    try {
      const updated = await api.updateMerchantOrder(order.id, status);
      setOrders((list) => list?.map((o) => (o.id === updated.id ? updated : o)) ?? list);
      toast(t("merchant.order.updated"));
    } catch (err) {
      // 409: the customer cancelled or another tab already changed it.
      toast(err instanceof ApiError && err.status === 409 ? t("merchant.order.changed") : errorMessage(err, t), "error");
    } finally {
      setBusy(null);
      void load();
    }
  }

  if (!orders) return error ? <div className="card mt-6 p-6"><p role="alert">{error}</p></div> : <ListSkeleton count={2} />;

  return (
    <section className="mt-6" aria-labelledby="merchant-orders-title">
      <h2 id="merchant-orders-title" className="text-xl font-bold">{t("merchant.orders")}</h2>
      <p className="mt-1 text-sm text-muted">{t("merchant.ordersIntro")}</p>
      {error && <p role="status" className="mt-3 text-sm text-muted">{error}</p>}
      {orders.length === 0 ? (
        <div className="card mt-5 p-8 text-center"><p className="text-4xl" aria-hidden>🧾</p><p className="mx-auto mt-4 max-w-lg text-muted">{t("merchant.noOrders")}</p></div>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {orders.map((o) => {
            const next = NEXT[o.status];
            return (
              <article key={o.id} className={`card p-5 ${o.status === "Pending" ? "ring-2 ring-accent" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">#{o.id.slice(0, 8).toUpperCase()}</p>
                    <p className="text-sm text-muted">{new Date(o.createdAt).toLocaleString(dateLocale)}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${BADGE[o.status]}`}>{t(`merchant.status.${o.status}`)}</span>
                </div>
                <dl className="mt-3 space-y-1 text-sm">
                  {o.items.map((i) => (
                    <div key={i.listingId} className="flex justify-between gap-4"><dt>{i.quantity} × {i.title}</dt><dd className="shrink-0">{money(i.lineTotal)}</dd></div>
                  ))}
                  {!!o.discount && <div className="flex justify-between gap-4 text-brand"><dt>{t("cart.promo", { promo: "" })}</dt><dd>−{money(o.discount)}</dd></div>}
                  {!!o.codeDiscount && <div className="flex justify-between gap-4 text-brand"><dt>{t("cart.promo", { promo: o.promoCode ?? "" })}</dt><dd>−{money(o.codeDiscount)}</dd></div>}
                  <div className="flex justify-between gap-4 border-t border-border pt-1 text-muted"><dt>{t("cart.deliveryFee")}</dt><dd>{money(o.deliveryFee)}</dd></div>
                  <div className="flex justify-between gap-4 font-bold"><dt>{t("cart.total")} · {t(o.paymentMethod === "Card" ? "cart.card" : "cart.cash")} · {o.currency ?? "USD"}</dt><dd>{money(o.total)}</dd></div>
                  {/* Riders need to know whether to collect dollars or riel at the door. */}
                  {o.currency === "KHR" && <div className="flex justify-between gap-4 rounded-lg bg-brand-soft px-2 py-1 font-bold text-brand"><dt>{o.paymentMethod === "Cash" ? t("currency.collectCash") : t("currency.paidIn", { currency: "KHR" })}</dt><dd>{formatPaid(o.total, "KHR", o.exchangeRate)}</dd></div>}
                </dl>
                <div className="mt-3 space-y-1 rounded-xl bg-background p-3 text-sm">
                  <p><span className="font-semibold">{t("merchant.order.customer")}:</span> {o.customerName}{o.customerPhone && <> · <a className="text-brand underline" href={`tel:${o.customerPhone}`}>{o.customerPhone}</a></>}</p>
                  <p>📍 {o.deliveryAddress}</p>
                  {o.note && <p className="text-muted">📝 {o.note}</p>}
                </div>
                {next && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" className="btn-primary h-9 text-sm" disabled={busy === o.id} onClick={() => void move(o, next.status)}>{t(next.label)}</button>
                    <button type="button" className="btn-outline h-9 text-sm hover:text-red-600" disabled={busy === o.id} onClick={() => void move(o, "Rejected")}>{t(o.status === "Pending" ? "merchant.order.reject" : "merchant.order.cancel")}</button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
