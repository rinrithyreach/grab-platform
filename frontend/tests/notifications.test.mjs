import assert from "node:assert/strict";
import test from "node:test";
import { loadLib } from "./load-lib.mjs";

function browser() {
  const values = new Map();
  const target = new EventTarget();
  target.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
  return target;
}

async function withBrowser(fn) {
  const previous = { window: globalThis.window, document: globalThis.document };
  globalThis.window = browser();
  globalThis.document = { visibilityState: "visible" };
  try { await fn(globalThis.window); } finally { Object.assign(globalThis, previous); }
}

test("notifications are kept per account, newest first, and the same id is only added once", () => withBrowser(async (window) => {
  const n = await loadLib("notifications");
  n.selectNotificationOwner("user-1");
  assert.equal(n.notify({ id: "order:1:Accepted", kind: "order", title: "Order update", body: "Accepted", href: "/orders" }), true);
  assert.equal(n.notify({ id: "order:1:Accepted", kind: "order", title: "Order update", body: "Accepted" }), false, "a second tab noticing the same change adds nothing");
  n.notify({ id: "ride:9:Completed", kind: "ride", title: "Ride update", body: "Completed" });
  const saved = JSON.parse(window.localStorage.getItem("grab-notifications:user-1"));
  assert.deepEqual(saved.map((item) => item.id), ["ride:9:Completed", "order:1:Accepted"]);
  assert.ok(saved.every((item) => item.read === false));

  // Another account (and guests) start with their own empty inbox.
  n.selectNotificationOwner("user-2");
  assert.equal(window.localStorage.getItem("grab-notifications:user-2"), null);
  n.notify({ id: "wallet:1", kind: "wallet", title: "Wallet", body: "Added $5.00" });
  n.selectNotificationOwner("user-1");
  n.markNotificationRead("order:1:Accepted");
  let items = JSON.parse(window.localStorage.getItem("grab-notifications:user-1"));
  assert.deepEqual(items.map((item) => item.read), [false, true]);
  n.markAllNotificationsRead();
  items = JSON.parse(window.localStorage.getItem("grab-notifications:user-1"));
  assert.ok(items.every((item) => item.read));
  n.removeNotification("ride:9:Completed");
  assert.deepEqual(JSON.parse(window.localStorage.getItem("grab-notifications:user-1")).map((item) => item.id), ["order:1:Accepted"]);
  n.clearNotifications();
  assert.deepEqual(JSON.parse(window.localStorage.getItem("grab-notifications:user-1")), []);
  assert.equal(JSON.parse(window.localStorage.getItem("grab-notifications:user-2")).length, 1, "clearing one inbox leaves the other account's alone");
}));

test("the inbox keeps the newest 50 and ignores corrupt or unsafe saved entries", () => withBrowser(async (window) => {
  window.localStorage.setItem("grab-notifications:user-1", JSON.stringify([
    { id: "ok", kind: "order", title: "T", body: "B", createdAt: 1, read: false, href: "/orders" },
    { id: "offsite", kind: "order", title: "T", body: "B", createdAt: 1, read: false, href: "https://example.com" },
    { id: "bad-kind", kind: "nope", title: "T", body: "B", createdAt: 1, read: false },
    "junk",
  ]));
  const n = await loadLib("notifications");
  n.selectNotificationOwner("user-1");
  n.markAllNotificationsRead();
  assert.deepEqual(JSON.parse(window.localStorage.getItem("grab-notifications:user-1")).map((item) => item.id), ["ok"]);
  for (let i = 0; i < 60; i++) n.notify({ id: `n${i}`, kind: "system", title: "T", body: String(i) });
  const items = JSON.parse(window.localStorage.getItem("grab-notifications:user-1"));
  assert.equal(items.length, 50);
  assert.equal(items[0].id, "n59");

  window.localStorage.setItem("grab-notifications:user-3", "{not json");
  n.selectNotificationOwner("user-3");
  assert.equal(n.notify({ id: "fresh", kind: "system", title: "T", body: "B" }), true);
}));

test("toasts stack at most four, replace by key, pause while hovered and leave on their own unless pinned", async () => {
  const toasts = await loadLib("toast");
  const texts = () => toasts.currentToasts().map((item) => item.text);
  for (const i of [1, 2, 3, 4, 5]) toasts.toast(`Toast ${i}`, "info", { duration: 40 });
  assert.deepEqual(texts(), ["Toast 2", "Toast 3", "Toast 4", "Toast 5"], "the oldest leaves when a fifth arrives");
  toasts.dismissAllToasts();

  const first = toasts.toast("Added to cart", "success", { duration: 40 });
  assert.equal(toasts.toast("Added to cart", "success", { duration: 40 }), first, "the same message isn't shown twice");
  toasts.toast("Added to cart", "error", { duration: 40 });
  assert.deepEqual(texts(), ["Added to cart", "Added to cart"], "a different tone is a different message");
  toasts.dismissAllToasts();

  const offline = toasts.toast("Offline", "warning", { key: "network", duration: 0 });
  toasts.toast("Saved");
  const online = toasts.toast("Online", "success", { key: "network", duration: 40 });
  assert.notEqual(offline, online);
  assert.deepEqual(texts(), ["Saved", "Online"], "a keyed toast replaces its earlier copy instead of stacking");
  assert.equal(toasts.currentToasts()[0].duration, 3200, "success toasts use the default duration");

  toasts.pauseToast(online);
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.ok(texts().includes("Online"), "a hovered toast stays past its duration");
  toasts.resumeToast(online);
  await new Promise((resolve) => setTimeout(resolve, 900));
  assert.ok(!texts().includes("Online"), "it leaves after resuming");

  const pinned = toasts.toast("Session expired", "warning", { duration: 0 });
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.ok(texts().includes("Session expired"), "duration 0 stays until dismissed");
  toasts.dismissToast(pinned);
  assert.ok(!texts().includes("Session expired"));
  toasts.dismissAllToasts();
});

test("the cart-replace helper only asks when the cart helpers would ask, and changes nothing when declined", async () => {
  const { withReplaceConfirm } = await loadLib("dialog");
  const cart = { store: "A" };
  const add = (store) => (confirmReplace) => {
    if (cart.store !== store && !confirmReplace(cart.store)) return false;
    cart.store = store;
    return true;
  };
  const questions = [];
  // Same store: no question.
  assert.equal(await withReplaceConfirm(add("A"), async (name) => { questions.push(name); return true; }), true);
  assert.deepEqual(questions, []);
  // Different store, declined: asked once about the current store; cart untouched.
  assert.equal(await withReplaceConfirm(add("B"), async (name) => { questions.push(name); return false; }), false);
  assert.deepEqual(questions, ["A"]);
  assert.equal(cart.store, "A");
  // Accepted: replaced.
  assert.equal(await withReplaceConfirm(add("B"), async (name) => { questions.push(name); return true; }), true);
  assert.deepEqual(questions, ["A", "A"]);
  assert.equal(cart.store, "B");
});

test("confirm dialogs queue one at a time and resolve with the answer", () => withBrowser(async () => {
  const dialog = await loadLib("dialog");
  assert.equal(dialog.currentConfirm(), null);
  const first = dialog.confirmDialog({ title: "First?" });
  const second = dialog.confirmDialog({ title: "Second?", tone: "danger" });
  const shown = dialog.currentConfirm();
  assert.equal(shown.title, "First?", "only the first question is on screen");
  dialog.settleConfirm(shown.id, true);
  const next = dialog.currentConfirm();
  assert.equal(next.title, "Second?");
  dialog.settleConfirm(next.id, false);
  dialog.settleConfirm(next.id, true); // already answered: ignored
  assert.equal(await first, true);
  assert.equal(await second, false);
  assert.equal(dialog.currentConfirm(), null);
}));
