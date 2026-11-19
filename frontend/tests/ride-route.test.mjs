import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { act, createElement as h } from "react";
import { JSDOM } from "jsdom";
import { loadLib } from "./load-lib.mjs";

const { outputText } = ts.transpileModule(await readFile(new URL("../app/api/ride-route/route.ts", import.meta.url), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
});
const { POST } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const request = (body) => new Request("http://localhost/api/ride-route", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) });

test("road routing validates coordinates, uses longitude/latitude upstream, returns Leaflet geometry and keeps positions uncached", async (t) => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url, options });
    return Response.json({ code: "Ok", routes: [{ geometry: { coordinates: [[104.92, 11.55], [104.921, 11.55], [104.921, 11.551]] }, distance: 222, duration: 44 }] });
  });
  const result = await POST(request({ from: [11.55, 104.92], to: [11.551, 104.921] }));
  assert.equal(result.status, 200);
  assert.equal(result.headers.get("cache-control"), "no-store");
  assert.deepEqual(await result.json(), { points: [[11.55, 104.92], [11.55, 104.921], [11.551, 104.921]], distance: 222, duration: 44 });
  assert.ok(calls[0].url.includes("/route/v1/driving/104.92,11.55;104.921,11.551?"));
  assert.equal(calls[0].options.cache, "no-store");
  assert.equal(calls[0].options.headers.Authorization, undefined);
  const before = calls.length;
  for (const body of ["{", "null", "[]", {}, { from: [91, 0], to: [0, 0] }, { from: [0, 0], to: [0, 181] }, { from: ["11", 104], to: [0, 0] }, { from: [0, 0, 0], to: [0, 0] }]) {
    assert.equal((await POST(request(body))).status, 400);
  }
  assert.equal(calls.length, before, "Bad coordinates never reach the road provider");
});

test("unavailable routers, missing roads and malformed upstream geometry produce a safe fallback", async (t) => {
  for (const response of [Response.json({}, { status: 502 }), new Response("not JSON"), Response.json({ code: "NoRoute" }), Response.json({ code: "Ok", routes: [{ geometry: { coordinates: [[104, 91], [104, 92]] }, distance: 1, duration: 1 }] })]) {
    t.mock.method(globalThis, "fetch", async () => response);
    const result = await POST(request({ from: [11.55, 104.92], to: [11.56, 104.93] }));
    assert.equal(result.status, 503);
    assert.deepEqual(await result.json(), { error: "Road route unavailable" });
    assert.equal(result.headers.get("cache-control"), "no-store");
  }
});

test("route byte limits stop oversized chunked requests and upstream responses", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; return new Response("x".repeat(2_000_001)); });
  assert.equal((await POST(request("x".repeat(513)))).status, 413);
  assert.equal(calls, 0);
  // A declared length is checked before buffering. Streaming bodies are bounded too.
  const declared = new Request("http://localhost/api/ride-route", {
    method: "POST", body: "{}", headers: { "Content-Length": "99999999" },
  });
  assert.equal((await POST(declared)).status, 413);
  const encoder = new TextEncoder();
  let cancelled = false;
  const stream = new ReadableStream({
    pull(controller) { controller.enqueue(encoder.encode("x".repeat(300))); },
    cancel() { cancelled = true; },
  });
  const chunked = new Request("http://localhost/api/ride-route", { method: "POST", body: stream, duplex: "half" });
  assert.equal((await POST(chunked)).status, 413);
  assert.equal(cancelled, true);
  assert.equal((await POST(request({ from: [11, 104], to: [12, 105] }))).status, 503);
  assert.equal(calls, 1);
});

test("concurrent route requests are bounded and slots are released after failures", async (t) => {
  const finish = [];
  t.mock.method(globalThis, "fetch", async () => new Promise((resolve) => finish.push(resolve)));
  const pending = Array.from({ length: 16 }, () => POST(request({ from: [11, 104], to: [12, 105] })));
  const rejected = await POST(request({ from: [11, 104], to: [12, 105] }));
  assert.equal(rejected.status, 503);
  assert.equal(rejected.headers.get("Retry-After"), "2");
  await new Promise((resolve) => setImmediate(resolve));
  finish.forEach((resolve) => resolve(Response.json({}, { status: 503 })));
  await Promise.all(pending);
  assert.equal((await POST(request({}))).status, 400);
});

test("road refreshes are throttled and a delayed old route cannot replace a changed destination", async (t) => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost:3000/rides" });
  const previous = { window: globalThis.window, document: globalThis.document, IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT };
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  const { createRoot } = await import("react-dom/client");
  const { useRideRoute } = await loadLib("use-ride-route", "ride-motion");
  const timers = new Map(), calls = [];
  let timerId = 0, now = 1_000_000, releaseOld;
  t.mock.method(Date, "now", () => now);
  t.mock.method(globalThis, "setInterval", (callback) => { timers.set(++timerId, callback); return timerId; });
  t.mock.method(globalThis, "clearInterval", (id) => timers.delete(id));
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url, ...options });
    const body = JSON.parse(options.body);
    const route = { points: [body.from, body.to], distance: calls.length * 100, duration: 40 };
    if (calls.length === 2) return new Promise((resolve) => { releaseOld = () => resolve(Response.json(route)); });
    return Response.json(route);
  });
  function Harness({ from, to }) {
    const { route } = useRideRoute(from, to, true, "pickup");
    return h("output", { "data-distance": route?.distance ?? "" });
  }
  const container = dom.window.document.getElementById("root");
  const root = createRoot(container);
  t.after(async () => { try { await act(async () => root.unmount()); } finally { dom.window.close(); Object.assign(globalThis, previous); } });
  const render = async (from, to = [11.56, 104.93]) => { await act(async () => root.render(h(Harness, { from, to }))); };
  const refresh = async () => { await act(async () => { [...timers.values()].forEach((callback) => callback()); }); };
  await render([11.55, 104.92]);
  assert.equal(calls.length, 1);
  assert.equal(container.querySelector("output").dataset.distance, "100");
  now += 11_000;
  await render([11.55001, 104.92]);
  await refresh();
  assert.equal(calls.length, 1, "Stationary GPS jitter does not repeatedly call the router");
  await render([11.5505, 104.92]);
  await refresh();
  assert.equal(calls.length, 2);
  await refresh();
  assert.equal(calls.length, 2, "There is at most one road request in flight");
  await render([11.5505, 104.92], [11.57, 104.94]);
  assert.equal(calls.length, 3, "A new navigation target gets its own route immediately");
  assert.equal(calls[1].signal.aborted, true);
  assert.equal(container.querySelector("output").dataset.distance, "300");
  await act(async () => releaseOld());
  assert.equal(container.querySelector("output").dataset.distance, "300");
});
