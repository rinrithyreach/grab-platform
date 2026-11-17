import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { act, createElement as h } from "react";
import { JSDOM } from "jsdom";
import ts from "typescript";
import { loadLib } from "./load-lib.mjs";

const require = createRequire(import.meta.url);
const data = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const react = pathToFileURL(require.resolve("react")).href;
const jsx = pathToFileURL(require.resolve("react/jsx-runtime")).href;
async function compile(path, imports = {}) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  let { outputText } = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX,
  } });
  for (const [name, url] of Object.entries({ react, "react/jsx-runtime": jsx, ...imports }))
    outputText = outputText.replaceAll(`from "${name}"`, `from "${url}"`);
  return data(outputText);
}

async function setup(t) {
  const dom = new JSDOM('<div id="merchant"></div><div id="customer"></div>', { url: "http://localhost:3000/merchant" });
  const previous = { window: globalThis.window, document: globalThis.document, fetch: globalThis.fetch, IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT };
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: dom.window.navigator });
  Object.defineProperty(dom.window, "isSecureContext", { configurable: true, value: true });
  const watches = new Map(), clearedWatches = [];
  let nextWatch = 0;
  Object.defineProperty(dom.window.navigator, "geolocation", { configurable: true, value: {
    watchPosition(success, failure, options) { const id = ++nextWatch; watches.set(id, { success, failure, options }); return id; },
    clearWatch(id) { clearedWatches.push(id); watches.delete(id); },
  } });
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  const { createRoot } = await import("react-dom/client");
  let merchantRoot, customerRoot;
  t.after(async () => {
    try {
      if (merchantRoot) await act(async () => merchantRoot.unmount());
      if (customerRoot) await act(async () => customerRoot.unmount());
    } finally {
      dom.window.close(); Object.assign(globalThis, previous);
      if (previousNavigator) Object.defineProperty(globalThis, "navigator", previousNavigator);
      else delete globalThis.navigator;
    }
  });
  const apiModule = await compile("../lib/api.ts");
  const { createApiClient } = await import(apiModule);
  const merchantApi = createApiClient("http://ride-test.local");
  const customerApi = createApiClient("http://ride-test.local");
  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  merchantApi.restoreSession({ accessToken: "merchant-token", expiresAt, user: { id: "merchant-user", role: "Merchant", fullName: "Dara", phoneNumber: "012345678" } });
  customerApi.restoreSession({ accessToken: "customer-token", expiresAt, user: { id: "customer-user", role: "Customer", fullName: "Customer", phoneNumber: "098765432" } });
  const initial = { id: "requested-ride", customerId: "customer-user", driverId: null, merchantId: null, merchantName: null,
    pickupLocation: "University", destination: "Central Market", pickupLatitude: 11.55, pickupLongitude: 104.92,
    destinationLatitude: 11.57, destinationLongitude: 104.93, fare: 5, pricingMode: "DevelopmentMockFlatFareUSD", status: "Pending",
    createdAt: "2026-11-17T00:00:00Z", completedAt: null };
  const state = { ride: structuredClone(initial), declined: false, holdInbox: false, holdAccept: false, conflict: false, releaseInbox: null, releaseAccept: null };
  const calls = [];
  function inbox() {
    const request = { ride: structuredClone(state.ride), customerName: "Test Customer" };
    return { requests: state.ride.status === "Pending" && !state.declined ? [request] : [],
      activeRide: state.ride.merchantId === "merchant" && ["Accepted", "InProgress"].includes(state.ride.status) ? request : null };
  }
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options });
    const token = options.headers.Authorization;
    if (url.endsWith("/api/merchants/ride-requests")) {
      assert.equal(token, "Bearer merchant-token");
      if (state.holdInbox) {
        state.holdInbox = false;
        const snapshot = inbox();
        return new Promise((resolve) => { state.releaseInbox = () => resolve(Response.json(snapshot)); });
      }
      return Response.json(inbox());
    }
    if (url.endsWith("/response")) {
      assert.equal(token, "Bearer merchant-token");
      const respond = () => {
        if (state.conflict) { state.ride.status = "Accepted"; state.ride.merchantId = "another-merchant"; return Response.json({ detail: "Already accepted" }, { status: 409 }); }
        if (JSON.parse(options.body).accept) { state.ride.status = "Accepted"; state.ride.merchantId = "merchant"; state.ride.merchantName = "Dara"; }
        else state.declined = true;
        return Response.json(inbox());
      };
      if (state.holdAccept) return new Promise((resolve) => { state.releaseAccept = () => { state.holdAccept = false; resolve(respond()); }; });
      return respond();
    }
    if (url.endsWith("/status")) {
      assert.equal(token, "Bearer merchant-token");
      state.ride.status = JSON.parse(options.body).status;
      return Response.json(state.ride);
    }
    if (url.endsWith("/location")) {
      assert.equal(token, "Bearer merchant-token");
      if (state.failLocation) return Response.json({ detail: "Offline" }, { status: 503 });
      state.ride.driverLocation = options.method === "DELETE" ? null : { ...JSON.parse(options.body), updatedAt: new Date(Date.now()).toISOString() };
      return Response.json(state.ride);
    }
    assert.equal(token, "Bearer customer-token");
    assert.ok(url.endsWith("/api/rides/requested-ride"));
    return Response.json(state.ride);
  };
  const auth = data(`import {createContext,useContext} from "${react}"; export const Context = createContext(null); export const useAuth = () => useContext(Context); export const errorMessage = err => err.message;`);
  const { Context } = await import(auth);
  const imports = {
    "@/lib/api": apiModule, "@/lib/auth": auth,
    "@/lib/i18n": data("const t = (key, vars) => key + (vars ? ' ' + JSON.stringify(vars) : ''); export const useT = () => ({t});"),
    "@/lib/brand": data("export const money = value => '$' + value;"),
    "@/lib/toast": data("export const toast = () => {};"),
    "next/link": data(`import {createElement} from "${react}"; export default ({children,...props}) => createElement('a',props,children);`),
  };
  const mapModule = data(`import {createElement} from "${react}"; export default ({from,to,label,driver,trackingPhase}) => createElement('div', {
      role: 'img', 'aria-label': label, 'data-pickup': JSON.stringify(from), 'data-destination': JSON.stringify(to),
      'data-driver': driver ? JSON.stringify(driver) : undefined,
      'data-phase': trackingPhase,
    });`);
  imports["./RideLocationSharing"] = await compile("../components/RideLocationSharing.tsx", imports);
  imports["./CustomerRideTracking"] = await compile("../components/CustomerRideTracking.tsx", { ...imports, "./RideMap": mapModule });
  imports["./MerchantRideNavigation"] = await compile("../components/MerchantRideNavigation.tsx", {
    ...imports, "./RideMap": mapModule,
  });
  const Merchant = (await import(await compile("../components/MerchantRideRequests.tsx", imports))).default;
  const Customer = (await import(await compile("../components/RideBookingConfirmation.tsx", imports))).default;
  const merchantContainer = dom.window.document.getElementById("merchant");
  const customerContainer = dom.window.document.getElementById("customer");
  const merchantValue = { api: merchantApi };
  async function mountMerchant() {
    merchantRoot = createRoot(merchantContainer);
    await act(async () => merchantRoot.render(h(Context.Provider, { value: merchantValue }, h(Merchant))));
  }
  await mountMerchant();
  customerRoot = createRoot(customerContainer);
  await act(async () => customerRoot.render(h(Context.Provider, { value: { api: customerApi } }, h(Customer, {
    initial, from: initial.pickupLocation, to: initial.destination, demo: false, onAnother: () => {},
  }))));
  const button = (key) => [...merchantContainer.querySelectorAll("button")].find((element) => element.textContent === key);
  const focus = async () => { await act(async () => dom.window.dispatchEvent(new dom.window.Event("focus"))); };
  return { state, calls, button, focus, merchantContainer, customerContainer, merchantApi, customerApi, watches, clearedWatches,
    remountMerchant: async () => { await act(async () => merchantRoot.unmount()); await mountMerchant(); } };
}

test("a merchant popup accepts a customer request, ignores stale polling, and both sessions track start and completion", async (t) => {
  const app = await setup(t);
  assert.equal(app.merchantContainer.querySelector("dialog").open, true);
  assert.ok(app.merchantContainer.querySelector("dialog").textContent.includes("Test Customer"));
  assert.equal(app.merchantContainer.querySelector('[role="img"]'), null);
  app.state.holdInbox = true;
  await app.focus();
  app.state.holdAccept = true;
  const accept = app.button("merchant.rides.accept");
  await act(async () => accept.click());
  assert.equal(accept.disabled, true);
  await act(async () => accept.click());
  assert.equal(app.calls.filter((call) => call.url.endsWith("/response")).length, 1);
  await act(async () => app.state.releaseAccept());
  assert.equal(app.merchantContainer.querySelector("dialog").open, false);
  assert.ok(app.merchantContainer.textContent.includes("merchant.rides.active"));
  const map = () => app.merchantContainer.querySelector('[role="img"]');
  const directions = () => app.merchantContainer.querySelector('a[href^="https://www.google.com/maps/dir/"]');
  assert.deepEqual(JSON.parse(map().dataset.pickup), { name: "University", km: "", lat: 11.55, lng: 104.92 });
  assert.deepEqual(JSON.parse(map().dataset.destination), { name: "Central Market", km: "", lat: 11.57, lng: 104.93 });
  assert.equal(new URL(directions().href).searchParams.get("destination"), "11.55,104.92");
  assert.equal(new URL(directions().href).searchParams.has("origin"), false, "Navigation can start at the merchant's actual device location");
  assert.ok(app.merchantContainer.textContent.includes("merchant.rides.goToPickup"));
  assert.equal(map().dataset.phase, "pickup");
  assert.ok(app.merchantContainer.querySelector('[aria-current="step"]').textContent.includes("merchant.rides.pickupStep"));
  assert.ok(app.merchantContainer.textContent.includes("merchant.rides.afterPickup"));
  assert.equal(app.button("merchant.rides.complete"), undefined, "The ride cannot be completed before pickup has been confirmed");
  await act(async () => app.state.releaseInbox());
  assert.equal(app.merchantContainer.querySelector("dialog").open, false, "A stale pending snapshot cannot reopen an accepted request");
  await app.focus();
  assert.ok(app.customerContainer.querySelector('[role="status"]').textContent.includes("rides.Accepted"));
  assert.ok(app.customerContainer.textContent.includes('ride.acceptedByMerchant {"name":"Dara"}'));
  await app.remountMerchant();
  assert.ok(map(), "An accepted ride restores its map after refreshing the merchant dashboard");
  assert.equal(new URL(directions().href).searchParams.get("destination"), "11.55,104.92");
  assert.equal(map().dataset.phase, "pickup", "Refreshing restores the pickup step");
  await act(async () => app.button("merchant.rides.start").click());
  await app.focus();
  assert.ok(app.customerContainer.textContent.includes("rides.InProgress"));
  assert.ok(app.merchantContainer.textContent.includes("merchant.rides.goToDestination"));
  assert.equal(map().dataset.phase, "trip");
  assert.equal(app.customerContainer.querySelector('[role="img"]').dataset.phase, "trip");
  assert.ok(app.merchantContainer.querySelector('[aria-current="step"]').textContent.includes("merchant.rides.destinationStep"));
  assert.ok(app.merchantContainer.textContent.includes("merchant.rides.pickedUp"));
  assert.ok(!app.merchantContainer.textContent.includes("merchant.rides.afterPickup"));
  assert.equal(new URL(directions().href).searchParams.get("destination"), "11.57,104.93");
  assert.equal(map().dataset.phase, "trip", "The destination step survives refresh");
  assert.equal(new URL(directions().href).searchParams.get("dir_action"), "navigate");
  assert.equal(directions().target, "_blank");
  assert.ok(directions().rel.split(" ").includes("noopener"));
  await app.remountMerchant();
  assert.ok(map(), "An in-progress ride also restores its map after refresh");
  assert.equal(new URL(directions().href).searchParams.get("destination"), "11.57,104.93");
  await act(async () => app.button("merchant.rides.complete").click());
  await app.focus();
  assert.ok(app.customerContainer.textContent.includes("rides.Completed"));
  assert.ok(app.merchantContainer.textContent.includes("merchant.rides.waiting"));
  assert.equal(map(), null);
  assert.equal(directions(), null);
  assert.equal(app.merchantApi.getSession().user.role, "Merchant");
  assert.equal(app.customerApi.getSession().user.role, "Customer");
});

test("customer waiting maps follow actual shared GPS, update as the driver approaches, and clear when sharing stops", async (t) => {
  const app = await setup(t);
  const customerMap = () => app.customerContainer.querySelector('[role="img"]');
  assert.ok(customerMap(), "The customer sees the trip map immediately while waiting");
  assert.equal(customerMap().dataset.driver, undefined);
  assert.ok(app.customerContainer.textContent.includes("tracking.finding"));
  await act(async () => app.button("merchant.rides.accept").click());
  await app.focus();
  assert.ok(app.customerContainer.textContent.includes("tracking.waiting"));
  assert.equal(app.watches.size, 0, "GPS starts only when the driver chooses to share");
  await act(async () => app.button("tracking.share").click());
  const watch = [...app.watches.values()][0];
  assert.equal(watch.options.enableHighAccuracy, true);
  await act(async () => watch.success({ coords: { latitude: 11.53, longitude: 104.91, accuracy: 7 } }));
  await app.focus();
  assert.equal(JSON.parse(customerMap().dataset.driver).latitude, 11.53);
  assert.ok(app.customerContainer.textContent.includes("tracking.live"));
  const realNow = Date.now();
  t.mock.method(Date, "now", () => realNow + 2100);
  await act(async () => watch.success({ coords: { latitude: 11.549, longitude: 104.919, accuracy: 5 } }));
  await app.focus();
  assert.equal(JSON.parse(customerMap().dataset.driver).latitude, 11.549);
  assert.ok(app.merchantContainer.textContent.includes("tracking.sharing"));
  await act(async () => app.button("tracking.stop").click());
  await app.focus();
  assert.equal(customerMap().dataset.driver, undefined);
  assert.equal(app.watches.size, 0);
  assert.equal(app.clearedWatches.length, 1);
  const sent = app.calls.filter((call) => call.url.endsWith("/location") && call.method === "PATCH").length;
  await act(async () => watch.success({ coords: { latitude: 11.55, longitude: 104.92, accuracy: 4 } }));
  assert.equal(app.calls.filter((call) => call.url.endsWith("/location") && call.method === "PATCH").length, sent, "Late GPS callbacks cannot send after stopping");
});

test("GPS permission errors are shown to the driver and ride cancellation clears the watcher and customer map", async (t) => {
  const app = await setup(t);
  await act(async () => app.button("merchant.rides.accept").click());
  await act(async () => app.button("tracking.share").click());
  await act(async () => [...app.watches.values()][0].failure({ code: 1 }));
  assert.ok(app.merchantContainer.querySelector('[role="alert"]').textContent.includes("ride.location.error.permission"));
  assert.equal(app.watches.size, 0);
  assert.equal(app.calls.filter((call) => call.url.endsWith("/location")).length, 0);
  await act(async () => app.button("tracking.share").click());
  assert.equal(app.watches.size, 1);
  app.state.ride.status = "Cancelled";
  await app.focus();
  assert.equal(app.watches.size, 0);
  assert.equal(app.customerContainer.querySelector('[role="img"]'), null);
});

test("failed GPS uploads show a retry state and recover without inventing a customer location", async (t) => {
  const app = await setup(t);
  await act(async () => app.button("merchant.rides.accept").click());
  await act(async () => app.button("tracking.share").click());
  const watch = [...app.watches.values()][0];
  app.state.failLocation = true;
  await act(async () => watch.success({ coords: { latitude: 11.53, longitude: 104.91, accuracy: 7 } }));
  await app.focus();
  assert.ok(app.merchantContainer.textContent.includes("tracking.network"));
  assert.equal(JSON.parse(app.merchantContainer.querySelector('[role="img"]').dataset.driver).latitude, 11.53, "The merchant sees local GPS immediately even when the server upload fails");
  assert.equal(app.customerContainer.querySelector('[role="img"]').dataset.driver, undefined);
  const realNow = Date.now();
  t.mock.method(Date, "now", () => realNow + 2100);
  app.state.failLocation = false;
  await act(async () => watch.success({ coords: { latitude: 11.54, longitude: 104.92, accuracy: 6 } }));
  await app.focus();
  assert.equal(JSON.parse(app.customerContainer.querySelector('[role="img"]').dataset.driver).latitude, 11.54);
  assert.ok(app.merchantContainer.textContent.includes("tracking.sharing"));
  assert.ok(!app.merchantContainer.textContent.includes("tracking.network"));
});

test("declining dismisses only the merchant's popup and remains dismissed after refreshing the merchant view", async (t) => {
  const app = await setup(t);
  await act(async () => app.button("merchant.rides.decline").click());
  assert.equal(app.state.ride.status, "Pending");
  assert.equal(app.merchantContainer.querySelector("dialog").open, false);
  await app.remountMerchant();
  assert.equal(app.merchantContainer.querySelector("dialog").open, false);
  assert.ok(app.merchantContainer.textContent.includes("merchant.rides.waiting"));
  await app.focus();
  assert.ok(app.customerContainer.textContent.includes("rides.Pending"));
  assert.deepEqual(JSON.parse(app.calls.find((call) => call.url.endsWith("/response")).body), { accept: false });
});

test("an already-claimed ride closes the popup after a conflict and never creates a local active assignment", async (t) => {
  const app = await setup(t);
  app.state.conflict = true;
  await act(async () => app.button("merchant.rides.accept").click());
  assert.equal(app.merchantContainer.querySelector("dialog").open, false);
  assert.ok(!app.merchantContainer.textContent.includes("merchant.rides.active"));
  assert.ok(app.merchantContainer.textContent.includes("merchant.rides.waiting"));
  assert.equal(app.merchantContainer.querySelector('[role="img"]'), null);
});

test("customer cancellation removes the merchant map and navigation on the next inbox refresh", async (t) => {
  const app = await setup(t);
  await act(async () => app.button("merchant.rides.accept").click());
  assert.ok(app.merchantContainer.querySelector('[role="img"]'));
  app.state.ride.status = "Cancelled";
  await app.focus();
  assert.equal(app.merchantContainer.querySelector('[role="img"]'), null);
  assert.equal(app.merchantContainer.querySelector('a[href^="https://www.google.com/maps/dir/"]'), null);
  assert.ok(app.merchantContainer.textContent.includes("merchant.rides.waiting"));
});

test("customer testing routes return after login while merchant accounts stay on their own dashboard", async () => {
  const { authDestination } = await loadLib("auth-destination");
  assert.equal(authDestination("Customer", "?next=%2Fride"), "/ride");
  assert.equal(authDestination("Customer", "?next=/rides"), "/rides");
  assert.equal(authDestination("Customer", ""), "/");
  assert.equal(authDestination("Merchant", "?next=/ride"), "/merchant");
  for (const next of ["https://example.com", "//example.com", "/profile", "/ride?external=true"])
    assert.equal(authDestination("Customer", `?next=${encodeURIComponent(next)}`), "/");
});
