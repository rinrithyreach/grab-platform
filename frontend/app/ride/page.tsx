"use client";

import Link from "next/link";
import { useState } from "react";
import type { Ride } from "@/lib/api";
import { errorMessage, useAuth } from "@/lib/auth";
import { money } from "@/lib/brand";
import { PLACES, distanceKm } from "@/lib/places";
import LoginRequired from "@/components/LoginRequired";

const VEHICLES = [
  { id: "bike", emoji: "🛵", name: "Moto", seats: 1 },
  { id: "tuk", emoji: "🛺", name: "Tuk-tuk", seats: 3 },
  { id: "car", emoji: "🚗", name: "Car", seats: 4 },
];

export default function RidePage() {
  const { api, user } = useAuth();
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

  async function book(e: React.FormEvent) {
    e.preventDefault();
    if (pickup === dropoff) { setError("Pickup and destination must be different."); return; }
    setBusy(true); setError("");
    try {
      const ride = await api.bookRide({
        pickupLocation: from.name, destination: to.name,
        pickupLatitude: from.lat, pickupLongitude: from.lng,
        destinationLatitude: to.lat, destinationLongitude: to.lng,
      });
      setBooked(ride);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-bold">Book a ride</h1>
      <p className="mt-1 text-muted">Where to today?</p>

      {!user ? <LoginRequired what="book a ride" /> : booked ? (
        <div className="card mx-auto mt-6 max-w-md p-8 text-center">
          <p className="text-5xl">🎉</p>
          <h2 className="mt-3 text-xl font-bold">Ride requested!</h2>
          <p className="mt-2 text-muted">{booked.pickupLocation} → {booked.destination}</p>
          <p className="mt-1 font-semibold">{money(booked.fare)} · finding a driver…</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/rides" className="btn-primary">Track my rides</Link>
            <button className="btn-outline" onClick={() => setBooked(null)}>Book another</button>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <form onSubmit={book} className="card space-y-5 p-6">
            <div className="relative space-y-3">
              <div>
                <label className="label" htmlFor="pickup">🟢 Pickup</label>
                <select id="pickup" className="input" value={pickup} onChange={(e) => setPickup(Number(e.target.value))}>
                  {PLACES.map((p, i) => <option key={p.name} value={i}>{p.name}</option>)}
                </select>
              </div>
              <button
                type="button" aria-label="Swap pickup and destination"
                onClick={() => { setPickup(dropoff); setDropoff(pickup); }}
                className="absolute right-3 top-1/2 z-10 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full border border-border bg-surface hover:bg-brand-soft"
              >⇅</button>
              <div>
                <label className="label" htmlFor="dropoff">📍 Destination</label>
                <select id="dropoff" className="input" value={dropoff} onChange={(e) => setDropoff(Number(e.target.value))}>
                  {PLACES.map((p, i) => <option key={p.name} value={i}>{p.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <span className="label">Vehicle</span>
              <div className="grid grid-cols-3 gap-2">
                {VEHICLES.map((v) => (
                  <button
                    type="button" key={v.id} onClick={() => setVehicle(v.id)}
                    className={`rounded-xl border p-3 text-center ${vehicle === v.id ? "border-brand bg-brand-soft" : "border-border"}`}
                  >
                    <span className="block text-2xl">{v.emoji}</span>
                    <span className="block text-sm font-semibold">{v.name}</span>
                    <span className="block text-xs text-muted">{v.seats} seat{v.seats > 1 ? "s" : ""}</span>
                  </button>
                ))}
              </div>
            </div>

            {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}
            <button className="btn-primary w-full" disabled={busy || pickup === dropoff}>
              {busy ? "Requesting…" : "Request ride"}
            </button>
          </form>

          <aside className="card h-fit p-6">
            <h2 className="font-bold">Trip summary</h2>
            <ol className="mt-4 space-y-3 border-l-2 border-dashed border-border pl-4 text-sm">
              <li><span className="text-muted">From</span><br /><span className="font-medium">{from.name}</span></li>
              <li><span className="text-muted">To</span><br /><span className="font-medium">{to.name}</span></li>
            </ol>
            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-brand-soft p-3"><dt className="text-muted">Distance</dt><dd className="text-lg font-bold">{km.toFixed(1)} km</dd></div>
              <div className="rounded-xl bg-brand-soft p-3"><dt className="text-muted">Est. time</dt><dd className="text-lg font-bold">{etaMin} min</dd></div>
            </dl>
            <p className="mt-4 text-xs text-muted">Fare is set by the server when you book (flat demo fare).</p>
          </aside>
        </div>
      )}
    </div>
  );
}
