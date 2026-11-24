using System.Net;
using System.Net.Http.Json;
using Grab.Api.DTOs;
using Grab.Api.Models;

namespace Grab.Api.Tests;

public partial class ApiTests
{
    [Fact]
    public async Task Legacy_routes_enforce_administrator_permissions_for_reads_and_writes()
    {
        await using var f = new ApiFactory(); await f.InitializeDatabase();
        using var super = await Admin(f);
        using var customer = f.CreateClient();
        await Register(customer, f.Password);
        var ride = await Read<RideDto>(await customer.PostAsJsonAsync("/api/rides", Booking(), Json));
        var delivery = await Read<ParcelDeliveryDto>(await customer.PostAsJsonAsync("/api/deliveries", Parcel(), Json));
        var roleId = await CreateRole(super, "Restricted operator", "overview.view");
        Assert.Equal(HttpStatusCode.Created, (await super.PostAsJsonAsync("/api/admin/team",
            new CreateAdminRequest("Restricted operator", "restricted@example.test", null, f.Password, "Security test", roleId), Json)).StatusCode);
        using var restricted = await AdminByEmail(f, "restricted@example.test", f.Password);

        foreach (var path in new[] { "/api/rides", "/api/rides/mine", $"/api/rides/{ride.Id}",
            $"/api/deliveries/{delivery.Id}", "/api/drivers/available" })
            Assert.Equal(HttpStatusCode.Forbidden, (await restricted.GetAsync(path)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await restricted.PatchAsJsonAsync($"/api/rides/{ride.Id}/status",
            new StatusRequest(RideStatus.Cancelled), Json)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await restricted.PostAsJsonAsync("/api/drivers",
            new DriverRequest(Guid.NewGuid(), "Car", "DENIED"), Json)).StatusCode);

        var role = (await Read<AdminRolesResponse>(await super.GetAsync("/api/admin/roles"))).Roles.Single(x => x.Id == roleId);
        Assert.Equal(HttpStatusCode.OK, (await super.PutAsJsonAsync($"/api/admin/roles/{roleId}",
            new SaveAdminRoleRequest(role.Name, null, ["rides.view", "deliveries.view", "drivers.view"], role.Version, "Grant reads"), Json)).StatusCode);
        foreach (var path in new[] { "/api/rides", "/api/rides/mine", $"/api/rides/{ride.Id}",
            $"/api/deliveries/{delivery.Id}", "/api/drivers/available" })
            Assert.Equal(HttpStatusCode.OK, (await restricted.GetAsync(path)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await restricted.PatchAsJsonAsync($"/api/rides/{ride.Id}/status",
            new StatusRequest(RideStatus.Cancelled), Json)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await restricted.PostAsJsonAsync("/api/drivers",
            new DriverRequest(Guid.NewGuid(), "Car", "DENIED"), Json)).StatusCode);
        Assert.Equal(RideStatus.Pending, (await Read<RideDto>(await customer.GetAsync($"/api/rides/{ride.Id}"))).Status);

        role = (await Read<AdminRolesResponse>(await super.GetAsync("/api/admin/roles"))).Roles.Single(x => x.Id == roleId);
        Assert.Equal(HttpStatusCode.OK, (await super.PutAsJsonAsync($"/api/admin/roles/{roleId}",
            new SaveAdminRoleRequest(role.Name, null, ["rides.manage", "drivers.manage"], role.Version, "Grant writes"), Json)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await restricted.PatchAsJsonAsync($"/api/rides/{ride.Id}/status",
            new StatusRequest(RideStatus.Cancelled), Json)).StatusCode);
        using var applicant = f.CreateClient();
        var account = await Register(applicant, f.Password);
        Assert.Equal(HttpStatusCode.Created, (await restricted.PostAsJsonAsync("/api/drivers",
            new DriverRequest(account.User.Id, "Car", "ALLOWED"), Json)).StatusCode);
        // Customer access does not require administrator permissions.
        Assert.Equal(HttpStatusCode.OK, (await customer.GetAsync("/api/drivers/available")).StatusCode);
    }

    [Fact]
    public async Task Cors_allows_supported_put_edits_only_from_configured_origins()
    {
        await using var f = new ApiFactory(); await f.InitializeDatabase();
        using var client = f.CreateClient();
        foreach (var origin in new[] { "http://localhost:3000", "https://untrusted.example" })
        {
            using var request = new HttpRequestMessage(HttpMethod.Options, $"/api/admin/roles/{Guid.NewGuid()}");
            request.Headers.Add("Origin", origin);
            request.Headers.Add("Access-Control-Request-Method", "PUT");
            request.Headers.Add("Access-Control-Request-Headers", "authorization,content-type");
            var response = await client.SendAsync(request);
            if (origin == "http://localhost:3000")
            {
                Assert.Equal(origin, Assert.Single(response.Headers.GetValues("Access-Control-Allow-Origin")));
                Assert.Contains("PUT", string.Join(",", response.Headers.GetValues("Access-Control-Allow-Methods")));
            }
            else Assert.False(response.Headers.Contains("Access-Control-Allow-Origin"));
        }
    }

    [Fact]
    public async Task Suspended_accounts_cannot_be_onboarded_through_legacy_driver_endpoint()
    {
        await using var f = new ApiFactory(); await f.InitializeDatabase();
        using var admin = await Admin(f);
        using var applicant = f.CreateClient();
        var account = await Register(applicant, f.Password);
        Assert.Equal(HttpStatusCode.OK, (await admin.PatchAsJsonAsync($"/api/admin/users/{account.User.Id}",
            new AdminUserRequest("Suspended applicant", Role.Customer, false, "Security test"), Json)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PostAsJsonAsync("/api/drivers",
            new DriverRequest(account.User.Id, "Car", "SUSPENDED"), Json)).StatusCode);
        Assert.Empty(await Read<List<DriverDto>>(await admin.GetAsync("/api/drivers/available")));
    }

    [Fact]
    public async Task Administrator_listing_prices_reject_fractional_cents_before_changing_the_listing()
    {
        await using var f = new ApiFactory(); await f.InitializeDatabase();
        using var admin = await Admin(f);
        using var merchant = f.CreateClient();
        await MerchantAccount(merchant, f.Password);
        var (profile, listing) = await PublishedListing(merchant);
        var update = new AdminListingRequest(listing.Title, listing.Description, 1.005m, true, false, "Price correction");
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PatchAsJsonAsync($"/api/admin/listings/{listing.Id}", update, Json)).StatusCode);
        var storefront = await Read<MerchantStorefrontDto>(await merchant.GetAsync($"/api/merchants/{profile.Id}"));
        Assert.Equal(listing.Price, Assert.Single(storefront.Listings).Price);
        Assert.Equal(HttpStatusCode.OK, (await admin.PatchAsJsonAsync($"/api/admin/listings/{listing.Id}", update with { Price = 1.01m }, Json)).StatusCode);
    }
}
