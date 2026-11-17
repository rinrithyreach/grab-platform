import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { act, createElement as h } from "react";
import { JSDOM } from "jsdom";
import ts from "typescript";

const require = createRequire(import.meta.url);
const data = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const react = pathToFileURL(require.resolve("react")).href;
const jsx = pathToFileURL(require.resolve("react/jsx-runtime")).href;
async function compile(path, imports = {}) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  let { outputText } = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX,
  } });
  outputText = outputText.replace('import "leaflet/dist/leaflet.css";', "");
  for (const [name, url] of Object.entries({ react, "react/jsx-runtime": jsx, ...imports })) {
    outputText = outputText.replaceAll(`from "${name}"`, `from "${url}"`).replaceAll(`import("${name}")`, `import("${url}")`);
  }
  return data(outputText);
}

test("the ride map loads every merchant page, draws grouped markers safely, and refreshes saved areas without resetting an unchanged view", async (t) => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost:3000/ride" });
  const previous = { window: globalThis.window, document: globalThis.document, Event: globalThis.Event, ResizeObserver: globalThis.ResizeObserver, IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT };
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, Event: dom.window.Event,
    ResizeObserver: class { observe() {} disconnect() {} }, IS_REACT_ACT_ENVIRONMENT: true });
  const { createRoot } = await import("react-dom/client");
  let root;
  t.after(async () => {
    try { if (root) await act(async () => root.unmount()); }
    finally { dom.window.close(); Object.assign(globalThis, previous); }
  });
  const leaf = data(`
    export const groups = [], views = [], tiles = [];
    export const map = () => ({ on() { return this; }, fitBounds: points => views.push(points), setView: point => views.push([point]), invalidateSize() {}, remove() {} });
    export const layerGroup = () => { const group = { layers: [], addTo() { return this; }, clearLayers() { this.layers = []; } }; groups.push(group); return group; };
    function layer(kind, position, options) { return { kind, position, options,
      bindTooltip(value) { this.tooltip = value; return this; }, bindPopup(value) { this.popup = value; return this; },
      addTo(group) { group.layers.push(this); return this; } }; }
    export const marker = (position, options) => layer('merchant', position, options);
    export const circleMarker = (position, options) => layer('trip', position, options);
    export const polyline = position => layer('route', position);
    export const divIcon = options => options;
    export const tileLayer = (url, options) => { tiles.push({url, options}); const handlers = {}; return { on(type, callback) { handlers[type] = callback; return this; }, addTo() { queueMicrotask(() => handlers.tileload()); return this; }, remove() {} }; };
  `);
  const { groups, views, tiles } = await import(leaf);
  const auth = data("let api; export const setApi = value => { api = value; }; export const useAuth = () => ({ api });");
  const rows = Array.from({ length: 100 }, (_, i) => ({ id: `rider-${i}`, name: `Rider ${i}`, address: `GPS: ${(11.55 + Math.max(0, i - 1) / 10000).toFixed(6)}, 104.920000`, openingHours: "Mon 08:00-17:00" }));
  rows[1].name = '<img src=x onerror="alert(1)">';
  const unknown = { id: "unmapped", name: "Unmapped Rider", address: "An old saved address", openingHours: "" };
  let fail = false;
  const pages = [];
  (await import(auth)).setApi({ rideMerchantAreas: async (page) => {
    pages.push(page);
    if (fail) throw new Error("offline");
    return structuredClone(page === 1 ? rows : [unknown]);
  } });
  const i18n = data("const t = (key, vars) => key + (vars ? ' ' + JSON.stringify(vars) : ''); export const useT = () => ({t});");
  const areas = await compile("../lib/ride-merchant-areas.ts", {
    "./merchant-location": await compile("../lib/merchant-location.ts", { "./phnom-penh": await compile("../lib/phnom-penh.ts") }),
    "./merchant-area-centres": await compile("../lib/merchant-area-centres.ts"),
  });
  const RideMap = await compile("../components/RideMap.tsx", { leaflet: leaf, "@/lib/i18n": i18n, "@/lib/ride-merchant-areas": areas,
    "@/lib/ride-motion": await compile("../lib/ride-motion.ts"),
    "@/lib/use-ride-route": data("export const useRideRoute = () => ({route: null, loading: false, failed: false});"),
  });
  const Component = (await import(await compile("../components/RideMerchantMap.tsx", {
    "@/lib/auth": auth, "@/lib/i18n": i18n, "@/lib/ride-merchant-areas": areas, "./RideMap": RideMap,
  }))).default;
  const container = dom.window.document.getElementById("root");
  root = createRoot(container);
  await act(async () => root.render(h(Component, {
    from: { name: "Pickup", km: "", lat: 11.5564, lng: 104.9282 },
    to: { name: "Destination", km: "", lat: 11.5636, lng: 104.9312 }, label: "Trip and merchant areas",
  })));
  assert.deepEqual(pages, [1, 2], "All pages are loaded, including merchants beyond the first hundred");
  assert.equal(tiles[0].url, "https://tile.openstreetmap.org/{z}/{x}/{y}.png", "The booking map uses the standard key-free tile service");
  assert.ok(tiles[0].options.attribution.includes("openstreetmap.org/copyright"));
  const markers = () => groups.at(-1).layers.filter((layer) => layer.kind === "merchant");
  assert.equal(markers().length, 99, "Two merchants at the same point share a selectable marker");
  const shared = markers().find((marker) => marker.position[0] === 11.55);
  assert.equal(shared.popup.querySelectorAll("strong").length, 2);
  assert.equal(shared.popup.querySelector("img"), null);
  assert.ok(shared.popup.textContent.includes(rows[1].name));
  assert.ok(shared.popup.textContent.includes(rows[0].openingHours));
  assert.ok(views.at(-1).some((point) => point[0] === 11.55 && point[1] === 104.92));
  assert.ok(container.textContent.includes("Unmapped Rider"));
  assert.ok(container.textContent.includes("ride.merchantAreaMissing"));

  const viewCount = views.length;
  await act(async () => dom.window.dispatchEvent(new dom.window.Event("focus")));
  assert.equal(views.length, viewCount, "Identical refreshes leave the customer's zoom and pan alone");
  rows[0].address = "GPS: 11.600000, 104.950000";
  rows[0].openingHours = "Sun 18:00-02:00";
  await act(async () => dom.window.dispatchEvent(new dom.window.Event("focus")));
  const moved = markers().find((marker) => marker.position[0] === 11.6);
  assert.ok(moved.popup.textContent.includes("Sun 18:00-02:00"));
  assert.ok(views.length > viewCount, "A changed registration location is brought into view");

  fail = true;
  await act(async () => dom.window.dispatchEvent(new dom.window.Event("focus")));
  assert.ok(container.querySelector('[role="alert"]').textContent.includes("ride.merchantAreasError"));
  assert.ok(markers().length > 0, "The last successful areas remain visible during a connection failure");
  fail = false;
  await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "errorPage.retry").click());
  assert.equal(container.querySelector('[role="alert"]'), null);
});

test("the customer map moves the real GPS marker without resetting the view and labels stale positions honestly", async (t) => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost:3000/rides" });
  const previous = { window: globalThis.window, document: globalThis.document, Event: globalThis.Event, ResizeObserver: globalThis.ResizeObserver, IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT };
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, Event: dom.window.Event,
    ResizeObserver: class { observe() {} disconnect() {} }, IS_REACT_ACT_ENVIRONMENT: true });
  dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  let frameTime = 0, nextFrame = 0;
  const frames = new Map();
  t.mock.method(performance, "now", () => frameTime);
  dom.window.requestAnimationFrame = (callback) => { frames.set(++nextFrame, callback); return nextFrame; };
  dom.window.cancelAnimationFrame = (id) => frames.delete(id);
  const advance = (ms) => { frameTime += ms; const pending = [...frames.values()]; frames.clear(); pending.forEach((callback) => callback(frameTime)); };
  const { createRoot } = await import("react-dom/client");
  let root;
  t.after(async () => {
    try { if (root) await act(async () => root.unmount()); }
    finally { dom.window.close(); Object.assign(globalThis, previous); }
  });
  const leaf = data(`
    export const markers = [], circles = [], views = [], pans = [], tiles = [], groups = [], handlers = new Map();
    export const map = () => ({ layers: [], on(type, handler) { handlers.set(type, handler); return this; },
      getBounds: () => ({ pad: () => ({ contains: () => false }) }), panTo: point => pans.push(point),
      fitBounds: points => views.push(points), setView: point => views.push([point]), invalidateSize() {}, remove() {} });
    export const layerGroup = () => { const group = { layers: [], addTo() { return this; }, clearLayers() { this.layers = []; } }; groups.push(group); return group; };
    function layer(position, options = {}) { return { position, options, removed: false,
      bindTooltip(value) { this.tooltip = value; return this; }, setTooltipContent(value) { this.tooltip = value; return this; },
      setLatLng(value) { this.position = value; return this; }, setRadius(value) { this.options.radius = value; return this; },
      setLatLngs(value) { this.position = value; return this; }, getElement() { return null; },
      addTo(target) { target.layers.push(this); return this; }, remove() { this.removed = true; } }; }
    export const marker = (position, options) => { const value = layer(position, options); markers.push(value); return value; };
    export const circle = (position, options) => { const value = layer(position, options); circles.push(value); return value; };
    export const circleMarker = layer, polyline = layer, divIcon = options => options;
    export const tileLayer = (url, options) => { const attempt = tiles.push({url, options}); const handlers = {}; return {
      on(type, callback) { handlers[type] = callback; return this; },
      addTo() { queueMicrotask(() => { if (attempt === 1) { handlers.tileerror(); handlers.tileerror(); handlers.tileerror(); } else handlers.tileload(); }); return this; },
      remove() {} }; };
  `);
  const { markers, circles, views, pans, tiles, groups, handlers } = await import(leaf);
  const i18n = data("const t = (key, vars) => key + (vars ? ' ' + JSON.stringify(vars) : ''); export const useT = () => ({t});");
  const routing = data("export const calls = []; export const useRideRoute = (from, to, enabled, phase) => { calls.push({from,to,enabled,phase}); return {route: null, loading: false, failed: enabled}; };");
  const { calls: routingCalls } = await import(routing);
  const map = await compile("../components/RideMap.tsx", {
    leaflet: leaf, "@/lib/i18n": i18n,
    "@/lib/ride-merchant-areas": data("export const groupRideMerchantAreas = () => []; export const rideMerchantPopup = () => null;"),
    "@/lib/ride-motion": await compile("../lib/ride-motion.ts"),
    "@/lib/use-ride-route": routing,
  });
  const Component = (await import(await compile("../components/CustomerRideTracking.tsx", { "@/lib/i18n": i18n, "./RideMap": map }))).default;
  const container = dom.window.document.getElementById("root");
  root = createRoot(container);
  let ride = { id: "ride", status: "Accepted", pickupLocation: "Customer pickup", destination: "Market",
    pickupLatitude: 11.55, pickupLongitude: 104.92, destinationLatitude: 11.57, destinationLongitude: 104.93 };
  const render = async () => { await act(async () => root.render(h(Component, { ride }))); };
  await render();
  assert.ok(container.textContent.includes("ride.mapError"), "A tile network failure offers retry instead of switching to key-required tiles");
  assert.equal(tiles.length, 1);
  await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "errorPage.retry").click());
  assert.ok(!container.textContent.includes("ride.mapError"), "The map recovers when the retry loads street tiles");
  assert.equal(tiles.length, 2);
  assert.ok(tiles.every(({url}) => url === "https://tile.openstreetmap.org/{z}/{x}/{y}.png"), "Live tracking and retry never switch to CARTO");
  assert.ok(tiles.every(({options}) => options.attribution.includes("openstreetmap.org/copyright")));
  assert.ok(container.querySelector('[role="img"]'));
  assert.equal(markers.length, 0, "An assigned driver with no GPS is never drawn at an invented point");
  assert.ok(container.textContent.includes("tracking.waiting"));
  assert.deepEqual(routingCalls.at(-1).to, [11.55, 104.92], "Accepted rides target the customer even before driver GPS arrives");
  assert.equal(routingCalls.at(-1).enabled, false, "Do not request a pickup-to-destination route while waiting for driver GPS");
  assert.deepEqual(views.at(-1), [[11.55, 104.92]], "Center on the customer's pickup before GPS is shared");
  assert.ok(container.textContent.includes("tracking.pickupTarget"));
  assert.ok(container.textContent.includes("tracking.pickupWaitingGps"));
  assert.ok(groups.at(-1).layers.every((layer) => layer.options.radius !== undefined), "Only the pickup markers are drawn; no destination leg is shown");
  ride = { ...ride, driverLocation: { latitude: 11.548, longitude: 104.918, accuracy: 12, updatedAt: new Date().toISOString() } };
  await render();
  assert.equal(markers.length, 1);
  assert.deepEqual(markers[0].position, [11.548, 104.918]);
  assert.equal(circles[0].options.radius, 12);
  assert.ok(container.textContent.includes("tracking.live"));
  assert.equal(routingCalls.at(-1).enabled, true);
  assert.deepEqual(routingCalls.at(-1).from, [11.548, 104.918]);
  assert.deepEqual(routingCalls.at(-1).to, [11.55, 104.92], "The first leg goes from the merchant's GPS to the customer");
  assert.ok(views.at(-1).some((point) => point[0] === 11.548), "The first GPS fix is brought into view with the pickup");
  await act(async () => container.querySelector('[aria-label="tracking.follow"]').click());
  assert.equal(container.querySelector('[aria-label="tracking.following"]').getAttribute("aria-pressed"), "true");
  assert.deepEqual(pans.at(-1), [11.548, 104.918]);
  const viewCount = views.length;
  ride = { ...ride, driverLocation: { ...ride.driverLocation, latitude: 11.549, longitude: 104.919, accuracy: 5 } };
  await render();
  assert.equal(markers.length, 1, "GPS updates reuse the existing marker");
  assert.deepEqual(markers[0].position, [11.548, 104.918], "A GPS refresh starts from the currently displayed position");
  await act(async () => advance(350));
  assert.ok(markers[0].position[0] > 11.548 && markers[0].position[0] < 11.549, "The marker is visibly between the two observations during the animation");
  await act(async () => advance(350));
  assert.deepEqual(markers[0].position, [11.549, 104.919]);
  assert.equal(circles[0].options.radius, 5);
  assert.equal(views.length, viewCount, "GPS polling preserves the customer's chosen zoom and pan");
  assert.deepEqual(pans.at(-1), [11.549, 104.919], "Follow mode pans smoothly when the driver leaves the central view");
  await act(async () => handlers.get("dragstart")());
  assert.equal(container.querySelector('[aria-label="tracking.follow"]').getAttribute("aria-pressed"), "false", "Manually dragging the map releases follow mode");
  await act(async () => container.querySelector('[aria-label="tracking.overview"]').click());
  assert.equal(views.length, viewCount + 1);
  ride = { ...ride, driverLocation: { ...ride.driverLocation, updatedAt: new Date(Date.now() - 31_000).toISOString() } };
  await render();
  assert.ok(container.textContent.includes("tracking.paused"));
  assert.ok(container.textContent.includes("tracking.stale"));
  assert.ok(!container.textContent.includes("tracking.live"));
  assert.deepEqual(markers[0].position, [11.549, 104.919], "A stale marker stays at its last known point");
  ride = { ...ride, driverLocation: null };
  await render();
  assert.equal(markers[0].removed, true);
  assert.equal(circles[0].removed, true);
  assert.equal(frames.size, 0, "Stopping sharing cancels scheduled animation frames");
  assert.deepEqual(routingCalls.at(-1).to, [11.55, 104.92], "Losing GPS cannot switch an accepted ride to the destination");
  assert.equal(routingCalls.at(-1).enabled, false);
  assert.deepEqual(views.at(-1), [[11.55, 104.92]], "A previous driver position is not reused as a fake origin after sharing stops");
  ride = { ...ride, driverLocation: { latitude: 11.55, longitude: 104.92, accuracy: 6, updatedAt: new Date().toISOString() } };
  await render();
  assert.deepEqual(routingCalls.at(-1).to, [11.55, 104.92], "Reaching the pickup alone does not begin the destination leg");
  ride = { ...ride, status: "InProgress" };
  await render();
  assert.deepEqual(routingCalls.at(-1).from, [11.55, 104.92]);
  assert.deepEqual(routingCalls.at(-1).to, [11.57, 104.93], "After confirming pickup, navigation switches to the customer's destination");
  assert.ok(!container.textContent.includes("tracking.pickupTarget"));
  assert.ok(views.at(-1).some((point) => point[0] === 11.57 && point[1] === 104.93));
  ride = { ...ride, status: "Completed" };
  await render();
  assert.equal(container.querySelector('[role="img"]'), null);
});
