import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { act, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import ts from "typescript";
import { loadLib } from "./load-lib.mjs";

const { EMPTY_MERCHANT_PROFILE, merchantRegistrationProfile } = await loadLib("merchant");
const dataModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const require = createRequire(import.meta.url);
const reactModule = pathToFileURL(require.resolve("react")).href;
const jsxModule = pathToFileURL(require.resolve("react/jsx-runtime")).href;
const translationStub = dataModule('const t = key => key; export const useT = () => ({ t, pick: english => english });');

async function component(relativePath, imports) {
  const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
  let { outputText } = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX,
  } });
  for (const [name, url] of Object.entries({ react: reactModule, "react/jsx-runtime": jsxModule, ...imports }))
    outputText = outputText.replaceAll(`from "${name}"`, `from "${url}"`);
  return dataModule(outputText);
}

async function registration(service) {
  const profile = { ...EMPTY_MERCHANT_PROFILE, service };
  const merchantStub = dataModule(`export const MERCHANT_SERVICES = ${JSON.stringify([
    { id: "GrabRide", emoji: "R" }, { id: "GrabFood", emoji: "F" }, { id: "GrabExpress", emoji: "E" },
  ])}; export const EMPTY_MERCHANT_PROFILE = ${JSON.stringify(profile)}; export const merchantRegistrationProfile = () => ({});`);
  const location = await locationComponent();
  const schedule = await scheduleComponent();
  const fields = await component("../components/MerchantProfileFields.tsx", { "@/lib/i18n": translationStub, "@/lib/merchant": merchantStub, "./RideMerchantLocation": location, "./RideWorkSchedule": schedule });
  const page = await component("../app/merchant/register/page.tsx", {
    "@/components/MerchantProfileFields": fields, "@/lib/i18n": translationStub, "@/lib/merchant": merchantStub,
    "@/lib/auth": dataModule('export const useAuth = () => ({ api: {} }); export const errorMessage = () => "";'),
    "@/lib/phone": dataModule('export const normalizePhoneNumber = value => value;'),
    "@/lib/ride-work-schedule": await component("../lib/ride-work-schedule.ts", {}),
    "next/navigation": dataModule('export const useRouter = () => ({ replace: () => {} });'),
    "next/link": dataModule(`import { createElement } from "${reactModule}"; export default ({ children, ...props }) => createElement("a", props, children);`),
  });
  return renderToStaticMarkup(createElement((await import(page)).default));
}

async function scheduleComponent() {
  return component("../components/RideWorkSchedule.tsx", { "@/lib/i18n": translationStub,
    "@/lib/ride-work-schedule": await component("../lib/ride-work-schedule.ts", {}) });
}

async function locationComponent() {
  const districts = await component("../lib/phnom-penh.ts", {});
  const helpers = await component("../lib/merchant-location.ts", { "./phnom-penh": districts });
  return component("../components/RideMerchantLocation.tsx", { "@/lib/i18n": translationStub, "@/lib/phnom-penh": districts, "@/lib/merchant-location": helpers });
}

test("GrabRide registration includes rider details and seven working-day checkboxes with time inputs", async () => {
  const html = await registration("GrabRide");
  const fields = [...html.matchAll(/<(?:input|textarea)\b[^>]*>/g)]
    .map(([tag]) => tag).filter((tag) => !/type="(?:radio|checkbox|time)"/.test(tag));
  assert.deepEqual(fields.map((tag) => tag.match(/name="([^"]+)"/)?.[1]), ["ownerName", "motorcycleLicensePlate", "address", "phoneNumber", "password"]);
  assert.ok(fields.filter((tag) => !tag.includes('name="address"')).every((tag) => tag.includes("required")));
  assert.ok(fields.find((tag) => tag.includes('name="address"')).includes('type="hidden"'));
  assert.ok(html.includes('name="ride-location-mode" value="auto"') || html.includes('value="auto"'));
  assert.ok(html.includes('value="manual"'));
  assert.ok(!html.includes('id="merchant-confirm-password"'));
  assert.equal([...html.matchAll(/name="merchant-service"/g)].length, 3, "Service is chosen during registration");
  assert.equal([...html.matchAll(/name="rideVehicleType"/g)].length, 3);
  for (const vehicle of ["Motorcycle", "Rickshaw", "Classic"])
    assert.ok(html.includes(`value="${vehicle}"`));
  assert.equal([...html.matchAll(/name="workingDay"/g)].length, 7);
  assert.ok(html.includes('name="selectAllWorkingDays"'));
  assert.equal([...html.matchAll(/type="time"/g)].length, 14);
  for (const day of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"])
    assert.ok(html.includes(`merchant.day.${day}`));
});

test("Food and Express registration retain their business fields and password confirmation", async () => {
  for (const service of ["GrabFood", "GrabExpress"]) {
    const html = await registration(service);
    for (const field of ["businessName", "ownerName", "contactPhone", "email", "address", "city", "category", "openingHours", "description"])
      assert.ok(html.includes(`name="${field}"`), `${service}: ${field}`);
    assert.ok(html.includes('id="merchant-confirm-password"'));
    assert.ok(!html.includes('name="motorcycleLicensePlate"'));
    assert.ok(!html.includes('name="workingDay"'));
  }
});

test("GrabRide registration sends rider details without hidden business requirements", () => {
  const profile = merchantRegistrationProfile({ ...EMPTY_MERCHANT_PROFILE, service: "GrabRide", ownerName: " Dara Sok ", address: " Phnom Penh ", motorcycleLicensePlate: " 1AB-1234 ", openingHours: " Mon 08:00-17:00; Sun 18:00-02:00 " });
  assert.deepEqual(profile, { service: "GrabRide", ownerName: "Dara Sok", address: "Phnom Penh", motorcycleLicensePlate: "1AB-1234", openingHours: "Mon 08:00-17:00; Sun 18:00-02:00", vehicleType: "Motorcycle" });
});

test("GrabRide dashboard saves and restores checked days and times without listings or profile edits resetting the schedule", async (t) => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost:3000/merchant" });
  const previous = { window: globalThis.window, document: globalThis.document, IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT };
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  const { createRoot } = await import("react-dom/client");
  let root;
  t.after(async () => {
    try { if (root) await act(async () => root.unmount()); }
    finally { dom.window.close(); Object.assign(globalThis, previous); }
  });
  let data = { profile: { ...EMPTY_MERCHANT_PROFILE, id: "rider-1", service: "GrabRide", ownerName: "Dara Sok", businessName: "Dara Sok",
    contactPhone: "012345678", address: "GPS: 11.556400, 104.928200", motorcycleLicensePlate: "1AB-1234", openingHours: "Mon 09:00-17:00" }, listings: [] };
  const updates = [];
  const api = {
    merchantDashboard: async () => structuredClone(data),
    updateMerchantProfile: async (profile) => { updates.push(structuredClone(profile)); data.profile = structuredClone(profile); return structuredClone(profile); },
  };
  const authStub = dataModule('let api; export const setApi = value => { api = value; }; export const useAuth = () => ({ api }); export const errorMessage = err => err.message;');
  (await import(authStub)).setApi(api);
  const fields = await component("../components/MerchantProfileFields.tsx", {
    "@/lib/i18n": translationStub, "@/lib/merchant": await component("../lib/merchant.ts", {}),
    "./RideMerchantLocation": await locationComponent(), "./RideWorkSchedule": await scheduleComponent(),
  });
  const Dashboard = (await import(await component("../components/MerchantDashboard.tsx", {
    "@/lib/auth": authStub, "@/lib/i18n": translationStub,
    "@/lib/brand": dataModule('export const money = value => String(value);'),
    "@/lib/toast": dataModule('export const toast = () => {};'),
    "@/lib/ride-work-schedule": await component("../lib/ride-work-schedule.ts", {}),
    "./MerchantProfileFields": fields, "./RideWorkSchedule": await scheduleComponent(),
    "./MerchantRideRequests": dataModule('export default () => null;'),
    "./MerchantOrders": dataModule('export default () => null;'),
    "./MerchantOfferCard": dataModule('export default () => null;'),
    "next/link": dataModule(`import { createElement } from "${reactModule}"; export default ({ children, ...props }) => createElement("a", props, children);`),
  }))).default;
  const container = dom.window.document.getElementById("root");
  async function mount() { root = createRoot(container); await act(async () => root.render(createElement(Dashboard))); }
  async function setTime(day, field, value) {
    await act(async () => {
      const input = container.querySelector(`#ride-work-${day}-${field}`);
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(input, value);
      input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });
  }
  async function submit(index) {
    await act(async () => container.querySelectorAll("form")[index].dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })));
  }
  await mount();
  assert.ok(container.textContent.includes("merchant.workSchedule"));
  assert.ok(!container.querySelector('input[name="merchant-service"]'), "Registered riders cannot switch service");
  assert.ok(!container.textContent.includes("GrabFood"));
  assert.ok(!container.textContent.includes("GrabExpress"));
  for (const key of ["merchant.listings", "merchant.newListing", "merchant.total", "merchant.published", "merchant.draft"])
    assert.ok(!container.textContent.includes(key), key);
  assert.equal(container.querySelectorAll('input[name="workingDay"]').length, 7);
  assert.equal(container.querySelector('input[value="Mon"]').checked, true);
  const selectAll = container.querySelector('input[name="selectAllWorkingDays"]');
  assert.equal(selectAll.indeterminate, true);
  await act(async () => selectAll.click());
  assert.ok([...container.querySelectorAll('input[name="workingDay"]')].every((input) => input.checked));
  assert.equal(selectAll.checked, true);
  assert.equal(container.querySelector("#ride-work-Mon-start").value, "09:00", "Selecting all keeps existing working hours");
  await act(async () => selectAll.click());
  assert.ok([...container.querySelectorAll('input[name="workingDay"]')].every((input) => !input.checked));
  await act(async () => { container.querySelector('input[value="Mon"]').click(); });
  await setTime("Mon", "start", "09:00");
  await act(async () => { container.querySelector('input[value="Sun"]').click(); });
  await setTime("Sun", "start", "18:00");
  await setTime("Sun", "end", "02:00");
  await submit(0);
  const savedHours = "Mon 09:00-17:00; Sun 18:00-02:00";
  assert.equal(updates[0].openingHours, savedHours);
  await submit(1);
  assert.equal(updates[1].openingHours, savedHours, "Saving rider information must retain the separately saved schedule");
  await act(async () => root.unmount());
  await mount();
  assert.equal(container.querySelector('input[value="Sun"]').checked, true);
  assert.equal(container.querySelector("#ride-work-Sun-start").value, "18:00");
  assert.equal(container.querySelector("#ride-work-Sun-end").value, "02:00");
  await setTime("Sun", "end", "18:00");
  await submit(0);
  assert.equal(updates.length, 2, "Equal start and end times cannot be saved");
  assert.equal(container.querySelector('[role="alert"]').textContent, "merchant.workInvalid");

  for (const service of ["GrabFood", "GrabExpress"]) {
    await act(async () => root.unmount());
    data = { ...data, profile: { ...data.profile, service, openingHours: "Mon–Sat 7 AM–8 PM" } };
    await mount();
    // Business dashboards open on incoming orders; listing tools are one tab away.
    assert.ok([...container.querySelectorAll("button")].some((button) => button.textContent.startsWith("merchant.orders")), `${service} shows its orders tab`);
    await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "merchant.listings").click());
    assert.ok(container.textContent.includes("merchant.newListing"), `${service} keeps listing tools`);
    assert.ok(!container.querySelector('input[name="workingDay"]'));
    await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "merchant.profile").click());
    assert.ok(!container.querySelector('input[name="merchant-service"]'), `${service} profile keeps its registered service`);
  }
});

test("manual location starts at Phnom Penh with all districts and requires a district before sangkat", async () => {
  const Location = (await import(await locationComponent())).default;
  const html = renderToStaticMarkup(createElement(Location, { value: "", onChange: () => {} }));
  const selects = [...html.matchAll(/<select\b[^>]*>[\s\S]*?<\/select>/g)].map(([tag]) => tag);
  assert.ok(html.includes("Phnom Penh"));
  assert.equal(selects.length, 2);
  assert.equal([...selects[0].matchAll(/<option\b/g)].length, 15); // Placeholder plus 14 districts.
  assert.ok(selects[0].includes("required"));
  assert.ok(selects[1].includes("disabled"));
  assert.equal([...selects[1].matchAll(/<option\b/g)].length, 1);
});

test("saved district and sangkat restore the picker with only that district's sangkats", async () => {
  const Location = (await import(await locationComponent())).default;
  const html = renderToStaticMarkup(createElement(Location, { value: "Tonle Basak, Khan Chamkar Mon, Phnom Penh", onChange: () => {} }));
  const selects = [...html.matchAll(/<select\b[^>]*>[\s\S]*?<\/select>/g)].map(([tag]) => tag);
  assert.ok(selects[0].includes('value="1201" selected=""'));
  assert.ok(selects[1].includes('value="120101" selected=""'));
  assert.equal([...selects[1].matchAll(/<option\b/g)].length, 6); // Placeholder plus this district's 5 sangkats.
  assert.ok(!selects[1].includes('value="121301"'));
  assert.ok(html.includes('name="address" value="Tonle Basak, Khan Chamkar Mon, Phnom Penh"'));
});

test("saved device coordinates restore automatic mode without requesting location during render", async () => {
  const Location = (await import(await locationComponent())).default;
  const html = renderToStaticMarkup(createElement(Location, { value: "GPS: 11.556400, 104.928200", onChange: () => {} }));
  assert.ok(!html.includes("<select"));
  assert.ok(!html.includes("<button"), "Saved device location has no extra Detect button");
  assert.ok(html.includes("11.556400, 104.928200"));
  assert.ok(html.includes("https://www.openstreetmap.org/?mlat="));
});
