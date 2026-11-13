import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

// Exercise the shipped TypeScript client without introducing another test framework.
const source = await readFile(new URL("../lib/api.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
const { createApiClient, ApiError } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

test("login sends JSON; subsequent requests use in-memory bearer; logout removes it", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options });
    return Response.json(url.endsWith("/login") ? { accessToken: "test-token", expiresAt: new Date(Date.now() + 60000).toISOString(), user: { id: "user-1" } } : []);
  };
  try {
    const api = createApiClient("http://localhost:5000/");
    await api.login("test@example.test", "test-password");
    await api.myRides();
    api.logout();
    await api.availableDrivers();
    assert.equal(calls[0].headers["Content-Type"], "application/json");
    assert.equal(calls[1].headers.Authorization, "Bearer test-token");
    assert.equal(calls[1].url, "http://localhost:5000/api/rides/mine?page=1");
    assert.equal(calls[2].headers.Authorization, undefined);
    assert.equal(calls[1].credentials, "omit");
  } finally { globalThis.fetch = originalFetch; }
});

test("validation errors preserve field messages and HTTP status", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ errors: { Email: ["Invalid email"] } }, { status: 400 });
  try {
    await assert.rejects(createApiClient().me(), e => e instanceof ApiError && e.status === 400 && e.message === "Invalid email");
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
    await api.login("test@example.test", "test-password");
    await assert.rejects(api.me(), e => e.status === 401);
    await api.myRides();
    assert.equal(finalHeaders.Authorization, undefined);
  } finally { globalThis.fetch = originalFetch; }
});
