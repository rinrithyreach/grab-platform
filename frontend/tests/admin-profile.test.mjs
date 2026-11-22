import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { act, createElement, useState } from "react";
import { JSDOM } from "jsdom";
import ts from "typescript";
import { loadLib } from "./load-lib.mjs";

const require = createRequire(import.meta.url);
const data = source => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const react = pathToFileURL(require.resolve("react")).href;
async function component(path, imports) {
  let source = ts.transpileModule(await readFile(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  for (const [name, url] of Object.entries({ react, "react/jsx-runtime": pathToFileURL(require.resolve("react/jsx-runtime")).href, ...imports })) source = source.replaceAll(`"${name}"`, JSON.stringify(url));
  return data(source);
}
const initial = {
  id: "admin", fullName: "Administrator", email: null, contactPhone: "", jobTitle: "Support", bio: "", avatarUrl: null,
  refreshSeconds: 30, compactTables: false, createdAt: "2026-11-01T00:00:00Z", lastLoginAt: null, passwordChangedAt: null,
  version: "version-1", roleId: "limited", roleName: "Support agent", isSuperAdmin: false, permissions: ["overview.view"],
};
async function setup(t, profile = initial) {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost:3000/admin?section=profile" });
  const previous = { window: globalThis.window, document: globalThis.document, FormData: globalThis.FormData, IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT, __adminProfileTest: globalThis.__adminProfileTest };
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, FormData: dom.window.FormData, IS_REACT_ACT_ENVIRONMENT: true, __adminProfileTest: { api: {} } });
  const { createRoot } = await import("react-dom/client"); const root = createRoot(document.getElementById("root"));
  t.after(async () => { await act(async () => root.unmount()); dom.window.close(); Object.assign(globalThis, previous); });
  const Panel = (await import(await component("../components/admin/AdminProfilePanel.tsx", {
    "@/lib/auth": data('export const useAuth = () => ({ api: globalThis.__adminProfileTest.api });'),
    "@/lib/admin-i18n": data('export const useAdminT = () => ({ a: text => text });'),
    "./AdminIcon": data('export default () => null;'),
  }))).default;
  function App() {
    const [current, setCurrent] = useState(profile);
    return createElement(Panel, { profile: current, onChanged: next => setCurrent(next) });
  }
  return { dom, root, render: async () => { await act(async () => root.render(createElement(App))); } };
}
const button = text => [...document.querySelectorAll("button")].find(b => b.textContent === text);
const click = async text => act(async () => button(text).click());
const submit = async dom => act(async () => document.querySelector("form").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })));

test("admin profile has explicit edit, cancel and save actions, and phone-only profiles update the summary", async t => {
  const { dom, render } = await setup(t); let payload; let complete;
  globalThis.__adminProfileTest.api.saveAdminProfile = body => { payload = body; return new Promise(resolve => { complete = resolve; }); };
  await render();
  assert.ok(button("Edit profile")); assert.equal(button("Save profile"), undefined);
  await click("Edit profile");
  assert.equal(document.querySelector('[name="email"]').required, false);
  assert.equal(document.querySelector('[name="currentPassword"]'), null);
  document.querySelector('[name="fullName"]').value = "Discard this change";
  await click("Cancel"); assert.equal(payload, undefined); assert.equal(document.querySelector(".admin-profile-summary h2").textContent, initial.fullName);
  await click("Edit profile"); assert.equal(document.querySelector('[name="fullName"]').value, initial.fullName);
  document.querySelector('[name="fullName"]').value = "Sok Dara";
  document.querySelector('[name="contactPhone"]').value = "+85512345678";
  document.querySelector('[name="jobTitle"]').value = "Operations manager";
  document.querySelector('[name="bio"]').value = "Runs daily operations.";
  await submit(dom);
  assert.equal(payload.fullName, "Sok Dara"); assert.equal(payload.email, null); assert.equal(payload.currentPassword, undefined); assert.equal(payload.version, "version-1");
  assert.equal(button("Saving…").disabled, true); assert.equal(button("Cancel").disabled, true);
  await act(async () => complete({ ...initial, ...payload, version: "version-2" }));
  assert.equal(document.querySelector(".admin-profile-summary h2").textContent, "Sok Dara");
  assert.ok(document.querySelector(".admin-profile-details").textContent.includes("Runs daily operations.")); assert.ok(button("Edit profile"));
  await click("Edit profile"); assert.equal(document.querySelector('[name="fullName"]').value, "Sok Dara");
});

test("failed admin profile saves preserve the draft and cancel clears the error", async t => {
  const { dom, render } = await setup(t);
  globalThis.__adminProfileTest.api.saveAdminProfile = async () => { throw new Error("Your profile changed in another session."); };
  await render(); await click("Edit profile");
  document.querySelector('[name="fullName"]').value = "Unsaved administrator";
  await submit(dom);
  assert.equal(document.querySelector('[role="alert"]').textContent, "Your profile changed in another session.");
  assert.equal(document.querySelector('[name="fullName"]').value, "Unsaved administrator"); assert.equal(button("Save profile").disabled, false);
  await click("Cancel"); assert.equal(document.querySelector('[role="alert"]'), null); assert.ok(button("Edit profile"));
});

test("phone-only admin preferences keep the email empty and use the current saved profile version", async t => {
  const { dom, render } = await setup(t); let payload;
  globalThis.__adminProfileTest.api.saveAdminProfile = async body => { payload = body; return { ...initial, ...body, version: "version-2" }; };
  await render(); await click("Preferences"); document.querySelector('[name="refreshSeconds"]').value = "60";
  document.querySelector('[name="compactTables"]').checked = true;
  await submit(dom);
  assert.equal(payload.email, null); assert.equal(payload.fullName, initial.fullName); assert.equal(payload.refreshSeconds, 60); assert.equal(payload.compactTables, true);
});

test("changing the sign-in email asks for the current password and submits it only with the profile save", async t => {
  const { dom, render } = await setup(t, { ...initial, email: "admin@example.test" }); let payload;
  globalThis.__adminProfileTest.api.saveAdminProfile = async body => { payload = body; return { ...initial, ...body, version: "version-2" }; };
  await render(); await click("Edit profile");
  const email = document.querySelector('[name="email"]'); assert.equal(email.required, true);
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(email, "updated@example.test");
    email.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  });
  const password = document.querySelector('[name="currentPassword"]');
  assert.ok(password); assert.equal(password.required, true); assert.equal(payload, undefined);
  password.value = "current-profile-password";
  await submit(dom);
  assert.equal(payload.email, "updated@example.test"); assert.equal(payload.currentPassword, "current-profile-password");
  assert.ok(document.querySelector(".admin-profile-details").textContent.includes("updated@example.test"));
});

test("saving an admin profile refreshes the signed-in name and token, and the profile reloads through the API", async () => {
  const { createApiClient } = await loadLib("api"); const original = globalThis.fetch; let saved = { ...initial };
  const session = (name, token) => ({ user: { id: "admin", fullName: name, role: "Admin", phoneNumber: "+85512345678" }, accessToken: token, expiresAt: new Date(Date.now() + 60000).toISOString() });
  globalThis.fetch = async (url, options) => {
    if (url.endsWith("/admin/login")) return Response.json(session(initial.fullName, "original-profile-token"));
    if (options.method === "PATCH") { const body = JSON.parse(options.body); assert.equal(body.email, null); saved = { ...saved, ...body, version: "version-2" }; return Response.json({ profile: saved, session: session(saved.fullName, "updated-profile-token") }); }
    return Response.json(saved);
  };
  try {
    const api = createApiClient("http://localhost:5000"); await api.adminLogin("admin@example.test", "test-password");
    const events = []; api.subscribeSession(value => events.push(value));
    const updated = await api.saveAdminProfile({ ...initial, fullName: "Updated administrator", email: null });
    assert.equal(updated.fullName, "Updated administrator"); assert.equal(api.getSession().user.fullName, "Updated administrator");
    assert.equal(api.getSession().accessToken, "updated-profile-token"); assert.equal(events.at(-1).user.fullName, "Updated administrator");
    assert.equal((await api.adminProfile()).fullName, "Updated administrator");
  } finally { globalThis.fetch = original; }
});
