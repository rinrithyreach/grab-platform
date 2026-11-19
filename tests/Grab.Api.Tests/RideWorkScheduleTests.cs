using System.Net;
using System.Net.Http.Json;
using Grab.Api.DTOs;
using Grab.Api.Models;

namespace Grab.Api.Tests;

public partial class ApiTests
{
    [Fact]
    public async Task GrabRide_working_hours_are_saved_at_registration_editable_and_restored_after_sign_in()
    {
        await using var f = new ApiFactory();
        await f.InitializeDatabase();
        using var rider = f.CreateClient();
        const string hours = "Mon 08:00-17:00; Tue 08:00-17:00; Wed 08:00-17:00; Thu 08:00-17:00; Fri 08:00-17:00; Sat 09:00-14:00; Sun 18:00-02:00";
        var request = new MerchantRegisterRequest("098111222", f.Password, Business(MerchantServiceKind.GrabRide) with { OpeningHours = hours });
        var registered = await rider.PostAsJsonAsync("/api/merchants/register", request, Json);
        Assert.Equal(HttpStatusCode.Created, registered.StatusCode);
        var account = await Read<AuthResponse>(registered);
        SignIn(rider, account);
        var dashboard = await Read<MerchantDashboardDto>(await rider.GetAsync("/api/merchants/me"));
        Assert.Equal(hours, dashboard.Profile.OpeningHours);
        Assert.Empty(dashboard.Listings);

        var changed = Business(MerchantServiceKind.GrabRide) with { OpeningHours = "Sun 20:00-03:00; Mon 09:00-18:00" };
        var updated = await rider.PatchAsJsonAsync("/api/merchants/me", changed, Json);
        Assert.Equal(HttpStatusCode.OK, updated.StatusCode);
        const string expected = "Mon 09:00-18:00; Sun 20:00-03:00";
        Assert.Equal(expected, (await Read<MerchantProfileDto>(updated)).OpeningHours);

        using var fresh = f.CreateClient();
        var login = await fresh.PostAsJsonAsync("/api/merchants/login", new LoginRequest(account.User.PhoneNumber, f.Password));
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        SignIn(fresh, await Read<AuthResponse>(login));
        Assert.Equal(expected, (await Read<MerchantDashboardDto>(await fresh.GetAsync("/api/merchants/me"))).Profile.OpeningHours);

        var cleared = await fresh.PatchAsJsonAsync("/api/merchants/me", changed with { OpeningHours = "" }, Json);
        Assert.Equal(HttpStatusCode.OK, cleared.StatusCode);
        Assert.Empty((await Read<MerchantDashboardDto>(await fresh.GetAsync("/api/merchants/me"))).Profile.OpeningHours);
    }

    [Fact]
    public async Task GrabRide_rejects_invalid_or_duplicate_shifts_without_changing_saved_hours()
    {
        await using var f = new ApiFactory();
        await f.InitializeDatabase();
        using var rider = f.CreateClient();
        await MerchantAccount(rider, f.Password, MerchantServiceKind.GrabRide);
        var before = (await Read<MerchantDashboardDto>(await rider.GetAsync("/api/merchants/me"))).Profile.OpeningHours;
        foreach (var hours in new[] { "Mon -17:00", "Mon 08:00-", "Mon 24:00-17:00", "Mon 08:60-17:00", "Mon 08:00-08:00",
            "Mon 08:00-17:00; Mon 09:00-18:00", "Everyday 08:00-17:00", "Mon 08:00-17:00;" })
        {
            var response = await rider.PatchAsJsonAsync("/api/merchants/me", Business(MerchantServiceKind.GrabRide) with { OpeningHours = hours }, Json);
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal(before, (await Read<MerchantDashboardDto>(await rider.GetAsync("/api/merchants/me"))).Profile.OpeningHours);
        }
    }
}
