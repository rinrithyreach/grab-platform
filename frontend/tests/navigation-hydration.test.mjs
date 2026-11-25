import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { act, createElement as h, Suspense } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { JSDOM } from "jsdom";
import ts from "typescript";
import { loadLib } from "./load-lib.mjs";

const require = createRequire(import.meta.url);
const dataModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const react = pathToFileURL(require.resolve("react")).href;
const jsx = pathToFileURL(require.resolve("react/jsx-runtime")).href;

async function compile(relativePath, imports) {
  const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
  let { outputText } = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX,
  } });
  for (const [name, url] of Object.entries({ react, "react/jsx-runtime": jsx, ...imports }))
    outputText = outputText.replaceAll(`from "${name}"`, `from "${url}"`);
  return dataModule(outputText);
}

const merchant = { id: "navigation-test", role: "Merchant", fullName: "Test Merchant", phoneNumber: "012345678" };

for (const destination of ["/merchant", "/store/test-store"]) {
  test(`navigation hydrates without attribute warnings when /profile changes to ${destination}`, async (t) => {
    const { AuthProvider, useAuth } = await loadLib("auth", "api", "local-store");
    const authBridge = dataModule("let hook; export const setHook = value => { hook = value; }; export const useAuth = () => hook();");
    (await import(authBridge)).setHook(useAuth);
    const routing = dataModule("let path = '/profile'; export const usePathname = () => path; export const setPath = value => { path = value; };");
    const router = await import(routing);
    router.setPath("/profile");
    const imports = {
      "next/navigation": routing,
      "next/link": dataModule(`import { createElement } from "${react}"; export default ({ children, ...props }) => createElement("a", props, children);`),
      "@/lib/auth": authBridge,
      "@/lib/navigation": await compile("../lib/navigation.ts", { "next/navigation": routing }),
      "@/lib/i18n": dataModule("const t = key => key; export const useT = () => ({ t, pick: english => english });"),
      "@/lib/cart": dataModule("const cart = {}; export const useShop = () => ({ cart }); export const cartDetails = () => ({ count: 2 });"),
      "@/lib/partner-cart": dataModule("const cart = {}; export const usePartnerCart = () => cart; export const partnerTotals = () => ({ count: 0 });"),
      "@/lib/catalog": dataModule("export const STORES = [];"),
      "@/lib/brand": dataModule("export const BRAND = {name: 'Grab'}; export const PROJECT = {year: 2026}; export const SOCIAL_LINKS = []; export const money = value => '$' + value;"),
      "@/lib/wallet": dataModule("export const useWallet = () => ({ balance: 5, hasWallet: true });"),
      "./SettingsMenu": dataModule("export default () => null;"),
      "./NotificationBell": dataModule("export default () => null;"),
      "./CartPreview": dataModule("export default () => null;"),
      "./social-icon-paths": dataModule("export const SOCIAL_ICON_PATHS = {};"),
      "@/lib/platform": dataModule("export const usePlatformSettings = () => null;"),
    };
    imports["./Icon"] = await compile("../components/Icon.tsx", imports);
    imports["./BrandMark"] = await compile("../components/BrandMark.tsx", imports);
    imports["./MobileNav"] = await compile("../components/MobileNav.tsx", imports);
    imports["./AccountMenu"] = await compile("../components/AccountMenu.tsx", imports);
    const Navbar = (await import(await compile("../components/Navbar.tsx", imports))).default;
    const Footer = (await import(await compile("../components/Footer.tsx", imports))).default;
    let paused = false;
    let resume;
    const pending = new Promise((resolve) => { resume = resolve; });
    function DeferredNavigation({ children }) {
      if (paused) throw pending;
      return children;
    }
    function SessionStatus() {
      const { user, ready } = useAuth();
      return h("output", null, ready ? user?.role ?? "Guest" : "Loading");
    }
    function App() {
      return h(AuthProvider, null, h(SessionStatus),
        h(Suspense, { fallback: null }, h(DeferredNavigation, null, h(Navbar))),
        h(Suspense, { fallback: null }, h(DeferredNavigation, null, h(Footer))));
    }
    const html = renderToString(h(App));
    const dom = new JSDOM(`<div id="root">${html}</div>`, { url: `http://localhost:3000${destination}` });
    const previous = { window: globalThis.window, document: globalThis.document, fetch: globalThis.fetch, IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT };
    const previousConsoleError = console.error;
    const attributeWarnings = [];
    const recoverableErrors = [];
    console.error = (...args) => attributeWarnings.push(args.map(String).join(" "));
    Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
    globalThis.fetch = async () => Response.json(merchant);
    dom.window.sessionStorage.setItem("grab-session", JSON.stringify({
      user: merchant, accessToken: "navigation-test-token", expiresAt: new Date(Date.now() + 60_000).toISOString(),
    }));
    let root;
    t.after(async () => {
      try { if (root) await act(async () => root.unmount()); }
      finally { console.error = previousConsoleError; dom.window.close(); Object.assign(globalThis, previous); }
    });
    const container = dom.window.document.getElementById("root");
    router.setPath(destination);
    paused = true;
    await act(async () => {
      root = hydrateRoot(container, h(App), { onRecoverableError: (error) => recoverableErrors.push(error.message) });
    });
    assert.equal(container.querySelector("output").textContent, "Merchant", "Session restores before the shared navigation hydrates");
    await act(async () => { paused = false; resume(); });
    assert.deepEqual(attributeWarnings, [], "Hydration must not warn about mismatched active-link or footer attributes");
    assert.deepEqual(recoverableErrors, []);
    // Personal links live in the avatar menu; open it to check them.
    await act(async () => container.querySelector('header button[aria-label="nav.myMerchant"]').click());
    const desktopAccount = container.querySelector('header [role="menu"] a[href="/merchant"]');
    assert.equal(desktopAccount.getAttribute("href"), "/merchant");
    assert.equal(desktopAccount.getAttribute("aria-current"), destination === "/merchant" ? "page" : null);
    assert.equal(container.querySelectorAll('a[href="/profile"]').length, 0);
    assert.equal(container.querySelector("footer").classList.contains("pb-24"), destination.startsWith("/store/"));

    router.setPath("/food");
    await act(async () => root.render(h(App)));
    assert.equal(container.querySelector('header a[href="/food"]').getAttribute("aria-current"), "page");
    assert.equal(container.querySelector('header [role="menu"] a[href="/merchant"]').getAttribute("aria-current"), null);
    assert.equal(container.querySelector("footer").classList.contains("pb-24"), false);
    assert.equal(container.querySelector('.mobile-bottom-nav a[href="/food"]').getAttribute("aria-current"), "page", "Bottom navigation follows the hydrated route");
    assert.deepEqual(attributeWarnings, [], "Active links continue to update without warnings after navigation");
  });
}
