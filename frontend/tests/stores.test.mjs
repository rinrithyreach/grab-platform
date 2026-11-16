import assert from "node:assert/strict";
import test from "node:test";
import { loadLib } from "./load-lib.mjs";

function browser() {
  const values = new Map();
  const target = new EventTarget();
  target.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  return target;
}
const shopLibs = ["cart", "wallet", "local-store", "pricing", "catalog", "brand", "hours"];

test("food checkout charges the discounted wallet total once, persists history and can reorder", async () => {
  const previous = globalThis.window;
  globalThis.window = browser();
  try {
    const cart = await loadLib(...shopLibs);
    const { STORES } = await loadLib("catalog", "hours");
    const food = STORES.find((s) => s.kind === "food");
    const another = STORES.find((s) => s.kind === "food" && s.id !== food.id);
    assert.equal(cart.addToCart(food.id, food.items[0].id, () => true), true);
    assert.equal(cart.addToCart(another.id, another.items[0].id, () => false), false);
    assert.equal(cart.applyPromoCode("WELCOME10"), "ok");
    const placed = cart.placeOrder("House 12, Street 1", "Wallet", "Test order");
    assert.ok(placed.order);
    assert.equal(placed.order.storeId, food.id);
    assert.equal(JSON.parse(window.localStorage.getItem("grab-wallet-v1")).balance, Math.round((20 - placed.order.total) * 100) / 100);
    const walletAfter = window.localStorage.getItem("grab-wallet-v1");
    assert.deepEqual(cart.placeOrder("House 12, Street 1", "Wallet", ""), { error: "empty" });
    assert.equal(window.localStorage.getItem("grab-wallet-v1"), walletAfter);
    const reloaded = await loadLib(...shopLibs);
    assert.equal(reloaded.reorder(placed.order, () => true), true);
    const state = JSON.parse(window.localStorage.getItem("grab-shop-v1"));
    assert.equal(state.orders.length, 1);
    assert.equal(state.cart.lines.length, 1);
  } finally { globalThis.window = previous; }
});

test("wallet rejects invalid amounts and cart rejects invalid quantities", async () => {
  const previous = globalThis.window;
  globalThis.window = browser();
  try {
    const wallet = await loadLib("wallet", "local-store", "pricing", "catalog", "brand", "hours");
    for (const amount of [-5, 0, NaN, Infinity]) {
      wallet.topUp(amount);
      assert.equal(wallet.payFromWallet(amount, "Invalid"), false);
    }
    assert.equal(wallet.walletBalance(), 20);
    const cart = await loadLib(...shopLibs);
    assert.equal(cart.addToCart("unknown", "unknown", () => true), false);
    for (const qty of [-1, 0, NaN, 0.5]) assert.equal(cart.addToCart("golden-noodle", "beef-noodle", () => true, [], qty), false);
  } finally { globalThis.window = previous; }
});

test("saved stores recover from corrupt shape and synchronize changes from another tab", async () => {
  const previous = globalThis.window;
  globalThis.window = browser();
  try {
    const { createLocalStore } = await loadLib("local-store");
    window.localStorage.setItem("example", '{"items":null}');
    const store = createLocalStore("example", { items: [] });
    assert.deepEqual(store.get(), { items: [] });
    let notifications = 0;
    const unsubscribe = store.subscribe(() => notifications++);
    window.dispatchEvent(Object.assign(new Event("storage"), { key: "example", newValue: '{"items":["saved elsewhere"]}' }));
    assert.deepEqual(store.get(), { items: ["saved elsewhere"] });
    window.dispatchEvent(Object.assign(new Event("storage"), { key: "example", newValue: null }));
    assert.deepEqual(store.get(), { items: [] });
    assert.equal(notifications, 2);
    unsubscribe();
  } finally { globalThis.window = previous; }
});

test("Express bookings persist independently from food orders and cancellation survives refresh", async () => {
  const previous = globalThis.window;
  globalThis.window = browser();
  const libs = ["express", "express-pricing", "local-store", "places", "pricing", "catalog", "brand", "hours"];
  try {
    const express = await loadLib(...libs);
    const request = {
      senderName: "Test Sender", senderPhone: "012345678", pickupAddress: "House 12, Street 1", pickupPlace: 0,
      recipientName: "Test Recipient", recipientPhone: "012345679", dropoffAddress: "House 34, Street 2", dropoffPlace: 1,
      parcelSize: "small", weightKg: 1, description: "Books", note: "",
    };
    const result = express.bookDelivery(request);
    assert.ok(result.delivery.id.startsWith("EXP-"));
    assert.equal(window.localStorage.getItem("grab-shop-v1"), null);
    const reloaded = await loadLib(...libs);
    assert.equal(reloaded.cancelDelivery(result.delivery.id), true);
    assert.ok(JSON.parse(window.localStorage.getItem("grab-express-demo-v1")).deliveries[0].cancelledAt);
    assert.equal(reloaded.cancelDelivery(result.delivery.id), false);
  } finally { globalThis.window = previous; }
});
