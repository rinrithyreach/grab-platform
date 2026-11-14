"use client";

import Link from "next/link";
import { useState } from "react";
import type { Ride } from "@/lib/api";
import { errorMessage, useAuth } from "@/lib/auth";
import { money } from "@/lib/brand";
import { useT, type MessageKey } from "@/lib/i18n";
import { PLACES, distanceKm } from "@/lib/places";
import LoginRequired from "@/components/LoginRequired";
import Select from "@/components/Select";
import BackButton from "@/components/BackButton";

const VEHICLES: { id: string; emoji: string; name: MessageKey; seats: number }[] = [
  { id: "bike", emoji: "🛵", name: "ride.moto", seats: 1 },
  { id: "tuk", emoji: "🛺", name: "ride.tuktuk", seats: 3 },
  { id: "car", emoji: "🚗", name: "ride.car", seats: 4 },
];

export default function RidePage() {
  const { api, user } = useAuth();
  const { t, pick } = useT();
  const [pickup, setPickup] = useState(0);
  const [dropoff, setDropoff] = useState(1);
  const [vehicle, setVehicle] = useState("car");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [booked, setBooked] = useState<Ride | null>(null);

  const from = PLACES[pickup];
  const to = PLACES[dropoff];
  const km = distanceKm(from, to);
  const etaMin = Math.max(3, Math.round((km / 22) * 60)); // ~22 km/h city traffic
  const placeOptions = PLACES.map((p, i) => ({ value: i, label: pick(p.name, p.km) }));

  async function book(e: React.FormEvent) {
    e.preventDefault();
    if (pickup === dropoff) { setError(t("ride.same")); return; }
    setBusy(true); setError("");
    try {
      // The backend stores English place names; only the UI is translated.
      const ride = await api.bookRide({
        pickupLocation: from.name, destination: to.name,
        pickupLatitude: from.lat, pickupLongitude: from.lng,
        destinationLatitude: to.lat, destinationLongitude: to.lng,
      });
      setBooked(ride);
    } catch (err) {
      setError(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <BackButton href="/" />
      <h1 className="text-3xl font-bold">{t("ride.title")}</h1>
      <p className="mt-1 text-muted">{t("ride.subtitle")}</p>

      {!user ? <LoginRequired what="loginRequired.bookRide" /> : booked ? (
        <div className="card mx-auto mt-6 max-w-md p-8 text-center">
          <p className="text-5xl">🎉</p>
          <h2 className="mt-3 text-xl font-bold">{t("ride.requested")}</h2>
          <p className="mt-2 text-muted">{booked.pickupLocation} → {booked.destination}</p>
          <p className="mt-1 font-semibold">{t("ride.finding", { fare: money(booked.fare) })}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/rides" className="btn-primary">{t("ride.track")}</Link>
            <button className="btn-outline" onClick={() => setBooked(null)}>{t("ride.another")}</button>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <form onSubmit={book} className="card min-w-0 space-y-5 p-5 sm:p-6">
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <span className="label" id="pickup-label">🟢 {t("ride.pickup")}</span>
                  <Select label={t("ride.pickup")} value={pickup} options={placeOptions} onChange={setPickup} />
                </div>
                <div>
                  <span className="label" id="dropoff-label">📍 {t("ride.destination")}</span>
                  <Select label={t("ride.destination")} value={dropoff} options={placeOptions} onChange={setDropoff} />
                </div>
              </div>
              <button
                type="button" aria-label={t("ride.swap")} title={t("ride.swap")}
                onClick={() => { setPickup(dropoff); setDropoff(pickup); }}
                className="mb-6 grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-surface hover:bg-brand-soft"
              >⇅</button>
            </div>

            <div>
              <span className="label">{t("ride.vehicle")}</span>
              <div className="grid grid-cols-3 gap-2">
                {VEHICLES.map((v) => (
                  <button
                    type="button" key={v.id} onClick={() => setVehicle(v.id)} aria-pressed={vehicle === v.id}
                    className={`rounded-xl border p-3 text-center ${vehicle === v.id ? "border-brand bg-brand-soft" : "border-border"}`}
                  >
                    <span className="block text-2xl">{v.emoji}</span>
                    <span className="block text-sm font-semibold">{t(v.name)}</span>
                    <span className="block text-xs text-muted">{v.seats > 1 ? t("ride.seats", { n: v.seats }) : t("ride.seat")}</span>
                  </button>
                ))}
              </div>
            </div>

            {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}
            <button className="btn-primary w-full" disabled={busy || pickup === dropoff}>
              {busy ? t("ride.busy") : t("ride.submit")}
            </button>
          </form>

          <aside className="card h-fit p-6">
            <h2 className="font-bold">{t("ride.summary")}</h2>
            <ol className="mt-4 space-y-3 border-l-2 border-dashed border-border pl-4 text-sm">
              <li><span className="text-muted">{t("ride.from")}</span><br /><span className="font-medium">{pick(from.name, from.km)}</span></li>
              <li><span className="text-muted">{t("ride.to")}</span><br /><span className="font-medium">{pick(to.name, to.km)}</span></li>
            </ol>
            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-brand-soft p-3"><dt className="text-muted">{t("ride.distance")}</dt><dd className="text-lg font-bold">{t("ride.km", { n: km.toFixed(1) })}</dd></div>
              <div className="rounded-xl bg-brand-soft p-3"><dt className="text-muted">{t("ride.eta")}</dt><dd className="text-lg font-bold">{t("store.min", { n: etaMin })}</dd></div>
            </dl>
            <p className="mt-4 text-xs text-muted">{t("ride.fareNote")}</p>
          </aside>
        </div>
      )}
    </div>
  );
}
