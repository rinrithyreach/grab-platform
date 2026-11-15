"use client";

/**
 * Map for the ride page: pickup (green) and destination (red) pins with a dashed line.
 * Uses Leaflet + OpenStreetMap tiles (free, needs internet). The line is straight,
 * not a real road route, because there is no routing service.
 */
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { LayerGroup, Map as LeafletMap } from "leaflet";
import type { Place } from "@/lib/places";

export default function RideMap({ from, to, label }: { from: Place; to: Place; label: string }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);

  // Create the map once (Leaflet needs the browser, so it's loaded here, not on the server).
  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !el.current || map.current) return;
      map.current = L.map(el.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map.current);
      layer.current = L.layerGroup().addTo(map.current);
      el.current.dispatchEvent(new Event("map-ready"));
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      layer.current = null;
    };
  }, []);

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
        if (from.name === to.name) map.current.setView(a, 15);
        else map.current.fitBounds([a, b], { padding: [40, 40], maxZoom: 16 });
      });
    }
    draw();
    node?.addEventListener("map-ready", draw);
    return () => { cancelled = true; node?.removeEventListener("map-ready", draw); };
  }, [from, to]);

  return <div ref={el} role="img" aria-label={label} className="ride-map h-64 w-full overflow-hidden rounded-xl border border-border sm:h-72" />;
}
