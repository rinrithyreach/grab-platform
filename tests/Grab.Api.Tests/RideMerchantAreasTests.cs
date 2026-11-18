using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Grab.Api.Data;
using Grab.Api.DTOs;
using Grab.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Grab.Api.Tests;

public partial class ApiTests
{
    [Fact]
    public async Task Ride_merchant_areas_show_registered_riders_without_listings_and_omit_private_account_fields()
    {
        await using var f = new ApiFactory();
        await f.InitializeDatabase();
        using var publicClient = f.CreateClient();
        using var rider = f.CreateClient();
        using var food = f.CreateClient();
        using var express = f.CreateClient();
        Assert.Empty(await Read<List<RideMerchantAreaDto>>(await publicClient.GetAsync("/api/merchants/ride-areas")));
        await MerchantAccount(rider, f.Password, MerchantServiceKind.GrabRide);
        await MerchantAccount(food, f.Password, MerchantServiceKind.GrabFood);
        await MerchantAccount(express, f.Password, MerchantServiceKind.GrabExpress);
        var profile = Business(MerchantServiceKind.GrabRide) with { OwnerName = "Dara Map", Address = "GPS: 11.556400, 104.928200", OpeningHours = "Mon 08:00-17:00" };
        Assert.Equal(HttpStatusCode.OK, (await rider.PatchAsJsonAsync("/api/merchants/me", profile, Json)).StatusCode);
        var response = await publicClient.GetAsync("/api/merchants/ride-areas?page=1");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var area = Assert.Single(await Read<List<RideMerchantAreaDto>>(response));
        Assert.Equal("Dara Map", area.Name);
        Assert.Equal(profile.Address, area.Address);
        Assert.Equal(profile.OpeningHours, area.OpeningHours);
        using (var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync()))
            Assert.Equal(new[] { "address", "id", "name", "openingHours", "vehicleType" }, json.RootElement[0].EnumerateObject().Select(p => p.Name).OrderBy(name => name).ToArray());
        Assert.Empty((await Read<MerchantDashboardDto>(await rider.GetAsync("/api/merchants/me"))).Listings);

        var updated = profile with { Address = "Tonle Basak, Khan Chamkar Mon, Phnom Penh", OpeningHours = "Sun 18:00-02:00" };
        Assert.Equal(HttpStatusCode.OK, (await rider.PatchAsJsonAsync("/api/merchants/me", updated, Json)).StatusCode);
        var changed = Assert.Single(await Read<List<RideMerchantAreaDto>>(await publicClient.GetAsync("/api/merchants/ride-areas")));
        Assert.Equal(updated.Address, changed.Address);
        Assert.Equal(updated.OpeningHours, changed.OpeningHours);
        Assert.Equal(HttpStatusCode.BadRequest, (await publicClient.GetAsync("/api/merchants/ride-areas?page=0")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await publicClient.GetAsync("/api/merchants/ride-areas?page=10001")).StatusCode);
    }

    [Fact]
    public async Task Ride_merchant_area_pages_are_bounded_disjoint_and_only_include_current_merchant_accounts()
    {
        await using var f = new ApiFactory();
        await f.InitializeDatabase();
        Guid changedAccount;
        using (var scope = f.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<GrabDbContext>();
            var users = Enumerable.Range(0, 105).Select(i => new User { FullName = $"Rider {i}", PhoneNumber = $"+85580{i:0000000}", Role = Role.Merchant, PasswordHash = "test-fixture-only" }).ToArray();
            db.Users.AddRange(users);
            db.Merchants.AddRange(users.Select(user => new Merchant { UserId = user.Id, Service = MerchantServiceKind.GrabRide, BusinessName = user.FullName, OwnerName = user.FullName, Address = "GPS: 11.556400, 104.928200" }));
            changedAccount = users[0].Id;
            await db.SaveChangesAsync();
        }
        using var client = f.CreateClient();
        var first = await Read<List<RideMerchantAreaDto>>(await client.GetAsync("/api/merchants/ride-areas?page=1"));
        var second = await Read<List<RideMerchantAreaDto>>(await client.GetAsync("/api/merchants/ride-areas?page=2"));
        Assert.Equal(100, first.Count);
        Assert.Equal(5, second.Count);
        Assert.Empty(first.Select(area => area.Id).Intersect(second.Select(area => area.Id)));
        using (var scope = f.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<GrabDbContext>();
            (await db.Users.SingleAsync(user => user.Id == changedAccount)).Role = Role.Customer;
            await db.SaveChangesAsync();
        }
        var current = (await Read<List<RideMerchantAreaDto>>(await client.GetAsync("/api/merchants/ride-areas?page=1")))
            .Concat(await Read<List<RideMerchantAreaDto>>(await client.GetAsync("/api/merchants/ride-areas?page=2"))).ToList();
        Assert.Equal(104, current.Count);
        Assert.DoesNotContain(current, area => area.Name == "Rider 0");
    }
}
