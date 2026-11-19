import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement as h, Suspense } from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { loadLib } from "./load-lib.mjs";

const merchant = { id: "merchant-hydration-test", fullName: "Test Merchant", phoneNumber: "012345678", role: "Merchant" };

test("a saved session can restore before a suspended navbar hydrates", async (t) => {
  const { AuthProvider, useAuth } = await loadLib("auth", "api", "local-store");
  let pauseNavbar = false;
  let resumeNavbar;
  const navbarReady = new Promise((resolve) => { resumeNavbar = resolve; });
  const renders = [];
  const pageRenders = [];

  function SessionStatus() {
    const { user, ready } = useAuth();
    return h("output", null, ready ? user?.role ?? "Guest" : "Loading");
  }

  function Navbar() {
    const { user, logout } = useAuth();
    if (pauseNavbar) throw navbarReady;
    renders.push(user);
    return h("nav", null, user
      ? h("div", null, `Hi, ${user.fullName}`, h("button", { onClick: logout }, "Log out"))
      : h("a", { href: "/login" }, "Log in"));
  }

  function MerchantPage() {
    const { user, ready, online } = useAuth();
    if (pauseNavbar) throw navbarReady;
    pageRenders.push({ user, ready, online });
    return h("main", null, !ready
      ? h("p", null, "Loading merchant portal")
      : h("section", null, user?.role === "Merchant" ? "Merchant dashboard" : "Merchant sign in"));
  }

  function App() {
    return h(AuthProvider, null,
      h(SessionStatus),
      h(Suspense, { fallback: h("p", null, "Loading navbar") }, h(Navbar)),
      h(Suspense, { fallback: h("p", null, "Loading page") }, h(MerchantPage)));
  }

  const html = renderToString(h(App));
  assert.match(html, /href="\/login"/);
  const dom = new JSDOM(`<div id="root">${html}</div>`, { url: "http://localhost:3000/merchant" });
  const previous = { window: globalThis.window, document: globalThis.document, fetch: globalThis.fetch, IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT };
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(String(url));
    return Response.json(merchant);
  };
  dom.window.sessionStorage.setItem("grab-session", JSON.stringify({
    user: merchant, accessToken: "hydration-test-token", expiresAt: new Date(Date.now() + 60_000).toISOString(),
  }));
  let root;
  t.after(async () => {
    try { if (root) await act(async () => root.unmount()); }
    finally { dom.window.close(); Object.assign(globalThis, previous); }
  });

  const container = dom.window.document.getElementById("root");
  const recoverableErrors = [];
  pauseNavbar = true;
  await act(async () => {
    root = hydrateRoot(container, h(App), { onRecoverableError: (err) => recoverableErrors.push(err.message) });
  });
  assert.equal(container.querySelector("output").textContent, "Merchant", "Session restores while the navbar is suspended");
  assert.match(container.querySelector("nav").textContent, /Log in/, "Server navbar remains until hydration resumes");
  assert.equal(container.querySelector("main").textContent, "Loading merchant portal");
  renders.length = 0;
  pageRenders.length = 0;
  await act(async () => {
    pauseNavbar = false;
    resumeNavbar();
  });

  assert.deepEqual(recoverableErrors, [], "Delayed hydration must not replace the server tree");
  assert.equal(renders[0], null, "The navbar's first hydration render must match the server's guest session");
  assert.deepEqual(pageRenders[0], { user: null, ready: false, online: null }, "The page must hydrate with the server's loading state");
  assert.match(container.querySelector("nav").textContent, /Hi, Test Merchant/);
  assert.equal(container.querySelector("main").textContent, "Merchant dashboard");
  assert.ok(requests.some((url) => url.endsWith("/api/auth/me")), "Saved sessions are still checked with the API");

  await act(async () => container.querySelector("nav button").click());
  assert.equal(container.querySelector("output").textContent, "Guest");
  assert.equal(container.querySelector("nav a").getAttribute("href"), "/login");
  assert.equal(container.querySelector("main").textContent, "Merchant sign in");
  assert.equal(dom.window.sessionStorage.getItem("grab-session"), null);
});
