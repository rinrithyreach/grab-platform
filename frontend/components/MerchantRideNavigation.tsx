"use client";

import { useMemo, useState } from "react";
import type { Ride, RideDriverLocation } from "@/lib/api";
import { useT } from "@/lib/i18n";
import type { Place } from "@/lib/places";
import RideMap from "./RideMap";
import RideLocationSharing from "./RideLocationSharing";

export default function MerchantRideNavigation({ ride }: { ride: Ride }) {
  const { t } = useT();
  const [localLocation, setLocalLocation] = useState<RideDriverLocation | null>(null);
  const { pickup, destination } = useMemo(() => ({
    pickup: { name: ride.pickupLocation, km: "", lat: ride.pickupLatitude, lng: ride.pickupLongitude } satisfies Place,
    destination: { name: ride.destination, km: "", lat: ride.destinationLatitude, lng: ride.destinationLongitude } satisfies Place,
  }), [ride.pickupLocation, ride.pickupLatitude, ride.pickupLongitude, ride.destination, ride.destinationLatitude, ride.destinationLongitude]);
  const goingToPickup = ride.status === "Accepted";
  const target = goingToPickup ? pickup : destination;
  // Let Maps use the device's current location as the navigation origin.
  const directions = new URLSearchParams({
    api: "1", destination: `${target.lat},${target.lng}`, travelmode: "driving", dir_action: "navigate",
  });

  return <section className="mt-5 space-y-3" aria-label={t("merchant.rides.navigation")}>
    <ol className="grid gap-2 sm:grid-cols-2" aria-label={t("merchant.rides.journeySteps")}>
      <li aria-current={goingToPickup ? "step" : undefined} className={`flex min-w-0 gap-3 rounded-xl border p-3 ${goingToPickup ? "border-brand bg-surface" : "border-border"}`}>
        <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-white dark:text-background">{goingToPickup ? "1" : "✓"}</span>
        <div className="min-w-0"><p className="text-sm font-bold">{t(goingToPickup ? "merchant.rides.pickupStep" : "merchant.rides.pickedUp")}</p><p className="mt-1 break-words text-xs text-muted">{pickup.name}</p></div>
      </li>
      <li aria-current={!goingToPickup ? "step" : undefined} className={`flex min-w-0 gap-3 rounded-xl border p-3 ${goingToPickup ? "border-border text-muted" : "border-brand bg-surface"}`}>
        <span aria-hidden="true" className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold ${goingToPickup ? "bg-background" : "bg-brand text-white dark:text-background"}`}>2</span>
        <div className="min-w-0"><p className="text-sm font-bold">{t("merchant.rides.destinationStep")}</p><p className="mt-1 break-words text-xs text-muted">{destination.name}</p>{goingToPickup && <p className="mt-1 text-xs">{t("merchant.rides.afterPickup")}</p>}</div>
      </li>
    </ol>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="min-w-0">
        <h4 className="font-bold text-brand" aria-live="polite">{t(goingToPickup ? "merchant.rides.goToPickup" : "merchant.rides.goToDestination")}</h4>
        <p className="mt-1 break-words text-sm">{target.name}</p>
        <p className="mt-2 max-w-md text-xs text-muted">{t(goingToPickup ? "merchant.rides.pickupHint" : "merchant.rides.destinationHint")}</p>
      </div>
      <a href={`https://www.google.com/maps/dir/?${directions}`} target="_blank" rel="noopener noreferrer" className="btn-primary h-auto min-h-11 py-2 text-center text-sm">
        {t(goingToPickup ? "merchant.rides.directionsPickup" : "merchant.rides.directionsDestination")} ↗
      </a>
    </div>
    <RideMap from={pickup} to={destination} driver={localLocation ?? ride.driverLocation ?? undefined} trackingPhase={goingToPickup ? "pickup" : "trip"} label={t(goingToPickup ? "merchant.rides.pickupMap" : "merchant.rides.destinationMap", { place: target.name })} />
    <RideLocationSharing ride={ride} onLocation={setLocalLocation} />
  </section>;
}
