"use client";

import type { MerchantProfileRequest } from "@/lib/api";
import { useT, type MessageKey } from "@/lib/i18n";
import { MERCHANT_SERVICES } from "@/lib/merchant";
import RideMerchantLocation from "./RideMerchantLocation";
import RideWorkSchedule from "./RideWorkSchedule";

export default function MerchantProfileFields({ value, onChange, hideRidePhone = false, showRideSchedule = true, allowServiceSelection = false }: {
  value: MerchantProfileRequest; onChange: (profile: MerchantProfileRequest) => void; hideRidePhone?: boolean; showRideSchedule?: boolean; allowServiceSelection?: boolean;
}) {
  const { t } = useT();
  const ride = value.service === "GrabRide";
  type Field = { key: keyof Omit<MerchantProfileRequest, "service">; label: MessageKey; min?: number; max: number; type?: string; auto?: string; hint?: MessageKey };
  const fields: Field[] = ride ? [
    { key: "ownerName", label: "merchant.name", min: 2, max: 120, auto: "name" },
    ...(!hideRidePhone ? [{ key: "contactPhone", label: "auth.phone", max: 30, type: "tel", auto: "tel" } satisfies Field] : []),
    { key: "motorcycleLicensePlate", label: "merchant.motorcycleLicensePlate", min: 2, max: 30 },
  ] : [
    { key: "businessName", label: "merchant.businessName", min: 2, max: 120, auto: "organization" },
    { key: "ownerName", label: "merchant.ownerName", min: 2, max: 120, auto: "name" },
    { key: "contactPhone", label: "merchant.contactPhone", max: 30, type: "tel", auto: "tel" },
    { key: "email", label: "merchant.email", max: 254, type: "email", auto: "email" },
    { key: "address", label: "merchant.address", min: 5, max: 300, auto: "street-address" },
    { key: "city", label: "merchant.city", min: 2, max: 100, auto: "address-level1" },
    { key: "category", label: "merchant.category", min: 2, max: 100, hint: "merchant.categoryHint" },
    { key: "openingHours", label: "merchant.hours", min: 3, max: 200, hint: "merchant.hoursHint" },
  ];
  return (
    <div className="space-y-5">
      {allowServiceSelection && <fieldset>
        <legend className="label">{t("merchant.choose")}</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {MERCHANT_SERVICES.map((s) => <label key={s.id} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm font-semibold ${value.service === s.id ? "border-brand bg-brand-soft text-brand" : "border-border"}`}>
            <input type="radio" name="merchant-service" value={s.id} checked={value.service === s.id} onChange={() => onChange({ ...value, service: s.id, openingHours: value.service !== s.id && (ride || s.id === "GrabRide") ? "" : value.openingHours })} className="accent-brand" />
            <span aria-hidden>{s.emoji}</span>{s.id}
          </label>)}
        </div>
      </fieldset>}
      {ride && <fieldset>
        <legend className="label">{t("merchant.vehicleType")}</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {(["Motorcycle", "Rickshaw", "Classic"] as const).map((type) => <label key={type} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm font-semibold ${value.vehicleType === type ? "border-brand bg-brand-soft text-brand" : "border-border"}`}>
            <input type="radio" name="rideVehicleType" value={type} checked={value.vehicleType === type} onChange={() => onChange({ ...value, vehicleType: type })} className="accent-brand" />
            {type}
          </label>)}
        </div>
      </fieldset>}
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((f) => <div key={f.key} className={f.key === "address" ? "sm:col-span-2" : ""}>
          <label className="label" htmlFor={`merchant-${f.key}`}>{t(f.label)}</label>
          <input id={`merchant-${f.key}`} name={f.key} className="input" type={f.type ?? "text"} required={f.key !== "email"} minLength={f.min} maxLength={f.max} autoComplete={f.auto} placeholder={f.hint ? t(f.hint) : undefined} value={value[f.key] ?? ""} onChange={(e) => onChange({ ...value, [f.key]: e.target.value })} />
        </div>)}
      </div>
      {ride && <RideMerchantLocation value={value.address} onChange={(address) => onChange({ ...value, address })} />}
      {ride && showRideSchedule && <RideWorkSchedule value={value.openingHours} onChange={(openingHours) => onChange({ ...value, openingHours })} />}
      {!ride && <div>
        <label className="label" htmlFor="merchant-description">{t("merchant.description")}</label>
        <textarea id="merchant-description" name="description" className="input h-auto min-h-28 py-3" required minLength={10} maxLength={1500} rows={4} value={value.description} onChange={(e) => onChange({ ...value, description: e.target.value })} />
      </div>}
      <p className="text-xs leading-relaxed text-muted">{t(ride ? "merchant.ridePublicHint" : "merchant.publicHint")}</p>
    </div>
  );
}
