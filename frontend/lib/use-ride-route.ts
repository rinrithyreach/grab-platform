"use client";

import { useEffect, useRef, useState } from "react";
import { metresBetween, type MapPoint } from "./ride-motion";

export interface RideRoadRoute { points: MapPoint[]; distance: number; duration: number }

/** Refresh road geometry as the driver moves; GPS animation does not wait for routing. */
export function useRideRoute(from: MapPoint, to: MapPoint, enabled: boolean, phase = "") {
  const origin = useRef(from);
  const [result, setResult] = useState<{ key: string; route: RideRoadRoute | null } | null>(null);
  const targetLat = to[0], targetLng = to[1];
  const key = `${phase}:${targetLat},${targetLng}`;
  useEffect(() => { origin.current = from; }, [from]);
  useEffect(() => {
    if (!enabled) return;
    const ctrl = new AbortController();
    let lastOrigin: MapPoint | null = null;
    let lastAttempt = -Infinity;
    let busy = false;
    let failed = false;
    const refresh = async () => {
      if (busy || ctrl.signal.aborted || document.visibilityState === "hidden") return;
      const point = origin.current;
      if (lastOrigin && (!failed && metresBetween(point, lastOrigin) < 30 || Date.now() - lastAttempt < 10000)) return;
      busy = true; lastOrigin = point; lastAttempt = Date.now();
      try {
        const response = await fetch("/api/ride-route", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ from: point, to: [targetLat, targetLng] }), signal: ctrl.signal, cache: "no-store" });
        if (!response.ok) throw new Error("No route");
        const route: RideRoadRoute = await response.json();
        if (!ctrl.signal.aborted) { failed = false; setResult({ key, route }); }
      } catch { if (!ctrl.signal.aborted) { failed = true; setResult({ key, route: null }); } }
      finally { busy = false; }
    };
    void refresh();
    const timer = setInterval(() => { void refresh(); }, 2000);
    const focus = () => { void refresh(); };
    window.addEventListener("focus", focus);
    return () => { ctrl.abort(); clearInterval(timer); window.removeEventListener("focus", focus); };
  }, [enabled, key, targetLat, targetLng]);
  return { route: enabled && result?.key === key ? result.route : null,
    loading: enabled && result?.key !== key, failed: enabled && result?.key === key && !result.route };
}
