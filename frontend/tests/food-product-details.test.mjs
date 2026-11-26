import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { act, createElement } from "react";
import { JSDOM } from "jsdom";
import ts from "typescript";
import { loadLibGroup } from "./load-lib.mjs";

const require = createRequire(import.meta.url);
const data = source => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const react = pathToFileURL(require.resolve("react")).href;
async function component(path, imports) {
  let source = ts.transpileModule(await readFile(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  for (const [name, url] of Object.entries({ react, "react/jsx-runtime": pathToFileURL(require.resolve("react/jsx-runtime")).href, ...imports })) source = source.replaceAll(`"${name}"`, JSON.stringify(url));
  return data(source);
}
const link = data(`import { createElement } from "${react}"; export default ({children,...props}) => createElement("a",props,children);`);
const i18n = data('const t = (key, vars = {}) => ({ "partner.add": "Add to cart", "store.increase": "Increase", "store.decrease": "Decrease", "common.close": "Close", "partner.inCart": `${vars.n} in cart`, "store.add": `Add ${vars.name}`, "store.viewCart": "View cart" })[key] ?? key; const pick = (en,km) => globalThis.__foodTest.lang === "km" ? km ?? en : en; export const useT = () => ({ t, pick, lang: globalThis.__foodTest.lang });');
const merchantContent = await component("../lib/merchant-content.ts", {});
const food = { id: "dish", title: "Chicken Fried Rice", description: "Jasmine rice fried with chicken, egg, vegetables and soy.", price: 3.25, imageUrl: "/backend/api/merchant-images/rice", merchant: { id: "restaurant", businessName: "Test Kitchen", service: "GrabFood", city: "Phnom Penh" } };

async function setup(t) {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost:3000/food" });
  const previous = { window: globalThis.window, document: globalThis.document, IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT, __foodTest: globalThis.__foodTest };
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true, __foodTest: { lang: "en", toasts: [] } });
  const libs = await loadLibGroup("cart", "partner-cart", "pricing", "catalog", "brand", "hours", "wallet", "local-store");
  globalThis.__foodTest.libs = libs;
  dom.window.confirm = () => true;
  const { createRoot } = await import("react-dom/client"); const root = createRoot(document.getElementById("root"));
  t.after(async () => { await act(async () => root.unmount()); dom.window.close(); Object.assign(globalThis, previous); });
  const controls = await component("../components/PartnerCartControls.tsx", {
    "next/navigation": data('export const useRouter = () => ({ push() {} });'),
    "next/link": link, "@/lib/brand": data('export const money = n => `$${n.toFixed(2)}`;'), "@/lib/i18n": i18n, "@/lib/merchant-content": merchantContent,
    "@/lib/cart": data('export const addPartnerItem = (...args) => globalThis.__foodTest.libs.cart.addPartnerItem(...args);'),
    "@/lib/partner-cart": data('export const MAX_PARTNER_QTY = 50; export const usePartnerCart = () => globalThis.__foodTest.libs["partner-cart"].usePartnerCart(); export const partnerTotals = cart => globalThis.__foodTest.libs["partner-cart"].partnerTotals(cart); export const setPartnerQty = (...args) => globalThis.__foodTest.libs["partner-cart"].setPartnerQty(...args);'),
    "@/lib/dialog": data('export const askReplaceCart = () => async name => window.confirm(name); export const withReplaceConfirm = async (run, ask) => { let asked = null; const first = run(name => { asked ??= name; return false; }); if (asked === null) return first; return (await ask(asked)) ? run(() => true) : first; };'),
    "@/lib/toast": data('export const toast = text => globalThis.__foodTest.toasts.push(text);'), "./Icon": data('export default () => null;'),
  });
  return { root, dom, libs, controls };
}

test("GrabFood detail quantity controls add the selected quantity and enforce the existing cart limit", async t => {
  const { root, libs, controls } = await setup(t); const Purchase = (await import(controls)).PartnerProductPurchase;
  await act(async () => root.render(createElement(Purchase, { offer: food })));
  const increase = () => document.querySelector('[aria-label="Increase"]');
  await act(async () => increase().click()); assert.equal(document.querySelector("output").textContent, "2");
  assert.equal(document.querySelector(".food-add-button strong").textContent, "$6.50");
  await act(async () => document.querySelector(".food-add-button").click());
  assert.equal(libs["partner-cart"].partnerCart().lines[0].qty, 2); assert.equal(document.querySelector("output").textContent, "1");
  assert.ok(document.querySelector(".food-added-note").textContent.includes("2 in cart"));
  await act(async () => libs["partner-cart"].setPartnerQty(food.id, 49)); assert.equal(increase().disabled, true);
  await act(async () => document.querySelector(".food-add-button").click());
  assert.equal(libs["partner-cart"].partnerCart().lines[0].qty, 50); assert.equal(document.querySelector(".food-add-button").disabled, true);
});

test("the food detail respects replacing another restaurant's cart", async t => {
  const { root, dom, libs, controls } = await setup(t);
  libs["partner-cart"].putPartnerItem({ ...food, id: "other", merchant: { id: "other-store", businessName: "Other restaurant" } });
  dom.window.confirm = () => false;
  await act(async () => root.render(createElement((await import(controls)).PartnerProductPurchase, { offer: food })));
  await act(async () => document.querySelector(".food-add-button").click()); assert.equal(libs["partner-cart"].partnerCart().merchantId, "other-store");
  dom.window.confirm = () => true;
  await act(async () => document.querySelector(".food-add-button").click()); assert.equal(libs["partner-cart"].partnerCart().merchantId, food.merchant.id);
});

test("food details show localized dish information, real related dishes and an image fallback", async t => {
  const { root, dom, controls } = await setup(t);
  globalThis.__foodTest.lang = "km";
  const Details = (await import(await component("../components/FoodProductDetails.tsx", {
    "next/link": link, "@/lib/brand": data('export const money = n => `$${n.toFixed(2)}`;'), "@/lib/i18n": i18n, "@/lib/merchant-content": merchantContent,
    "./CategoryBadge": data('export default () => null;'), "./PromotionBadge": data('export default () => null;'), "./Icon": data('export default () => null;'),
    "./WishlistButton": data('export default () => null;'),
    "./PartnerCartControls": controls, "./MerchantOfferCard": data(`import { createElement } from "${react}"; export default ({offer}) => createElement("a", {href: '/partners/'+offer.merchant.id+'/products/'+offer.id},offer.title);`),
  }))).default;
  const other = { ...food, id: "noodles", title: "Noodle bowl" };
  await act(async () => root.render(createElement(Details, { offer: food, others: [food, other] })));
  assert.equal(document.querySelector("h1").textContent, "បាយឆាមាន់");
  assert.ok(document.querySelector(".food-dish-description").textContent.includes("សាច់មាន់"));
  assert.equal(document.querySelectorAll(".food-related-grid a").length, 1);
  assert.equal(document.querySelector(".food-related-grid a").getAttribute("href"), "/partners/restaurant/products/noodles");
  await act(async () => document.querySelector(".food-detail-photo img").dispatchEvent(new dom.window.Event("error")));
  assert.ok(document.querySelector(".food-detail-placeholder"));
});

test("a sample dish without options opens details and adds the selected quantity", async t => {
  const { root, dom } = await setup(t); let added;
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  const Dialog = (await import(await component("../components/ItemOptionsDialog.tsx", {
    "@/lib/brand": data('export const money = n => `$${n.toFixed(2)}`;'), "@/lib/i18n": i18n, "./Icon": data('export default () => null;'),
    "@/lib/pricing": data('export const defaultOptions = () => []; export const unitPrice = item => item.price;'),
  }))).default;
  const item = { id: "plain", name: "Rice bowl", description: "Steamed rice and vegetables.", price: 4, emoji: "🍚" };
  await act(async () => root.render(createElement(Dialog, { item, open: true, storeName: "Sample kitchen", onClose: () => {}, onAdd: (...args) => { added = args; } })));
  assert.equal(document.querySelector("h2").textContent, item.name); assert.ok(document.querySelector(".food-item-store").textContent.includes("Sample kitchen"));
  await act(async () => document.querySelector('[aria-label="Increase"]').click());
  assert.equal(document.querySelector(".food-add-button strong").textContent, "$8.00");
  await act(async () => document.querySelector("form").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })));
  assert.deepEqual(added, [[], 2]);
  added = null;
  await act(async () => root.render(createElement(Dialog, { item, open: true, closed: true, onClose: () => {}, onAdd: (...args) => { added = args; } })));
  assert.equal(document.querySelector('[type="submit"]').disabled, true);
  await act(async () => document.querySelector("form").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })));
  assert.equal(added, null);
});

test("clicking a sample menu product opens its detail dialog and adds through the existing cart", async t => {
  const { root, libs } = await setup(t);
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  const pricing = data('export const defaultOptions = (...args) => globalThis.__foodTest.libs.pricing.defaultOptions(...args); export const unitPrice = (...args) => globalThis.__foodTest.libs.pricing.unitPrice(...args);');
  const Dialog = await component("../components/ItemOptionsDialog.tsx", { "@/lib/brand": data('export const money = n => `$${n.toFixed(2)}`;'), "@/lib/i18n": i18n, "@/lib/pricing": pricing, "./Icon": data('export default () => null;') });
  const Card = (await import(await component("../components/MenuItemCard.tsx", {
    "next/image": data(`import { createElement } from "${react}"; export default ({fill, sizes, ...props}) => createElement("img",props);`),
    "@/lib/brand": data('export const money = n => `$${n.toFixed(2)}`;'), "@/lib/i18n": i18n,
    "@/lib/catalog": data('export const STORES = globalThis.__foodTest.libs.catalog.STORES;'),
    "@/lib/cart": data('export const useShop = () => globalThis.__foodTest.libs.cart.useShop(); export const addToCart = (...args) => globalThis.__foodTest.libs.cart.addToCart(...args); export const lineKey = (...args) => globalThis.__foodTest.libs.cart.lineKey(...args); export const setQty = (...args) => globalThis.__foodTest.libs.cart.setQty(...args);'),
    "@/lib/dialog": data('export const askReplaceCart = () => async name => window.confirm(name); export const withReplaceConfirm = async (run, ask) => { let asked = null; const first = run(name => { asked ??= name; return false; }); if (asked === null) return first; return (await ask(asked)) ? run(() => true) : first; };'),
    "@/lib/toast": data('export const toast = () => {};'), "./ItemOptionsDialog": Dialog, "./PromotionBadge": data('export default () => null;'),
  }))).default;
  const store = libs.catalog.getStore("golden-noodle"); const item = store.items.find(i => !i.options?.length);
  await act(async () => root.render(createElement(Card, { storeId: store.id, item })));
  await act(async () => document.querySelector(".menu-item-details-trigger").click());
  assert.equal(document.querySelector("dialog").open, true); assert.equal(document.querySelector("dialog h2").textContent, item.name);
  await act(async () => document.querySelector('dialog [type="submit"]').click());
  assert.equal(document.querySelector("dialog"), null);
  assert.equal(JSON.parse(window.localStorage.getItem("grab-shop-v1")).cart.lines[0].itemId, item.id);
});
