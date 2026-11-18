import assert from "node:assert/strict";
import test from "node:test";
import { loadLib, loadLibGroup } from "./load-lib.mjs";

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
const shopLibs = ["cart", "partner-cart", "wallet", "local-store", "pricing", "catalog", "brand", "hours"];

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
    assert.equal(reloaded.reorder(placed.order, () => true), "ok");
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
    for (const amount of [-5, 0, NaN, Infinity, 1e308, 0.001]) {
      wallet.topUp(amount);
      assert.equal(wallet.payFromWallet(amount, "Invalid"), false);
    }
    assert.equal(wallet.walletBalance(), 20);
    const cart = await loadLib(...shopLibs);
    assert.equal(cart.addToCart("unknown", "unknown", () => true), false);
    for (const qty of [-1, 0, NaN, 0.5]) assert.equal(cart.addToCart("golden-noodle", "beef-noodle", () => true, [], qty), false);
  } finally { globalThis.window = previous; }
});

test("malformed saved profile, review and wallet entries recover without breaking account screens", async () => {
  const previous = globalThis.window;
  globalThis.window = browser();
  try {
    window.localStorage.setItem("grab-profile-v1", JSON.stringify({ addresses: [null] }));
    const profile = await loadLib("profile", "local-store");
    profile.saveAddress("home", "House 12, Street 271");
    assert.deepEqual(JSON.parse(window.localStorage.getItem("grab-profile-v1")).addresses,
      [{ label: "home", text: "House 12, Street 271" }]);

    window.localStorage.setItem("grab-wallet-v1", JSON.stringify({ balance: 20, txns: [null] }));
    const wallet = await loadLib("wallet", "local-store", "pricing", "catalog", "brand", "hours");
    wallet.topUp(1);
    const saved = JSON.parse(window.localStorage.getItem("grab-wallet-v1"));
    assert.equal(saved.balance, 21);
    assert.ok(saved.txns.every((txn) => txn && typeof txn.description === "string"));

    window.localStorage.setItem("grab-reviews-v1", JSON.stringify({ reviews: [null] }));
    const reviews = await loadLib("reviews", "local-store", "catalog", "hours");
    reviews.addReview({ storeId: "rice-bowl", name: "Test", comment: "Good", rating: 5 });
    assert.equal(JSON.parse(window.localStorage.getItem("grab-reviews-v1")).reviews.length, 1);
  } finally { globalThis.window = previous; }
});

test("a completed checkout preserves subsequent cart edits and rejects infinite prices", async () => {
  const previous = globalThis.window;
  globalThis.window = browser();
  try {
    const { "partner-cart": cart } = await loadLibGroup("partner-cart", "local-store", "brand");
    const offer = { id: "listing", title: "Lunch", price: 4.5, imageUrl: "", merchant: { id: "merchant", businessName: "Lunch shop" } };
    assert.equal(cart.putPartnerItem({ ...offer, price: Infinity }), false);
    cart.putPartnerItem(offer);
    const submitted = cart.partnerCart();
    cart.setPartnerQty(offer.id, 2);
    cart.clearSubmittedPartnerCart(submitted);
    assert.equal(cart.partnerCart().lines[0].qty, 2);
    cart.clearSubmittedPartnerCart(cart.partnerCart());
    assert.equal(cart.partnerCart().lines.length, 0);
    cart.putPartnerItem(offer);
    cart.putPartnerItem({ ...offer, merchant: { id: "another", businessName: "Other shop" } });
    assert.equal(cart.refreshPartnerCart("merchant", "", []), 0);
    assert.equal(cart.partnerCart().merchantId, "another");
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

test("partner products share the one-store cart rule with food, respect limits and follow the live storefront", async () => {
  const previous = globalThis.window;
  globalThis.window = browser();
  try {
    const cart = await loadLib(...shopLibs);
    const partner = await loadLib("partner-cart", "local-store", "brand");
    const { STORES } = await loadLib("catalog", "hours");
    const food = STORES.find((s) => s.kind === "food");
    const offer = (id, merchant = "m1", price = 2.5) => ({ id, title: `Item ${id}`, price, imageUrl: "", merchant: { id: merchant, businessName: `Shop ${merchant}` } });
    const saved = () => JSON.parse(window.localStorage.getItem("grab-partner-cart-v1") ?? "null");

    // Food in the cart: adding a partner product asks first and keeps food when declined.
    assert.equal(cart.addToCart(food.id, food.items[0].id, () => true), true);
    let asked = "";
    assert.equal(cart.addPartnerItem(offer("a"), (name) => { asked = name; return false; }), "declined");
    assert.equal(asked, food.name);
    assert.equal(JSON.parse(window.localStorage.getItem("grab-shop-v1")).cart.lines.length, 1);
    assert.equal(cart.addPartnerItem(offer("a"), () => true), "ok");
    assert.equal(JSON.parse(window.localStorage.getItem("grab-shop-v1")).cart.lines.length, 0);
    assert.equal(cart.addPartnerItem(offer("a"), () => { throw new Error("same store must not ask"); }, 2), "ok");
    assert.equal(saved().lines[0].qty, 3);

    // Quantity cap matches the API (50).
    assert.equal(cart.addPartnerItem(offer("a"), () => true, 48), "limit");
    assert.equal(saved().lines[0].qty, 3);

    // Another merchant replaces the cart only after confirming; food asks about the partner store.
    assert.equal(cart.addPartnerItem(offer("x", "m2"), () => false), "declined");
    assert.equal(cart.addToCart(food.id, food.items[0].id, (name) => { asked = name; return false; }), false);
    assert.equal(asked, "Shop m1");
    assert.equal(cart.addPartnerItem(offer("b"), () => true), "ok");

    // Live storefront: new prices apply and unpublished products are removed.
    assert.equal(partner.refreshPartnerCart("m1", "Shop m1", [{ id: "a", title: "Renamed", price: 4, imageUrl: "/img" }]), 1);
    assert.deepEqual(saved().lines.map((l) => [l.listingId, l.title, l.price, l.qty]), [["a", "Renamed", 4, 3]]);
    assert.deepEqual(partner.partnerTotals(saved()), { count: 3, subtotal: 12, deliveryFee: 1.5, total: 13.5 });
    partner.setPartnerQty("a", 0);
    assert.deepEqual(saved(), { merchantId: null, merchantName: "", lines: [] });
  } finally { globalThis.window = previous; }
});

test("order again never empties the current cart when the old dishes are no longer sold", async () => {
  const previous = globalThis.window;
  globalThis.window = browser();
  try {
    const cart = await loadLib(...shopLibs);
    const { STORES } = await loadLib("catalog", "hours");
    const food = STORES.find((s) => s.kind === "food");
    assert.equal(cart.addToCart(food.id, food.items[0].id, () => true), true);
    const gone = { id: "ORD-old", storeId: food.id, storeName: food.name, lines: [{ itemId: "discontinued", name: "Old dish", price: 1, qty: 1 }] };
    assert.equal(cart.reorder(gone, () => { throw new Error("must not ask"); }), "unavailable");
    assert.equal(JSON.parse(window.localStorage.getItem("grab-shop-v1")).cart.lines.length, 1);
  } finally { globalThis.window = previous; }
});
