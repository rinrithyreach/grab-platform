import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { act, createElement } from "react";
import { JSDOM } from "jsdom";
import ts from "typescript";

const require = createRequire(import.meta.url);
const data = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const react = pathToFileURL(require.resolve("react")).href;
const jsx = pathToFileURL(require.resolve("react/jsx-runtime")).href;

test("manual ride refresh responds to clicks and its result wins over an older poll", async (t) => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost:3000/rides" });
  const previous = { window: globalThis.window, document: globalThis.document, IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT };
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(dom.window.document.getElementById("root"));
  t.after(async () => {
    try { await act(async () => root.unmount()); }
    finally { dom.window.close(); Object.assign(globalThis, previous); }
  });

  const requests = [];
  const service = {
    mode: "live",
    myRides: () => new Promise((resolve) => requests.push(resolve)),
    myPayments: async () => [],
  };
  const rides = data('let service; export const setService = value => { service = value; }; export const useRideService = () => service;');
  (await import(rides)).setService(service);
  const empty = data('export default () => null;');
  const imports = {
    react,
    "react/jsx-runtime": jsx,
    "next/link": data(`import { createElement } from "${react}"; export default ({ children, ...props }) => createElement("a", props, children);`),
    "@/lib/auth": data('export const useAuth = () => ({ user: { id: "customer", role: "Customer" }, ready: true }); export const errorMessage = err => err.message;'),
    "@/lib/brand": data('export const money = value => String(value);'),
    "@/lib/i18n": data('export const useT = () => ({ t: key => key, pick: en => en, dateLocale: "en-US" });'),
    "@/lib/places": data('export const PLACES = [];'),
    "@/lib/rides": rides,
    "@/lib/toast": data('export const toast = () => {};'),
    "@/components/LoginRequired": empty,
    "@/components/BackButton": empty,
    "@/components/DemoModeNotice": empty,
    "@/components/CustomerRideTracking": empty,
    "@/components/MerchantRideNavigation": empty,
  };
  let source = ts.transpileModule(await readFile(new URL("../app/rides/page.tsx", import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  for (const [name, url] of Object.entries(imports)) source = source.replaceAll(`from "${name}"`, `from "${url}"`);
  const Page = (await import(data(source))).default;
  const container = dom.window.document.getElementById("root");

  await act(async () => root.render(createElement(Page)));
  assert.equal(requests.length, 1, "The automatic poll starts on mount");
  const button = container.querySelector("button");
  assert.equal(button.textContent, "rides.refresh");
  assert.equal(button.disabled, false);

  await act(async () => button.click());
  assert.equal(requests.length, 2, "Clicking Refresh starts a new request");
  assert.equal(button.textContent, "rides.refreshing");
  assert.equal(button.disabled, true);

  const ride = { id: "new-ride", pickupLocation: "University", destination: "Central Market", createdAt: "2026-11-18T00:00:00Z", fare: 5, status: "Pending", driverId: null, merchantName: null };
  await act(async () => requests[1]([ride]));
  assert.equal(button.textContent, "rides.refresh");
  assert.equal(button.disabled, false);
  assert.equal(container.querySelector('[role="status"]').textContent, "rides.refreshed");
  assert.ok(container.textContent.includes("University"));

  await act(async () => requests[0]([]));
  assert.ok(container.textContent.includes("University"), "The stale automatic response cannot replace the manual result");
});
