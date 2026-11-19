"use client";

import { useEffect, useMemo, useState } from "react";
import type { Ride } from "@/lib/api";
import { useT } from "@/lib/i18n";
import RideMap from "./RideMap";

export default function CustomerRideTracking({ ride, demo = false }: { ride: Ride; demo?: boolean }) {
  const { t } = useT();
  const [now, setNow] = useState(() => Date.now());
  const active = ride.status === "Pending" || ride.status === "Accepted" || ride.status === "InProgress";
  const location = ride.status === "Pending" || demo ? null : ride.driverLocation;
  const updated = location ? Date.parse(location.updatedAt) : NaN;
  const age = Number.isFinite(updated) ? Math.max(0, Math.floor((now - updated) / 1000)) : Infinity;
  const stale = age >= 30;
  const { pickup, destination } = useMemo(() => ({
    pickup: { name: ride.pickupLocation, km: "", lat: ride.pickupLatitude, lng: ride.pickupLongitude },
    destination: { name: ride.destination, km: "", lat: ride.destinationLatitude, lng: ride.destinationLongitude },
  }), [ride.pickupLocation, ride.pickupLatitude, ride.pickupLongitude, ride.destination, ride.destinationLatitude, ride.destinationLongitude]);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);

  if (!active) return null;
  // Haversine distance is only a proximity indicator, not a road distance or arrival estimate.
  let distance: string | null = null;
  if (location) {
    const rad = Math.PI / 180;
    const a = Math.sin((pickup.lat - location.latitude) * rad / 2) ** 2
      + Math.cos(location.latitude * rad) * Math.cos(pickup.lat * rad) * Math.sin((pickup.lng - location.longitude) * rad / 2) ** 2;
    distance = (6371 * 2 * Math.asin(Math.sqrt(Math.min(1, a)))).toFixed(1);
  }

  return <section className="mt-5 space-y-3 text-left" aria-label={t("tracking.mapLabel")}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-bold">{t(ride.status === "InProgress" ? "tracking.trip" : ride.status === "Pending" ? "rides.Pending" : "tracking.title")}</h3>
      {location && <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${stale ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" : "bg-brand-soft text-brand"}`}>
        <span aria-hidden className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current ${stale ? "" : "animate-pulse"}`} />
        {t(stale ? "tracking.paused" : "tracking.live")}
      </span>}
    </div>
    <RideMap from={pickup} to={destination} driver={location ?? undefined} trackingPhase={ride.status === "Pending" ? "waiting" : ride.status === "Accepted" ? "pickup" : "trip"} label={t("tracking.mapLabel")} />
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-hidden="true">
      <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-sky-500" />{t("ride.pickup")}</span>
      <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-900" />{t("ride.destination")}</span>
      {location && <span>{t("tracking.driver")}</span>}
    </div>
    <p role="status" className="text-sm text-muted">{demo ? t("tracking.demo") : location
      ? <>{stale ? t("tracking.stale") : ride.status === "Accepted" ? t("tracking.distance", { n: distance! }) : t("tracking.live")}{Number.isFinite(age) && <> · {t("tracking.updated", { n: age })}</>}</>
      : t(ride.status === "Pending" ? "tracking.finding" : "tracking.waiting")}</p>
  </section>;
}
