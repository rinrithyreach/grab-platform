import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { act, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import ts from "typescript";

const require = createRequire(import.meta.url);
const data = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const react = pathToFileURL(require.resolve("react")).href;
const jsx = pathToFileURL(require.resolve("react/jsx-runtime")).href;
const link = data(`import { createElement } from "${react}"; export default ({ children, ...props }) => createElement("a", props, children);`);
const i18n = data('export const useT = () => ({ t: key => key });');
const merchantContent = await component("../lib/merchant-content.ts", {});
const offer = {
  id: "product-1", title: "Desktop Monitor", description: "A computer display for desktop workspaces.",
  price: 115, imageUrl: "/backend/api/merchant-images/photo-1",
  merchant: { id: "merchant-1", service: "GrabExpress", businessName: "Computer Supplies", category: "Computers", city: "Phnom Penh" },
};

async function component(path, imports) {
  imports["./PromotionBadge"] ??= data('export default () => null;');
  imports["./CategoryBadge"] ??= data('export default () => null;');
  imports["./FoodProductDetails"] ??= data('export default () => null;');
  let source = ts.transpileModule(await readFile(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  for (const [name, url] of Object.entries({ react, "react/jsx-runtime": jsx, ...imports }))
    source = source.replaceAll(`from "${name}"`, `from "${url}"`);
  return data(source);
}

test("GrabExpress product card opens details and keeps Add to cart outside its link", async () => {
  const Card = (await import(await component("../components/MerchantOfferCard.tsx", {
    "next/link": link, "@/lib/brand": data('export const money = value => `$${value}`;'), "@/lib/i18n": i18n,
    "@/lib/merchant-content": merchantContent,
  }))).default;
  const html = renderToStaticMarkup(createElement(Card, { offer }, createElement("button", null, "Add to cart")));
  const dom = new JSDOM(html);
  const document = dom.window.document;
  assert.equal(document.querySelector("a").getAttribute("href"), "/partners/merchant-1/products/product-1");
  assert.equal(document.querySelector("a button"), null, "The cart control is not nested in the product link");
  assert.equal(document.querySelector("button").textContent, "Add to cart");
  dom.window.close();
});

test("GrabFood product cards open the selected dish instead of the restaurant", async () => {
  const Card = (await import(await component("../components/MerchantOfferCard.tsx", {
    "next/link": link, "@/lib/brand": data('export const money = value => `$${value}`;'), "@/lib/i18n": i18n,
    "@/lib/merchant-content": merchantContent,
  }))).default;
  const dish = { ...offer, merchant: { ...offer.merchant, service: "GrabFood" } };
  const dom = new JSDOM(renderToStaticMarkup(createElement(Card, { offer: dish })));
  assert.equal(dom.window.document.querySelector("a").getAttribute("href"), "/partners/merchant-1/products/product-1");
  assert.ok(dom.window.document.querySelector("a").textContent.includes("partner.viewDetails"));
  dom.window.close();
});

test("product details show the published listing and reject a missing listing", async (t) => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost:3000/express" });
  const previous = { window: globalThis.window, document: globalThis.document, IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT };
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  const { createRoot } = await import("react-dom/client");
  const container = dom.window.document.getElementById("root");
  const root = createRoot(container);
  t.after(async () => {
    try { await act(async () => root.unmount()); }
    finally { dom.window.close(); Object.assign(globalThis, previous); }
  });
  const api = data(`export class ApiError extends Error {};
    const api = { merchantStorefront: async () => (${JSON.stringify({ merchant: offer.merchant, listings: [offer] })}) };
    export const useAuth = () => ({ api });`);
  const controls = data(`import { createElement } from "${react}";
    export const PartnerAddButton = () => createElement("button", null, "Add to cart");
    export const PartnerCartBar = () => null;`);
  const Details = (await import(await component("../components/MerchantProductDetails.tsx", {
    "next/link": link, "@/lib/api": api, "@/lib/auth": api,
    "@/lib/brand": data('export const money = value => `$${value}`;'), "@/lib/i18n": i18n,
    "./BackButton": data('export default () => null;'), "./PartnerCartControls": controls,
    "./FoodProductDetails": data('export default () => null;'),
  }))).default;

  await act(async () => root.render(createElement(Details, { merchantId: "merchant-1", listingId: "product-1" })));
  assert.equal(container.querySelector("h1").textContent, "Desktop Monitor");
  assert.ok(container.textContent.includes(offer.description));
  assert.equal(container.querySelector("img").getAttribute("src"), offer.imageUrl);
  assert.equal(container.querySelector("button").textContent, "Add to cart");

  await act(async () => root.render(createElement(Details, { key: "missing", merchantId: "merchant-1", listingId: "unpublished" })));
  assert.equal(container.querySelector("h1"), null);
  assert.equal(container.querySelector('[role="alert"]').textContent, "partner.productUnavailable");
});
