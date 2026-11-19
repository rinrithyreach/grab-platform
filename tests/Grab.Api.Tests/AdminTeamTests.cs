using System.Net;
using System.Net.Http.Json;
using Grab.Api.DTOs;
using Grab.Api.Models;

namespace Grab.Api.Tests;

public partial class ApiTests
{
    [Fact]
    public async Task Admin_settings_and_profile_persist_with_optimistic_concurrency()
    {
        await using var f = new ApiFactory(); await f.InitializeDatabase();
        using var admin = await Admin(f);
        var settings = await Read<PlatformSettingsDto>(await admin.GetAsync("/api/admin/settings"));
        var save = new SavePlatformSettingsRequest("help@example.test", null, "Daily 08:00-20:00", "Phnom Penh", true, "Holiday hours apply",
            false, settings.MaintenanceMessage, true, false, true, true, true, settings.Version, "Holiday support update");
        var saved = await Read<PlatformSettingsDto>(await admin.PatchAsJsonAsync("/api/admin/settings", save, Json));
        Assert.Equal("help@example.test", saved.SupportEmail); Assert.False(saved.FoodEnabled); Assert.NotEqual(settings.Version, saved.Version);
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PatchAsJsonAsync("/api/admin/settings", save, Json)).StatusCode);
        var profile = await Read<AdminProfileDto>(await admin.GetAsync("/api/admin/profile"));
        var updated = await Read<AdminProfileResponse>(await admin.PatchAsJsonAsync("/api/admin/profile",
            new SaveAdminProfileRequest("Test Admin", profile.Email!, null, "Operations lead", "Runs the console.", 15, true, profile.Version, null), Json));
        Assert.Equal("Operations lead", updated.Profile.JobTitle); Assert.Equal(15, updated.Profile.RefreshSeconds);
        var activity = await Read<List<AdminActivityDto>>(await admin.GetAsync("/api/admin/profile/activity"));
        Assert.Equal(["profile", "settings"], activity.Select(a => a.Resource));
    }

    [Fact]
    public async Task Admin_team_lists_profiles_onboards_suspends_and_revokes_with_audit()
    {
        await using var f = new ApiFactory(); await f.InitializeDatabase();
        using var admin = await Admin(f);
        using var customer = f.CreateClient();
        await Register(customer, f.Password);
        Assert.Equal(HttpStatusCode.Forbidden, (await customer.GetAsync("/api/admin/team")).StatusCode);
        var me = Assert.Single(await Read<List<AdminTeamMemberDto>>(await admin.GetAsync("/api/admin/team")));
        Assert.True(me.IsYou); Assert.True(me.IsActive);

        var tempPassword = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(18));
        var request = new CreateAdminRequest("Second Admin", "Second@Example.test", "Support lead", tempPassword, "New support lead");
        Assert.Equal(HttpStatusCode.Forbidden, (await customer.PostAsJsonAsync("/api/admin/team", request, Json)).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await admin.PostAsJsonAsync("/api/admin/team", request, Json)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PostAsJsonAsync("/api/admin/team", request, Json)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/admin/team", request with { Email = "third@example.test", TemporaryPassword = "short" }, Json)).StatusCode);

        var team = await Read<List<AdminTeamMemberDto>>(await admin.GetAsync("/api/admin/team"));
        Assert.Equal(2, team.Count); Assert.True(team[0].IsYou);
        var second = team.Single(x => !x.IsYou);
        Assert.Equal("second@example.test", second.Email); Assert.Equal("Support lead", second.JobTitle);
        Assert.DoesNotContain("passwordHash", await (await admin.GetAsync("/api/admin/team")).Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);

        using var secondClient = f.CreateClient();
        var login = await secondClient.PostAsJsonAsync("/api/auth/admin/login", new AdminLoginRequest("second@example.test", tempPassword));
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        SignIn(secondClient, await Read<AuthResponse>(login));
        Assert.Equal(HttpStatusCode.OK, (await secondClient.GetAsync("/api/admin/overview")).StatusCode);

        // Self-management goes through My profile; the team endpoints refuse it.
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PatchAsJsonAsync($"/api/admin/team/{me.Id}", new AdminTeamStatusRequest(false, "Self suspension"), Json)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.PatchAsJsonAsync($"/api/admin/team/{Guid.NewGuid()}", new AdminTeamStatusRequest(false, "Unknown admin"), Json)).StatusCode);

        Assert.Equal(HttpStatusCode.OK, (await admin.PostAsJsonAsync($"/api/admin/team/{second.Id}/revoke-sessions", new AdminTeamReasonRequest("Lost laptop"), Json)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await secondClient.GetAsync("/api/admin/overview")).StatusCode);
        SignIn(secondClient, await Read<AuthResponse>(await secondClient.PostAsJsonAsync("/api/auth/admin/login", new AdminLoginRequest("second@example.test", tempPassword))));

        Assert.Equal(HttpStatusCode.OK, (await admin.PatchAsJsonAsync($"/api/admin/team/{second.Id}", new AdminTeamStatusRequest(false, "Left the team"), Json)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await secondClient.GetAsync("/api/admin/overview")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await secondClient.PostAsJsonAsync("/api/auth/admin/login", new AdminLoginRequest("second@example.test", tempPassword))).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PatchAsJsonAsync($"/api/admin/team/{second.Id}", new AdminTeamStatusRequest(false, "Duplicate suspension"), Json)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PatchAsJsonAsync($"/api/admin/team/{second.Id}", new AdminTeamStatusRequest(true, "Returned to the team"), Json)).StatusCode);

        var audit = await Read<AdminPage<AdminAudit>>(await admin.GetAsync("/api/admin/audit?filter=team"));
        Assert.Equal(4, audit.Total);
        Assert.All(audit.Items, a => Assert.Equal(me.Id, a.ActorId));
        Assert.All(audit.Items, a => Assert.Equal(second.Id, a.TargetId));
        Assert.Equal(4, (await Read<List<AdminTeamMemberDto>>(await admin.GetAsync("/api/admin/team"))).Single(x => x.IsYou).ChangesLast30Days);
    }
}
