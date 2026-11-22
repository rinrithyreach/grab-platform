import assert from "node:assert/strict";
import test from "node:test";
import { loadLib } from "./load-lib.mjs";

const { adminActions, adminCsv, adminPermissionSection, ADMIN_CONFIG } = await loadLib("admin");
const { createApiClient } = await loadLib("api");
const { authDestination } = await loadLib("auth-destination");

test("admin sign-in establishes the existing session and admin requests carry its token", async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options });
    if (url.endsWith("/admin/login")) return Response.json({ user: { id: "admin", fullName: "Administrator", phoneNumber: "admin", role: "Admin" }, accessToken: "admin-test-token", expiresAt: new Date(Date.now() + 60000).toISOString() });
    return Response.json({ items: [], total: 0, page: 2, pageSize: 20 });
  };
  try {
    const api = createApiClient("http://localhost:5000");
    const user = await api.adminLogin("admin@example.test", "test-password");
    assert.equal(user.role, "Admin");
    assert.equal(authDestination(user.role, "?next=https://external.example"), "/admin");
    assert.deepEqual(JSON.parse(calls[0].body), { email: "admin@example.test", password: "test-password" });
    await api.adminList("users", 2, "a&role=Admin", "Suspended");
    const url = new URL(calls[1].url);
    assert.equal(url.searchParams.get("search"), "a&role=Admin");
    assert.equal(url.searchParams.get("filter"), "Suspended");
    assert.equal(url.searchParams.get("page"), "2");
    assert.equal(calls[1].headers.Authorization, "Bearer admin-test-token");
    await api.adminAction("rides", "test-id", "Cancelled", "Customer request");
    assert.deepEqual(JSON.parse(calls[2].body), { action: "Cancelled", reason: "Customer request" });
    assert.equal(calls[2].method, "POST");
    api.logout();
    assert.equal(api.getSession(), null);
  } finally { globalThis.fetch = original; }
});

test("admin controls offer only allowed state transitions and preserve terminal records", () => {
  for (const status of ["Completed", "Cancelled"]) assert.deepEqual(adminActions("rides", { id: "r", status }), []);
  assert.deepEqual(adminActions("orders", { id: "o", status: "Pending" }).map(a => a.value), ["Accepted", "Rejected"]);
  for (const status of ["Delivered", "Rejected", "Cancelled"]) assert.deepEqual(adminActions("orders", { id: "o", status }), []);
  assert.deepEqual(adminActions("deliveries", { id: "d", status: "InTransit" }).map(a => a.value), ["Failed"]);
  assert.deepEqual(adminActions("payments", { id: "p" }), []);
  assert.deepEqual(adminActions("reviews", { id: "r", isHidden: true }).map(a => a.value), ["Restore"]);
});

test("CSV export quotes content and neutralizes spreadsheet formulas", () => {
  const csv = adminCsv("users", [{ id: "u", fullName: '=HYPERLINK("bad")', phoneNumber: "+85512345678", role: "Customer", isActive: true, createdAt: "2026-11-19" }]);
  assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'));
  assert.ok(csv.includes('"\'+85512345678"'));
  assert.ok(csv.includes('"Active"'));
  assert.ok(!csv.includes("password"));
});

test("administrator team requests use the team endpoints and send reasons, never echoing passwords in URLs", async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options });
    if (url.endsWith("/admin/login")) return Response.json({ user: { id: "admin", fullName: "Administrator", phoneNumber: "admin", role: "Admin" }, accessToken: "admin-test-token", expiresAt: new Date(Date.now() + 60000).toISOString() });
    return Response.json(url.includes("/team") && options.method === "GET" ? [] : { saved: true, id: "new-admin" });
  };
  try {
    const api = createApiClient("http://localhost:5000");
    await api.adminLogin("admin@example.test", "test-password");
    await api.adminTeam();
    await api.createAdmin({ fullName: "Second Admin", email: "second@example.test", jobTitle: "Support lead", temporaryPassword: "temporary-pass-123", reason: "New support lead" });
    await api.setAdminStatus("member/1", false, "Left the team");
    await api.revokeAdminMemberSessions("member-1", "Lost laptop");
    await api.adminActivity();
    assert.deepEqual(calls.slice(1).map(c => [c.method, new URL(c.url).pathname]), [
      ["GET", "/api/admin/team"], ["POST", "/api/admin/team"], ["PATCH", "/api/admin/team/member%2F1"],
      ["POST", "/api/admin/team/member-1/revoke-sessions"], ["GET", "/api/admin/profile/activity"]]);
    assert.ok(!calls[2].url.includes("temporary-pass-123"));
    assert.deepEqual(JSON.parse(calls[3].body), { isActive: false, reason: "Left the team" });
    assert.ok(calls.slice(1).every(c => c.headers.Authorization === "Bearer admin-test-token"));
  } finally { globalThis.fetch = original; }
});

test("administrator directory filters by text and status and builds initials", async () => {
  const { filterAdminTeam, adminInitials } = await loadLib("admin-settings");
  const member = (fullName, isActive, extra = {}) => ({ id: fullName, fullName, email: null, jobTitle: "", contactPhone: "", bio: "", avatarUrl: null, isActive, isYou: false, createdAt: "2026-11-01", lastLoginAt: null, passwordChangedAt: null, lastActivityAt: null, changesLast30Days: 0, ...extra });
  const team = [member("Sok Dara", true, { email: "dara@example.test" }), member("Chan Lina", false, { jobTitle: "Finance" })];
  assert.deepEqual(filterAdminTeam(team, "", "").map(m => m.fullName), ["Sok Dara", "Chan Lina"]);
  assert.deepEqual(filterAdminTeam(team, "DARA@", "").map(m => m.fullName), ["Sok Dara"]);
  assert.deepEqual(filterAdminTeam(team, "finance", "Active"), []);
  assert.deepEqual(filterAdminTeam(team, "", "Suspended").map(m => m.fullName), ["Chan Lina"]);
  assert.equal(adminInitials("  sok   dara "), "SD");
  assert.equal(adminInitials("Admin"), "A");
  assert.equal(adminInitials(""), "?");
});

test("role permissions: manage implies view, removing view removes manage, and super admins hold everything", async () => {
  const { adminCan, adminCovers, togglePermission } = await loadLib("admin-settings");
  assert.deepEqual(togglePermission([], "orders", "manage", true).sort(), ["orders.manage", "orders.view"]);
  assert.deepEqual(togglePermission(["orders.view", "orders.manage"], "orders", "view", false), []);
  assert.deepEqual(togglePermission(["orders.view", "orders.manage"], "orders", "manage", false), ["orders.view"]);
  const agent = { isSuperAdmin: false, permissions: ["orders.view", "orders.manage"] };
  assert.equal(adminCan(agent, "orders", "manage"), true);
  assert.equal(adminCan(agent, "users"), false);
  assert.equal(adminCan(null, "orders"), false);
  assert.equal(adminCan({ isSuperAdmin: true, permissions: [] }, "roles", "manage"), true);
  assert.equal(adminCovers(agent, ["orders.view"]), true);
  assert.equal(adminCovers(agent, ["orders.view", "settings.manage"]), false);
});

test("role and user creation requests use the admin endpoints", async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options });
    if (url.endsWith("/admin/login")) return Response.json({ user: { id: "admin", fullName: "Administrator", phoneNumber: "admin", role: "Admin" }, accessToken: "admin-test-token", expiresAt: new Date(Date.now() + 60000).toISOString() });
    return Response.json({ saved: true, id: "x", roles: [], superAdministrators: 1, catalog: [] });
  };
  try {
    const api = createApiClient("http://localhost:5000");
    await api.adminLogin("admin@example.test", "test-password");
    await api.adminRoles();
    await api.createAdminRole({ name: "Order desk", description: "", permissions: ["orders.manage"], reason: "Setup" });
    await api.updateAdminRole("role/1", { name: "Order desk", description: "", permissions: ["orders.view"], version: "v1", reason: "Trim" });
    await api.deleteAdminRole("role-1", "Unused");
    await api.setAdminRole("admin-2", null, "Promote");
    await api.adminCreateUser({ fullName: "Phone Customer", phoneNumber: "012777888", email: "", password: "a-long-password", reason: "Support" });
    assert.deepEqual(calls.slice(1).map(c => [c.method, new URL(c.url).pathname]), [
      ["GET", "/api/admin/roles"], ["POST", "/api/admin/roles"], ["PUT", "/api/admin/roles/role%2F1"], ["POST", "/api/admin/roles/role-1/delete"],
      ["PATCH", "/api/admin/team/admin-2/role"], ["POST", "/api/admin/users"]]);
    assert.deepEqual(JSON.parse(calls[5].body), { adminRoleId: null, reason: "Promote" });
  } finally { globalThis.fetch = original; }
});

test("admin profiles from an API without role fields do not crash permission checks", async () => {
  const { adminCan, normalizeAdminProfile } = await loadLib("admin-settings");
  const legacy = { id: "a", fullName: "Admin", email: "a@example.test" };
  assert.equal(adminCan(legacy, "orders"), false); // missing fields never throw
  const normalized = normalizeAdminProfile(legacy);
  assert.equal(normalized.isSuperAdmin, true); // pre-roles API: every admin had full access
  assert.equal(normalized.roleName, "Super administrator");
  assert.equal(adminCan(normalized, "roles", "manage"), true);
  const limited = normalizeAdminProfile({ ...legacy, isSuperAdmin: false, permissions: ["orders.view"], roleId: "r", roleName: "Order desk" });
  assert.equal(adminCan(limited, "orders"), true);
  assert.equal(adminCan(limited, "users"), false);
});

test("the Express section manages GrabExpress shop orders like food orders and shares the Orders permission", () => {
  assert.deepEqual(adminActions("express", { id: "e", status: "Pending" }).map(a => a.value), ["Accepted", "Rejected"]);
  assert.deepEqual(adminActions("express", { id: "e", status: "OnTheWay" }).map(a => a.value), ["Delivered", "Rejected"]);
  assert.deepEqual(adminActions("express", { id: "e", status: "Delivered" }), []);
  assert.equal(adminPermissionSection("express"), "orders");
  assert.equal(adminPermissionSection("deliveries"), "deliveries");
  assert.ok(ADMIN_CONFIG.audit.filters.includes("express"), "Express changes can be found in the activity log");
});
