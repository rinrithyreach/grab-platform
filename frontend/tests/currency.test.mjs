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

async function withBrowser(fn) {
  const previous = globalThis.window;
  globalThis.window = browser();
  try { await fn(); } finally { globalThis.window = previous; }
}

test("riel amounts use the backend's rate and round to the nearest 100 ៛", async () => {
  const { usdToKhr, riel, formatPaid, KHR_PER_USD, isCurrency } = await loadLib("currency");
  assert.equal(KHR_PER_USD, 4100, "must match Currencies.KhrPerUsd in the backend");
  // Same cases as the backend's Riel_amounts_round_to_the_nearest_100 test.
  for (const [usd, khr] of [[6, 24_600], [1.25, 5_100], [0.01, 0], [19.99, 82_000]]) assert.equal(usdToKhr(usd), khr, `$${usd}`);
  // Whole-cent maths: no float drift on amounts like $0.1 + $0.2.
  assert.equal(usdToKhr(0.1 + 0.2), 1_200);
  assert.equal(riel(2_050_000), "2,050,000៛");
  assert.equal(formatPaid(6, "KHR"), "24,600៛");
  assert.equal(formatPaid(6), "$6.00");
  assert.equal(formatPaid(6, "KHR", 4000), "24,000៛", "a saved order keeps its own rate");
  assert.ok(isCurrency("KHR") && isCurrency("USD") && !isCurrency("EUR"));
});

test("food orders remember the payment currency, and wallet orders are always USD", () => withBrowser(async () => {
  const { cart, wallet, "local-store": local } = await loadLibGroup("cart", "partner-cart", "wallet", "local-store", "pricing", "catalog", "brand", "hours");
  const { STORES } = await loadLib("catalog", "hours");
  const food = STORES.find((s) => s.kind === "food");
  const add = () => assert.equal(cart.addToCart(food.id, food.items[0].id, () => true), true);

  add();
  assert.equal(cart.placeOrder("House 12, Street 1", "Cash", "", null, "KHR").order.currency, "KHR");
  add();
  assert.equal(cart.placeOrder("House 12, Street 1", "Card", "").order.currency, "USD", "USD unless the customer picks riel");
  local.selectLocalAccount("user-1");
  add();
  wallet.topUp("user-1", 100);
  assert.equal(cart.placeOrder("House 12, Street 1", "Wallet", "", "user-1", "KHR").order.currency, "USD");
}));

test("KHQR top-ups can be paid in riel while the wallet is credited in dollars", () => withBrowser(async () => {
  const { demoProvider } = await loadLib("payments", "local-store", "currency");
  const usd = await demoProvider.create(20);
  assert.equal(usd.currency, "USD");
  assert.equal(usd.paidAmount, 20);
  const khr = await demoProvider.create(20, "KHR");
  assert.equal(khr.currency, "KHR");
  assert.equal(khr.amount, 20, "the wallet still receives $20");
  assert.equal(khr.paidAmount, 82_000);
  assert.match(khr.qr, /amount:82000KHR$/);
  await assert.rejects(demoProvider.create(20, "EUR"));
}));
