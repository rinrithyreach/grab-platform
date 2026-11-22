"use client";

import { useEffect, useRef, useState } from "react";
import { useT, type MessageKey } from "@/lib/i18n";
import { useProfile } from "@/lib/profile";
import { isValidAddress } from "@/lib/pricing";
import { DeviceLocationError, deviceRideLocation, getDeviceLocation, type LocationFailure } from "@/lib/merchant-location";
import { PLACES, distanceKm } from "@/lib/places";
import Icon from "./Icon";

const ADDRESS_ICON = { home: "🏠", work: "💼", other: "📍" } as const;
const LOCATION_ERRORS: Record<LocationFailure, MessageKey> = {
  permission: "cart.locationDenied", timeout: "cart.locationTimeout", unavailable: "cart.locationUnavailable",
  unsupported: "cart.locationUnsupported", insecure: "cart.locationInsecure",
};

export default function DeliveryAddressField({ id, value, onChange, invalid, onInvalidChange, onDetectingChange, disabled = false }: {
  id: string; value: string; onChange: (value: string) => void; invalid: boolean;
  onInvalidChange: (invalid: boolean) => void; onDetectingChange: (detecting: boolean) => void; disabled?: boolean;
}) {
  const { t, pick } = useT(); const { addresses } = useProfile();
  const [detecting, setDetecting] = useState(false);
  const [failure, setFailure] = useState<LocationFailure | null>(null);
  const [detected, setDetected] = useState(false);
  const input = useRef<HTMLInputElement>(null); const request = useRef(0);
  useEffect(() => () => { request.current += 1; onDetectingChange(false); }, [onDetectingChange]);

  // Typing or selecting a saved address cancels any older GPS response immediately.
  function edit(text: string, validate = false) {
    request.current += 1; setDetecting(false); onDetectingChange(false); setFailure(null); setDetected(false);
    onChange(text);
    if (validate || invalid) onInvalidChange(!isValidAddress(text));
  }

  async function detect() {
    if (disabled || detecting) return;
    const current = ++request.current;
    setDetecting(true); onDetectingChange(true); setFailure(null); setDetected(false);
    try {
      const location = await getDeviceLocation(navigator.geolocation, window.isSecureContext);
      if (current !== request.current) return;
      const point = { name: "", km: "", lat: location.latitude, lng: location.longitude };
      const nearest = PLACES.map(place => ({ place, distance: distanceKm(place, point) })).sort((a, b) => a.distance - b.distance)[0];
      const gps = deviceRideLocation(location);
      const address = nearest && nearest.distance <= 2
        ? `${pick("Near", "ជិត")} ${pick(nearest.place.name, nearest.place.km)} · ${gps}` : gps;
      onChange(address); onInvalidChange(false); setDetected(true); input.current?.focus();
    } catch (err) {
      if (current === request.current) setFailure(err instanceof DeviceLocationError ? err.reason : "unavailable");
    } finally {
      if (current === request.current) { setDetecting(false); onDetectingChange(false); }
    }
  }

  return <div>
    <label className="label" htmlFor={id}>{t("cart.address")}</label>
    {/* One tap to fill the address: detect where I am, or pick a saved one. */}
    <div className="mb-2 flex flex-wrap gap-2">
      <button type="button" disabled={disabled || detecting} aria-busy={detecting} onClick={detect} title={t("cart.locationHint")}
        className="inline-flex items-center gap-1.5 rounded-full border border-brand bg-brand-soft px-3 py-1 text-sm font-semibold text-brand transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60">
        <Icon name="pin" className={`h-4 w-4 ${detecting ? "animate-pulse" : ""}`} />{t(detecting ? "cart.detectingLocation" : "cart.detectLocation")}
      </button>
      {addresses.map(address => <button key={address.label} type="button" disabled={disabled} onClick={() => edit(address.text, true)} aria-pressed={value === address.text}
        className={`rounded-full border px-3 py-1 text-sm ${value === address.text ? "border-brand bg-brand-soft text-brand" : "border-border hover:bg-brand-soft"}`}>
        {ADDRESS_ICON[address.label]} {t(`profile.${address.label}`)}
      </button>)}
    </div>
    <input ref={input} id={id} required maxLength={300} autoComplete="street-address" disabled={disabled} value={value}
      className={`input ${invalid ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""}`}
      onChange={event => edit(event.target.value)} onBlur={() => { if (value.trim()) onInvalidChange(!isValidAddress(value)); }}
      aria-invalid={invalid} aria-describedby={invalid ? `${id}-error` : undefined} placeholder={t("cart.addressPh")} />
    {invalid && <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm text-red-600 dark:text-red-400">{t("cart.addressInvalid")}</p>}
    {failure && <p role="alert" className="mt-1.5 text-sm text-red-600 dark:text-red-400">{t(LOCATION_ERRORS[failure])}</p>}
    {detected && <p role="status" className="mt-1.5 flex items-center gap-1 text-xs text-brand"><Icon name="check" className="h-3.5 w-3.5" />{t("cart.locationDetected")}</p>}
  </div>;
}
