"use client";

/**
 * Map for the ride page: pickup (green) and destination (red) pins with a dashed line.
 * Uses Leaflet with free map tiles (needs internet). The line is straight, not a real
 * road route, because there is no routing service.
 *
 * If OpenStreetMap's tiles can't load (offline, blocked network, ad-blocker...), it
 * switches to CARTO's free tiles; if those fail too, it shows a message instead of a grey box.
 */
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { LayerGroup, Map as LeafletMap, TileLayer } from "leaflet";
import { useT } from "@/lib/i18n";
import type { Place } from "@/lib/places";

const TILE_SOURCES = [
  {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  {
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
];

type Status = "loading" | "ready" | "failed";

interface Props {
  from: Place;
  to: Place;
  label: string;
  /** Optional 0–1: draws a moving 🛵 rider this far along the line (delivery tracking). */
  rider?: number;
}

export default function RideMap({ from, to, label, rider }: Props) {
  const { t } = useT();
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [attempt, setAttempt] = useState(0);

  // Create the map (Leaflet needs the browser, so it's loaded here, not on the server).
  // `attempt` changes when the user presses "Try again".
  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | undefined;

    import("leaflet").then((L) => {
      if (cancelled || !el.current || map.current) return;
      const m = L.map(el.current, { scrollWheelZoom: false });
      map.current = m;
      layer.current = L.layerGroup().addTo(m);

      // Try each tile source in turn; give up if none of them load.
      let source = 0;
      let tiles: TileLayer;
      let loadedAny = false;
      let errors = 0;
      const switchToSource = (i: number) => {
        tiles?.remove();
        errors = 0;
        tiles = L.tileLayer(TILE_SOURCES[i].url, { maxZoom: 19, subdomains: "abcd", attribution: TILE_SOURCES[i].attribution });
        tiles.on("tileload", () => { if (!loadedAny) { loadedAny = true; if (!cancelled) setStatus("ready"); } });
        tiles.on("tileerror", () => {
          errors += 1;
          if (loadedAny || errors < 3) return;
          if (source + 1 < TILE_SOURCES.length) switchToSource(++source);
          else if (!cancelled) setStatus("failed");
        });
        tiles.addTo(m);
      };
      switchToSource(0);

      // Keep tiles filling the box when the page layout changes size.
      observer = new ResizeObserver(() => m.invalidateSize());
      observer.observe(el.current);
      el.current.dispatchEvent(new Event("map-ready"));
    }).catch(() => { if (!cancelled) setStatus("failed"); });

    return () => {
      cancelled = true;
      observer?.disconnect();
      map.current?.remove();
      map.current = null;
      layer.current = null;
    };
  }, [attempt]);

  // Draw the pins and line whenever pickup/destination change.
  useEffect(() => {
    const node = el.current;
    let cancelled = false;
    function draw() {
      import("leaflet").then((L) => {
        if (cancelled || !map.current || !layer.current) return;
        layer.current.clearLayers();
        const a: [number, number] = [from.lat, from.lng];
        const b: [number, number] = [to.lat, to.lng];
        L.polyline([a, b], { color: "#0f766e", weight: 4, dashArray: "8 8" }).addTo(layer.current);
        L.circleMarker(a, { radius: 9, color: "#fff", weight: 3, fillColor: "#16a34a", fillOpacity: 1 }).bindTooltip(from.name).addTo(layer.current);
        L.circleMarker(b, { radius: 9, color: "#fff", weight: 3, fillColor: "#dc2626", fillOpacity: 1 }).bindTooltip(to.name).addTo(layer.current);
        if (rider !== undefined) {
          const p = Math.min(1, Math.max(0, rider));
          const pos: [number, number] = [a[0] + (b[0] - a[0]) * p, a[1] + (b[1] - a[1]) * p];
          L.marker(pos, { icon: L.divIcon({ html: "🛵", className: "rider-icon", iconSize: [32, 32] }), keyboard: false }).addTo(layer.current);
        }
        if (from.name === to.name) map.current.setView(a, 15);
        else map.current.fitBounds([a, b], { padding: [40, 40], maxZoom: 16 });
      });
    }
    draw();
    node?.addEventListener("map-ready", draw);
    return () => { cancelled = true; node?.removeEventListener("map-ready", draw); };
  }, [from, to, attempt, rider]);

  return (
    <div className="relative">
      <div key={attempt} ref={el} role="img" aria-label={label} className="ride-map h-64 w-full overflow-hidden rounded-xl border border-border bg-background sm:h-72" />
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
    </div>
  );
}
