import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import ts from "typescript";
import { loadLib } from "./load-lib.mjs";

const require = createRequire(import.meta.url);
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const react = pathToFileURL(require.resolve("react")).href;
const jsx = pathToFileURL(require.resolve("react/jsx-runtime")).href;

async function compile(path, imports) {
  let { outputText } = ts.transpileModule(await readFile(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
  });
  for (const [name, url] of Object.entries({ react, "react/jsx-runtime": jsx, ...imports }))
    outputText = outputText.replaceAll(`from "${name}"`, `from "${url}"`);
  return moduleUrl(outputText);
}

test("uploaded banners replace built-in promotions, refresh on focus, and survive a failed refresh", async t => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost:3000" });
  const previous = { window: globalThis.window, document: globalThis.document, IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT };
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  dom.window.matchMedia = () => ({ matches: true });
  let banners = [];
  let fail = false;
  const auth = moduleUrl("let api; export const setApi = value => { api = value; }; export const useAuth = () => ({ api });");
  (await import(auth)).setApi({ banners: async () => { if (fail) throw new Error("Offline"); return banners; } });
  const imports = {
    "@/lib/auth": auth,
    "@/lib/i18n": moduleUrl("export const useT = () => ({ t: key => key, pick: english => english });"),
    "next/link": moduleUrl(`import { createElement } from "${react}"; export default ({ children, ...props }) => createElement("a", props, children);`),
    "next/image": moduleUrl(`import { createElement } from "${react}"; export default ({ fill, preload, ...props }) => createElement("img", props);`),
  };
  imports["./Icon"] = await compile("../components/Icon.tsx", imports);
  imports["./Carousel"] = await compile("../components/Carousel.tsx", imports);
  const BannerCarousel = (await import(await compile("../components/BannerCarousel.tsx", imports))).default;
  const container = dom.window.document.getElementById("root");
  const root = createRoot(container);
  t.after(async () => {
    try { await act(async () => root.unmount()); }
    finally { dom.window.close(); Object.assign(globalThis, previous); }
  });
  await act(async () => root.render(h(BannerCarousel)));
  assert.ok(container.querySelector(".welcome-promo"));

  banners = [{ id: "uploaded", imageUrl: "/backend/api/banner-images/uploaded/v1", title: "Weekend offer", subtitle: "Fresh from the admin dashboard", linkUrl: "/food" }];
  await act(async () => dom.window.dispatchEvent(new dom.window.Event("focus")));
  assert.equal(container.querySelector(".welcome-promo"), null, "An uploaded banner must take the first position");
  assert.equal(container.querySelectorAll('[aria-roledescription="slide"]').length, 1);
  assert.equal(container.querySelector("img").getAttribute("src"), banners[0].imageUrl);
  assert.equal(container.querySelector("a").getAttribute("href"), "/food");
  assert.ok(container.textContent.includes("Weekend offer"));

  fail = true;
  await act(async () => dom.window.dispatchEvent(new dom.window.Event("focus")));
  assert.ok(container.textContent.includes("Weekend offer"), "A transient failure must not remove the current banner");
  fail = false;
  banners = [];
  await act(async () => dom.window.dispatchEvent(new dom.window.Event("focus")));
  assert.ok(container.querySelector(".welcome-promo"), "Built-in slides return when no published banners remain");
});

test("admin banner uploads use authenticated multipart and edits retain the image when none is supplied", async t => {
  const { createApiClient } = await loadLib("api");
  const previous = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options });
    if (url.endsWith("/admin/login")) return Response.json({ user: { id: "admin", role: "Admin" }, accessToken: "banner-test-token", expiresAt: new Date(Date.now() + 60000).toISOString() });
    if (options.method === "GET") return Response.json([{ id: "banner", imageUrl: "/api/banner-images/banner/v1" }]);
    return Response.json({ id: "banner", saved: true });
  };
  t.after(() => { globalThis.fetch = previous; });
  const api = createApiClient("/backend");
  await api.adminLogin("admin@example.test", "test-password");
  const image = new File([new Uint8Array([137, 80, 78, 71])], "offer.png", { type: "image/png" });
  const fields = { title: "Weekend offer", subtitle: "New promotion", linkUrl: "/food", sortOrder: 0, isActive: true, reason: "Publish promotion" };
  await api.adminSaveBanner(fields, image);
  const upload = calls.at(-1);
  assert.equal(upload.url, "/backend/api/admin/banners");
  assert.equal(upload.method, "POST");
  assert.equal(upload.headers.Authorization, "Bearer banner-test-token");
  assert.equal(upload.headers["Content-Type"], undefined, "The browser supplies the multipart boundary");
  assert.ok(upload.body instanceof FormData);
  assert.equal(upload.body.get("image").name, "offer.png");
  assert.equal(upload.body.get("isActive"), "true");
  assert.equal(upload.body.get("sortOrder"), "0");
  assert.equal(upload.body.get("reason"), fields.reason);

  await api.adminSaveBanner({ ...fields, isActive: false }, null, "banner");
  assert.equal(calls.at(-1).method, "PATCH");
  assert.equal(calls.at(-1).url, "/backend/api/admin/banners/banner");
  assert.equal(calls.at(-1).body.has("image"), false);
  assert.equal(calls.at(-1).body.get("isActive"), "false");
  assert.equal((await api.adminBanners())[0].imageUrl, "/backend/api/banner-images/banner/v1");
  assert.equal((await api.banners())[0].imageUrl, "/backend/api/banner-images/banner/v1");
});
