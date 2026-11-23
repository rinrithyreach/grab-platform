"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RideMerchantArea, RideVehicleType } from "@/lib/api";
import { errorMessage, useAuth } from "@/lib/auth";
import { money } from "@/lib/brand";
import { useT, type MessageKey } from "@/lib/i18n";
import { PLACES, distanceKm, type Place } from "@/lib/places";
import { DeviceLocationError, deviceRideLocation, getDeviceLocation, type DeviceLocation, type LocationFailure } from "@/lib/merchant-location";
import { demoFare, rideVehicleType, useRideService, type RideView, type VehicleId } from "@/lib/rides";
import { toast } from "@/lib/toast";
import { notify } from "@/lib/notifications";
import { normalizePhoneNumber } from "@/lib/phone";
import { rememberGuestRide } from "@/lib/guest-rides";
import Select from "@/components/Select";
import BackButton from "@/components/BackButton";
import RideMerchantMap from "@/components/RideMerchantMap";
import RideBookingConfirmation from "@/components/RideBookingConfirmation";
import Icon from "@/components/Icon";

const VEHICLES: { id: VehicleId; emoji: string; name: MessageKey; seats: number }[] = [
  { id: "bike", emoji: "🛵", name: "ride.moto", seats: 1 },
  { id: "tuk", emoji: "🛺", name: "ride.tuktuk", seats: 3 },
  { id: "car", emoji: "🚗", name: "ride.car", seats: 4 },
];
const CURRENT_LOCATION = PLACES.length;
const MAP_LOCATION = PLACES.length + 1;

export default function RidePage() {
  const { user, ready } = useAuth();
  const rides = useRideService();
  const { t, pick } = useT();
  const [pickup, setPickup] = useState(0);
  const [dropoff, setDropoff] = useState(1);
  const [mappedPickup, setMappedPickup] = useState<Place | null>(null);
  const [mappedDestination, setMappedDestination] = useState<Place | null>(null);
  const [vehicle, setVehicle] = useState<VehicleId | null>("car");
  const [merchantAvailability, setMerchantAvailability] = useState<{ phase: "loading" | "ready" | "error"; types: RideVehicleType[] }>({ phase: "loading", types: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [booked, setBooked] = useState<RideView | null>(null);
  // Guests (not logged in) give a name and phone so the driver can reach them.
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestChecked, setGuestChecked] = useState(false);
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const trimmedGuestName = guestName.trim();
  const guestNameInvalid = trimmedGuestName.length < 2 || !/\p{L}/u.test(trimmedGuestName);
  const guestPhoneInvalid = !normalizePhoneNumber(guestPhone);
  const [location, setLocation] = useState<DeviceLocation | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [locationError, setLocationError] = useState<LocationFailure | null>(null);
  const locationRequest = useRef(0);
  useEffect(() => () => { locationRequest.current += 1; }, []);

  const places = useMemo(() => location ? [...PLACES, {
    name: deviceRideLocation(location), km: deviceRideLocation(location), lat: location.latitude, lng: location.longitude,
  }] : PLACES, [location]);
  const from = mappedPickup ?? places[pickup];
  const to = mappedDestination ?? places[dropoff];
  const sameLocation = from.lat === to.lat && from.lng === to.lng;
  const mapLabel = (point: Place) => `${t("ride.mapLocation")} · ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
  const fromLabel = mappedPickup ? mapLabel(mappedPickup) : pickup === CURRENT_LOCATION ? t("ride.currentLocation") : pick(from.name, from.km);
  const toLabel = mappedDestination ? mapLabel(mappedDestination) : dropoff === CURRENT_LOCATION ? t("ride.currentLocation") : pick(to.name, to.km);
  const km = distanceKm(from, to);
  const etaMin = Math.max(3, Math.round((km / 22) * 60)); // ~22 km/h city traffic
  const placeOptions = places.map((p, i) => ({ value: i, label: i === CURRENT_LOCATION ? t("ride.currentLocation") : pick(p.name, p.km) }));
  const pickupOptions = mappedPickup ? [...placeOptions, { value: MAP_LOCATION, label: fromLabel }] : placeOptions;
  const destinationOptions = mappedDestination ? [...placeOptions, { value: MAP_LOCATION, label: toLabel }] : placeOptions;
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

  function selectMapDestination(point: Pick<Place, "lat" | "lng">) {
    const name = deviceRideLocation({ latitude: point.lat, longitude: point.lng });
    if (!name) return;
    setMappedDestination({ ...point, name, km: name });
    setError("");
  }

  function swapLocations() {
    cancelDetection();
    setPickup(dropoff); setDropoff(pickup);
    setMappedPickup(mappedDestination); setMappedDestination(mappedPickup);
    setError("");
  }

  async function detectLocation() {
    const current = ++locationRequest.current;
    setDetecting(true); setLocationError(null); setError("");
    try {
      const detected = await getDeviceLocation(navigator.geolocation, window.isSecureContext);
      if (current !== locationRequest.current) return;
      setLocation(detected); setPickup(CURRENT_LOCATION); setMappedPickup(null);
    } catch (err) {
      if (current === locationRequest.current) setLocationError(err instanceof DeviceLocationError ? err.reason : "unavailable");
    } finally { if (current === locationRequest.current) setDetecting(false); }
  }

  async function book(e: React.FormEvent) {
    e.preventDefault();
    if (!rides || busy || detecting) return;
    if (!vehicle || !selectedVehicleAvailable) { setError(t("ride.vehicleUnavailable")); return; }
    if (sameLocation) { setError(t("ride.same")); return; }
    const contactPhone = normalizePhoneNumber(guestPhone);
    if (guest && (guestNameInvalid || !contactPhone)) {
      setGuestChecked(true);
      const field = document.getElementById(guestNameInvalid ? "ride-guest-name" : "ride-guest-phone");
      field?.focus();
      field?.scrollIntoView({ block: "center" });
      return;
    }
    setBusy(true); setError("");
    try {
      if (guest) {
        const result = await rides.bookGuestRide!({
          pickupLocation: from.name, destination: to.name,
          pickupLatitude: from.lat, pickupLongitude: from.lng,
          destinationLatitude: to.lat, destinationLongitude: to.lng,
          vehicleType: rideVehicleType[vehicle],
        }, vehicle, { contactName: guestName.trim(), contactPhone: contactPhone! });
        rememberGuestRide(result.ride.id, result.accessToken);
        setGuestToken(result.accessToken);
        setBooked(result.ride);
        toast(t("ride.requested"));
        return;
      }
      // The backend stores English place names; only the UI is translated.
      const ride = await rides.bookRide({
        pickupLocation: from.name, destination: to.name,
        pickupLatitude: from.lat, pickupLongitude: from.lng,
        destinationLatitude: to.lat, destinationLongitude: to.lng,
        vehicleType: rideVehicleType[vehicle],
      }, vehicle, km);
      setBooked(ride);
      toast(t("ride.requested"));
      notify({ id: `ride:${ride.id}:requested`, kind: "ride", title: t("notify.rideTitle"), body: t("notify.rideRequested", { destination: toLabel }), href: "/rides" });
    } catch (err) {
      setError(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  }

  // Live mode: customers book with their account; guests book with a name and phone.
  const guest = rides?.mode === "live" && !user;
  const customerBlocked = !demo && !!user && user.role !== "Customer";
  const selectedVehicle = VEHICLES.find((option) => option.id === vehicle);

  return (
    <div className="ride-booking-page mx-auto max-w-6xl px-4 pb-8 pt-4 sm:pt-6">
      <BackButton href="/" />
      <h1 className="text-2xl font-bold sm:text-3xl">{t("ride.title")}</h1>
      <p className="mt-1 text-base text-muted">{t("ride.subtitle")}</p>

      {!rides || !ready ? (
        <div className="mt-5 grid animate-pulse gap-5 lg:grid-cols-[minmax(0,420px)_1fr]" aria-busy>
          <div className="card h-96" /><div className="card h-56 lg:h-140" />
        </div>
      ) : booked ? (
        <RideBookingConfirmation key={booked.id} initial={booked} from={fromLabel} to={toLabel} demo={demo} guestToken={guestToken} onAnother={() => { setBooked(null); setGuestToken(null); }} />
      ) : (
        <form onSubmit={book} className="ride-booking-layout mt-5">
            <aside className="ride-map-panel min-w-0">
              <div id="ride-map-preview" className="relative isolate">
                <RideMerchantMap from={from} to={to} vehicleType={vehicle ? rideVehicleType[vehicle] : undefined} onAvailabilityChange={updateMerchantAvailability} onDestinationChange={busy ? undefined : selectMapDestination} label={t("ride.mapLabel", { from: fromLabel, to: toLabel })} />
              </div>
            </aside>

            <section className="ride-route-card card min-w-0 space-y-3 p-4 sm:p-5" aria-labelledby="ride-route-heading">
              <h2 id="ride-route-heading" className="text-lg font-bold">{pick("Where to?", "ទៅណា?")}</h2>
              <div className="ride-where rounded-2xl border border-border bg-background/60">
                <div className="ride-stop">
                  <span aria-hidden className="ride-stop-marker bg-brand"><span className="h-2 w-2 rounded-full bg-white" /></span>
                  <div className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-muted">{t("ride.pickup")}</span>
                    <Select label={t("ride.pickup")} value={mappedPickup ? MAP_LOCATION : pickup} options={pickupOptions} onChange={(value) => { if (value === MAP_LOCATION) return; cancelDetection(); setMappedPickup(null); setPickup(value); setError(""); }} />
                  </div>
                </div>
                <div className="ride-stop-divider">
                  <span className="flex-1 border-t border-border" />
                </div>
                <div className="ride-stop">
                  <span aria-hidden className="ride-stop-marker text-red-500"><Icon name="pin" className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-muted">{t("ride.destination")}</span>
                    <Select label={t("ride.destination")} value={mappedDestination ? MAP_LOCATION : dropoff} options={destinationOptions} onChange={(value) => { if (value === MAP_LOCATION) return; setMappedDestination(null); setDropoff(value); setError(""); }} />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button type="button" onClick={detectLocation} disabled={detecting || busy} aria-busy={detecting} aria-describedby={locationError ? "ride-location-error" : undefined}
                  className="flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-soft px-3 py-2 text-sm font-semibold text-brand transition hover:brightness-95 disabled:opacity-50">
                  <Icon name="pin" className="h-4 w-4" />{t(detecting ? "ride.detectingLocation" : "ride.detectLocation")}
                </button>
                <button type="button" aria-label={t("ride.swap")} title={t("ride.swap")} onClick={swapLocations} disabled={busy}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border bg-surface text-xl transition hover:border-brand hover:text-brand disabled:opacity-50">
                  <span aria-hidden>⇅</span>
                </button>
              </div>

              {detecting && <p role="status" className="text-sm text-muted">{t("ride.detectingLocation")}</p>}
              {locationError && <p id="ride-location-error" role="alert" className="text-sm text-red-600 dark:text-red-400">{t(`ride.location.error.${locationError}`)}</p>}
              {location && ((!mappedPickup && pickup === CURRENT_LOCATION) || (!mappedDestination && dropoff === CURRENT_LOCATION)) && location.accuracy !== null && (
                <p role="status" className="text-sm text-muted">{t("ride.locationAccuracy", { n: Math.round(location.accuracy) })}</p>
              )}
              {sameLocation && !error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{t("ride.same")}</p>}
            </section>

            <section className="ride-vehicle-card card min-w-0 p-4 sm:p-5" aria-labelledby="ride-vehicle-heading">
              <h2 id="ride-vehicle-heading" className="mb-3 text-lg font-bold">{pick("Choose a ride", "ជ្រើសរើសយានជំនិះ")}</h2>
              <div className="grid grid-cols-3 gap-2" role="group" aria-labelledby="ride-vehicle-heading">
                {VEHICLES.map((v) => {
                  const available = demo || (merchantAvailability.phase === "ready" && merchantAvailability.types.includes(rideVehicleType[v.id]));
                  const selected = available && vehicle === v.id;
                  return (
                    <button
                      type="button" key={v.id} onClick={() => setVehicle(v.id)} disabled={!available} aria-pressed={selected}
                      className={`ride-vehicle-option relative flex min-w-0 flex-col items-center justify-start rounded-2xl border px-2 py-3 text-center transition ${available ? selected ? "border-brand bg-brand-soft ring-1 ring-brand" : "border-border hover:border-brand" : "cursor-not-allowed border-border opacity-45"}`}
                    >
                      <span className="mb-1 grid h-10 w-10 shrink-0 place-items-center text-3xl" aria-hidden>{v.emoji}</span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold">{t(v.name)}</span>
                        <span className="mt-1 block text-sm text-muted">
                          {v.seats > 1 ? t("ride.seats", { n: v.seats }) : t("ride.seat")}
                        </span>
                        {!available && merchantAvailability.phase === "ready" && <span className="mt-1 block text-sm text-muted"><span aria-hidden>{pick("Unavailable", "មិនទំនេរ")}</span><span className="sr-only">{t("ride.vehicleUnregistered")}</span></span>}
                      </span>
                      {/* Demo mode prices by vehicle and distance; the real backend sets its own fare. */}
                      {demo && !sameLocation && <span className="mt-2 text-sm font-bold">{money(demoFare(v.id, km))}</span>}
                      <span aria-hidden className={`absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full border-2 ${selected ? "border-brand bg-brand text-white dark:text-background" : "border-border bg-surface"}`}>
                        {selected && <Icon name="check" className="h-3.5 w-3.5" />}
                      </span>
                    </button>
                  );
                })}
              </div>
              {!demo && merchantAvailability.phase === "loading" && <p role="status" className="mt-2 text-sm text-muted">{t("ride.vehicleAvailabilityLoading")}</p>}
              {!demo && merchantAvailability.phase === "error" && <p role="alert" className="mt-3 text-sm text-muted">{t("ride.vehicleAvailabilityError")}</p>}
              {!demo && merchantAvailability.phase === "ready" && merchantAvailability.types.length === 0 && <p role="status" className="mt-2 text-sm text-muted">{t("ride.noMerchantAreas")}</p>}
            </section>

            {/* Step 3 (guests only): who the driver should call */}
            {guest && (
              <section className="ride-contact-card card min-w-0 space-y-3 p-4 sm:p-5" aria-labelledby="ride-contact-heading">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <h2 id="ride-contact-heading" className="text-lg font-bold">{pick("Your details", "ព័ត៌មានរបស់អ្នក")}</h2>
                  <Link href="/login?next=%2Fride" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand hover:underline">{pick("Log in", "ចូល")}</Link>
                </div>
                <p className="text-sm text-muted">{pick("No account needed. Your driver will use these to reach you.", "មិនចាំបាច់មានគណនីទេ។ អ្នកបើកបរនឹងប្រើព័ត៌មាននេះដើម្បីទាក់ទងអ្នក។")}</p>
                <div>
                  <label htmlFor="ride-guest-name" className="mb-1 block text-sm font-semibold">{pick("Full name", "ឈ្មោះពេញ")}</label>
                  <input id="ride-guest-name" className={`input ${guestChecked && guestNameInvalid ? "border-red-500" : ""}`} autoComplete="name" maxLength={120} value={guestName}
                    onChange={(e) => setGuestName(e.target.value)} placeholder={pick("e.g. Sok Dara", "ឧ. សុខ ដារា")}
                    aria-invalid={guestChecked && guestNameInvalid} aria-describedby={guestChecked && guestNameInvalid ? "ride-guest-name-error" : undefined} />
                  {guestChecked && guestNameInvalid && <p id="ride-guest-name-error" role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400">{pick("Enter your name so the driver knows who to pick up.", "សូមបញ្ចូលឈ្មោះ ដើម្បីឱ្យអ្នកបើកបរដឹងថាត្រូវទទួលអ្នកណា។")}</p>}
                </div>
                <div>
                  <label htmlFor="ride-guest-phone" className="mb-1 block text-sm font-semibold">{pick("Phone number", "លេខទូរសព្ទ")}</label>
                  <input id="ride-guest-phone" className={`input ${guestChecked && guestPhoneInvalid ? "border-red-500" : ""}`} type="tel" inputMode="tel" autoComplete="tel" maxLength={30} value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)} placeholder="012 345 678"
                    aria-invalid={guestChecked && guestPhoneInvalid} aria-describedby={guestChecked && guestPhoneInvalid ? "ride-guest-phone-error" : undefined} />
                  {guestChecked && guestPhoneInvalid && <p id="ride-guest-phone-error" role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400">{pick("Enter a phone number the driver can call, e.g. 012 345 678.", "សូមបញ្ចូលលេខទូរសព្ទដែលអ្នកបើកបរអាចហៅបាន ឧ. 012 345 678។")}</p>}
                </div>
              </section>
            )}

            {/* Fixed above mobile navigation; stays in the form on larger screens. */}
            <div className="ride-cta">
              <div className="ride-cta-inner">
              {customerBlocked && <p role="alert" className="mb-2 text-sm text-muted">{t("ride.customerOnly")}</p>}
              {error && <p role="alert" className="mb-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}
              {selectedVehicle && !sameLocation && <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
                <span className="font-semibold">{t(selectedVehicle.name)}</span>
                <span className="flex items-center gap-1.5 text-muted"><Icon name="clock" className="h-4 w-4" />{pick("Approx.", "ប្រហែល")} {t("store.min", { n: etaMin })} · {t("ride.km", { n: km.toFixed(1) })}</span>
              </div>}
              <button type="submit" className="btn-primary min-h-13 w-full text-base" aria-busy={busy} disabled={busy || detecting || sameLocation || !selectedVehicleAvailable || customerBlocked}>
                {busy ? t("ride.busy") : demo ? `${t("ride.submit")} · ${money(demoFare(vehicle ?? "car", km))}` : t("ride.submit")}
              </button>
              </div>
            </div>
        </form>
      )}
    </div>
  );
}
