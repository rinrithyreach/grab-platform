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
const user = { id: "photo-customer", fullName: "Customer", phoneNumber: "012345678", role: "Customer", avatarUrl: null };
const savedSession = () => ({ user, accessToken: "photo-test-token", expiresAt: new Date(Date.now() + 60000).toISOString() });

async function compile(path, imports) {
  let { outputText } = ts.transpileModule(await readFile(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
  });
  for (const [name, url] of Object.entries({ react, "react/jsx-runtime": jsx, ...imports }))
    outputText = outputText.replaceAll(`from "${name}"`, `from "${url}"`);
  return moduleUrl(outputText);
}

test("profile photo editor validates files and previews before save, with cancel and remove controls", async t => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost:3000/profile" });
  const previous = { window: globalThis.window, document: globalThis.document, IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT };
  const originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL;
  const revoked = [];
  URL.createObjectURL = () => "blob:photo-preview";
  URL.revokeObjectURL = url => revoked.push(url);
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  const calls = [];
  const auth = moduleUrl("let api; export const setApi = value => { api = value; }; export const useAuth = () => ({ api }); export const errorMessage = error => error.message;");
  (await import(auth)).setApi({ saveProfilePhoto: async file => { calls.push(file); return { ...user, avatarUrl: file ? "data:image/png;base64,new" : null }; } });
  const imports = {
    "@/lib/auth": auth,
    "@/lib/i18n": moduleUrl("export const useT = () => ({ t: key => key });"),
    "@/lib/toast": moduleUrl("export const toast = () => {};"),
    "./Icon": await compile("../components/Icon.tsx", {}),
  };
  const Editor = (await import(await compile("../components/ProfilePhotoEditor.tsx", imports))).default;
  const container = dom.window.document.getElementById("root");
  const root = createRoot(container);
  t.after(async () => {
    try { await act(async () => root.unmount()); }
    finally { dom.window.close(); Object.assign(globalThis, previous); URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke; }
  });
  await act(async () => root.render(h(Editor, { user })));
  const choose = async file => {
    const input = container.querySelector('input[type="file"]');
    Object.defineProperty(input, "files", { configurable: true, value: [file] });
    await act(async () => input.dispatchEvent(new dom.window.Event("change", { bubbles: true })));
  };
  const click = async text => act(async () => [...container.querySelectorAll("button")].find(button => button.textContent === text).click());
  await choose(new File(["<svg>not-an-allowed-photo</svg>"], "unsafe.svg", { type: "image/svg+xml" }));
  assert.equal(container.querySelector('[role="alert"]').textContent, "profile.photoInvalid");
  await choose(new File([new Uint8Array(524289)], "large.png", { type: "image/png" }));
  assert.equal(container.querySelector('[role="alert"]').textContent, "profile.photoTooLarge");
  const photo = new File([new Uint8Array(24)], "photo.png", { type: "image/png" });
  await choose(photo);
  assert.equal(container.querySelector("img").getAttribute("src"), "blob:photo-preview");
  assert.equal(calls.length, 0, "Choosing a file does not save it automatically");
  await click("common.cancel");
  assert.equal(container.querySelector("img"), null);
  assert.ok(revoked.includes("blob:photo-preview"));
  await choose(photo);
  await click("profile.save");
  assert.equal(calls[0], photo);
  assert.equal(container.querySelector("img"), null, "The temporary preview is cleared after saving");
  await act(async () => root.render(h(Editor, { user: { ...user, avatarUrl: "data:image/png;base64,saved" } })));
  await click("profile.removePhoto");
  assert.equal(calls.at(-1), null);
});

test("photo saves update the authenticated session and an older profile refresh cannot undo them", async t => {
  const { createApiClient } = await loadLib("api");
  const previous = globalThis.fetch;
  t.after(() => { globalThis.fetch = previous; });
  const calls = [];
  let finishRefresh;
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options });
    if (options.method === "GET") return new Promise(resolve => { finishRefresh = resolve; });
    return Response.json({ ...user, avatarUrl: options.method === "DELETE" ? null : "data:image/png;base64,saved" });
  };
  const api = createApiClient();
  api.restoreSession(savedSession());
  const refresh = api.refreshMe();
  await api.saveProfilePhoto(new File([new Uint8Array(24)], "photo.png", { type: "image/png" }));
  const upload = calls.find(call => call.method === "POST");
  assert.equal(upload.url, "/backend/api/auth/me/avatar");
  assert.equal(upload.headers.Authorization, "Bearer photo-test-token");
  assert.equal(upload.headers["Content-Type"], undefined);
  assert.equal(upload.body.get("file").name, "photo.png");
  assert.equal(api.getSession().user.avatarUrl, "data:image/png;base64,saved");
  finishRefresh(Response.json(user));
  await refresh;
  assert.equal(api.getSession().user.avatarUrl, "data:image/png;base64,saved");
  const restored = createApiClient();
  assert.equal(restored.restoreSession(JSON.parse(JSON.stringify(api.getSession()))), true);
  assert.equal(restored.getSession().user.avatarUrl, "data:image/png;base64,saved");
  await api.saveProfilePhoto(null);
  assert.equal(api.getSession().user.avatarUrl, null);
});

test("a pending photo save cannot restore the account after sign-out", async t => {
  const { createApiClient } = await loadLib("api");
  const previous = globalThis.fetch;
  t.after(() => { globalThis.fetch = previous; });
  let finish;
  globalThis.fetch = async () => new Promise(resolve => { finish = resolve; });
  const api = createApiClient();
  api.restoreSession(savedSession());
  const save = api.saveProfilePhoto(new File([new Uint8Array(24)], "photo.png", { type: "image/png" }));
  api.logout();
  finish(Response.json({ ...user, avatarUrl: "data:image/png;base64,saved" }));
  await assert.rejects(save, { name: "AbortError" });
  assert.equal(api.getSession(), null);
});
