import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { act, createElement as h } from "react";
import { JSDOM } from "jsdom";
import ts from "typescript";

const require = createRequire(import.meta.url);
const dataModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const react = pathToFileURL(require.resolve("react")).href;
const jsx = pathToFileURL(require.resolve("react/jsx-runtime")).href;

async function compile(relativePath, imports = {}) {
  const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
  let { outputText } = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX,
  } });
  for (const [name, url] of Object.entries({ react, "react/jsx-runtime": jsx, ...imports }))
    outputText = outputText.replaceAll(`from "${name}"`, `from "${url}"`);
  return dataModule(outputText);
}

async function setup(t) {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost:3000/ride" });
  const previous = { window: globalThis.window, document: globalThis.document, IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT };
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: dom.window.navigator });
  Object.defineProperty(dom.window, "isSecureContext", { configurable: true, value: true });
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  const locationRequests = [];
  Object.defineProperty(dom.window.navigator, "geolocation", { configurable: true, value: {
    getCurrentPosition: (success, failure, options) => locationRequests.push({ success, failure, options }),
  } });
  const { createRoot } = await import("react-dom/client");
  let root;
  t.after(async () => {
    try { if (root) await act(async () => root.unmount()); }
    finally {
      dom.window.close(); Object.assign(globalThis, previous);
      if (previousNavigator) Object.defineProperty(globalThis, "navigator", previousNavigator);
      else delete globalThis.navigator;
    }
  });
  const link = dataModule(`import { createElement } from "${react}"; export default ({ children, ...props }) => createElement("a", props, children);`);
  const translations = dataModule("const t = (key, vars) => key + (vars ? ' ' + JSON.stringify(vars) : ''); export const useT = () => ({ t, pick: english => english });");
  const rides = dataModule("export const bookings = []; export const demoFare = () => 5; export const useRideService = () => ({ mode: 'live', bookRide: async (body, vehicle, km) => { bookings.push({ body, vehicle, km }); return { ...body, id: 'test-ride', fare: 5 }; } });");
  const { bookings } = await import(rides);
  bookings.length = 0;
  const placesModule = await compile("../lib/places.ts");
  const { PLACES } = await import(placesModule);
  const locationHelpers = await compile("../lib/merchant-location.ts", { "./phnom-penh": await compile("../lib/phnom-penh.ts") });
  const map = dataModule(`import { createElement } from "${react}"; export default ({ from, to }) => createElement('div', { 'data-testid': 'map', 'data-from-lat': from.lat, 'data-from-lng': from.lng, 'data-to-lat': to.lat, 'data-to-lng': to.lng });`);
  const RidePage = (await import(await compile("../app/ride/page.tsx", {
    "next/link": link, "@/lib/auth": dataModule("export const useAuth = () => ({user: {role: 'Customer'}, ready: true}); export const errorMessage = err => err.message;"),
    "@/lib/brand": dataModule("export const money = value => '$' + value;"), "@/lib/i18n": translations,
    "@/lib/places": placesModule, "@/lib/merchant-location": locationHelpers, "@/lib/rides": rides,
    "@/lib/toast": dataModule("export const toast = () => {};"),
    "@/components/LoginRequired": dataModule("export default () => null;"),
    "@/components/Select": await compile("../components/Select.tsx"),
    "@/components/BackButton": link, "@/components/RideMerchantMap": map,
    "@/components/RideBookingConfirmation": dataModule("export default () => null;"),
    "@/components/DemoModeNotice": dataModule("export default () => null;"),
  }))).default;
  const container = dom.window.document.getElementById("root");
  root = createRoot(container);
  await act(async () => root.render(h(RidePage)));
  const button = (key) => [...container.querySelectorAll("button")].find((node) => node.textContent.includes(key));
  async function click(node) { await act(async () => node.click()); }
  async function choose(key, label) {
    await click(container.querySelector(`[role="combobox"][aria-label="${key}"]`));
    await click([...container.querySelectorAll('[role="option"]')].find((node) => node.textContent === label));
  }
  async function submit() {
    await act(async () => container.querySelector("form").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })));
  }
  return { dom, container, PLACES, bookings, locationRequests, button, click, choose, submit };
}

test("customers explicitly detect pickup coordinates; the map, swap and booking use the detected point", async (t) => {
  const app = await setup(t);
  assert.equal(app.locationRequests.length, 0, "Loading the ride page must not request location permission");
  await app.click(app.button("ride.detectLocation"));
  assert.equal(app.locationRequests.length, 1);
  assert.deepEqual(app.locationRequests[0].options, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  assert.equal(app.button("ride.submit").disabled, true, "Wait for location detection before booking");
  const coords = { latitude: 11.55123456, longitude: 104.92789123, accuracy: 12 };
  await act(async () => app.locationRequests[0].success({ coords }));
  assert.ok(app.container.querySelector('[role="combobox"][aria-label="ride.pickup"]').textContent.includes("ride.currentLocation"));
  let map = app.container.querySelector('[data-testid="map"]');
  assert.equal(Number(map.dataset.fromLat), coords.latitude);
  assert.equal(Number(map.dataset.fromLng), coords.longitude);
  assert.ok(app.container.textContent.includes('ride.locationAccuracy {"n":12}'));
  await app.click(app.container.querySelector('button[aria-label="ride.swap"]'));
  map = app.container.querySelector('[data-testid="map"]');
  assert.equal(Number(map.dataset.toLat), coords.latitude);
  assert.equal(Number(map.dataset.fromLat), app.PLACES[1].lat);
  await app.click(app.container.querySelector('button[aria-label="ride.swap"]'));
  await app.submit();
  assert.equal(app.bookings.length, 1);
  assert.equal(app.bookings[0].body.pickupLatitude, coords.latitude);
  assert.equal(app.bookings[0].body.pickupLongitude, coords.longitude);
  assert.equal(app.bookings[0].body.pickupLocation, "GPS: 11.551235, 104.927891");
  assert.equal(app.bookings[0].body.destination, app.PLACES[1].name);
  assert.ok(app.bookings[0].km > 0 && Number.isFinite(app.bookings[0].km));
});

test("denied location access explains the failure and still allows a manual pickup booking", async (t) => {
  const app = await setup(t);
  await app.click(app.button("ride.detectLocation"));
  await act(async () => app.locationRequests[0].failure({ code: 1 }));
  assert.equal(app.container.querySelector('[role="alert"]').textContent, "ride.location.error.permission");
  assert.equal(app.button("ride.submit").disabled, false);
  await app.choose("ride.pickup", app.PLACES[2].name);
  assert.equal(app.container.querySelector('[role="alert"]'), null);
  await app.submit();
  assert.equal(app.bookings[0].body.pickupLatitude, app.PLACES[2].lat);
  assert.equal(app.bookings[0].body.pickupLocation, app.PLACES[2].name);
});

test("a late device location cannot overwrite a pickup the customer chose manually", async (t) => {
  const app = await setup(t);
  await app.click(app.button("ride.detectLocation"));
  await app.choose("ride.pickup", app.PLACES[4].name);
  await act(async () => app.locationRequests[0].success({ coords: { latitude: 11.55, longitude: 104.9, accuracy: 10 } }));
  const map = app.container.querySelector('[data-testid="map"]');
  assert.equal(Number(map.dataset.fromLat), app.PLACES[4].lat);
  assert.equal(Number(map.dataset.fromLng), app.PLACES[4].lng);
  await app.submit();
  assert.equal(app.bookings[0].body.pickupLocation, app.PLACES[4].name);
});

test("the same detected pickup and destination cannot be booked even with different dropdown options", async (t) => {
  const app = await setup(t);
  await app.click(app.button("ride.detectLocation"));
  await act(async () => app.locationRequests[0].success({ coords: { latitude: app.PLACES[1].lat, longitude: app.PLACES[1].lng, accuracy: 5 } }));
  assert.equal(app.button("ride.submit").disabled, true);
  await app.submit();
  assert.equal(app.bookings.length, 0);
  assert.ok([...app.container.querySelectorAll('[role="alert"]')].some((node) => node.textContent === "ride.same"));
});
