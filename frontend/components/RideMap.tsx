"use client";

/**
 * Booking/merchant-area map and shared live navigation for customers and drivers.
 * Tracking uses road geometry when available and animates between observed GPS fixes.
 *
 * All views use OpenStreetMap's standard tiles without an API key. Network failures
 * show a retry message instead of switching to a provider that requires credentials.
 */
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { Circle, LayerGroup, Map as LeafletMap, Marker, Polyline } from "leaflet";
import type { RideDriverLocation } from "@/lib/api";
import { useT } from "@/lib/i18n";
import type { Place } from "@/lib/places";
import { groupRideMerchantAreas, rideMerchantPopup, type RideMerchantMapArea } from "@/lib/ride-merchant-areas";
import { createRideMotion, remainingPath, type MapPoint } from "@/lib/ride-motion";
import { useRideRoute } from "@/lib/use-ride-route";

// CARTO's unauthenticated endpoint now returns an API-key notice as an HTTP 200
// image, so Leaflet's tileerror event cannot detect it. Use the key-free OSM source.
const TILE_SOURCE = {
  url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
};

type Status = "loading" | "ready" | "failed";
const NO_MERCHANT_AREAS: RideMerchantMapArea[] = [];
const VEHICLE_ICON = `<span class="ride-driver-halo"></span><span class="ride-driver-vehicle"><svg viewBox="0 0 36 64" width="29" height="48" aria-hidden="true"><rect x="3" y="13" width="5" height="12" rx="2" fill="#203530"/><rect x="28" y="13" width="5" height="12" rx="2" fill="#203530"/><rect x="3" y="43" width="5" height="12" rx="2" fill="#203530"/><rect x="28" y="43" width="5" height="12" rx="2" fill="#203530"/><rect x="6" y="2" width="24" height="60" rx="9" fill="#fff" stroke="#47625a" stroke-width="1.5"/><path d="M10 18Q18 14 26 18L24 27H12Z" fill="#243f38"/><path d="M12 43H24L26 50Q18 53 10 50Z" fill="#243f38"/><rect x="11" y="29" width="14" height="12" rx="3" fill="#dcfce7"/><path d="M10 7h4m8 0h4" stroke="#b4edc7" stroke-width="3" stroke-linecap="round"/><path d="M10 57h4m8 0h4" stroke="#ef7777" stroke-width="2" stroke-linecap="round"/></svg></span>`;

interface Props {
  from: Place;
  to: Place;
  label: string;
  /** Optional 0–1: draws a moving 🛵 rider this far along the line (delivery tracking). */
  rider?: number;
  /** GPS reported by the assigned driver; never interpolated from booking time. */
  driver?: RideDriverLocation;
  trackingPhase?: "waiting" | "pickup" | "trip";
  merchantAreas?: RideMerchantMapArea[];
}

export default function RideMap({ from, to, label, rider, driver, trackingPhase, merchantAreas = NO_MERCHANT_AREAS }: Props) {
  const { t } = useT();
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const driverMarker = useRef<Marker | null>(null);
  const driverAccuracy = useRef<Circle | null>(null);
  const motion = useRef<ReturnType<typeof createRideMotion> | null>(null);
  const displayedPosition = useRef<MapPoint | null>(null);
  const routeLines = useRef<Polyline[]>([]);
  const roadPoints = useRef<MapPoint[]>([]);
  const following = useRef(false);
  const view = useRef("");
  const [status, setStatus] = useState<Status>("loading");
  const [attempt, setAttempt] = useState(0);
  const [follow, setFollow] = useState(false);
  const [now, setNow] = useState(0);
  const tracking = trackingPhase !== undefined;
  const hasDriver = !!driver;
  const driverLat = driver?.latitude, driverLng = driver?.longitude;
  const driverAccuracyMetres = driver?.accuracy, driverUpdatedAt = driver?.updatedAt;
  const paused = hasDriver && now - Date.parse(driverUpdatedAt ?? "") >= 30000;
  const goingToPickup = trackingPhase === "pickup";
  const waitingForPickupGps = goingToPickup && !hasDriver;
  // An accepted ride always targets the customer. Without driver GPS, show the
  // pickup pin and wait instead of drawing the later pickup-to-destination leg.
  const target = goingToPickup ? from : to;
  const originLat = driverLat ?? from.lat, originLng = driverLng ?? from.lng;
  const { route, loading: routeLoading, failed: routeFailed } = useRideRoute([originLat, originLng], [target.lat, target.lng], tracking && !waitingForPickupGps, `${trackingPhase}:${hasDriver}`);
  const targetPoint = useRef<MapPoint>([target.lat, target.lng]);
  useEffect(() => { roadPoints.current = route?.points ?? []; targetPoint.current = [target.lat, target.lng]; }, [route, target.lat, target.lng]);
  useEffect(() => {
    if (!tracking || !hasDriver) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [tracking, hasDriver]);

  // Create the map (Leaflet needs the browser, so it's loaded here, not on the server).
  // `attempt` changes when the user presses "Try again".
  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const finishMotion = () => { if (document.visibilityState === "hidden" || media?.matches) motion.current?.finish(); };
    document.addEventListener("visibilitychange", finishMotion);
    media?.addEventListener("change", finishMotion);

    import("leaflet").then((L) => {
      if (cancelled || !el.current || map.current) return;
      setNow(Date.now());
      const m = L.map(el.current, { scrollWheelZoom: false });
      map.current = m;
      layer.current = L.layerGroup().addTo(m);
      m.on("dragstart", () => { following.current = false; setFollow(false); });

      // Normal browser image requests preserve OSM's caching and Referer headers.
      let loadedAny = false;
      let errors = 0;
      const tiles = L.tileLayer(TILE_SOURCE.url, { maxZoom: 19, attribution: TILE_SOURCE.attribution });
      const failed = () => {
        if (cancelled || loadedAny) return;
        clearTimeout(timeout);
        setStatus("failed");
      };
      tiles.on("tileload", () => {
        if (cancelled || loadedAny) return;
        loadedAny = true; clearTimeout(timeout); setStatus("ready");
      });
      tiles.on("tileerror", () => { if (++errors >= 3) failed(); });
      timeout = setTimeout(failed, 10000);
      tiles.addTo(m);

      // Keep tiles filling the box when the page layout changes size.
      observer = new ResizeObserver(() => m.invalidateSize());
      observer.observe(el.current);
      el.current.dispatchEvent(new Event("map-ready"));
    }).catch(() => { if (!cancelled) setStatus("failed"); });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      observer?.disconnect();
      document.removeEventListener("visibilitychange", finishMotion);
      media?.removeEventListener("change", finishMotion);
      motion.current?.stop(); motion.current = null;
      map.current?.remove();
      map.current = null;
      layer.current = null;
      driverMarker.current = null;
      driverAccuracy.current = null;
      displayedPosition.current = null;
      routeLines.current = [];
      view.current = "";
    };
  }, [attempt, tracking]);

  // Draw the pins and line whenever pickup/destination change.
  useEffect(() => {
    const node = el.current;
    let cancelled = false;
    function draw() {
      import("leaflet").then((L) => {
        if (cancelled || !map.current || !layer.current) return;
        layer.current.clearLayers();
        routeLines.current = [];
        const a: [number, number] = [from.lat, from.lng];
        const b: [number, number] = [to.lat, to.lng];
        const start: MapPoint = hasDriver ? displayedPosition.current ?? [originLat, originLng] : [originLat, originLng];
        const end: MapPoint = [target.lat, target.lng];
        const path = tracking ? route ? remainingPath(start, route.points) : [start, end] : [a, b];
        if (!waitingForPickupGps) {
          if (tracking) routeLines.current.push(L.polyline(path, { color: "#fff", weight: 11, opacity: 0.9, lineCap: "round", interactive: false }).addTo(layer.current));
          routeLines.current.push(L.polyline(path, { color: tracking ? "#18a45b" : "#0f766e", weight: tracking ? 6 : 4,
            dashArray: tracking && route ? undefined : "8 8", lineCap: "round", lineJoin: "round", interactive: false }).addTo(layer.current));
          if (tracking && route && hasDriver) routeLines.current.push(L.polyline(path, { color: "#eaffee", weight: 2, dashArray: "1 19", opacity: 0.75,
            className: "ride-route-flow", interactive: false }).addTo(layer.current));
        }
        const pickupLabel = document.createElement("span"); pickupLabel.textContent = tracking ? t("ride.pickup") : from.name;
        const destinationLabel = document.createElement("span"); destinationLabel.textContent = tracking ? t("ride.destination") : to.name;
        if (tracking) L.circleMarker(a, { radius: 19, weight: 0, fillColor: "#0ea5e9", fillOpacity: 0.16, className: "ride-pickup-halo", interactive: false }).addTo(layer.current);
        L.circleMarker(a, { radius: tracking ? 8 : 9, color: "#fff", weight: tracking ? 4 : 3, fillColor: tracking ? "#0ea5e9" : "#16a34a", fillOpacity: 1 }).bindTooltip(pickupLabel).addTo(layer.current);
        if (!goingToPickup) L.circleMarker(b, { radius: tracking ? 8 : 9, color: "#fff", weight: 3, fillColor: tracking ? "#173f31" : "#dc2626", fillOpacity: 1 }).bindTooltip(destinationLabel).addTo(layer.current);
        for (const group of groupRideMerchantAreas(merchantAreas)) {
          const title = group.merchants.length === 1 ? group.merchants[0].name : t("ride.merchantsAtArea", { n: group.merchants.length });
          const tooltip = document.createElement("span");
          tooltip.textContent = title;
          const popup = document.createElement("div");
          for (const merchant of group.merchants) popup.append(rideMerchantPopup(merchant, {
            location: t(merchant.approximate ? "ride.merchantApproximateArea" : "ride.merchantSavedLocation"),
            hours: t("merchant.workSchedule"), noHours: t("ride.merchantHoursUnset"),
          }));
          L.marker(group.position, { title, icon: L.divIcon({
            html: `<span style="display:grid;place-items:center;width:32px;height:32px;border:2px solid #fff;border-radius:50%;background:#2563eb;color:#fff;box-shadow:0 2px 6px #0005">${group.merchants.length > 1 ? group.merchants.length : "🛵"}</span>`,
            className: "merchant-area-pin", iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -16],
          }) }).bindTooltip(tooltip).bindPopup(popup, { maxHeight: 240, maxWidth: 320 }).addTo(layer.current);
        }
        if (rider !== undefined) {
          const p = Math.min(1, Math.max(0, rider));
          const pos: [number, number] = [a[0] + (b[0] - a[0]) * p, a[1] + (b[1] - a[1]) * p];
          L.marker(pos, { icon: L.divIcon({ html: "🛵", className: "rider-icon", iconSize: [32, 32] }), keyboard: false }).addTo(layer.current);
        }
        const points: MapPoint[] = tracking ? [start, end, ...(route?.points ?? [])] : [a, b, ...merchantAreas.map((merchant) => merchant.position)];
        const nextView = JSON.stringify(tracking ? [a, b, trackingPhase, hasDriver, !!route] : points);
        if (view.current !== nextView) {
          if (points.every((point) => point[0] === a[0] && point[1] === a[1])) map.current.setView(a, tracking ? 17 : 15);
          else map.current.fitBounds(points, { padding: [40, 40], maxZoom: tracking ? 17 : 16 });
          view.current = nextView;
        }
      }).catch(() => { if (!cancelled) setStatus("failed"); });
    }
    draw();
    node?.addEventListener("map-ready", draw);
    return () => { cancelled = true; node?.removeEventListener("map-ready", draw); };
  }, [from, to, attempt, rider, merchantAreas, t, tracking, trackingPhase, goingToPickup, waitingForPickupGps, hasDriver, originLat, originLng, target.lat, target.lng, route]);

  // Keep the GPS marker mounted so location refreshes move it without resetting the map.
  useEffect(() => {
    const node = el.current;
    let cancelled = false;
    function drawDriver() {
      import("leaflet").then((L) => {
        if (cancelled || !map.current) return;
        if (driverLat === undefined || driverLng === undefined) {
          motion.current?.stop(); motion.current = null;
          driverMarker.current?.remove(); driverMarker.current = null;
          driverAccuracy.current?.remove(); driverAccuracy.current = null;
          displayedPosition.current = null;
          return;
        }
        const position: MapPoint = [driverLat, driverLng];
        if (driverMarker.current) driverMarker.current.setTooltipContent(t("tracking.driver"));
        else driverMarker.current = L.marker(position, { title: t("tracking.driver"), zIndexOffset: 1000,
          icon: L.divIcon({ html: VEHICLE_ICON, className: "ride-driver-pin", iconSize: [52, 52], iconAnchor: [26, 26] }),
        }).bindTooltip(t("tracking.driver")).addTo(map.current);
        if (driverAccuracyMetres !== null && driverAccuracyMetres !== undefined && driverAccuracyMetres > 0) {
          if (driverAccuracy.current) driverAccuracy.current.setRadius(driverAccuracyMetres);
          else driverAccuracy.current = L.circle(displayedPosition.current ?? position, { radius: driverAccuracyMetres, color: "#0ea5e9", weight: 1, fillOpacity: 0.07, interactive: false }).addTo(map.current);
        } else { driverAccuracy.current?.remove(); driverAccuracy.current = null; }
        if (!motion.current) motion.current = createRideMotion({ now: () => performance.now(),
          requestFrame: (callback) => window.requestAnimationFrame(callback), cancelFrame: (id) => window.cancelAnimationFrame(id),
          onFrame: (point, heading) => {
            displayedPosition.current = point;
            driverMarker.current?.setLatLng(point);
            driverAccuracy.current?.setLatLng(point);
            driverMarker.current?.getElement()?.querySelector<HTMLElement>(".ride-driver-vehicle")?.style.setProperty("--driver-heading", `${heading}deg`);
            if (tracking) {
              const remaining = roadPoints.current.length ? remainingPath(point, roadPoints.current) : [point, targetPoint.current];
              routeLines.current.forEach((line) => line.setLatLngs(remaining));
            }
          },
        });
        const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        motion.current.moveTo(position, { timestamp: Date.parse(driverUpdatedAt ?? "") || 0, road: roadPoints.current,
          immediate: paused || reduced || document.visibilityState === "hidden" });
        if (following.current && !paused && !map.current.getBounds().pad(-0.25).contains(position)) {
          map.current.panTo(position, { animate: !reduced, duration: 1 });
        }
      }).catch(() => { if (!cancelled) setStatus("failed"); });
    }
    drawDriver();
    node?.addEventListener("map-ready", drawDriver);
    return () => { cancelled = true; node?.removeEventListener("map-ready", drawDriver); };
  }, [driverLat, driverLng, driverAccuracyMetres, driverUpdatedAt, paused, tracking, attempt, t]);

  function showRoute() {
    if (!map.current) return;
    following.current = false; setFollow(false);
    const points: MapPoint[] = [[originLat, originLng], [target.lat, target.lng], ...(route?.points ?? [])];
    map.current.fitBounds(points, { padding: [48, 48], maxZoom: 17, animate: !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches, duration: 0.6 });
  }

  function followDriver() {
    if (!map.current || !driver) return;
    const next = !following.current;
    following.current = next; setFollow(next);
    if (next) map.current.panTo(displayedPosition.current ?? [driver.latitude, driver.longitude], { animate: !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches, duration: 0.8 });
  }

  return (
    <div className="relative isolate" data-tracking-paused={paused || !hasDriver}>
      <div key={attempt} ref={el} role="img" aria-label={label} className={`ride-map w-full overflow-hidden rounded-2xl border border-border bg-background ${tracking ? "h-96 sm:h-[420px]" : "h-64 sm:h-72"}`} />
      {tracking && status === "ready" && <>
        <div className="pointer-events-none absolute right-3 top-3 z-[500] flex items-center gap-2 rounded-full border border-white/80 bg-surface/95 px-3 py-2 text-xs font-semibold shadow-sm backdrop-blur-sm">
          <span className={`h-2 w-2 rounded-full ${hasDriver && !paused ? "animate-pulse bg-emerald-500" : "bg-amber-500"}`} />
          {t(hasDriver ? paused ? "tracking.paused" : "tracking.live" : trackingPhase === "waiting" ? "rides.Pending" : "tracking.awaitingGps")}
        </div>
        <div className="pointer-events-none absolute inset-x-3 bottom-8 z-[500] flex items-end justify-between gap-3">
          <div className="min-w-0 max-w-[calc(100%_-_4rem)] rounded-2xl border border-white/80 bg-surface/95 p-3 shadow-lg backdrop-blur-sm sm:p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{t(goingToPickup ? "tracking.pickupTarget" : "ride.destination")}</p>
            <p className="mt-1 truncate text-sm font-bold">{target.name}</p>
            {route && <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted"><span className="font-bold text-brand">{t("tracking.minutes", { n: Math.max(1, Math.ceil(route.duration / 60)) })}</span><span>· {(route.distance / 1000).toFixed(1)} km</span><span>{t("tracking.estimatedDrive")}</span></p>}
          </div>
          <div className="pointer-events-auto flex shrink-0 flex-col gap-2">
            {hasDriver && <button type="button" title={t(follow ? "tracking.following" : "tracking.follow")} aria-label={t(follow ? "tracking.following" : "tracking.follow")} aria-pressed={follow} onClick={followDriver}
              className={`grid h-11 w-11 place-items-center rounded-full border shadow-md ${follow ? "border-brand bg-brand text-white" : "border-border bg-surface text-foreground"}`}>
              <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/></svg>
            </button>}
            <button type="button" title={t("tracking.overview")} aria-label={t("tracking.overview")} onClick={showRoute} className="grid h-11 w-11 place-items-center rounded-full border border-border bg-surface text-foreground shadow-md">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><path d="m8 8-5-5m13 5 5-5M8 16l-5 5m13-5 5 5"/></svg>
            </button>
          </div>
        </div>
      </>}
      {status !== "ready" && (
        <div className="absolute inset-0 z-[1100] grid place-items-center rounded-xl bg-background/85 p-6 text-center text-sm" aria-live="polite">
          {status === "loading" ? (
            <p className="animate-pulse text-muted">🗺️ {t("ride.mapLoading")}</p>
          ) : (
            <div>
              <p className="font-semibold">🗺️ {t("ride.mapError")}</p>
              <button type="button" onClick={() => { setStatus("loading"); setAttempt((n) => n + 1); }} className="btn-outline mt-3 h-9 text-sm">
                {t("errorPage.retry")}
              </button>
            </div>
          )}
        </div>
      )}
      {tracking && <p className="mt-2 px-1 text-xs text-muted">{t(waitingForPickupGps ? "tracking.pickupWaitingGps" : routeLoading ? "tracking.routeLoading" : routeFailed ? "tracking.routeFallback" : "tracking.roadHint")}</p>}
    </div>
  );
}
