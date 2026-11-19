"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import BackButton from "@/components/BackButton";
import RideMap from "@/components/RideMap";
import Select from "@/components/Select";
import MerchantOffers from "@/components/MerchantOffers";
import { money } from "@/lib/brand";
import { bookDelivery } from "@/lib/express";
import { deliveryQuote, PARCEL_SIZES, type Delivery, type DeliveryRequest, type ParcelSize } from "@/lib/express-pricing";
import { useT } from "@/lib/i18n";
import { PLACES } from "@/lib/places";

const INITIAL: DeliveryRequest = {
  senderName: "", senderPhone: "", pickupAddress: "", pickupPlace: 0,
  recipientName: "", recipientPhone: "", dropoffAddress: "", dropoffPlace: 1,
  parcelSize: "small", weightKg: 1, description: "", note: "",
};

export default function ExpressPage() {
  const { t, pick } = useT();
  const [form, setForm] = useState(INITIAL);
  const [error, setError] = useState("");
  const [booked, setBooked] = useState<Delivery | null>(null);
  const submitting = useRef(false);
  const quote = deliveryQuote(form.pickupPlace, form.dropoffPlace, form.parcelSize);
  const places = PLACES.map((p, i) => ({ value: i, label: pick(p.name, p.km) }));
  const field = (name: "senderName" | "senderPhone" | "pickupAddress" | "recipientName" | "recipientPhone" | "dropoffAddress" | "description" | "note") => ({
    id: name, name, value: form[name], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [name]: e.target.value }),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    const result = bookDelivery(form);
    if ("error" in result) {
      setError(t(`express.error.${result.error ?? "parcel"}`));
      submitting.current = false;
    } else { setError(""); setBooked(result.delivery); }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <BackButton href="/" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl font-bold">{t("express.title")}</h1><p className="mt-1 text-muted">{t("express.subtitle")}</p></div>
        <div className="flex flex-wrap gap-2"><a href="#send-parcel" className="btn-primary">📦 {t("express.sendParcel")}</a><Link href="/deliveries" className="btn-outline">{t("nav.deliveries")}</Link></div>
      </div>
      <MerchantOffers service="GrabExpress" />

      {booked ? (
        <div className="card mx-auto mt-6 max-w-lg p-8 text-center" role="status">
          <p className="text-5xl" aria-hidden>📦</p>
          <h2 className="mt-3 text-xl font-bold">{t("express.booked")}</h2>
          <p className="mt-2 break-all text-sm text-muted">{booked.id}</p>
          <p className="mt-3 font-semibold">{money(booked.fare)} · {t("express.cash")}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/deliveries" className="btn-primary">{t("express.track")}</Link>
            <button className="btn-outline" onClick={() => { setBooked(null); setForm(INITIAL); submitting.current = false; }}>{t("express.another")}</button>
          </div>
        </div>
      ) : (
        <div id="send-parcel" className="mt-6 grid scroll-mt-20 gap-6 lg:grid-cols-2">
          <form onSubmit={submit} className="card min-w-0 space-y-6 p-5 sm:p-6">
            <fieldset className="space-y-3">
              <legend className="mb-3 text-lg font-bold">{t("express.sender")}</legend>
              <div><label className="label" htmlFor="senderName">{t("express.name")}</label><input className="input" required minLength={2} maxLength={120} autoComplete="section-sender name" {...field("senderName")} /></div>
              <div><label className="label" htmlFor="senderPhone">{t("express.phone")}</label><input className="input" type="tel" required maxLength={30} autoComplete="section-sender tel" {...field("senderPhone")} /></div>
              <div><span className="label">{t("express.pickupArea")}</span><Select label={t("express.pickupArea")} value={form.pickupPlace} options={places} onChange={(pickupPlace) => setForm({ ...form, pickupPlace })} /></div>
              <div><label className="label" htmlFor="pickupAddress">{t("express.pickupAddress")}</label><input className="input" required maxLength={300} autoComplete="section-sender street-address" placeholder={t("cart.addressPh")} {...field("pickupAddress")} /></div>
            </fieldset>
            <fieldset className="space-y-3">
              <legend className="mb-3 text-lg font-bold">{t("express.recipient")}</legend>
              <div><label className="label" htmlFor="recipientName">{t("express.name")}</label><input className="input" required minLength={2} maxLength={120} autoComplete="section-recipient name" {...field("recipientName")} /></div>
              <div><label className="label" htmlFor="recipientPhone">{t("express.phone")}</label><input className="input" type="tel" required maxLength={30} autoComplete="section-recipient tel" {...field("recipientPhone")} /></div>
              <div><span className="label">{t("express.dropoffArea")}</span><Select label={t("express.dropoffArea")} value={form.dropoffPlace} options={places} onChange={(dropoffPlace) => setForm({ ...form, dropoffPlace })} /></div>
              <div><label className="label" htmlFor="dropoffAddress">{t("express.dropoffAddress")}</label><input className="input" required maxLength={300} autoComplete="section-recipient street-address" placeholder={t("cart.addressPh")} {...field("dropoffAddress")} /></div>
            </fieldset>
            <fieldset className="space-y-3">
              <legend className="mb-3 text-lg font-bold">{t("express.parcel")}</legend>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(PARCEL_SIZES) as ParcelSize[]).map((size) => (
                  <button key={size} type="button" aria-pressed={form.parcelSize === size} onClick={() => setForm({ ...form, parcelSize: size, weightKg: Math.min(form.weightKg || 1, PARCEL_SIZES[size].maxKg) })} className={`rounded-xl border px-2 py-3 text-sm ${form.parcelSize === size ? "border-brand bg-brand-soft text-brand" : "border-border"}`}>
                    <span className="block font-semibold">{t(`express.size.${size}`)}</span><span>{t("express.maxWeight", { n: PARCEL_SIZES[size].maxKg })}</span>
                  </button>
                ))}
              </div>
              <div><label className="label" htmlFor="weightKg">{t("express.weight")}</label><input id="weightKg" name="weightKg" type="number" className="input" required min="0.01" step="0.01" max={PARCEL_SIZES[form.parcelSize].maxKg} value={Number.isNaN(form.weightKg) ? "" : form.weightKg} onChange={(e) => setForm({ ...form, weightKg: e.target.valueAsNumber })} /></div>
              <div><label className="label" htmlFor="description">{t("express.description")}</label><input className="input" required minLength={3} maxLength={300} {...field("description")} /></div>
              <div><label className="label" htmlFor="note">{t("cart.note")}</label><input className="input" maxLength={500} {...field("note")} /></div>
            </fieldset>
            {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}
            {!quote && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{t("express.error.route")}</p>}
            <p className="text-sm text-muted">{t("express.cash")}</p>
            <button className="btn-primary w-full" disabled={!quote}>{t("express.submit")} {quote && `· ${money(quote.fare)}`}</button>
          </form>
          <aside className="card h-fit space-y-4 p-5 sm:p-6 lg:sticky lg:top-24">
            <h2 className="text-lg font-bold">{t("express.estimate")}</h2>
            <RideMap from={PLACES[form.pickupPlace]} to={PLACES[form.dropoffPlace]} label={t("express.mapLabel")} />
            {quote && <dl className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-xl bg-brand-soft p-3"><dt className="text-muted">{t("ride.distance")}</dt><dd className="font-bold">{t("ride.km", { n: quote.distanceKm.toFixed(1) })}</dd></div>
              <div className="rounded-xl bg-brand-soft p-3"><dt className="text-muted">{t("ride.eta")}</dt><dd className="font-bold">{t("store.min", { n: quote.etaMinutes })}</dd></div>
              <div className="rounded-xl bg-brand-soft p-3"><dt className="text-muted">{t("cart.total")}</dt><dd className="font-bold">{money(quote.fare)}</dd></div>
            </dl>}
            <p className="text-xs text-muted">{t("express.estimateNote")}</p>
          </aside>
        </div>
      )}
    </div>
  );
}
