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

test("top-up amounts: $1 to $500, whole cents only", async () => {
  const { isValidTopUpAmount } = await loadLib("payments", "local-store", "currency");
  for (const ok of [1, 1.1, 1.09, 4.1, 5, 10.5, 19.99, 500]) assert.equal(isValidTopUpAmount(ok), true, `${ok}`);
  for (const bad of [0, 0.99, -1, 500.01, NaN, Infinity, 1.005]) assert.equal(isValidTopUpAmount(bad), false, `${bad}`);
});

test("valid top-ups accept every whole-cent amount within the limits", async () => {
  const { isValidTopUpAmount } = await loadLib("payments", "local-store", "currency");
  for (let cents = 100; cents <= 50_000; cents++)
    assert.equal(isValidTopUpAmount(cents / 100), true, `${cents} cents`);
});

test("demo Bakong provider: pending -> paid, cancel, and refuses bad amounts", () => withBrowser(async () => {
  const { demoProvider, getPaymentProvider } = await loadLib("payments", "local-store", "currency");
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
  const { demoProvider } = await loadLib("payments", "local-store", "currency");
  const t = await demoProvider.create(10);
  // Pretend 11 minutes have passed by moving the saved expiry into the past.
  const saved = JSON.parse(window.localStorage.getItem("grab-demo-topups-v1"));
  saved.topups[t.id].expiresAt = new Date(Date.now() - 60_000).toISOString();
  window.localStorage.setItem("grab-demo-topups-v1", JSON.stringify(saved));
  const fresh = await loadLib("payments", "local-store", "currency"); // reload, like a page refresh
  assert.equal((await fresh.demoProvider.status(t.id)).status, "expired");
  assert.equal((await fresh.demoProvider.simulatePaid(t.id)).status, "expired");
}));

test("demo top-ups created at the same instant keep separate payment records", () => withBrowser(async () => {
  const originalNow = Date.now, originalRandom = Math.random;
  Date.now = () => 1_800_000_000_000;
  Math.random = () => 0.5;
  try {
    const { demoProvider } = await loadLib("payments", "local-store", "currency");
    const first = await demoProvider.create(1);
    const second = await demoProvider.create(5);
    assert.notEqual(first.id, second.id);
    assert.equal((await demoProvider.status(first.id)).amount, 1);
    assert.equal((await demoProvider.status(second.id)).amount, 5);
  } finally { Date.now = originalNow; Math.random = originalRandom; }
}));

test("corrupt demo payment caches recover and inherited object properties are never payments", () => withBrowser(async () => {
  for (const topups of [null, [], { broken: null }, { broken: { id: "broken", status: "pending" } }]) {
    window.localStorage.setItem("grab-demo-topups-v1", JSON.stringify({ topups }));
    const { demoProvider } = await loadLib("payments", "local-store", "currency");
    const created = await demoProvider.create(1.09);
    assert.equal((await demoProvider.status(created.id)).amount, 1.09);
    for (const id of ["toString", "constructor", "__proto__"])
      await assert.rejects(demoProvider.status(id), /Top-up not found/);
  }
}));

test("a paid top-up is added to the wallet exactly once", () => withBrowser(async () => {
  const { wallet, "local-store": local } = await loadLibGroup("wallet", "local-store", "pricing", "catalog", "brand", "hours");
  local.selectLocalAccount("user-1");
  const payment = { method: "Bakong KHQR", reference: "TU-ABC" };
  assert.equal(wallet.topUp("user-1", 1, payment), true);
  assert.equal(wallet.topUp("user-1", 1, payment), false); // seen again (e.g. two tabs polling)
  assert.equal(wallet.walletBalance("user-1"), 1);         // starts at $0, + $1 once
  assert.equal(wallet.topUp(null, 1, payment), false);     // guests still can't top up
}));
