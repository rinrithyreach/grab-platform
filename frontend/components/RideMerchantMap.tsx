"use client";

import { useEffect, useMemo, useState } from "react";
import type { RideMerchantArea, RideVehicleType } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import type { Place } from "@/lib/places";
import { rideMerchantMapArea } from "@/lib/ride-merchant-areas";
import RideMap from "./RideMap";

export default function RideMerchantMap({ from, to, label, vehicleType, onAvailabilityChange }: { from: Place; to: Place; label: string; vehicleType?: RideVehicleType; onAvailabilityChange?: (areas: RideMerchantArea[] | null) => void }) {
  const { api } = useAuth();
  const { t } = useT();
  const [merchants, setMerchants] = useState<RideMerchantArea[]>([]);
  const visibleMerchants = vehicleType ? merchants.filter((merchant) => merchant.vehicleType === vehicleType) : merchants;
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [retry, setRetry] = useState(0);
  const areas = useMemo(() => merchants.filter((merchant) => !vehicleType || merchant.vehicleType === vehicleType).flatMap((merchant) => {
    const area = rideMerchantMapArea(merchant);
    return area ? [area] : [];
  }), [merchants, vehicleType]);

  useEffect(() => {
    const ctrl = new AbortController();
    let busy = false;
    const refresh = async () => {
      if (busy) return;
      busy = true;
      try {
        const rows: RideMerchantArea[] = [];
        for (let page = 1; ; page++) {
          ctrl.signal.throwIfAborted();
          const batch = await api.rideMerchantAreas(page, ctrl.signal);
          rows.push(...batch);
          if (batch.length < 100) break;
        }
        if (!ctrl.signal.aborted) {
          setMerchants((previous) => JSON.stringify(previous) === JSON.stringify(rows) ? previous : rows);
          setPhase("ready");
          onAvailabilityChange?.(rows);
        }
      } catch { if (!ctrl.signal.aborted) { setPhase("error"); onAvailabilityChange?.(null); } }
      finally { busy = false; }
    };
    const focus = () => { void refresh(); };
    void refresh();
    const timer = setInterval(() => { if (document.visibilityState !== "hidden") void refresh(); }, 5000);
    window.addEventListener("focus", focus);
    return () => { ctrl.abort(); clearInterval(timer); window.removeEventListener("focus", focus); };
  }, [api, retry, onAvailabilityChange]);

  return <section className="space-y-3" aria-label={t("ride.merchantAreas")}>
    <div><h2 className="font-bold">{t("ride.merchantAreas")}</h2><p className="mt-1 text-xs text-muted">{t("ride.merchantAreasHint")}</p></div>
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted">
      <span>🟢 {t("ride.pickup")}</span><span>🔴 {t("ride.destination")}</span><span>🛵 {t("ride.merchantAreasCount", { n: areas.length })}</span>
    </div>
    <RideMap from={from} to={to} label={label} merchantAreas={areas} />
    {phase === "loading" && <p role="status" className="text-xs text-muted">{t("ride.merchantAreasLoading")}</p>}
    {phase === "error" && <div className="flex flex-wrap items-center justify-between gap-2"><p role="alert" className="text-xs text-muted">{t("ride.merchantAreasError")}</p><button type="button" className="btn-outline h-9 px-3 text-xs" onClick={() => { setPhase("loading"); setRetry((value) => value + 1); }}>{t("errorPage.retry")}</button></div>}
    {phase === "ready" && !visibleMerchants.length && <p className="text-xs text-muted">{t("ride.noMerchantAreas")}</p>}
    {visibleMerchants.length > areas.length && <p className="text-xs text-muted">{t("ride.merchantAreaMissing")}</p>}
    {visibleMerchants.length > 0 && <details className="rounded-xl border border-border p-3 text-sm">
      <summary className="cursor-pointer font-semibold">{t("ride.merchantsList", { n: visibleMerchants.length })}</summary>
      <ul className="mt-3 max-h-64 space-y-3 overflow-y-auto">{visibleMerchants.map((merchant) => <li key={merchant.id} className="border-t border-border pt-3">
        <p className="font-semibold">{merchant.name}</p><p className="mt-1 break-words text-xs text-muted">{merchant.address}</p>
        <p className="mt-1 text-xs text-muted">{t("merchant.workSchedule")}: {merchant.openingHours || t("ride.merchantHoursUnset")}</p>
      </li>)}</ul>
    </details>}
  </section>;
}
