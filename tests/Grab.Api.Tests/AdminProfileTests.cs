using System.Net;
using System.Net.Http.Json;
using Grab.Api.DTOs;
using Grab.Api.Models;

namespace Grab.Api.Tests;

public partial class ApiTests
{
    private static SaveAdminProfileRequest ProfileEdit(AdminProfileDto p) => new(
        "Updated Administrator", p.Email, "+85512345678", "Operations manager", "Manages daily operations.\nCoordinates customer support.", 15, true, p.Version, null);

    [Fact]
    public async Task Admin_profile_edits_persist_and_are_available_without_management_permissions()
    {
        await using var f = new ApiFactory(); await f.InitializeDatabase();
        using var admin = await Admin(f); using var guest = f.CreateClient(); using var customer = f.CreateClient();
        await Register(customer, f.Password);
        var roleId = await CreateRole(admin, "Profile viewer", "overview.view");
        Assert.Equal(HttpStatusCode.Created, (await admin.PostAsJsonAsync("/api/admin/team", new CreateAdminRequest("Limited Administrator", "profile@example.test", "Support", f.Password, "Test self-service profile", roleId), Json)).StatusCode);
        using var limited = await AdminByEmail(f, "profile@example.test", f.Password);
        var profile = await Read<AdminProfileDto>(await limited.GetAsync("/api/admin/profile"));
        var request = ProfileEdit(profile);
        Assert.Equal(HttpStatusCode.Unauthorized, (await guest.PatchAsJsonAsync("/api/admin/profile", request, Json)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await customer.PatchAsJsonAsync("/api/admin/profile", request, Json)).StatusCode);
        var response = await limited.PatchAsJsonAsync("/api/admin/profile", request, Json);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var saved = await Read<AdminProfileResponse>(response);
        Assert.Equal(request.FullName, saved.Profile.FullName); Assert.Equal(request.FullName, saved.Session.User.FullName);
        Assert.Equal(request.ContactPhone, saved.Profile.ContactPhone); Assert.Equal(request.JobTitle, saved.Profile.JobTitle); Assert.Equal(request.Bio, saved.Profile.Bio);
        Assert.Equal(roleId, saved.Profile.RoleId); Assert.False(saved.Profile.IsSuperAdmin);
        Assert.Equal(profile.Email, saved.Profile.Email); Assert.NotEqual(profile.Version, saved.Profile.Version);
        Assert.Equal(HttpStatusCode.Conflict, (await limited.PatchAsJsonAsync("/api/admin/profile", request, Json)).StatusCode);
        SignIn(limited, saved.Session);
        var reloaded = await Read<AdminProfileDto>(await limited.GetAsync("/api/admin/profile"));
        Assert.Equal(saved.Profile.FullName, reloaded.FullName); Assert.Equal(saved.Profile.JobTitle, reloaded.JobTitle);
        Assert.Equal(saved.Profile.ContactPhone, reloaded.ContactPhone); Assert.Equal(saved.Profile.Bio, reloaded.Bio);
        Assert.Equal(saved.Profile.Version, reloaded.Version);
        var activity = await Read<List<AdminActivityDto>>(await limited.GetAsync("/api/admin/profile/activity"));
        Assert.Contains(activity, x => x.Resource == "profile" && x.Action == "Updated administrator profile");
    }

    [Fact]
    public async Task Phone_only_admins_can_edit_their_profile_and_preferences_without_adding_an_email()
    {
        await using var f = new ApiFactory(); await f.InitializeDatabase();
        using var admin = await Admin(f); using var phoneAdmin = f.CreateClient();
        var account = await Register(phoneAdmin, f.Password);
        Assert.Equal(HttpStatusCode.OK, (await admin.PatchAsJsonAsync($"/api/admin/users/{account.User.Id}", new AdminUserRequest("Phone Administrator", Role.Admin, true, "Enable administrator account"), Json)).StatusCode);
        SignIn(phoneAdmin, await Read<AuthResponse>(await phoneAdmin.PostAsJsonAsync("/api/auth/login", new LoginRequest(account.User.PhoneNumber, f.Password))));
        var profile = await Read<AdminProfileDto>(await phoneAdmin.GetAsync("/api/admin/profile"));
        Assert.Null(profile.Email);
        var response = await phoneAdmin.PatchAsJsonAsync("/api/admin/profile", ProfileEdit(profile), Json);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var saved = await Read<AdminProfileResponse>(response);
        Assert.Null(saved.Profile.Email); Assert.Equal("Updated Administrator", saved.Profile.FullName);
        SignIn(phoneAdmin, saved.Session);
        var preferences = await phoneAdmin.PatchAsJsonAsync("/api/admin/profile", ProfileEdit(saved.Profile) with { RefreshSeconds = 60, CompactTables = false }, Json);
        Assert.Equal(HttpStatusCode.OK, preferences.StatusCode);
        var updated = await Read<AdminProfileResponse>(preferences);
        Assert.Null(updated.Profile.Email); Assert.Equal(60, updated.Profile.RefreshSeconds); Assert.False(updated.Profile.CompactTables);
        Assert.Equal(HttpStatusCode.BadRequest, (await phoneAdmin.PatchAsJsonAsync("/api/admin/profile", ProfileEdit(updated.Profile) with { Email = "new@example.test" }, Json)).StatusCode);
        var added = await phoneAdmin.PatchAsJsonAsync("/api/admin/profile", ProfileEdit(updated.Profile) with { Email = "new@example.test", CurrentPassword = f.Password }, Json);
        Assert.Equal(HttpStatusCode.OK, added.StatusCode);
        var withEmail = await Read<AdminProfileResponse>(added);
        Assert.Equal("new@example.test", withEmail.Profile.Email);
        Assert.Equal(HttpStatusCode.Unauthorized, (await phoneAdmin.GetAsync("/api/admin/profile")).StatusCode);
        SignIn(phoneAdmin, withEmail.Session);
        Assert.Equal(HttpStatusCode.OK, (await phoneAdmin.GetAsync("/api/admin/profile")).StatusCode);
    }

    [Fact]
    public async Task Admin_profile_email_changes_require_the_current_password_and_preserve_sign_in()
    {
        await using var f = new ApiFactory(); await f.InitializeDatabase(); using var admin = await Admin(f);
        var profile = await Read<AdminProfileDto>(await admin.GetAsync("/api/admin/profile"));
        foreach (var invalid in new[] { ProfileEdit(profile) with { Email = null }, ProfileEdit(profile) with { Email = "invalid-email" }, ProfileEdit(profile) with { Email = "changed@example.test" }, ProfileEdit(profile) with { Email = "changed@example.test", CurrentPassword = "incorrect-password" } })
            Assert.Equal(HttpStatusCode.BadRequest, (await admin.PatchAsJsonAsync("/api/admin/profile", invalid, Json)).StatusCode);
        var unchanged = await Read<AdminProfileDto>(await admin.GetAsync("/api/admin/profile"));
        Assert.Equal(profile.Email, unchanged.Email); Assert.Equal(profile.FullName, unchanged.FullName);
        var response = await admin.PatchAsJsonAsync("/api/admin/profile", ProfileEdit(profile) with { Email = "CHANGED@example.test", CurrentPassword = f.Password }, Json);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var saved = await Read<AdminProfileResponse>(response);
        Assert.Equal("changed@example.test", saved.Profile.Email);
        SignIn(admin, saved.Session);
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync("/api/admin/profile")).StatusCode);
        using var newSession = await AdminByEmail(f, "changed@example.test", f.Password);
        Assert.Equal(profile.Id, (await Read<AdminProfileDto>(await newSession.GetAsync("/api/admin/profile"))).Id);
    }
}
