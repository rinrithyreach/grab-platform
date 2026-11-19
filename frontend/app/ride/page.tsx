"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RideMerchantArea, RideVehicleType } from "@/lib/api";
import { errorMessage, useAuth } from "@/lib/auth";
import { money } from "@/lib/brand";
import { useT, type MessageKey } from "@/lib/i18n";
import { PLACES, distanceKm } from "@/lib/places";
import { DeviceLocationError, deviceRideLocation, getDeviceLocation, type DeviceLocation, type LocationFailure } from "@/lib/merchant-location";
import { demoFare, rideVehicleType, useRideService, type RideView, type VehicleId } from "@/lib/rides";
import { toast } from "@/lib/toast";
import LoginRequired from "@/components/LoginRequired";
import Select from "@/components/Select";
import BackButton from "@/components/BackButton";
import RideMerchantMap from "@/components/RideMerchantMap";
import RideBookingConfirmation from "@/components/RideBookingConfirmation";

const VEHICLES: { id: VehicleId; emoji: string; name: MessageKey; seats: number }[] = [
  { id: "bike", emoji: "🛵", name: "ride.moto", seats: 1 },
  { id: "tuk", emoji: "🛺", name: "ride.tuktuk", seats: 3 },
  { id: "car", emoji: "🚗", name: "ride.car", seats: 4 },
];
const CURRENT_LOCATION = PLACES.length;

export default function RidePage() {
  const { user, ready } = useAuth();
  const rides = useRideService();
  const { t, pick } = useT();
  const [pickup, setPickup] = useState(0);
  const [dropoff, setDropoff] = useState(1);
  const [vehicle, setVehicle] = useState<VehicleId | null>("car");
  const [merchantAvailability, setMerchantAvailability] = useState<{ phase: "loading" | "ready" | "error"; types: RideVehicleType[] }>({ phase: "loading", types: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [booked, setBooked] = useState<RideView | null>(null);
  const [location, setLocation] = useState<DeviceLocation | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [locationError, setLocationError] = useState<LocationFailure | null>(null);
  const locationRequest = useRef(0);
  useEffect(() => () => { locationRequest.current += 1; }, []);

  const places = useMemo(() => location ? [...PLACES, {
    name: deviceRideLocation(location), km: deviceRideLocation(location), lat: location.latitude, lng: location.longitude,
  }] : PLACES, [location]);
  const from = places[pickup];
  const to = places[dropoff];
  const sameLocation = from.lat === to.lat && from.lng === to.lng;
  const fromLabel = pickup === CURRENT_LOCATION ? t("ride.currentLocation") : pick(from.name, from.km);
  const toLabel = dropoff === CURRENT_LOCATION ? t("ride.currentLocation") : pick(to.name, to.km);
  const km = distanceKm(from, to);
  const etaMin = Math.max(3, Math.round((km / 22) * 60)); // ~22 km/h city traffic
  const placeOptions = places.map((p, i) => ({ value: i, label: i === CURRENT_LOCATION ? t("ride.currentLocation") : pick(p.name, p.km) }));
  const demo = rides?.mode === "demo";
  const selectedVehicleAvailable = demo || (merchantAvailability.phase === "ready" && vehicle !== null && merchantAvailability.types.includes(rideVehicleType[vehicle]));
  const updateMerchantAvailability = useCallback((areas: RideMerchantArea[] | null) => {
    const types = areas ? [...new Set(areas.map((area) => area.vehicleType))] : [];
    setMerchantAvailability((previous) => {
      const phase = areas ? "ready" : "error";
      return previous.phase === phase && previous.types.length === types.length && previous.types.every((type) => types.includes(type))
        ? previous : { phase, types };
    });
    if (demo) setVehicle((current) => current ?? "car");
    else if (areas) setVehicle((current) => current && types.includes(rideVehicleType[current])
      ? current : VEHICLES.find((option) => types.includes(rideVehicleType[option.id]))?.id ?? null);
  }, [demo]);

  function cancelDetection() {
    locationRequest.current += 1;
    setDetecting(false); setLocationError(null);
  }

  async function detectLocation() {
    const current = ++locationRequest.current;
    setDetecting(true); setLocationError(null); setError("");
    try {
      const detected = await getDeviceLocation(navigator.geolocation, window.isSecureContext);
      if (current !== locationRequest.current) return;
      setLocation(detected); setPickup(CURRENT_LOCATION);
    } catch (err) {
      if (current === locationRequest.current) setLocationError(err instanceof DeviceLocationError ? err.reason : "unavailable");
    } finally { if (current === locationRequest.current) setDetecting(false); }
  }

  async function book(e: React.FormEvent) {
    e.preventDefault();
    if (!rides || busy || detecting) return;
    if (!vehicle || !selectedVehicleAvailable) { setError(t("ride.vehicleUnavailable")); return; }
    if (sameLocation) { setError(t("ride.same")); return; }
    setBusy(true); setError("");
    try {
      // The backend stores English place names; only the UI is translated.
      const ride = await rides.bookRide({
        pickupLocation: from.name, destination: to.name,
        pickupLatitude: from.lat, pickupLongitude: from.lng,
        destinationLatitude: to.lat, destinationLongitude: to.lng,
        vehicleType: rideVehicleType[vehicle],
      }, vehicle, km);
      setBooked(ride);
      toast(t("ride.requested"));
    } catch (err) {
      setError(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  }

  // Live mode needs a login; demo mode works without one.
  const needsLogin = rides?.mode === "live" && !user;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <BackButton href="/" />
      <h1 className="text-3xl font-bold">{t("ride.title")}</h1>
      <p className="mt-1 text-muted">{t("ride.subtitle")}</p>

      {!rides || !ready ? (
        <div className="mt-6 grid animate-pulse gap-6 lg:grid-cols-2" aria-busy>
          <div className="card h-96" /><div className="card h-96" />
        </div>
      ) : needsLogin ? <LoginRequired what="loginRequired.bookRide" returnTo="/ride" /> : booked ? (
        <RideBookingConfirmation key={booked.id} initial={booked} from={fromLabel} to={toLabel} demo={demo} onAnother={() => setBooked(null)} />
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <form onSubmit={book} className="card min-w-0 space-y-5 p-5 sm:p-6">
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold">🟢 {t("ride.pickup")}</span>
                    <button type="button" onClick={detectLocation} disabled={detecting || busy} aria-busy={detecting} aria-describedby={locationError ? "ride-location-hint ride-location-error" : "ride-location-hint"} className="-my-1.5 inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-brand hover:bg-brand-soft disabled:opacity-50">
                      <span aria-hidden>⌖</span>{t(detecting ? "ride.detectingLocation" : "ride.detectLocation")}
                    </button>
                  </div>
                  <Select label={t("ride.pickup")} value={pickup} options={placeOptions} onChange={(value) => { cancelDetection(); setPickup(value); setError(""); }} />
                  <p id="ride-location-hint" className="mt-2 text-xs text-muted">{t("ride.locationHint")}</p>
                  {detecting && <p role="status" className="mt-2 text-sm text-muted">{t("ride.detectingLocation")}</p>}
                  {locationError && <p id="ride-location-error" role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">{t(`ride.location.error.${locationError}`)}</p>}
                  {location && (pickup === CURRENT_LOCATION || dropoff === CURRENT_LOCATION) && <div role="status" className="mt-3 rounded-xl bg-brand-soft p-3 text-sm">
                    <p className="font-semibold text-brand">{t("ride.currentLocation")}</p>
                    <p className="mt-1 break-words tabular-nums">{location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</p>
                    {location.accuracy !== null && <p className="mt-1 text-xs text-muted">{t("ride.locationAccuracy", { n: Math.round(location.accuracy) })}</p>}
                  </div>}
                </div>
                <div>
                  <span className="label">📍 {t("ride.destination")}</span>
                  <Select label={t("ride.destination")} value={dropoff} options={placeOptions} onChange={(value) => { setDropoff(value); setError(""); }} />
                </div>
              </div>
              <button
                type="button" aria-label={t("ride.swap")} title={t("ride.swap")}
                onClick={() => { cancelDetection(); setPickup(dropoff); setDropoff(pickup); setError(""); }}
                className="mb-6 grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-surface hover:bg-brand-soft"
              >⇅</button>
            </div>

            <div>
              <span className="label">{t("ride.vehicle")}</span>
              <div className="grid grid-cols-3 gap-2">
                {VEHICLES.map((v) => {
                  const available = demo || (merchantAvailability.phase === "ready" && merchantAvailability.types.includes(rideVehicleType[v.id]));
                  return (
                  <button
                    type="button" key={v.id} onClick={() => setVehicle(v.id)} disabled={!available} aria-pressed={available && vehicle === v.id}
                    className={`rounded-xl border p-3 text-center ${available ? vehicle === v.id ? "border-brand bg-brand-soft" : "border-border" : "cursor-not-allowed border-border opacity-45"}`}
                  >
                    <span className="block text-2xl" aria-hidden>{v.emoji}</span>
                    <span className="block text-sm font-semibold">{t(v.name)}</span>
                    <span className="block text-xs text-muted">{v.seats > 1 ? t("ride.seats", { n: v.seats }) : t("ride.seat")}</span>
                    {!available && merchantAvailability.phase === "ready" && <span className="mt-1 block text-xs">{t("ride.vehicleUnregistered")}</span>}
                    {/* Demo mode prices by vehicle and distance; the real backend sets its own fare. */}
                    {demo && !sameLocation && <span className="mt-1 block text-sm font-bold text-brand">{money(demoFare(v.id, km))}</span>}
                  </button>
                  );
                })}
              </div>
              {!demo && merchantAvailability.phase === "loading" && <p role="status" className="mt-2 text-sm text-muted">{t("ride.vehicleAvailabilityLoading")}</p>}
              {!demo && merchantAvailability.phase === "error" && <p role="alert" className="mt-2 text-sm text-muted">{t("ride.vehicleAvailabilityError")}</p>}
              {!demo && merchantAvailability.phase === "ready" && merchantAvailability.types.length === 0 && <p role="status" className="mt-2 text-sm text-muted">{t("ride.noMerchantAreas")}</p>}
            </div>
            {!demo && <p className="rounded-xl bg-brand-soft p-3 text-sm text-brand">{t("ride.liveVehicle")}</p>}

            {!demo && user?.role !== "Customer" && <p role="alert" className="text-sm text-muted">{t("ride.customerOnly")}</p>}

            {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}
            <button className="btn-primary w-full" disabled={busy || detecting || sameLocation || !selectedVehicleAvailable || (!demo && user?.role !== "Customer")}>
              {busy ? t("ride.busy") : demo ? `${t("ride.submit")} · ${money(demoFare(vehicle ?? "car", km))}` : t("ride.submit")}
            </button>
          </form>

          <aside className="card h-fit space-y-5 p-5 sm:p-6">
            <RideMerchantMap from={from} to={to} vehicleType={vehicle ? rideVehicleType[vehicle] : undefined} onAvailabilityChange={updateMerchantAvailability} label={t("ride.mapLabel", { from: fromLabel, to: toLabel })} />
            <div>
              <h2 className="font-bold">{t("ride.summary")}</h2>
              <ol className="mt-3 space-y-3 border-l-2 border-dashed border-border pl-4 text-sm">
                <li><span className="text-muted">{t("ride.from")}</span><br /><span className="font-medium">🟢 {fromLabel}</span></li>
                <li><span className="text-muted">{t("ride.to")}</span><br /><span className="font-medium">📍 {toLabel}</span></li>
              </ol>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-brand-soft p-3"><dt className="text-muted">{t("ride.distance")}</dt><dd className="text-lg font-bold">{t("ride.km", { n: km.toFixed(1) })}</dd></div>
              <div className="rounded-xl bg-brand-soft p-3"><dt className="text-muted">{t("ride.eta")}</dt><dd className="text-lg font-bold">{t("store.min", { n: etaMin })}</dd></div>
            </dl>
          </aside>
        </div>
      )}
    </div>
  );
}
