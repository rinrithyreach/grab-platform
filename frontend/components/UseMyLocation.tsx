"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { PLACES, distanceKm } from "@/lib/places";
import { DeviceLocationError, deviceRideLocation, getDeviceLocation, type DeviceLocation, type LocationFailure } from "@/lib/merchant-location";
import Icon from "./Icon";

/** Text for a detected point: the nearest known landmark (if close) plus exact GPS for the driver. */
export function detectedAddress(location: DeviceLocation, pick: (en: string, km: string) => string) {
  const here = { name: "", km: "", lat: location.latitude, lng: location.longitude };
  const nearest = PLACES.map((p) => ({ p, d: distanceKm(p, here) })).sort((a, b) => a.d - b.d)[0];
  const gps = deviceRideLocation(location);
  return nearest && nearest.d <= 2 ? `${pick("Near", "ជិត")} ${pick(nearest.p.name, nearest.p.km)} · ${gps}` : gps;
}

/**
 * "Use my location" for address fields. Location permission is only requested when tapped.
 * `cancelOn`: pass the field's current text — if the customer types or picks something else
 * while we're still locating, the late result is ignored instead of overwriting it.
 */
export default function UseMyLocation({ onDetected, cancelOn }: {
  onDetected: (address: string) => void;
  cancelOn?: string;
}) {
  const { t, pick } = useT();
  const [detecting, setDetecting] = useState(false);
  const [failure, setFailure] = useState<LocationFailure | null>(null);
  const request = useRef(0);
  const latestText = useRef(cancelOn);
  useEffect(() => { latestText.current = cancelOn; }, [cancelOn]);
  useEffect(() => () => { request.current += 1; }, []);

  async function detect() {
    const current = ++request.current;
    const startedWith = latestText.current;
    setDetecting(true); setFailure(null);
    try {
      const location = await getDeviceLocation(navigator.geolocation, window.isSecureContext);
      if (current !== request.current) return;
      setDetecting(false);
      // The customer typed or picked another address meanwhile: keep their choice.
      if (latestText.current !== startedWith) return;
      onDetected(detectedAddress(location, pick));
    } catch (err) {
      if (current === request.current) { setFailure(err instanceof DeviceLocationError ? err.reason : "unavailable"); setDetecting(false); }
    }
  }

  const label = t(detecting ? "cart.detectingLocation" : "cart.detectLocation");
  const message = failure === "permission"
    ? pick("Location access is blocked. Allow it in your browser, or type your address.", "ការចូលប្រើទីតាំងត្រូវបានបិទ។ សូមអនុញ្ញាតក្នុងកម្មវិធីរុករក ឬវាយអាសយដ្ឋានរបស់អ្នក។")
    : failure === "insecure"
      ? pick("Open the site with HTTPS or localhost to detect your location, or type your address.", "សូមបើកគេហទំព័រតាម HTTPS ឬ localhost ដើម្បីរកទីតាំង ឬវាយអាសយដ្ឋានរបស់អ្នក។")
      : pick("Couldn't find your location. Try again or type your address.", "រកទីតាំងរបស់អ្នកមិនឃើញទេ។ សូមព្យាយាមម្ដងទៀត ឬវាយអាសយដ្ឋានរបស់អ្នក។");
  const error = failure && <p role="alert" className="mt-1.5 w-full text-sm text-red-600 dark:text-red-400">{message}</p>;
  const pin = <Icon name="pin" className={`h-4 w-4 ${detecting ? "animate-pulse" : ""}`} />;

  return <>
    <button type="button" onClick={detect} disabled={detecting} aria-busy={detecting} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-brand bg-brand-soft px-3 py-2 text-sm font-semibold text-brand transition hover:brightness-95 disabled:opacity-60">
      {pin}{label}
    </button>
    {error}
  </>;
}
