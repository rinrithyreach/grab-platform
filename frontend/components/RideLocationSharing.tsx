"use client";

import { useEffect, useState } from "react";
import type { Ride, RideDriverLocation, RideLocation } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import type { LocationFailure } from "@/lib/merchant-location";

export default function RideLocationSharing({ ride, onLocation }: { ride: Ride; onLocation?: (location: RideDriverLocation | null) => void }) {
  const { api } = useAuth();
  const { t } = useT();
  const [sharing, setSharing] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<LocationFailure | "network" | "stopError" | null>(null);
  const [stopping, setStopping] = useState(false);
  const active = ride.status === "Accepted" || ride.status === "InProgress";

  useEffect(() => {
    if (!sharing || !active) return;
    const ctrl = new AbortController();
    let latest: RideLocation | null = null;
    let busy = false;
    let lastSent = 0;
    let latestAt = 0;
    const publish = async () => {
      if (!latest || busy || ctrl.signal.aborted || Date.now() - lastSent < 2000 || Date.now() - latestAt > 15000) return;
      busy = true;
      lastSent = Date.now();
      try {
        await api.updateRideLocation(ride.id, latest, ctrl.signal);
        if (!ctrl.signal.aborted) { setSent(true); setError(null); }
      } catch { if (!ctrl.signal.aborted) setError("network"); }
      finally { busy = false; }
    };
    const watch = navigator.geolocation.watchPosition(({ coords }) => {
      if (ctrl.signal.aborted) return;
      if (!Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude)
        || Math.abs(coords.latitude) > 90 || Math.abs(coords.longitude) > 180) { latest = null; setError("unavailable"); return; }
      latest = { latitude: coords.latitude, longitude: coords.longitude,
        accuracy: Number.isFinite(coords.accuracy) && coords.accuracy >= 0 ? coords.accuracy : null };
      latestAt = Date.now();
      onLocation?.({ ...latest, updatedAt: new Date(latestAt).toISOString() });
      void publish();
    }, (failure) => {
      if (ctrl.signal.aborted) return;
      latest = null;
      setError(failure.code === 1 ? "permission" : failure.code === 3 ? "timeout" : "unavailable");
      if (failure.code === 1) setSharing(false);
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
    // Re-send a recent fix while stationary; old fixes must become visibly stale.
    const timer = setInterval(() => { void publish(); }, 3000);
    return () => { ctrl.abort(); navigator.geolocation.clearWatch(watch); clearInterval(timer); };
  }, [api, ride.id, active, sharing, onLocation]);

  function start() {
    if (!window.isSecureContext) { setError("insecure"); return; }
    if (!navigator.geolocation) { setError("unsupported"); return; }
    setError(null); setSent(false); setSharing(true);
  }

  async function stop() {
    setSharing(false); setStopping(true); setError(null);
    onLocation?.(null);
    try { await api.stopRideLocation(ride.id); setSent(false); }
    catch { setError("stopError"); }
    finally { setStopping(false); }
  }

  if (!active) return null;
  return <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
    <p className="text-sm text-muted">{t("tracking.shareHint")}</p>
    {sharing && <p role="status" className="text-sm font-semibold text-brand">{t(sent ? "tracking.sharing" : "tracking.locating")}</p>}
    {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{t(error === "network" || error === "stopError" ? `tracking.${error}` : `ride.location.error.${error}`)}</p>}
    {sharing || stopping || error === "stopError"
      ? <button type="button" className="btn-outline h-auto min-h-11 py-2 text-sm" disabled={stopping} onClick={stop}>{t(stopping ? "tracking.stopping" : "tracking.stop")}</button>
      : <button type="button" className="btn-primary h-auto min-h-11 py-2 text-sm" onClick={start}>{t("tracking.share")}</button>}
  </div>;
}
