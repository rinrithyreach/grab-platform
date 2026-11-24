import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import ts from "typescript";
import { loadLibGroup } from "./load-lib.mjs";

const require = createRequire(import.meta.url);
const data = source => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const react = pathToFileURL(require.resolve("react")).href;
let instance = 0;

async function setup(t) {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost:3000/wallet" });
  const previous = { window: globalThis.window, document: globalThis.document,
    IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT, __topupTest: globalThis.__topupTest };
  const originalInterval = globalThis.setInterval, originalClear = globalThis.clearInterval;
  const polls = new Map();
  globalThis.setInterval = (fn, ms, ...args) => {
    if (ms !== 2000) return originalInterval(fn, ms, ...args);
    const id = {}; polls.set(id, fn); return id;
  };
  globalThis.clearInterval = id => { if (!polls.delete(id)) originalClear(id); };
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  const { wallet, "local-store": local } = await loadLibGroup("wallet", "local-store", "pricing", "catalog", "brand", "hours");
  local.selectLocalAccount("alice");
  const pending = { id: "topup-1", amount: 5, currency: "USD", qr: "DEMO-ONLY", status: "pending",
    expiresAt: new Date(Date.now() + 60000).toISOString() };
  const state = {
    owner: "alice", wallet, local, closes: 0, toasts: [], notifications: [],
    provider: { kind: "demo", create: async () => pending, status: async () => pending,
      cancel: async () => ({ ...pending, status: "cancelled" }),
      simulatePaid: async () => ({ ...pending, status: "paid" }) },
  };
  globalThis.__topupTest = state;
  const stub = source => data(source + `\n// instance ${++instance}`);
  const imports = {
    react, "react/jsx-runtime": pathToFileURL(require.resolve("react/jsx-runtime")).href,
    qrcode: stub('export default {toDataURL: async () => "data:image/png;base64,cXI="};'),
    "@/lib/auth": stub('const api = {getSession: () => ({user:{id:globalThis.__topupTest.owner}})}; export const useAuth = () => ({api,user:{id:globalThis.__topupTest.owner}});'),
    "@/lib/brand": stub('export const money = n => "$" + n.toFixed(2);'),
    "@/lib/i18n": stub('export const useT = () => ({t:key=>key});'),
    "@/lib/payments": stub('export const getPaymentProvider = () => globalThis.__topupTest.provider;'),
    "@/lib/toast": stub('export const toast = text => globalThis.__topupTest.toasts.push(text);'),
    "@/lib/notifications": stub('export const notify = notification => globalThis.__topupTest.notifications.push(notification);'),
    "@/lib/wallet": stub('export const topUp = (...args) => globalThis.__topupTest.wallet.topUp(...args);'),
    "@/lib/currency": stub('export const formatPaid = n => "$"+n; export const riel = n => ""+n; export const usdToKhr = n => n*4100;'),
    "./CurrencyPicker": stub('export default () => null;'),
  };
  let source = ts.transpileModule(await readFile(new URL("../components/TopUpDialog.tsx", import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  for (const [name, url] of Object.entries(imports)) source = source.replaceAll(`from "${name}"`, `from "${url}"`);
  const Dialog = (await import(data(source))).default;
  const root = createRoot(document.getElementById("root"));
  let mounted = true;
  const unmount = async () => { if (mounted) { await act(async () => root.unmount()); mounted = false; } };
  t.after(async () => {
    await unmount(); dom.window.close();
    globalThis.setInterval = originalInterval; globalThis.clearInterval = originalClear;
    Object.assign(globalThis, previous);
  });
  await act(async () => root.render(h(Dialog, { amount: 5, onClose: () => { state.closes++; } })));
  const click = async key => act(async () => {
    const button = [...document.querySelectorAll("button")].find(x => x.textContent.includes(key));
    assert.ok(button, key); button.click();
  });
  await click("topup.continue");
  return { ...state, state, pending, click, unmount, poll: async () => act(async () => { for (const fn of polls.values()) fn(); }) };
}

test("paid top-ups settle once and ignore an older pending poll response", async t => {
  const app = await setup(t);
  let finishPoll;
  app.state.provider.status = () => new Promise(resolve => { finishPoll = resolve; });
  await app.poll();
  await app.click("topup.simulate");
  assert.equal(app.wallet.walletBalance("alice"), 5);
  await act(async () => finishPoll(app.pending));
  assert.ok(document.body.textContent.includes("topup.success"));
  assert.equal(app.state.toasts.length, 1);
  assert.equal(app.state.notifications.length, 1);
  assert.equal(app.local.getAccountCache().data["grab-wallet-v1"].txns.length, 1);
});

test("payment callbacks after account switching or closing the dialog have no effects", async t => {
  const app = await setup(t);
  let finish;
  app.state.provider.simulatePaid = () => new Promise(resolve => { finish = resolve; });
  await app.click("topup.simulate");
  app.state.owner = "bob"; app.local.selectLocalAccount("bob");
  await act(async () => finish({ ...app.pending, status: "paid" }));
  assert.equal(app.wallet.walletBalance("bob"), 0);
  assert.equal(app.state.toasts.length, 0);
  app.state.owner = "alice"; app.local.selectLocalAccount("alice");
  await app.click("topup.simulate");
  await app.unmount();
  await act(async () => finish({ ...app.pending, status: "paid" }));
  assert.equal(app.wallet.walletBalance("alice"), 0);
  assert.equal(app.state.notifications.length, 0);
});

test("closing a top-up that was already paid credits it before closing", async t => {
  const app = await setup(t);
  app.state.provider.cancel = async () => ({ ...app.pending, status: "paid" });
  await app.click("topup.cancel");
  assert.equal(app.wallet.walletBalance("alice"), 5);
  assert.equal(app.state.closes, 1);
});

test("simulation errors show a retry state", async t => {
  const app = await setup(t);
  app.state.provider.simulatePaid = async () => { throw new Error("Payment temporarily unavailable"); };
  await app.click("topup.simulate");
  assert.ok(document.body.textContent.includes("Payment temporarily unavailable"));
  assert.ok(document.body.textContent.includes("errorPage.retry"));
  assert.equal(app.wallet.walletBalance("alice"), 0);
});

test("a delayed simulation error cannot replace a confirmed payment", async t => {
  const app = await setup(t);
  let failSimulation;
  app.state.provider.simulatePaid = () => new Promise((_, reject) => { failSimulation = reject; });
  await app.click("topup.simulate");
  app.state.provider.status = async () => ({ ...app.pending, status: "paid" });
  await app.poll();
  await act(async () => failSimulation(new Error("Old payment error")));
  assert.ok(document.body.textContent.includes("topup.success"));
  assert.ok(!document.body.textContent.includes("Old payment error"));
  assert.equal(app.wallet.walletBalance("alice"), 5);
  assert.equal(app.state.toasts.length, 1);
});
