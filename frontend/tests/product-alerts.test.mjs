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

async function component(path, imports) {
  let source = ts.transpileModule(await readFile(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  for (const [name, url] of Object.entries({ react, "react/jsx-runtime": jsx, ...imports }))
    source = source.replaceAll(`from "${name}"`, `from "${url}"`);
  return data(source);
}

const store = { id: "m1", businessName: "Dara Kitchen", service: "GrabFood" };
const product = (id, price = 3) => ({ id, title: `Dish ${id}`, description: "", price, imageUrl: `/img/${id}`, merchant: store });

test("guests get alerts for new products and for saved products that sell out, come back and drop in price", async (t) => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost:3000/", pretendToBeVisual: true });
  const previous = { window: globalThis.window, document: globalThis.document, IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT, __alerts: globalThis.__alerts };
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true, __alerts: { offers: [], storefront: [], toasts: [] } });
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(dom.window.document.getElementById("root"));
  t.after(async () => { try { await act(async () => root.unmount()); } finally { dom.window.close(); Object.assign(globalThis, previous); } });

  const localStore = await component("../lib/local-store.ts", {});
  const notifications = await component("../lib/notifications.ts", {});
  const wishlist = await component("../lib/wishlist.ts", { "./local-store": localStore });
  const api = data(`export class ApiError extends Error { constructor(status) { super("x"); this.status = status; } }
    const api = {
      merchantOffers: async () => structuredClone(globalThis.__alerts.offers),
      merchantStorefront: async () => ({ merchant: ${JSON.stringify(store)}, listings: structuredClone(globalThis.__alerts.storefront) }),
    };
    export const useAuth = () => ({ api, user: null, ready: true });`);
  const Watcher = (await import(await component("../components/NotificationWatcher.tsx", {
    "@/lib/api": api, "@/lib/auth": api,
    "@/lib/brand": data("export const money = n => '$' + n.toFixed(2);"),
    "@/lib/i18n": data("const t = (key, vars) => vars ? key + ' ' + JSON.stringify(vars) : key; export const useT = () => ({ t, lang: 'en' });"),
    "@/lib/merchant-content": data("export const merchantProductTitle = title => title;"),
    "@/lib/notifications": notifications, "@/lib/wishlist": wishlist,
    "@/lib/toast": data("export const toast = (text, tone, options) => globalThis.__alerts.toasts.push({ text, tone, title: options?.title });"),
  }))).default;
  const n = await import(notifications);
  const w = await import(wishlist);
  const ids = () => JSON.parse(dom.window.localStorage.getItem("grab-notifications:guest") ?? "[]").map((item) => item.id.replace(/:\d{4}-\d\d-\d\dT\d\d:\d\d$/, ""));
  // Each background round is started by the "wishlist changed" event, then allowed to finish.
  const round = async () => act(async () => {
    dom.window.dispatchEvent(new dom.window.Event(w.WISHLIST_CHANGED));
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

  globalThis.__alerts.offers = [product("a")];
  globalThis.__alerts.storefront = [product("a")];
  await act(async () => { root.render(createElement(Watcher)); await new Promise((resolve) => setTimeout(resolve, 20)); });
  assert.deepEqual(ids(), [], "the first visit remembers existing products without alerting");

  globalThis.__alerts.offers = [product("b", 4.5), product("a")];
  await round();
  assert.deepEqual(ids(), ["product:new:b"]);
  assert.equal(globalThis.__alerts.toasts.at(-1).text, "Dish b · $4.50");

  // Saving a product that is on sale just records it.
  await act(async () => { w.toggleWishlist(product("a")); await new Promise((resolve) => setTimeout(resolve, 20)); });
  assert.deepEqual(ids(), ["product:new:b"]);
  assert.equal(w.wishStatus().a.available, true);

  globalThis.__alerts.storefront = [];
  await round();
  assert.deepEqual(ids(), ["soldout:a", "product:new:b"]);
  assert.equal(globalThis.__alerts.toasts.at(-1).tone, "warning");

  globalThis.__alerts.storefront = [product("a")];
  await round();
  assert.deepEqual(ids().slice(0, 1), ["restock:a"]);

  globalThis.__alerts.storefront = [product("a", 2)];
  await round();
  assert.deepEqual(ids().slice(0, 1), ["pricedrop:a:2"]);
  await round();
  assert.equal(ids().filter((id) => id.startsWith("pricedrop")).length, 1, "the same price drop is only reported once");

  // "Notify me when it's back" on a sold-out product: alert when it is published again, and fill in its details.
  await act(async () => { w.watchForRestock("m1", "c"); await new Promise((resolve) => setTimeout(resolve, 20)); });
  assert.deepEqual(ids().slice(0, 1), ["pricedrop:a:2"], "watching a sold-out product does not alert");
  globalThis.__alerts.storefront = [product("a", 2), product("c")];
  await round();
  assert.deepEqual(ids().slice(0, 1), ["restock:c"]);
  assert.equal(w.wishlistItems().find((item) => item.listingId === "c").title, "Dish c");

  // Turned-off alerts stay quiet.
  n.setNotifyPref("newProducts", false);
  globalThis.__alerts.offers = [product("d"), ...globalThis.__alerts.offers];
  await round();
  assert.ok(!ids().includes("product:new:d"));
});
