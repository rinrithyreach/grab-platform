import assert from "node:assert/strict";
import { loadLib } from "../tests/load-lib.mjs";

// HTTP verification only. Run a production server first; this does not drive a browser.
const base = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const proxy = await fetch(new URL("/backend/api/sync/status", base));
assert.equal(proxy.status, 200, "Frontend proxy reaches the shared API/database");
assert.match((await proxy.json()).storageId, /^[0-9a-f-]{36}$/i);
assert.equal((await fetch(new URL("/backend/api/account-data", base))).status, 401, "Private snapshots require sign-in through the proxy");
const { STORES } = await loadLib("catalog", "hours");
const active = STORES.filter((s) => s.kind === "food");
const routes = ["/", "/food", "/express", "/deliveries", "/ride", "/rides", "/cart", "/orders", "/profile", "/wallet", "/login", "/register", "/merchant", "/merchant/register", "/partners/00000000-0000-0000-0000-000000000000", "/credits", ...active.map((s) => `/store/${s.id}`)];

for (const route of routes) {
  const response = await fetch(new URL(route, base), { redirect: "manual" });
  assert.equal(response.status, 200, route);
  const html = await response.text();
  if (route === "/") {
    assert.ok(html.includes('href="/express"'), "Home links to Express");
    assert.ok(!html.includes('href="/mart"'), "Mart is absent from home navigation");
    assert.ok(html.includes('href="/merchant"'), "Home navigation links to the merchant portal");
  }
  if (route === "/express") assert.ok(html.includes("Send a parcel"), "Express form is rendered");
  if (route === "/merchant/register") {
    for (const field of ["businessName", "ownerName", "contactPhone", "email", "address", "city", "category", "openingHours", "description"])
      assert.ok(html.includes(`name="${field}"`), `Merchant registration includes ${field}`);
    for (const service of ["GrabRide", "GrabFood", "GrabExpress"])
      assert.ok(html.includes(`value="${service}"`), `Merchant registration offers ${service}`);
  }
  if (route === "/login" || route === "/register") {
    const fields = [...html.matchAll(/<input\b[^>]*\bname="([^"]+)"/g)].map((match) => match[1]);
    assert.deepEqual(fields, ["phoneNumber", "password"], `${route}: phone/password only`);
    assert.ok(html.includes('type="tel"'), `${route}: phone keypad`);
    assert.ok(html.includes('type="password"'), `${route}: password hidden initially`);
    assert.ok(html.includes('aria-controls="password"'), `${route}: password visibility control`);
  }
  console.log(`PASS ${route}`);
}

const mart = await fetch(new URL("/mart", base), { redirect: "manual" });
assert.equal(mart.status, 307);
assert.equal(mart.headers.get("location"), "/express");

for (const route of ["/does-not-exist", "/store/does-not-exist"]) {
  const response = await fetch(new URL(route, base));
  const html = await response.text();
  // A dynamic notFound after a streamed shell keeps 200; Next injects noindex.
  assert.ok(response.status === 404 || (route.startsWith("/store/") && response.status === 200), route);
  assert.ok(html.includes('name="robots" content="noindex"'), `${route}: noindex`);
}
const legacy = await fetch(new URL("/store/daily-mart", base), { redirect: "manual" });
assert.equal(legacy.status, 307);
assert.equal(legacy.headers.get("location"), "/express");

const photos = [...new Set(active.flatMap((s) => s.photo ? [s.photo.src] : []))];
for (const path of photos) {
  assert.equal((await fetch(new URL(path, base))).status, 200, path);
  const optimized = new URL("/_next/image", base);
  optimized.search = new URLSearchParams({ url: path, w: "640", q: "75" }).toString();
  const response = await fetch(optimized);
  assert.equal(response.status, 200, `Optimized photo: ${path}`);
  assert.ok(response.headers.get("content-type")?.startsWith("image/"));
}
console.log(`PASS ${routes.length} pages, redirects/not-found handling, ${photos.length} raw and optimized photos`);
