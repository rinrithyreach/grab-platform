import assert from "node:assert/strict";
import test from "node:test";
import { loadLibGroup } from "./load-lib.mjs";

function browser() {
  const target = new EventTarget(), values = new Map();
  target.localStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  return { target, values };
}
const waitFor = async (condition) => {
  for (let i = 0; i < 150; i++) { if (condition()) return; await new Promise((resolve) => setTimeout(resolve, 10)); }
  assert.fail("Sync condition was not reached");
};
const copy = (value) => JSON.parse(JSON.stringify(value));

test("partner carts round-trip through the existing shopping section without changing food history", async t => {
  const { api } = await loadLibGroup("api");
  let row = { version: 1, data: { "grab-shop-v1": { orders: [{ id: "existing" }] } } };
  const mock = t.mock.method(globalThis, "fetch", async (_url, options) => {
    if (options.method === "PATCH") row = JSON.parse(options.body);
    return Response.json(row);
  });
  const client = api.createApiClient("/backend");
  const initial = await client.accountData();
  assert.deepEqual(initial, row);
  const cart = { merchantId: "shop", merchantName: "Cafe", lines: [{ listingId: "coffee", qty: 1 }] };
  for (const data of [{ ...initial.data, "grab-partner-cart-v1": cart }, { "grab-partner-cart-v1": cart }]) {
    const snapshot = { version: 2, data };
    assert.deepEqual(await client.saveAccountData(snapshot), snapshot);
    assert.equal(row.data["grab-partner-cart-v1"], undefined);
    assert.deepEqual(row.data["grab-shop-v1"].partnerCart, cart);
    assert.deepEqual(await client.accountData(), snapshot);
  }
  assert.equal(mock.mock.callCount(), 5);
});

test("account caches isolate users and preserve guest data until explicit import", async () => {
  const previous = globalThis.window;
  const { target } = browser(); globalThis.window = target;
  try {
    const { "local-store": local } = await loadLibGroup("local-store");
    const store = local.createLocalStore("grab-profile-v1", { addresses: [] });
    store.set({ addresses: [{ label: "home", text: "Guest address 12" }] });
    local.selectLocalAccount("user-a");
    assert.deepEqual(store.get(), { addresses: [] });
    local.importDeviceData();
    assert.equal(store.get().addresses[0].text, "Guest address 12");
    store.set({ addresses: [{ label: "home", text: "Private A 12" }] });
    local.selectLocalAccount("user-b");
    assert.deepEqual(store.get(), { addresses: [] });
    local.selectLocalAccount("user-a");
    assert.equal(store.get().addresses[0].text, "Private A 12");
    assert.equal(local.getAccountCache().pending, true);
    local.selectLocalAccount(null);
    assert.equal(store.get().addresses[0].text, "Guest address 12");
  } finally { globalThis.window = previous; }
});

test("independent device edits merge; conflicting edits to the same section are protected", async () => {
  const { "account-sync": sync } = await loadLibGroup("account-sync", "local-store");
  const base = { favorites: { items: [] }, profile: { address: "A" } };
  assert.deepEqual(sync.mergeAccountData(base, { ...base, favorites: { items: ["food"] } }, { ...base, profile: { address: "B" } }),
    { favorites: { items: ["food"] }, profile: { address: "B" } });
  assert.equal(sync.mergeAccountData(base, { ...base, profile: { address: "Local" } }, { ...base, profile: { address: "Remote" } }), null);
  assert.equal(sync.mergeAccountData({}, { "grab-shop-v1": { cart: { lines: [{ itemId: "food" }] } } },
    { "grab-partner-cart-v1": { lines: [{ listingId: "partner-food" }] } }), null);
  assert.deepEqual(sync.mergeAccountData(base, { ...base, profile: { address: "Same" } }, { ...base, profile: { address: "Same" } }),
    { ...base, profile: { address: "Same" } });
});

test("two device stores sync through one API and an offline edit retries without losing data", async () => {
  const previousWindow = globalThis.window, previousDocument = globalThis.document;
  const { target, values } = browser(); globalThis.window = target; globalThis.document = { visibilityState: "visible" };
  const running = [];
  let server = { version: 0, data: {} }, online = true;
  const api = {
    accountData: async () => { if (!online) throw new Error("Network unavailable"); return copy(server); },
    saveAccountData: async (body) => {
      if (!online) throw new Error("Network unavailable");
      if (body.version !== server.version) throw Object.assign(new Error("Changed"), { status: 409 });
      server = { version: server.version + 1, data: copy(body.data) }; return copy(server);
    },
  };
  try {
    const a = await loadLibGroup("account-sync", "local-store");
    a["local-store"].selectLocalAccount("same-account");
    const aStore = a["local-store"].createLocalStore("grab-favorites-v1", { storeIds: [] });
    running.push(a["account-sync"].startAccountSync(api, "same-account", () => {}, 30));
    values.clear(); // Device B starts without Device A's browser cache.
    const b = await loadLibGroup("account-sync", "local-store");
    b["local-store"].selectLocalAccount("same-account");
    const bStore = b["local-store"].createLocalStore("grab-favorites-v1", { storeIds: [] });
    let bStatus;
    running.push(b["account-sync"].startAccountSync(api, "same-account", (state) => { bStatus = state.phase; }, 30));
    aStore.set({ storeIds: ["golden-noodle"] });
    await waitFor(() => bStore.get().storeIds.includes("golden-noodle"));
    assert.deepEqual(server.data["grab-favorites-v1"], { storeIds: ["golden-noodle"] });
    online = false;
    bStore.set({ storeIds: ["golden-noodle", "rice-bowl"] });
    await waitFor(() => bStatus === "offline");
    assert.equal(b["local-store"].getAccountCache().pending, true);
    assert.ok(target.localStorage.getItem("grab-account:same-account").includes("rice-bowl"));
    online = true; target.dispatchEvent(new Event("online"));
    await waitFor(() => aStore.get().storeIds.includes("rice-bowl"));
    assert.equal(b["local-store"].getAccountCache().pending, false);
  } finally { running.forEach((instance) => instance.stop()); globalThis.window = previousWindow; globalThis.document = previousDocument; }
});

test("a delayed response after account switching cannot expose the previous account data", async () => {
  const previousWindow = globalThis.window, previousDocument = globalThis.document;
  globalThis.window = browser().target; globalThis.document = { visibilityState: "visible" };
  let controller;
  try {
    const libs = await loadLibGroup("account-sync", "local-store");
    const local = libs["local-store"];
    local.selectLocalAccount("a");
    const store = local.createLocalStore("grab-profile-v1", { addresses: [] });
    let finish;
    controller = libs["account-sync"].startAccountSync({ accountData: () => new Promise((resolve) => { finish = resolve; }), saveAccountData: async () => assert.fail() }, "a", () => {}, 5000);
    local.selectLocalAccount("b");
    finish({ version: 1, data: { "grab-profile-v1": { addresses: [{ label: "home", text: "Private A 12" }] } } });
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.deepEqual(store.get(), { addresses: [] });
  } finally { controller?.stop(); globalThis.window = previousWindow; globalThis.document = previousDocument; }
});
