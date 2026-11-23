import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { act, createElement } from "react";
import { JSDOM } from "jsdom";
import ts from "typescript";
import { loadLibGroup, loadLib } from "./load-lib.mjs";

const require = createRequire(import.meta.url);
const data = source => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const react = pathToFileURL(require.resolve("react")).href;
let setupCount = 0;
async function setup(t, { service = "GrabExpress", user = null } = {}) {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost:3000/cart" });
  const previous = { window: globalThis.window, document: globalThis.document, IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT, __guestTest: globalThis.__guestTest };
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  const libs = await loadLibGroup("phone", "card", "guest-orders");
  const cart = { merchantId: "store", merchantName: "Express store", lines: [{ listingId: "item", title: "Product", price: 7, qty: 2, imageUrl: "" }] };
  const quote = { subtotal: 14, discount: 0, codeDiscount: 0, deliveryFee: 1.5, total: 15.5, promotionNames: [] };
  const calls = { guest: [], customer: [], quotes: [], navigation: [], cleared: 0 };
  const api = {
    merchantStorefront: async () => ({ merchant: { service, businessName: cart.merchantName }, listings: [] }),
    quoteGuestOrder: async () => { calls.quotes.push("guest"); return quote; },
    quoteOrder: async () => { calls.quotes.push("customer"); return quote; },
    placeGuestOrder: async body => { calls.guest.push(body); return { order: { id: "guest-order" }, accessToken: "A".repeat(64) }; },
    placeOrder: async body => { calls.customer.push(body); return { id: "customer-order" }; },
  };
  const tKey = key => key;
  globalThis.__guestTest = { libs, cart, api, user, calls, rules: [], t: tKey, pick: en => en };
  const stub = source => data(source + `\n// setup ${++setupCount}`);
  const imports = {
    react, "react/jsx-runtime": pathToFileURL(require.resolve("react/jsx-runtime")).href,
    "next/link": stub(`import {createElement} from '${react}'; export default ({children,...props}) => createElement('a',props,children);`),
    "next/navigation": stub('export const useRouter = () => ({ push: url => globalThis.__guestTest.calls.navigation.push(url) });'),
    "@/lib/api": stub('export class ApiError extends Error {}'),
    "@/lib/auth": stub('export const useAuth = () => ({api:globalThis.__guestTest.api,user:globalThis.__guestTest.user,ready:true}); export const errorMessage = e => e.message;'),
    "@/lib/brand": stub('export const money = n => `$${n.toFixed(2)}`;'),
    "@/lib/cart": stub('export const isValidAddress = v => v.length >= 5 && /[a-z]/i.test(v) && /[0-9]/.test(v);'),
    "@/lib/i18n": stub('export const useT = () => ({t:globalThis.__guestTest.t,pick:globalThis.__guestTest.pick,lang:"en"});'),
    "@/lib/merchant-content": stub('export const merchantProductTitle = title => title;'),
    "@/lib/partner-cart": stub('export const usePartnerCart=()=>globalThis.__guestTest.cart; export const partnerTotals=()=>({count:2,subtotal:14,deliveryFee:1.5,total:15.5}); export const clearSubmittedPartnerCart=()=>globalThis.__guestTest.calls.cleared++; export const clearPartnerCart=()=>{}; export const refreshPartnerCart=()=>false; export const setPartnerQty=()=>{}; export const MAX_PARTNER_QTY=50;'),
    "@/lib/promotions": stub('export const usePromotions=()=>globalThis.__guestTest.rules;'),
    "@/lib/toast": stub('export const toast=()=>{};'),
    "@/lib/notifications": stub('export const notify=()=>true;'),
    "@/lib/currency": stub('export const formatPaid = (usd, currency = "USD") => currency === "KHR" ? Math.round(usd * 41) * 100 + "៛" : "$" + usd.toFixed(2);'),
    "./CurrencyPicker": stub('export default ()=>null;'),
    "@/lib/phone": stub('export const normalizePhoneNumber=v=>globalThis.__guestTest.libs.phone.normalizePhoneNumber(v);'),
    "@/lib/card": stub('export const {CARD_FIELDS,EMPTY_CARD,validateCard}=globalThis.__guestTest.libs.card;'),
    "@/lib/guest-orders": stub('export const rememberGuestOrder=(...args)=>globalThis.__guestTest.libs["guest-orders"].rememberGuestOrder(...args);'),
    "./BackButton": stub('export default ()=>null;'),
    "./LoginRequired": stub(`import {createElement} from '${react}'; export default ()=>createElement('p',{'data-login-required':true},'Sign in');`),
    "./DeliveryAddressField": stub(`import {createElement} from '${react}'; export default ({id,value,onChange})=>createElement('input',{id,value,onChange:e=>onChange(e.target.value)});`),
    "./CardPaymentFields": stub('export default ()=>null;'),
  };
  let source = ts.transpileModule(await readFile(new URL("../components/PartnerCheckout.tsx", import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  for (const [name, url] of Object.entries(imports)) source = source.replaceAll(`"${name}"`, JSON.stringify(url));
  const Checkout = (await import(data(source))).default;
  const { createRoot } = await import("react-dom/client"); const root = createRoot(document.getElementById("root"));
  t.after(async () => { await act(async () => root.unmount()); Object.assign(globalThis, previous); dom.window.close(); });
  await act(async () => root.render(createElement(Checkout)));
  await act(async () => new Promise(resolve => setTimeout(resolve, 20)));
  await act(async () => new Promise(resolve => setTimeout(resolve, 180)));
  const input = async (id, value) => {
    const el = document.getElementById(id);
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(el, value);
      el.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });
  };
  const submit = async () => act(async () => document.querySelector("form").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })));
  return { calls, libs, input, submit };
}

test("GrabExpress guests must supply recipient, callable phone and address before creating a saved order", async t => {
  const { calls, libs, input, submit } = await setup(t);
  assert.ok(document.getElementById("partner-contact-name"));
  assert.equal(document.querySelector("[data-login-required]"), null);
  assert.deepEqual(calls.quotes, ["guest"]);
  await submit();
  assert.equal(document.activeElement.id, "partner-contact-name");
  assert.equal(calls.guest.length, 0);
  await input("partner-contact-name", "  Sok Dara  ");
  await input("partner-contact-phone", "invalid");
  await submit();
  assert.equal(document.activeElement.id, "partner-contact-phone");
  await input("partner-contact-phone", "012 345 678");
  await submit();
  assert.equal(document.activeElement.id, "partner-address");
  assert.equal(calls.guest.length, 0);
  await input("partner-address", "House 12, Street 271");
  await input("partner-note", "Call on arrival");
  await submit();
  assert.equal(calls.guest.length, 1);
  assert.deepEqual(calls.guest[0], { contactName: "Sok Dara", contactPhone: "+85512345678", order: {
    merchantId: "store", paymentMethod: "Cash", deliveryAddress: "House 12, Street 271", note: "Call on arrival",
    expectedTotal: 15.5, currency: "USD", promoCode: undefined, items: [{ listingId: "item", quantity: 2 }],
  } });
  assert.equal(calls.customer.length, 0); assert.equal(calls.cleared, 1);
  assert.deepEqual(calls.navigation, ["/orders?guest=guest-order"]);
  assert.equal(libs["guest-orders"].guestOrderToken("guest-order"), "A".repeat(64));
});

test("GrabFood guest checkout still requires sign-in", async t => {
  const { calls, submit } = await setup(t, { service: "GrabFood" });
  assert.ok(document.querySelector("[data-login-required]"));
  assert.equal(document.getElementById("partner-contact-name"), null);
  await submit();
  assert.equal(calls.guest.length, 0); assert.equal(calls.customer.length, 0); assert.equal(calls.quotes.length, 0);
});

test("signed-in customers continue through their account checkout", async t => {
  const { calls, input, submit } = await setup(t, { user: { id: "customer", role: "Customer" } });
  assert.equal(document.getElementById("partner-contact-name"), null);
  assert.ok(calls.quotes.every(x => x === "customer"));
  await input("partner-address", "House 12, Street 271");
  await submit();
  assert.equal(calls.guest.length, 0); assert.equal(calls.customer.length, 1);
  assert.deepEqual(calls.navigation, ["/orders?partner=customer-order"]);
});

test("guest receipt credentials survive refresh without persisting contact details, including storage failures", async () => {
  const previous = globalThis.window;
  const saved = new Map();
  globalThis.window = { sessionStorage: { getItem: k => saved.get(k) ?? null, setItem: (k, v) => saved.set(k, v) } };
  try {
    const first = await loadLib("guest-orders");
    first.rememberGuestOrder("receipt", "B".repeat(64));
    const refreshed = await loadLib("guest-orders");
    assert.equal(refreshed.guestOrderToken("receipt"), "B".repeat(64));
    assert.deepEqual(Object.keys(JSON.parse([...saved.values()][0])[0]).sort(), ["accessToken", "id"]);
    assert.equal(refreshed.guestOrderToken("someone-else"), null);
    globalThis.window.sessionStorage = { getItem: () => null, setItem: () => { throw new Error("Quota exceeded"); } };
    refreshed.rememberGuestOrder("memory", "C".repeat(64));
    assert.equal(refreshed.guestOrderToken("memory"), "C".repeat(64));
  } finally { globalThis.window = previous; }
});
