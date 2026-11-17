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

async function withBrowser(fn) {
  const previous = globalThis.window;
  globalThis.window = browser();
  try { await fn(); } finally { globalThis.window = previous; }
}

test("top-up amounts: $1 to $500, whole cents only", async () => {
  const { isValidTopUpAmount } = await loadLib("payments", "local-store");
  for (const ok of [1, 5, 10.5, 500]) assert.equal(isValidTopUpAmount(ok), true, `${ok}`);
  for (const bad of [0, 0.99, -1, 500.01, NaN, Infinity, 1.005]) assert.equal(isValidTopUpAmount(bad), false, `${bad}`);
});

test("demo Bakong provider: pending -> paid, cancel, and refuses bad amounts", () => withBrowser(async () => {
  const { demoProvider, getPaymentProvider } = await loadLib("payments", "local-store");
  assert.equal(getPaymentProvider({}).kind, "demo"); // default when NEXT_PUBLIC_PAYMENT_PROVIDER isn't "api"

  const t = await demoProvider.create(1);
  assert.equal(t.status, "pending");
  assert.equal(t.amount, 1);
  assert.equal(t.method, "bakong_khqr");
  assert.match(t.qr, /^DEMO-ONLY\|/); // never a real, payable KHQR
  assert.ok(Date.parse(t.expiresAt) > Date.now());

  assert.equal((await demoProvider.simulatePaid(t.id)).status, "paid");
  assert.equal((await demoProvider.status(t.id)).status, "paid");     // survives a re-read
  assert.equal((await demoProvider.cancel(t.id)).status, "paid");     // can't cancel after paying

  const t2 = await demoProvider.create(5);
  assert.equal((await demoProvider.cancel(t2.id)).status, "cancelled");
  assert.equal((await demoProvider.simulatePaid(t2.id)).status, "cancelled"); // can't pay a cancelled one

  await assert.rejects(demoProvider.create(0));
  await assert.rejects(demoProvider.create(1000));
  await assert.rejects(demoProvider.status("TU-NOPE"));
}));

test("demo QR codes expire after their time runs out", () => withBrowser(async () => {
  const { demoProvider } = await loadLib("payments", "local-store");
  const t = await demoProvider.create(10);
  // Pretend 11 minutes have passed by moving the saved expiry into the past.
  const saved = JSON.parse(window.localStorage.getItem("grab-demo-topups-v1"));
  saved.topups[t.id].expiresAt = new Date(Date.now() - 60_000).toISOString();
  window.localStorage.setItem("grab-demo-topups-v1", JSON.stringify(saved));
  const fresh = await loadLib("payments", "local-store"); // reload, like a page refresh
  assert.equal((await fresh.demoProvider.status(t.id)).status, "expired");
  assert.equal((await fresh.demoProvider.simulatePaid(t.id)).status, "expired");
}));

test("a paid top-up is added to the wallet exactly once", () => withBrowser(async () => {
  const wallet = await loadLib("wallet", "local-store", "pricing", "catalog", "brand", "hours");
  const payment = { method: "Bakong KHQR", reference: "TU-ABC" };
  assert.equal(wallet.topUp("user-1", 1, payment), true);
  assert.equal(wallet.topUp("user-1", 1, payment), false); // seen again (e.g. two tabs polling)
  assert.equal(wallet.walletBalance("user-1"), 21);        // $20 welcome + $1
  assert.equal(wallet.topUp(null, 1, payment), false);     // guests still can't top up
}));
