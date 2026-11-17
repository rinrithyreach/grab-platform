import assert from "node:assert/strict";

const api = (process.env.API_PROXY_URL || "http://localhost:5000").replace(/\/$/, "");
const response = await fetch(`${api}/api/sync/status`, { signal: AbortSignal.timeout(12000) });
assert.equal(response.status, 200, "The shared API must be running with all database migrations applied.");
const status = await response.json();
assert.equal(status.status, "ok");
assert.match(status.storageId, /^[0-9a-f-]{36}$/i);
const offers = await fetch(`${api}/api/merchants/offers`, { signal: AbortSignal.timeout(12000) });
assert.equal(offers.status, 200, "The shared catalogue must be readable.");
const privateData = await fetch(`${api}/api/account-data`, { signal: AbortSignal.timeout(12000) });
assert.equal(privateData.status, 401, "Account data must require sign-in.");
console.log(`API: ${api}`);
console.log(`Storage ID: ${status.storageId}`);
console.log("Shared API is ready. Run this on each PC: Storage IDs must match and all frontends must target the same central API.");
