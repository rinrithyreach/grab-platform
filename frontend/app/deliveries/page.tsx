"use client";

import Link from "next/link";
import { useState } from "react";
import BackButton from "@/components/BackButton";
import RideMap from "@/components/RideMap";
import { money } from "@/lib/brand";
import { useNow } from "@/lib/clock";
import { cancelDelivery, useDeliveries } from "@/lib/express";
import { canCancelDelivery, deliveryStatus, type DeliveryStatus } from "@/lib/express-pricing";
import { useT } from "@/lib/i18n";
import { PLACES } from "@/lib/places";

const STEPS: DeliveryStatus[] = ["Pending", "Accepted", "PickedUp", "Delivered"];

export default function DeliveriesPage() {
  const { t, pick, dateLocale } = useT();
  const deliveries = useDeliveries();
  const now = useNow();
  const [tracking, setTracking] = useState<string | null>(null);
  const [error, setError] = useState("");
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <BackButton href="/express" />
      <h1 className="text-3xl font-bold">{t("nav.deliveries")}</h1>
      {error && <p role="alert" className="mt-4 text-red-600 dark:text-red-400">{error}</p>}
      {!deliveries.length ? <div className="card mt-6 p-10 text-center"><p className="text-5xl" aria-hidden>📦</p><p className="mt-3 font-semibold">{t("express.empty")}</p><Link href="/express" className="btn-primary mt-5">{t("express.submit")}</Link></div> : (
        <div className="mt-6 space-y-4">
          {deliveries.map((d) => {
            const status = deliveryStatus(d, now);
            const step = STEPS.indexOf(status);
            const from = PLACES[d.pickupPlace], to = PLACES[d.dropoffPlace];
            const rider = status === "Delivered" ? 1 : status === "PickedUp" ? Math.min(1, Math.max(0, (now - Date.parse(d.createdAt) - 30_000) / 30_000)) : 0;
            return <article key={d.id} className="card min-w-0 p-5">
              <div className="flex flex-wrap justify-between gap-2">
                <div className="min-w-0"><h2 className="font-bold">{pick(from.name, from.km)} → {pick(to.name, to.km)}</h2><p className="mt-1 break-all text-xs text-muted">{d.id}</p><p className="text-sm text-muted">{new Date(d.createdAt).toLocaleString(dateLocale)}</p></div>
                <p className="font-bold">{money(d.fare)}</p>
              </div>
              <p className={`mt-3 text-sm font-semibold ${status === "Cancelled" ? "text-muted" : "text-brand"}`} role="status">{t(`express.status.${status}`)}</p>
              {status !== "Cancelled" && <ol className="mt-3 grid grid-cols-4 gap-2 text-xs">{STEPS.map((s, i) => <li key={s}><div className={`h-1.5 rounded-full ${i <= step ? "bg-brand" : "bg-border"}`} /><p className="mt-1">{t(`express.status.${s}`)}</p></li>)}</ol>}
              <dl className="mt-4 space-y-2 border-t border-border pt-3 text-sm">
                <div><dt className="text-muted">{t("express.sender")}</dt><dd className="break-words">{d.senderName} · {d.senderPhone}<br />{d.pickupAddress}</dd></div>
                <div><dt className="text-muted">{t("express.recipient")}</dt><dd className="break-words">{d.recipientName} · {d.recipientPhone}<br />{d.dropoffAddress}</dd></div>
                <div><dt className="text-muted">{t("express.parcel")}</dt><dd className="break-words">{d.description} · {t(`express.size.${d.parcelSize}`)} · {d.weightKg} kg</dd></div>
                {d.note && <div><dt className="text-muted">{t("cart.note")}</dt><dd className="break-words">{d.note}</dd></div>}
              </dl>
              <p className="mt-3 text-xs text-muted">{t("express.cash")}</p>
              {tracking === d.id && status !== "Cancelled" && <div className="mt-4"><RideMap from={from} to={to} rider={rider} label={t("express.mapLabel")} /></div>}
              <div className="mt-4 flex flex-wrap gap-2">
                {status !== "Cancelled" && <button className="btn-outline h-9 text-sm" aria-expanded={tracking === d.id} onClick={() => setTracking(tracking === d.id ? null : d.id)}>{t(tracking === d.id ? "orders.hideMap" : "express.track")}</button>}
                {canCancelDelivery(status) && <button className="btn-outline h-9 text-sm" onClick={() => { setError(cancelDelivery(d.id) ? "" : t("express.cancelError")); }}>{t("rides.cancel")}</button>}
              </div>
            </article>;
          })}
        </div>
      )}
    </div>
  );
}
