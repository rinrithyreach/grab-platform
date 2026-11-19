import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { loadLibGroup } from "./load-lib.mjs";

const customer = { id: "theme-customer", fullName: "", phoneNumber: "012345678", role: "Customer" };
const snapshot = (data) => ({ version: 1, base: data, data, pending: false, revision: 0 });

async function browser(t, initial, systemDark = false) {
  const libs = await loadLibGroup("settings", "settings-script", "local-store", "auth", "api");
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost:3000", runScripts: "outside-only" });
  const previous = { window: globalThis.window, document: globalThis.document, fetch: globalThis.fetch, IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT };
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  const media = new dom.window.EventTarget();
  media.matches = systemDark;
  dom.window.matchMedia = () => media;
  dom.window.localStorage.setItem("grab-settings", JSON.stringify(initial));
  globalThis.fetch = async (url) => {
    assert.ok(String(url).endsWith("/api/auth/login"));
    return Response.json({ user: customer, accessToken: "theme-test-token", expiresAt: new Date(Date.now() + 60_000).toISOString() });
  };

  let auth, settings, root;
  function Preferences() {
    auth = libs.auth.useAuth();
    settings = libs.settings.useSettings();
    return h("output", null, `${auth.user?.id ?? "guest"}:${settings.theme}`);
  }
  t.after(async () => {
    try { if (root) await act(async () => root.unmount()); }
    finally { dom.window.close(); Object.assign(globalThis, previous); }
  });
  await act(async () => {
    root = createRoot(dom.window.document.getElementById("root"));
    root.render(h(libs.auth.AuthProvider, null, h(Preferences)));
  });
  return {
    ...libs,
    dom,
    media,
    login: () => act(async () => { await auth.login(customer.phoneNumber, "test-password"); }),
    logout: () => act(async () => auth.logout()),
    assertPreference(expected) {
      assert.deepEqual(settings, expected);
      assert.equal(dom.window.document.documentElement.dataset.theme,
        expected.theme === "dark" || (expected.theme === "system" && media.matches) ? "dark" : "light");
      assert.equal(dom.window.document.documentElement.lang, expected.lang);
    },
    assertFirstPaint(expected) {
      dom.window.document.documentElement.removeAttribute("data-theme");
      dom.window.document.documentElement.lang = "en";
      dom.window.eval(libs["settings-script"].SETTINGS_SCRIPT);
      this.assertPreference(expected);
    },
  };
}

for (const theme of ["light", "dark", "system"]) {
  test(`${theme} preference survives customer login, empty account sync, logout and next first paint`, async (t) => {
    const initial = { lang: "en", theme: theme === "dark" ? "light" : "dark" };
    const app = await browser(t, initial, theme !== "dark");
    app.assertPreference(initial);
    await app.login();
    app.assertPreference(initial);

    // A new account (or one without settings) must not reset the device preference.
    await act(async () => app["local-store"].replaceAccountCache(snapshot({})));
    app.assertPreference(initial);
    assert.equal(app["local-store"].getAccountCache().pending, false);

    const chosen = { lang: "km", theme };
    await act(async () => app.settings.updateSettings(chosen));
    app.assertPreference(chosen);
    assert.deepEqual(app["local-store"].getAccountCache().data["grab-settings"], chosen, "Account sync still receives preference changes");
    app.assertFirstPaint(chosen);

    await app.logout();
    app.assertPreference(chosen);
    app.assertFirstPaint(chosen);
    await app.login();
    app.assertPreference(chosen);

    if (theme === "system") {
      app.media.matches = false;
      await act(async () => app.media.dispatchEvent(new app.dom.window.Event("change")));
      app.assertPreference(chosen);
    }
  });
}

test("cached and synchronized account preferences become the device preference without copying private data", async (t) => {
  const app = await browser(t, { lang: "en", theme: "light" });
  const cached = { lang: "km", theme: "dark" };
  const data = {
    "grab-settings": cached,
    "grab-profile-v1": { addresses: [{ text: "Private customer address" }] },
  };
  app.dom.window.localStorage.setItem(`grab-account:${customer.id}`, JSON.stringify(snapshot(data)));
  const profile = app["local-store"].createLocalStore("grab-profile-v1", { addresses: [] });
  await app.login();
  app.assertPreference(cached);
  app.assertFirstPaint(cached);
  assert.equal(profile.get().addresses.length, 1);

  const remote = { lang: "en", theme: "system" };
  await act(async () => app["local-store"].replaceAccountCache(snapshot({ ...data, "grab-settings": remote })));
  app.assertPreference(remote);
  app.assertFirstPaint(remote);
  assert.equal(app["local-store"].getAccountCache().pending, false, "Reading account preferences must not queue another save");

  await app.logout();
  app.assertPreference(remote);
  app.assertFirstPaint(remote);
  assert.deepEqual(profile.get(), { addresses: [] });
  assert.equal(app.dom.window.localStorage.getItem("grab-profile-v1"), null);
});
