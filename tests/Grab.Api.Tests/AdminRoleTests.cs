using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Grab.Api.DTOs;
using Grab.Api.Models;

namespace Grab.Api.Tests;

public partial class ApiTests
{
    private static async Task<HttpClient> AdminByEmail(ApiFactory f, string email, string password)
    {
        var client = f.CreateClient();
        var login = await client.PostAsJsonAsync("/api/auth/admin/login", new AdminLoginRequest(email, password));
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        SignIn(client, await Read<AuthResponse>(login));
        return client;
    }

    private static async Task<Guid> CreateRole(HttpClient admin, string name, params string[] permissions)
    {
        var response = await admin.PostAsJsonAsync("/api/admin/roles", new SaveAdminRoleRequest(name, "Test role", [.. permissions], null, "Test role setup"), Json);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await Read<JsonElement>(response)).GetProperty("id").GetGuid();
    }

    [Fact]
    public async Task Admin_roles_limit_sections_and_block_privilege_escalation()
    {
        await using var f = new ApiFactory(); await f.InitializeDatabase();
        using var super = await Admin(f);
        var password = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(18));

        // Role validation.
        var orderDesk = await CreateRole(super, "Order desk", "overview.view", "orders.manage");
        Assert.Equal(HttpStatusCode.Conflict, (await super.PostAsJsonAsync("/api/admin/roles", new SaveAdminRoleRequest("ORDER DESK", null, ["orders.view"], null, "Duplicate"), Json)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await super.PostAsJsonAsync("/api/admin/roles", new SaveAdminRoleRequest("Super administrator", null, ["orders.view"], null, "Reserved"), Json)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await super.PostAsJsonAsync("/api/admin/roles", new SaveAdminRoleRequest("Bad", null, ["orders.delete"], null, "Unknown"), Json)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await super.PostAsJsonAsync("/api/admin/roles", new SaveAdminRoleRequest("Empty", null, [], null, "Empty"), Json)).StatusCode);
        var roles = await Read<AdminRolesResponse>(await super.GetAsync("/api/admin/roles"));
        Assert.Equal(["overview.view", "orders.view", "orders.manage"], Assert.Single(roles.Roles).Permissions); // manage implies view
        Assert.Equal(1, roles.SuperAdministrators);

        // A limited administrator sees and changes only what the role grants.
        Assert.Equal(HttpStatusCode.Created, (await super.PostAsJsonAsync("/api/admin/team", new CreateAdminRequest("Order Agent", "orders@example.test", "Order desk", password, "New order agent", orderDesk), Json)).StatusCode);
        using var agent = await AdminByEmail(f, "orders@example.test", password);
        var profile = await Read<AdminProfileDto>(await agent.GetAsync("/api/admin/profile"));
        Assert.False(profile.IsSuperAdmin); Assert.Equal("Order desk", profile.RoleName); Assert.Contains("orders.manage", profile.Permissions!);
        foreach (var allowed in new[] { "overview", "orders", "express", "profile/activity" })
            Assert.Equal(HttpStatusCode.OK, (await agent.GetAsync($"/api/admin/{allowed}")).StatusCode);
        foreach (var denied in new[] { "users", "merchants", "rides", "payments", "audit", "settings", "team", "roles" })
            Assert.Equal(HttpStatusCode.Forbidden, (await agent.GetAsync($"/api/admin/{denied}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await agent.PostAsJsonAsync("/api/admin/roles", new SaveAdminRoleRequest("Mine", null, ["orders.view"], null, "Self service"), Json)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await agent.PostAsJsonAsync($"/api/admin/rides/{Guid.NewGuid()}/actions", new AdminActionRequest("Cancelled", "Not my section"), Json)).StatusCode);

        // A team lead may manage administrators but only within their own permissions.
        var teamLead = await CreateRole(super, "Team lead", "team.manage", "roles.view", "overview.view", "orders.manage", "users.manage");
        Assert.Equal(HttpStatusCode.Created, (await super.PostAsJsonAsync("/api/admin/team", new CreateAdminRequest("Team Lead", "lead@example.test", null, password, "New lead", teamLead), Json)).StatusCode);
        using var lead = await AdminByEmail(f, "lead@example.test", password);
        Assert.Equal(HttpStatusCode.Forbidden, (await lead.PostAsJsonAsync("/api/admin/team", new CreateAdminRequest("Sneaky Super", "super2@example.test", null, password, "Escalation", null), Json)).StatusCode);
        var settingsRole = await CreateRole(super, "Settings editor", "settings.manage");
        // The Express section follows the Orders permission: a role without it cannot see Express orders.
        Assert.Equal(HttpStatusCode.Created, (await super.PostAsJsonAsync("/api/admin/team", new CreateAdminRequest("Settings Only", "settings-only@example.test", null, password, "Settings only", settingsRole), Json)).StatusCode);
        using (var settingsOnly = await AdminByEmail(f, "settings-only@example.test", password))
            Assert.Equal(HttpStatusCode.Forbidden, (await settingsOnly.GetAsync("/api/admin/express")).StatusCode);
        // Free the settings role again so the deletion check below still finds it unused.
        var settingsOnlyId = (await Read<List<AdminTeamMemberDto>>(await super.GetAsync("/api/admin/team"))).Single(x => x.Email == "settings-only@example.test").Id;
        Assert.Equal(HttpStatusCode.OK, (await super.PatchAsJsonAsync($"/api/admin/team/{settingsOnlyId}/role", new AdminTeamRoleRequest(orderDesk, "Move to order desk"), Json)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await lead.PostAsJsonAsync("/api/admin/team", new CreateAdminRequest("Settings Person", "settings@example.test", null, password, "Escalation", settingsRole), Json)).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await lead.PostAsJsonAsync("/api/admin/team", new CreateAdminRequest("Second Agent", "agent2@example.test", null, password, "Within my access", orderDesk), Json)).StatusCode);
        var team = await Read<List<AdminTeamMemberDto>>(await lead.GetAsync("/api/admin/team"));
        var me = team.Single(x => x.FullName == "Test Admin");
        Assert.Equal(HttpStatusCode.Forbidden, (await lead.PatchAsJsonAsync($"/api/admin/team/{me.Id}", new AdminTeamStatusRequest(false, "Escalation"), Json)).StatusCode);
        // users.manage alone cannot promote someone to (super) administrator.
        using var customer = f.CreateClient();
        var account = await Register(customer, f.Password);
        Assert.Equal(HttpStatusCode.Forbidden, (await lead.PatchAsJsonAsync($"/api/admin/users/{account.User.Id}", new AdminUserRequest("Promoted", Role.Admin, true, "Escalation"), Json)).StatusCode);

        // Role edits apply immediately; roles in use cannot be deleted.
        var desk = (await Read<AdminRolesResponse>(await super.GetAsync("/api/admin/roles"))).Roles.Single(r => r.Id == orderDesk);
        Assert.Equal(HttpStatusCode.OK, (await super.PutAsJsonAsync($"/api/admin/roles/{orderDesk}", new SaveAdminRoleRequest("Order desk", "Orders and rides", ["orders.manage", "rides.view"], desk.Version, "Add rides"), Json)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await super.PutAsJsonAsync($"/api/admin/roles/{orderDesk}", new SaveAdminRoleRequest("Order desk", null, ["orders.view"], desk.Version, "Stale"), Json)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await agent.GetAsync("/api/admin/rides")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await agent.GetAsync("/api/admin/overview")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await super.PostAsJsonAsync($"/api/admin/roles/{orderDesk}/delete", new AdminTeamReasonRequest("Cleanup"), Json)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await super.PostAsJsonAsync($"/api/admin/roles/{settingsRole}/delete", new AdminTeamReasonRequest("Unused"), Json)).StatusCode);

        // Role changes: cannot touch yourself, and the last super administrator must stay.
        Assert.Equal(HttpStatusCode.Conflict, (await super.PatchAsJsonAsync($"/api/admin/team/{me.Id}/role", new AdminTeamRoleRequest(orderDesk, "Self demotion"), Json)).StatusCode);
        var agentId = team.Single(x => x.Email == "orders@example.test").Id;
        Assert.Equal(HttpStatusCode.OK, (await super.PatchAsJsonAsync($"/api/admin/team/{agentId}/role", new AdminTeamRoleRequest(null, "Promote to super"), Json)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await agent.GetAsync("/api/admin/settings")).StatusCode);
        var audit = await Read<AdminPage<AdminAudit>>(await super.GetAsync("/api/admin/audit?filter=roles"));
        Assert.Equal(5, audit.Total); // 3 creates + 1 update + 1 delete
    }

    [Fact]
    public async Task Admin_creates_customer_users_who_can_sign_in()
    {
        await using var f = new ApiFactory(); await f.InitializeDatabase();
        using var admin = await Admin(f);
        var password = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(18));
        var request = new AdminCreateUserRequest("Phone Customer", "012 777 888", "Phone@Example.test", password, "Phone support sign-up");
        Assert.Equal(HttpStatusCode.Created, (await admin.PostAsJsonAsync("/api/admin/users", request, Json)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PostAsJsonAsync("/api/admin/users", request with { Email = null }, Json)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/admin/users", request with { PhoneNumber = "12", Email = null }, Json)).StatusCode);
        using var customer = f.CreateClient();
        var login = await customer.PostAsJsonAsync("/api/auth/login", new LoginRequest("012777888", password));
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var session = await Read<AuthResponse>(login);
        Assert.Equal(Role.Customer, session.User.Role); Assert.Equal("Phone Customer", session.User.FullName);
        SignIn(customer, session);
        Assert.Equal(HttpStatusCode.Forbidden, (await customer.PostAsJsonAsync("/api/admin/users", request with { PhoneNumber = "012777889", Email = null }, Json)).StatusCode);
        var audit = await Read<AdminPage<AdminAudit>>(await admin.GetAsync("/api/admin/audit?filter=users"));
        Assert.Equal(session.User.Id, Assert.Single(audit.Items).TargetId);
    }
}
