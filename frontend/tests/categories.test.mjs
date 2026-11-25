import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { act, createElement } from "react";
import { JSDOM } from "jsdom";
import ts from "typescript";
import { skeletonStub } from "./skeleton-stub.mjs";

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
const auth = data('export const useAuth = () => ({ api: globalThis.__categoryTest.api });');
const categories = data('export const useCategories = () => globalThis.__categoryTest.categories; export const setCategories = rows => { globalThis.__categoryTest.categories = rows; };');
const i18n = data('const t = key => key; const pick = en => en; export const useT = () => ({ t, pick, lang: "en" });');
const adminT = data('const a = (text, vars = {}) => text.replace(/\\{(\\w+)\\}/g, (_, key) => vars[key] ?? key); export const useAdminT = () => ({ a });');
const types = await component("../lib/category-types.ts", {});
const fixture = [
  { id: "food", name: "Meals", service: "GrabFood", parentId: null, khmerName: "ម្ហូប", sortOrder: 0, productCount: 0, subcategoryCount: 1 },
  { id: "rice", name: "Rice", service: "GrabFood", parentId: "food", khmerName: "បាយ", sortOrder: 0, productCount: 0, subcategoryCount: 0 },
  { id: "shop", name: "Electronics", service: "GrabExpress", parentId: null, khmerName: null, sortOrder: 0, productCount: 0, subcategoryCount: 0 },
];

async function setup(t) {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost:3000/admin?section=categories" });
  const previous = { window: globalThis.window, document: globalThis.document, FormData: globalThis.FormData, IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT, __categoryTest: globalThis.__categoryTest };
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, FormData: dom.window.FormData, IS_REACT_ACT_ENVIRONMENT: true, __categoryTest: { api: {}, categories: fixture.map(c => ({ ...c })) } });
  const { createRoot } = await import("react-dom/client"); const root = createRoot(document.getElementById("root"));
  t.after(async () => { await act(async () => root.unmount()); dom.window.close(); Object.assign(globalThis, previous); });
  return { dom, root };
}
const button = text => [...document.querySelectorAll("button")].find(b => b.textContent === text);
const change = async (dom, select, value) => { await act(async () => { select.value = value; select.dispatchEvent(new dom.window.Event("change", { bubbles: true })); }); };

test("admin creates a subcategory in the selected service and read-only roles cannot change categories", async t => {
  const { root, dom } = await setup(t); let saved;
  globalThis.__categoryTest.api = {
    adminCategories: async () => globalThis.__categoryTest.categories,
    adminSaveCategory: async body => { saved = body; globalThis.__categoryTest.categories = [...globalThis.__categoryTest.categories, { ...body, id: "new" }]; return { id: "new" }; },
  };
  const Panel = (await import(await component("../components/admin/AdminCategoriesPanel.tsx", {
    "@/lib/visible-refresh": await component("../lib/visible-refresh.ts", {}),
    "@/lib/auth": auth, "@/lib/admin-i18n": adminT, "@/lib/categories": categories,
    "./AdminIcon": data('export default () => null;'), "./useAdminDialog": data('export const useAdminDialog = onClose => ({ ref: { current: null }, close: onClose });'),
  }))).default;
  const render = canManage => root.render(createElement(Panel, { canManage, revision: 0, onSaved: () => {} }));
  await act(async () => render(true));
  assert.ok(document.querySelector("table").textContent.includes("Meals")); assert.equal(document.querySelector("table").textContent.includes("Electronics"), false);
  await act(async () => button("Add subcategory").click());
  assert.equal(document.querySelectorAll("dialog select")[1].value, "food");
  document.querySelector('[name="name"]').value = "Noodles"; document.querySelector('[name="reason"]').value = "Organize meals";
  await act(async () => document.querySelector("dialog form").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })));
  assert.equal(saved.parentId, "food"); assert.equal(saved.service, "GrabFood"); assert.ok(document.querySelector("table").textContent.includes("Noodles"));
  await act(async () => button("GrabExpress").click());
  assert.equal(document.querySelector("table").textContent.includes("Meals"), false); assert.ok(document.querySelector("table").textContent.includes("Electronics"));
  await act(async () => render(false)); assert.equal(button("Create category"), undefined); assert.equal(button("Delete"), undefined);
  await act(async () => button("View").click()); assert.equal(document.querySelector("dialog fieldset").disabled, true); assert.equal(button("Save category"), undefined);
});

test("product category picker restores subcategories and clears them when changing the parent or service", async t => {
  const { root, dom } = await setup(t); let value = "rice"; let service = "GrabFood";
  const Picker = (await import(await component("../components/CategoryPicker.tsx", { "@/lib/categories": categories, "@/lib/category-types": types, "@/lib/i18n": i18n }))).default;
  const render = () => root.render(createElement(Picker, { service, value, onChange: next => { value = next; render(); } }));
  await act(async () => render());
  assert.equal(document.querySelectorAll("select")[0].value, "food"); assert.equal(document.querySelectorAll("select")[1].value, "rice");
  await change(dom, document.querySelectorAll("select")[1], ""); assert.equal(value, "food");
  await change(dom, document.querySelectorAll("select")[0], ""); assert.equal(value, null); assert.equal(document.querySelectorAll("select")[1].disabled, true);
  service = "GrabExpress"; await act(async () => render()); assert.ok(document.querySelector("select").textContent.includes("Electronics")); assert.equal(document.querySelector("select").textContent.includes("Meals"), false);
});

test("customer category filters request the full category before pagination and keep the list when clicked again", async t => {
  const { root } = await setup(t); const calls = [];
  globalThis.__categoryTest.api = { merchantOffers: async (service, page, _signal, categoryId) => { calls.push({ service, page, categoryId }); return [{ id: "product", title: categoryId ?? "all", merchant: { service } }]; } };
  const Offers = (await import(await component("../components/MerchantOffers.tsx", {
    "@/lib/auth": auth, "@/lib/i18n": i18n, "@/lib/categories": categories, "@/lib/category-types": types,
    "@/lib/partner-cart": data('export const usePartnerCart = () => ({ merchantId: null });'),
    "next/link": data(`import { createElement } from "${react}"; export default ({children,...props}) => createElement("a",props,children);`),
    "./MerchantOfferCard": data(`import { createElement } from "${react}"; export default ({offer}) => createElement("article",null,offer.title);`),
    "./PartnerCartControls": data('export const PartnerAddButton = () => null; export const PartnerCartBar = () => null;'),
    "./Skeleton": skeletonStub,
  }))).default;
  await act(async () => root.render(createElement(Offers, { service: "GrabFood" })));
  await act(async () => button("Meals").click()); assert.equal(calls.at(-1).categoryId, "food"); assert.equal(calls.at(-1).page, 1);
  const count = calls.length; await act(async () => button("Meals").click()); assert.equal(calls.length, count); assert.equal(document.querySelector("article").textContent, "food");
  await act(async () => button("Rice").click()); assert.equal(calls.at(-1).categoryId, "rice");
  await act(async () => root.render(createElement(Offers, { service: "GrabExpress" }))); assert.equal(calls.at(-1).categoryId, undefined); assert.equal(calls.at(-1).service, "GrabExpress");
});
