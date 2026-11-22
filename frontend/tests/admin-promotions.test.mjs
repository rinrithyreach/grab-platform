import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { act, createElement } from "react";
import { JSDOM } from "jsdom";
import ts from "typescript";

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

test("admin can create a product coupon, pause it, delete it and inspect offers with read-only access", async t => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost:3000/admin?section=promotions" });
  const previous = { window: globalThis.window, document: globalThis.document, FormData: globalThis.FormData, IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT, __promotionTestApi: globalThis.__promotionTestApi };
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, FormData: dom.window.FormData, IS_REACT_ACT_ENVIRONMENT: true });
  const { createRoot } = await import("react-dom/client"); const root = createRoot(document.getElementById("root"));
  t.after(async () => { await act(async () => root.unmount()); dom.window.close(); Object.assign(globalThis, previous); });
  let saved = null; let reason = ""; let rows = [];
  globalThis.__promotionTestApi = {
    adminPromotions: async () => rows,
    adminPromotionTargets: async () => [{ storeId: "shop", storeName: "Test shop", productId: "product", productName: "Test product" }],
    adminSavePromotion: async (body, id) => { saved = body; rows = [{ ...body, id: id ?? "offer" }]; return { id: "offer" }; },
    adminDeletePromotion: async (_id, why) => { reason = why; rows = []; return { saved: true }; },
  };
  const rules = await component("../lib/promotion-rules.ts", {});
  const Panel = (await import(await component("../components/admin/AdminPromotionsPanel.tsx", {
    "@/lib/auth": data('export const useAuth = () => ({ api: globalThis.__promotionTestApi });'),
    "@/lib/admin-i18n": data('const a = (text, vars = {}) => text.replace(/\\{(\\w+)\\}/g, (_, key) => vars[key] ?? key); export const useAdminT = () => ({ a });'),
    "@/lib/catalog": data('export const STORES = [];'), "@/lib/brand": data('export const money = value => `$${value.toFixed(2)}`;'),
    "@/lib/promotion-rules": rules, "./AdminIcon": data('export default () => null;'),
    "@/lib/promotions": data('export const usePromotions = () => [];'),
    "./useAdminDialog": data('export const useAdminDialog = onClose => ({ ref: { current: null }, close: onClose });'),
  }))).default;
  const render = canManage => root.render(createElement(Panel, { canManage, revision: 0, onSaved: () => {} }));
  const button = text => [...document.querySelectorAll("button")].find(b => b.textContent === text);
  const select = label => [...document.querySelectorAll("dialog label")].find(l => l.textContent.startsWith(label)).querySelector("select");
  const change = async (node, value) => { await act(async () => { node.value = value; node.dispatchEvent(new dom.window.Event("change", { bubbles: true })); }); };
  const submit = async () => { await act(async () => { document.querySelector("dialog form").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })); }); };
  await act(async () => render(true));
  await act(async () => button("Create promotion").click());
  await change(select("How customers redeem"), "code");
  await change(select("Store"), "shop"); await change(select("Product"), "product");
  document.querySelector('[name="name"]').value = "Product savings";
  document.querySelector('[name="code"]').value = "save20";
  document.querySelector('[name="value"]').value = "20";
  document.querySelector('[name="reason"]').value = "Weekend campaign";
  document.querySelector('[name="startsAt"]').value = "2026-11-25T09:00";
  await submit();
  assert.equal(saved.code, "SAVE20"); assert.equal(saved.storeId, "shop"); assert.equal(saved.productId, "product");
  assert.equal(saved.value, 20); assert.equal(saved.startsAt, "2026-11-25T02:00:00.000Z");
  assert.ok(document.querySelector("table").textContent.includes("SAVE20"));
  await act(async () => button("Edit").click());
  document.querySelector('[name="isActive"]').checked = false;
  document.querySelector('[name="reason"]').value = "Pause campaign";
  await submit(); assert.equal(saved.isActive, false); assert.ok(document.querySelector("table").textContent.includes("Paused"));
  await act(async () => render(false));
  assert.equal(button("Create promotion"), undefined); assert.equal(button("Delete"), undefined);
  await act(async () => button("View").click());
  assert.equal(document.querySelector("dialog fieldset").disabled, true);
  assert.equal(button("Save promotion"), undefined);
  await act(async () => button("Close").click()); await act(async () => render(true));
  await act(async () => button("Delete").click());
  document.querySelector('[name="reason"]').value = "Campaign finished";
  await submit(); assert.equal(reason, "Campaign finished"); assert.equal(document.querySelector("table"), null);
});
