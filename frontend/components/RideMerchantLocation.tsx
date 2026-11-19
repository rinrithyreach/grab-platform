"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useT, type MessageKey } from "@/lib/i18n";
import { PHNOM_PENH_DISTRICTS } from "@/lib/phnom-penh";
import { DeviceLocationError, deviceRideLocation, getDeviceLocation, manualRideLocation, readDeviceRideLocation, rideLocationSelection, type LocationFailure } from "@/lib/merchant-location";

export default function RideMerchantLocation({ value, onChange, label = "merchant.location" }: { value: string; onChange: (location: string) => void; label?: MessageKey }) {
  const { t, pick } = useT();
  const id = useId();
  const [selection, setSelection] = useState(() => rideLocationSelection(value));
  const [mode, setMode] = useState<"auto" | "manual">(() => readDeviceRideLocation(value) ? "auto" : "manual");
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<LocationFailure | null>(null);
  const request = useRef(0);
  const latestChange = useRef(onChange);
  useEffect(() => { latestChange.current = onChange; }, [onChange]);
  useEffect(() => () => { request.current += 1; }, []);
  const district = PHNOM_PENH_DISTRICTS.find((item) => item.code === selection.districtCode);
  const coordinates = readDeviceRideLocation(value);

  function changeMode(next: "auto" | "manual") {
    setMode(next);
    if (next === "auto") { void detect(); return; }
    request.current += 1;
    setLoading(false); setError(null);
    onChange(manualRideLocation(selection.districtCode, selection.sangkatCode));
  }

  async function detect() {
    const current = ++request.current;
    setLoading(true); setError(null); onChange("");
    try {
      const location = await getDeviceLocation(navigator.geolocation, window.isSecureContext);
      if (current !== request.current) return;
      const address = deviceRideLocation(location);
      setAccuracy(location.accuracy); latestChange.current(address);
    } catch (err) {
      if (current === request.current) setError(err instanceof DeviceLocationError ? err.reason : "unavailable");
    } finally { if (current === request.current) setLoading(false); }
  }

  return <fieldset className="rounded-xl border border-border p-4 sm:p-5">
    <legend className="px-1 text-sm font-semibold">{t(label)}</legend>
    <input type="hidden" name="address" value={value} />
    <div className="grid gap-3 sm:grid-cols-2">
      <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${mode === "auto" ? "border-brand bg-brand-soft" : "border-border"}`}>
        <input type="radio" name="ride-location-mode" className="mt-1 accent-brand" value="auto" checked={mode === "auto"} onChange={() => changeMode("auto")} />
        <span><span className="block text-sm font-semibold">{t("merchant.location.auto")}</span><span className="mt-1 block text-xs text-muted">{t("merchant.location.autoHint")}</span></span>
      </label>
      <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${mode === "manual" ? "border-brand bg-brand-soft" : "border-border"}`}>
        <input type="radio" name="ride-location-mode" className="mt-1 accent-brand" value="manual" checked={mode === "manual"} onChange={() => changeMode("manual")} />
        <span><span className="block text-sm font-semibold">{t("merchant.location.manual")}</span><span className="mt-1 block text-xs text-muted">{t("merchant.location.manualHint")}</span></span>
      </label>
    </div>
    {mode === "auto" ? <div className="mt-5 space-y-3">
      <p className="text-xs text-muted">{t("merchant.location.permissionHint")}</p>
      {loading && <p role="status" className="text-sm text-muted">{t("merchant.location.detecting")}</p>}
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{t(`merchant.location.error.${error}`)}</p>}
      {error && <button type="button" className="btn-outline w-full sm:w-auto" onClick={detect}>{t("merchant.retry")}</button>}
      {coordinates && <div className="rounded-xl bg-brand-soft p-4 text-sm">
        <p className="font-semibold text-brand">{t("merchant.location.detected")}</p>
        <p className="mt-1 break-words tabular-nums">{coordinates.latitude.toFixed(6)}, {coordinates.longitude.toFixed(6)}</p>
        {accuracy !== null && <p className="mt-1 text-xs text-muted">{t("merchant.location.accuracy", { n: Math.round(accuracy) })}</p>}
        <a href={`https://www.openstreetmap.org/?mlat=${coordinates.latitude}&mlon=${coordinates.longitude}#map=16/${coordinates.latitude}/${coordinates.longitude}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-semibold text-brand">{t("merchant.location.map")} ↗</a>
      </div>}
    </div> : <div className="mt-5 space-y-4">
      <div><span className="label">{t("merchant.city")}</span><p className="rounded-xl bg-background px-3 py-3 text-sm font-medium">{pick("Phnom Penh", "ភ្នំពេញ")}</p></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label" htmlFor={`${id}-district`}>{t("merchant.location.district")}</label>
          <select id={`${id}-district`} className="input" value={selection.districtCode} required={!value || !!selection.districtCode} onChange={(e) => {
            setSelection({ districtCode: e.target.value, sangkatCode: "" }); onChange("");
          }}>
            <option value="">{t("merchant.location.chooseDistrict")}</option>
            {PHNOM_PENH_DISTRICTS.map((item) => <option key={item.code} value={item.code}>{pick(item.name, item.km)}</option>)}
          </select>
        </div>
        <div><label className="label" htmlFor={`${id}-sangkat`}>{t("merchant.location.sangkat")}</label>
          <select id={`${id}-sangkat`} className="input disabled:opacity-50" value={selection.sangkatCode} disabled={!district} required={!value || !!selection.districtCode} onChange={(e) => {
            setSelection({ ...selection, sangkatCode: e.target.value }); onChange(manualRideLocation(selection.districtCode, e.target.value));
          }}>
            <option value="">{t(district ? "merchant.location.chooseSangkat" : "merchant.location.districtFirst")}</option>
            {district?.sangkats.map((item) => <option key={item.code} value={item.code}>{pick(item.name, item.km)}</option>)}
          </select>
        </div>
      </div>
      {value && <div role="status" className="rounded-xl bg-brand-soft p-4 text-sm"><p className="font-semibold text-brand">{t("merchant.location.selected")}</p><p className="mt-1 break-words">{value}</p></div>}
    </div>}
  </fieldset>;
}
