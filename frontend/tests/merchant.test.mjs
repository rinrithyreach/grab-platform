import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { loadLib } from "./load-lib.mjs";

const { EMPTY_MERCHANT_PROFILE, merchantRegistrationProfile } = await loadLib("merchant");
const dataModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const require = createRequire(import.meta.url);
const reactModule = pathToFileURL(require.resolve("react")).href;
const jsxModule = pathToFileURL(require.resolve("react/jsx-runtime")).href;
const translationStub = dataModule('export const useT = () => ({ t: key => key, pick: english => english });');

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
  const fields = await component("../components/MerchantProfileFields.tsx", { "@/lib/i18n": translationStub, "@/lib/merchant": merchantStub, "./RideMerchantLocation": location });
  const page = await component("../app/merchant/register/page.tsx", {
    "@/components/MerchantProfileFields": fields, "@/lib/i18n": translationStub, "@/lib/merchant": merchantStub,
    "@/lib/auth": dataModule('export const useAuth = () => ({ api: {} }); export const errorMessage = () => "";'),
    "@/lib/phone": dataModule('export const normalizePhoneNumber = value => value;'),
    "next/navigation": dataModule('export const useRouter = () => ({ replace: () => {} });'),
    "next/link": dataModule(`import { createElement } from "${reactModule}"; export default ({ children, ...props }) => createElement("a", props, children);`),
  });
  return renderToStaticMarkup(createElement((await import(page)).default));
}

async function locationComponent() {
  const districts = await component("../lib/phnom-penh.ts", {});
  const helpers = await component("../lib/merchant-location.ts", { "./phnom-penh": districts });
  return component("../components/RideMerchantLocation.tsx", { "@/lib/i18n": translationStub, "@/lib/phnom-penh": districts, "@/lib/merchant-location": helpers });
}

test("GrabRide registration renders exactly the five requested data fields", async () => {
  const html = await registration("GrabRide");
  const fields = [...html.matchAll(/<(?:input|textarea)\b[^>]*>/g)]
    .map(([tag]) => tag).filter((tag) => !tag.includes('type="radio"'));
  assert.deepEqual(fields.map((tag) => tag.match(/name="([^"]+)"/)?.[1]), ["ownerName", "motorcycleLicensePlate", "address", "phoneNumber", "password"]);
  assert.ok(fields.filter((tag) => !tag.includes('name="address"')).every((tag) => tag.includes("required")));
  assert.ok(fields.find((tag) => tag.includes('name="address"')).includes('type="hidden"'));
  assert.ok(html.includes('name="ride-location-mode" value="auto"') || html.includes('value="auto"'));
  assert.ok(html.includes('value="manual"'));
  assert.ok(!html.includes('id="merchant-confirm-password"'));
});

test("Food and Express registration retain their business fields and password confirmation", async () => {
  for (const service of ["GrabFood", "GrabExpress"]) {
    const html = await registration(service);
    for (const field of ["businessName", "ownerName", "contactPhone", "email", "address", "city", "category", "openingHours", "description"])
      assert.ok(html.includes(`name="${field}"`), `${service}: ${field}`);
    assert.ok(html.includes('id="merchant-confirm-password"'));
    assert.ok(!html.includes('name="motorcycleLicensePlate"'));
  }
});

test("GrabRide registration sends rider details without hidden business requirements", () => {
  const profile = merchantRegistrationProfile({ ...EMPTY_MERCHANT_PROFILE, service: "GrabRide", ownerName: " Dara Sok ", address: " Phnom Penh ", motorcycleLicensePlate: " 1AB-1234 " });
  assert.deepEqual(profile, { service: "GrabRide", ownerName: "Dara Sok", address: "Phnom Penh", motorcycleLicensePlate: "1AB-1234" });
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
