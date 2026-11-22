import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { act, createElement, useState } from "react";
import { JSDOM } from "jsdom";
import ts from "typescript";
import { loadLibGroup } from "./load-lib.mjs";

const require = createRequire(import.meta.url);
const data = source => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const react = pathToFileURL(require.resolve("react")).href;
let setupCount = 0;
async function component(path, imports) {
  let source = ts.transpileModule(await readFile(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  for (const [name, url] of Object.entries({ react, "react/jsx-runtime": pathToFileURL(require.resolve("react/jsx-runtime")).href, ...imports })) source = source.replaceAll(`"${name}"`, JSON.stringify(url));
  return data(source);
}

async function setup(t, { id = "address", initial = "", secure = true, supported = true } = {}) {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost:3000/cart" });
  const previous = { window: globalThis.window, document: globalThis.document, IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT, __deliveryTest: globalThis.__deliveryTest };
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: dom.window.navigator });
  Object.defineProperty(dom.window, "isSecureContext", { configurable: true, value: secure });
  const calls = [];
  Object.defineProperty(dom.window.navigator, "geolocation", { configurable: true, value: supported ? { getCurrentPosition: (success, error, options) => calls.push({ success, error, options }) } : undefined });
  const libs = await loadLibGroup("merchant-location", "phnom-penh", "places", "pricing", "catalog", "brand", "hours");
  globalThis.__deliveryTest = { libs };
  const Field = (await import(await component("../components/DeliveryAddressField.tsx", {
    "@/lib/i18n": data('export const useT = () => ({ t: key => key, pick: en => en });'),
    "@/lib/profile": data('export const useProfile = () => ({ addresses: [{label:"other",text:"House 8, Street 100"}] });'),
    "@/lib/pricing": data('export const isValidAddress = value => globalThis.__deliveryTest.libs.pricing.isValidAddress(value);'),
    "@/lib/merchant-location": data('export const DeviceLocationError = globalThis.__deliveryTest.libs["merchant-location"].DeviceLocationError; export const getDeviceLocation = (...args) => globalThis.__deliveryTest.libs["merchant-location"].getDeviceLocation(...args); export const deviceRideLocation = (...args) => globalThis.__deliveryTest.libs["merchant-location"].deviceRideLocation(...args);\n// setup ' + ++setupCount),
    "@/lib/places": data('export const PLACES = globalThis.__deliveryTest.libs.places.PLACES; export const distanceKm = (...args) => globalThis.__deliveryTest.libs.places.distanceKm(...args);'),
    "./Icon": data('export default () => null;'),
  }))).default;
  const { createRoot } = await import("react-dom/client"); const root = createRoot(document.getElementById("root"));
  let alive = true;
  async function unmount() { if (alive) { await act(async () => root.unmount()); alive = false; } }
  t.after(async () => { await unmount(); dom.window.close(); Object.assign(globalThis, previous); if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator); else delete globalThis.navigator; });
  function Checkout() {
    const [value, setValue] = useState(initial); const [invalid, setInvalid] = useState(false); const [detecting, setDetecting] = useState(false);
    return createElement("form", { onSubmit: e => e.preventDefault() },
      createElement(Field, { id, value, onChange: setValue, invalid, onInvalidChange: setInvalid, onDetectingChange: setDetecting }),
      createElement("button", { type: "submit", disabled: detecting }, "Place order"));
  }
  await act(async () => root.render(createElement(Checkout)));
  const detect = () => [...document.querySelectorAll("button")].find(b => b.textContent.includes("cart.detectLocation"));
  const checkout = () => document.querySelector('[type="submit"]');
  return { dom, calls, detect, checkout, unmount, libs, input: () => document.getElementById(id) };
}

for (const id of ["address", "partner-address"]) {
  test(`${id}: location is requested only on click, fills a valid address and pauses checkout until complete`, async t => {
    const app = await setup(t, { id });
    assert.equal(app.calls.length, 0);
    await act(async () => app.detect().click());
    assert.equal(app.calls.length, 1); assert.equal(app.checkout().disabled, true);
    assert.equal(app.calls[0].options.enableHighAccuracy, true); assert.equal(app.calls[0].options.maximumAge, 0);
    await act(async () => app.calls[0].success({ coords: { latitude: 11.5564, longitude: 104.9282, accuracy: 5 } }));
    assert.equal(app.input().value, "Near Independence Monument · GPS: 11.556400, 104.928200");
    assert.equal(app.libs.pricing.isValidAddress(app.input().value), true); assert.equal(app.checkout().disabled, false);
    assert.ok(document.querySelector('[role="status"]').textContent.includes("cart.locationDetected"));
  });
}

test("a GPS result outside known areas keeps the exact coordinates", async t => {
  const app = await setup(t); await act(async () => app.detect().click());
  await act(async () => app.calls[0].success({ coords: { latitude: 0, longitude: 0, accuracy: 5 } }));
  assert.equal(app.input().value, "GPS: 0.000000, 0.000000"); assert.equal(app.libs.pricing.isValidAddress(app.input().value), true);
});

test("permission errors preserve the entered address and allow retry", async t => {
  const app = await setup(t, { initial: "House 12, Street 271" }); await act(async () => app.detect().click());
  await act(async () => app.calls[0].error({ code: 1 }));
  assert.equal(app.input().value, "House 12, Street 271"); assert.equal(app.checkout().disabled, false);
  assert.equal(document.querySelector('[role="alert"]').textContent, "cart.locationDenied");
  await act(async () => app.detect().click());
  assert.equal(app.calls.length, 2); assert.equal(document.querySelector('[role="alert"]'), null);
  await act(async () => app.calls[1].error({ code: 3 }));
  assert.equal(document.querySelector('[role="alert"]').textContent, "cart.locationTimeout");
});

for (const mode of ["manual", "saved"]) {
  test(`${mode} address selection wins over an older location request`, async t => {
    const app = await setup(t); await act(async () => app.detect().click());
    if (mode === "manual") await act(async () => {
      Object.getOwnPropertyDescriptor(app.dom.window.HTMLInputElement.prototype, "value").set.call(app.input(), "House 22, Street 10");
      app.input().dispatchEvent(new app.dom.window.Event("input", { bubbles: true }));
    });
    else await act(async () => document.querySelector('[aria-pressed]').click());
    const selected = app.input().value; assert.ok(selected); assert.equal(app.checkout().disabled, false);
    await act(async () => app.calls[0].success({ coords: { latitude: 11.56, longitude: 104.93, accuracy: 5 } }));
    assert.equal(app.input().value, selected); assert.equal(document.querySelector('[role="status"]'), null);
  });
}

for (const options of [{ secure: false, expected: "cart.locationInsecure" }, { supported: false, expected: "cart.locationUnsupported" }]) {
  test(`${options.expected}: manual entry stays available`, async t => {
    const app = await setup(t, options); await act(async () => app.detect().click());
    assert.equal(app.calls.length, 0); assert.equal(app.input().disabled, false); assert.equal(app.checkout().disabled, false);
    assert.equal(document.querySelector('[role="alert"]').textContent, options.expected);
  });
}

test("a completed location request after leaving checkout is ignored", async t => {
  const app = await setup(t); await act(async () => app.detect().click()); await app.unmount();
  await act(async () => app.calls[0].success({ coords: { latitude: 11.56, longitude: 104.93, accuracy: 5 } }));
  assert.equal(document.querySelector("input"), null);
});
