import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

// Exercise the shipped TypeScript client without introducing another test framework.
const source = await readFile(new URL("../lib/api.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
const { createApiClient, ApiError } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

test("ride merchant areas load a public page through the configured API", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  const rows = [{ id: "rider", name: "Dara", address: "GPS: 11.55, 104.92", openingHours: "Mon 08:00-17:00" }];
  globalThis.fetch = async (url, options) => { calls.push({ url, ...options }); return Response.json(rows); };
  try {
    const api = createApiClient("http://localhost:5000");
    assert.deepEqual(await api.rideMerchantAreas(2, new AbortController().signal), rows);
    assert.equal(calls[0].url, "http://localhost:5000/api/merchants/ride-areas?page=2");
    assert.equal(calls[0].method, "GET");
    assert.equal(calls[0].headers.Authorization, undefined);
    assert.ok(calls[0].signal instanceof AbortSignal);
  } finally { globalThis.fetch = originalFetch; }
});

test("merchant sign-in survives refresh and uploads use multipart with bearer authentication", async () => {
  const originalFetch = globalThis.fetch;
  const user = { id: "merchant", fullName: "Dara", phoneNumber: "+85512345678", role: "Merchant" };
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options });
    if (url.endsWith("/login")) return Response.json({ accessToken: "merchant-token", expiresAt: new Date(Date.now() + 60000).toISOString(), user });
    return Response.json({ id: "photo", imageUrl: "/api/merchant-images/photo" });
  };
  try {
    const api = createApiClient("http://localhost:5000/");
    await api.merchantLogin("012345678", "long-password");
    assert.equal(calls[0].url, "http://localhost:5000/api/merchants/login");
    assert.deepEqual(JSON.parse(calls[0].body), { phoneNumber: "012345678", password: "long-password" });
    const fresh = createApiClient("http://localhost:5000");
    assert.equal(fresh.restoreSession(api.getSession()), true);
    const file = new File(["photo"], "photo.png", { type: "image/png" });
    const image = await fresh.uploadMerchantImage(file);
    assert.equal(image.imageUrl, "http://localhost:5000/api/merchant-images/photo");
    assert.equal(calls[1].headers.Authorization, "Bearer merchant-token");
    assert.equal(calls[1].headers["Content-Type"], undefined);
    assert.ok(calls[1].body instanceof FormData);
    assert.equal(calls[1].body.get("file").name, "photo.png");
  } finally { globalThis.fetch = originalFetch; }
});

test("merchant listing updates and public offers preserve price, visibility and API image URLs", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options });
    if (url.includes("/offers?")) return Response.json([{ id: "offer", imageUrl: "/api/merchant-images/photo" }]);
    if (url.endsWith("/banners")) return Response.json([{ id: "banner", imageUrl: "/api/merchant-images/photo", linkUrl: "/partners/business" }]);
    return Response.json({ id: "listing", ...JSON.parse(options.body), imageUrl: "/api/merchant-images/photo" });
  };
  try {
    const api = createApiClient("http://localhost:5000");
    const body = { title: "Lunch", description: "Freshly cooked lunch", price: 4.50, imageId: "photo", isPublished: false, showInSlideshow: true };
    assert.equal((await api.saveMerchantListing(body, "listing/id")).imageUrl, "http://localhost:5000/api/merchant-images/photo");
    assert.equal(calls[0].url, "http://localhost:5000/api/merchants/listings/listing%2Fid");
    assert.equal(calls[0].method, "PATCH");
    assert.deepEqual(JSON.parse(calls[0].body), body);
    assert.equal((await api.merchantOffers("GrabFood", 2))[0].imageUrl, "http://localhost:5000/api/merchant-images/photo");
    assert.equal(calls[1].url, "http://localhost:5000/api/merchants/offers?page=2&service=GrabFood");
    assert.equal((await api.banners())[0].linkUrl, "/partners/business");
  } finally { globalThis.fetch = originalFetch; }
});

test("login sends JSON; subsequent requests use in-memory bearer; logout removes it", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options });
    return Response.json(url.endsWith("/login") ? { accessToken: "test-token", expiresAt: new Date(Date.now() + 60000).toISOString(), user: { id: "user-1" } } : []);
  };
  try {
    const api = createApiClient("http://localhost:5000/");
    await api.login("012345678", "test-password");
    await api.myRides();
    api.logout();
    await api.availableDrivers();
    assert.equal(calls[0].headers["Content-Type"], "application/json");
    assert.deepEqual(JSON.parse(calls[0].body), { phoneNumber: "012345678", password: "test-password" });
    assert.equal(calls[1].headers.Authorization, "Bearer test-token");
    assert.equal(calls[1].url, "http://localhost:5000/api/rides/mine?page=1");
    assert.equal(calls[2].headers.Authorization, undefined);
    assert.equal(calls[1].credentials, "omit");
  } finally { globalThis.fetch = originalFetch; }
});

test("validation errors preserve field messages and HTTP status", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ errors: { PhoneNumber: ["Invalid phone number"] } }, { status: 400 });
  try {
    await assert.rejects(createApiClient().me(), e => e instanceof ApiError && e.status === 400 && e.message === "Invalid phone number");
  } finally { globalThis.fetch = originalFetch; }
});

test("registration sends only a phone number and password and establishes a session", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.ok(url.endsWith("/api/auth/register"));
    assert.deepEqual(JSON.parse(options.body), { phoneNumber: "012345678", password: "a-long-test-password" });
    return Response.json({ accessToken: "registered", expiresAt: new Date(Date.now() + 60000).toISOString(), user: { id: "customer", fullName: "Customer", phoneNumber: "+85512345678", role: "Customer" } }, { status: 201 });
  };
  try {
    const api = createApiClient();
    const user = await api.register({ phoneNumber: "012345678", password: "a-long-test-password" });
    assert.equal(user.phoneNumber, "+85512345678");
    assert.equal(api.getSession().accessToken, "registered");
    api.logout();
    assert.equal(api.getSession(), null);
  } finally { globalThis.fetch = originalFetch; }
});

test("profile name updates notify the provider and persist in the saved session", async () => {
  const originalFetch = globalThis.fetch;
  const user = { id: "customer", fullName: "Customer", phoneNumber: "+85512345678", role: "Customer" };
  const saved = { accessToken: "same-token", expiresAt: new Date(Date.now() + 60000).toISOString(), user };
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/backend/api/auth/me");
    assert.equal(options.method, "PATCH");
    assert.equal(options.headers.Authorization, "Bearer same-token");
    assert.deepEqual(JSON.parse(options.body), { fullName: "Dara" });
    return Response.json({ ...user, fullName: "Dara" });
  };
  try {
    const api = createApiClient();
    api.restoreSession(saved);
    const notifications = [];
    api.subscribeSession((session) => notifications.push(session));
    assert.equal((await api.updateProfile({ fullName: "Dara" })).fullName, "Dara");
    assert.equal(api.getSession().user.fullName, "Dara");
    assert.equal(api.getSession().accessToken, saved.accessToken);
    assert.equal(api.getSession().expiresAt, saved.expiresAt);
    assert.equal(notifications[0].user.fullName, "Dara");
    const refreshed = createApiClient();
    assert.equal(refreshed.restoreSession(JSON.parse(JSON.stringify(api.getSession()))), true);
    assert.equal(refreshed.getSession().user.fullName, "Dara");
  } finally { globalThis.fetch = originalFetch; }
});

test("a pending profile save cannot restore a session after sign-out", async () => {
  const originalFetch = globalThis.fetch;
  let finish;
  globalThis.fetch = async () => new Promise((resolve) => { finish = resolve; });
  try {
    const api = createApiClient();
    const user = { id: "customer", fullName: "Customer", phoneNumber: "+85512345678", role: "Customer" };
    api.restoreSession({ accessToken: "token", expiresAt: new Date(Date.now() + 60000).toISOString(), user });
    const saving = api.updateProfile({ fullName: "Dara" });
    api.logout();
    finish(Response.json({ ...user, fullName: "Dara" }));
    await assert.rejects(saving, { name: "AbortError" });
    assert.equal(api.getSession(), null);
  } finally { globalThis.fetch = originalFetch; }
});

test("401 clears the token and empty error bodies are handled", async () => {
  const originalFetch = globalThis.fetch;
  let count = 0;
  let finalHeaders;
  globalThis.fetch = async (_url, options) => {
    count++;
    if (count === 1) return Response.json({ accessToken: "test-token", expiresAt: new Date(Date.now() + 60000).toISOString(), user: {} });
    if (count === 2) return new Response(null, { status: 401, statusText: "Unauthorized" });
    finalHeaders = options.headers;
    return Response.json([]);
  };
  try {
    const api = createApiClient();
    await api.login("012345678", "test-password");
    await assert.rejects(api.me(), e => e.status === 401);
    await api.myRides();
    assert.equal(finalHeaders.Authorization, undefined);
  } finally { globalThis.fetch = originalFetch; }
});

test("restoreSession reuses a saved, unexpired login and rejects an expired one", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => { calls.push({ url, ...options }); return Response.json([]); };
  try {
    const api = createApiClient("http://localhost:5000");
    const user = { id: "user-1", fullName: "Test User", phoneNumber: "012345678", role: "Customer" };
    assert.equal(api.restoreSession({ accessToken: "old", expiresAt: new Date(Date.now() - 1000).toISOString(), user }), false);
    assert.equal(api.getSession(), null);
    assert.equal(api.restoreSession({ accessToken: "saved-token", expiresAt: new Date(Date.now() + 60000).toISOString(), user }), true);
    await api.myRides();
    assert.equal(calls[0].headers.Authorization, "Bearer saved-token");
    assert.equal(api.getSession().accessToken, "saved-token");
  } finally { globalThis.fetch = originalFetch; }
});

test("health check rejects failed, opaque, and unrelated responses", async () => {
  const originalFetch = globalThis.fetch;
  try {
    const api = createApiClient();
    for (const response of [new Response(null, { status: 503 }), new Response("<html>another site</html>"), Response.json({ status: "unhealthy" }), Response.error()]) {
      globalThis.fetch = async () => response;
      assert.equal(await api.isOnline(), false);
    }
    globalThis.fetch = async (_url, options) => {
      assert.notEqual(options.mode, "no-cors");
      return Response.json({ status: "ok" });
    };
    assert.equal(await api.isOnline(), true);
  } finally { globalThis.fetch = originalFetch; }
});

test("corrupt saved sessions are rejected without crashing", () => {
  const api = createApiClient();
  for (const saved of [null, [], "invalid", {}, { expiresAt: "invalid" }, { accessToken: "t", expiresAt: "2999-01-01", user: {} }]) {
    assert.equal(api.restoreSession(saved), false);
    assert.equal(api.getSession(), null);
  }
});

test("401 notifies the authentication UI and JSON null errors keep their status", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json(null, { status: 401, statusText: "Unauthorized" });
  try {
    const api = createApiClient();
    let notified = false;
    api.subscribeSession((session) => { assert.equal(session, null); notified = true; });
    await assert.rejects(api.me(), e => e instanceof ApiError && e.status === 401 && e.message === "Unauthorized");
    assert.equal(notified, true);
  } finally { globalThis.fetch = originalFetch; }
});

test("a delayed 401 from an older session cannot log out a newer login", async () => {
  const originalFetch = globalThis.fetch;
  let finishOldRequest;
  globalThis.fetch = async () => new Promise((resolve) => { finishOldRequest = resolve; });
  try {
    const api = createApiClient();
    const user = { id: "user", fullName: "Test User", phoneNumber: "012345678", role: "Customer" };
    const expiresAt = new Date(Date.now() + 60000).toISOString();
    api.restoreSession({ accessToken: "old-token", expiresAt, user });
    const pending = api.me();
    api.restoreSession({ accessToken: "new-token", expiresAt, user });
    finishOldRequest(new Response(null, { status: 401 }));
    await assert.rejects(pending, e => e.status === 401);
    assert.equal(api.getSession().accessToken, "new-token");
  } finally { globalThis.fetch = originalFetch; }
});

test("logout cancels an in-flight login and the latest sign-in attempt wins", async (t) => {
  const pending = [];
  t.mock.method(globalThis, "fetch", async () => new Promise((resolve) => pending.push(resolve)));
  const api = createApiClient();
  const auth = (token) => ({ accessToken: token, expiresAt: new Date(Date.now() + 60000).toISOString(),
    user: { id: token, fullName: "Customer", phoneNumber: "012345678", role: "Customer" } });
  const cancelled = api.login("012345678", "password");
  api.logout();
  pending.shift()(Response.json(auth("cancelled")));
  await assert.rejects(cancelled, { name: "AbortError" });
  assert.equal(api.getSession(), null);

  const first = api.login("012345678", "password");
  const second = api.login("098765432", "password");
  pending[1](Response.json(auth("new-account")));
  await second;
  pending[0](Response.json(auth("old-account")));
  await assert.rejects(first, { name: "AbortError" });
  assert.equal(api.getSession().user.id, "new-account");
});

test("a delayed private response is discarded after switching accounts", async (t) => {
  let finish;
  t.mock.method(globalThis, "fetch", async () => new Promise((resolve) => { finish = resolve; }));
  const api = createApiClient();
  const session = (id) => ({ accessToken: id, expiresAt: new Date(Date.now() + 60000).toISOString(),
    user: { id, fullName: "Customer", phoneNumber: "012345678", role: "Customer" } });
  api.restoreSession(session("first"));
  const loading = api.myOrders();
  api.restoreSession(session("second"));
  finish(Response.json([{ deliveryAddress: "Private address" }]));
  await assert.rejects(loading, { name: "AbortError" });
});

test("failed sign-in does not send or invalidate the currently signed-in account token", async (t) => {
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    assert.equal(options.headers.Authorization, undefined);
    return new Response(null, { status: 401 });
  });
  const api = createApiClient();
  api.restoreSession({ accessToken: "current", expiresAt: new Date(Date.now() + 60000).toISOString(),
    user: { id: "current", fullName: "Customer", phoneNumber: "012345678", role: "Customer" } });
  await assert.rejects(api.login("098765432", "wrong-password"), { status: 401 });
  assert.equal(api.getSession().accessToken, "current");
});
