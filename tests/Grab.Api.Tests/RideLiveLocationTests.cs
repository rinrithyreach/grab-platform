using System.Net;
using System.Net.Http.Json;
using Grab.Api.Data;
using Grab.Api.DTOs;
using Grab.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Grab.Api.Tests;

public partial class ApiTests
{
    [Theory]
    [InlineData(RideStatus.Completed)]
    [InlineData(RideStatus.Cancelled)]
    public async Task Assigned_merchant_shares_GPS_with_only_the_customer_and_terminal_rides_clear_it(RideStatus terminal)
    {
        await using var f = new ApiFactory();
        await f.InitializeDatabase();
        using var customer = f.CreateClient();
        using var stranger = f.CreateClient();
        using var merchant = f.CreateClient();
        using var otherMerchant = f.CreateClient();
        using var guest = f.CreateClient();
        await Register(customer, f.Password);
        await Register(stranger, f.Password);
        await MerchantAccount(merchant, f.Password, MerchantServiceKind.GrabRide);
        await MerchantAccount(otherMerchant, f.Password, MerchantServiceKind.GrabRide);
        var ride = await Read<RideDto>(await customer.PostAsJsonAsync("/api/rides", Booking()));
        var path = $"/api/rides/{ride.Id}/location";
        var location = new RideLocationRequest(11.552, 104.918, 8);
        Assert.Null(ride.DriverLocation);
        Assert.Equal(HttpStatusCode.Unauthorized, (await guest.PatchAsJsonAsync(path, location)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await customer.PatchAsJsonAsync(path, location)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await merchant.PatchAsJsonAsync(path, location)).StatusCode);
        await merchant.PostAsJsonAsync($"/api/merchants/ride-requests/{ride.Id}/response", new { accept = true });
        Assert.Equal(HttpStatusCode.NotFound, (await otherMerchant.PatchAsJsonAsync(path, location)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await otherMerchant.DeleteAsync(path)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await merchant.PatchAsJsonAsync(path, new { latitude = 91, longitude = 104 })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await merchant.PatchAsJsonAsync(path, new { latitude = 11, longitude = 181 })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await merchant.PatchAsJsonAsync(path, new { latitude = 11, longitude = 104, accuracy = -1 })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await merchant.PatchAsJsonAsync(path, new { latitude = 11 })).StatusCode);
        var before = DateTimeOffset.UtcNow;
        var sent = await merchant.PatchAsJsonAsync(path, location);
        Assert.Equal(HttpStatusCode.OK, sent.StatusCode);
        var gps = (await Read<RideDto>(sent)).DriverLocation!;
        Assert.Equal(location.Latitude, gps.Latitude);
        Assert.Equal(location.Longitude, gps.Longitude);
        Assert.Equal(location.Accuracy, gps.Accuracy);
        Assert.InRange(gps.UpdatedAt, before, DateTimeOffset.UtcNow);
        Assert.Equal(gps, (await Read<RideDto>(await customer.GetAsync($"/api/rides/{ride.Id}"))).DriverLocation);
        Assert.Equal(gps, Assert.Single(await Read<List<RideDto>>(await customer.GetAsync("/api/rides/mine"))).DriverLocation);
        Assert.Equal(gps, (await Read<MerchantRideInboxDto>(await merchant.GetAsync("/api/merchants/ride-requests"))).ActiveRide!.Ride.DriverLocation);
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.GetAsync($"/api/rides/{ride.Id}")).StatusCode);
        Assert.Empty(await Read<List<RideDto>>(await stranger.GetAsync("/api/rides/mine")));

        Assert.Equal(HttpStatusCode.OK, (await merchant.DeleteAsync(path)).StatusCode);
        Assert.Null((await Read<RideDto>(await customer.GetAsync($"/api/rides/{ride.Id}"))).DriverLocation);
        Assert.Equal(HttpStatusCode.OK, (await merchant.PatchAsJsonAsync(path, new RideLocationRequest(0, 0, null))).StatusCode);
        Assert.Equal(0, (await Read<RideDto>(await customer.GetAsync($"/api/rides/{ride.Id}"))).DriverLocation!.Latitude);
        if (terminal == RideStatus.Completed)
            Assert.Equal(HttpStatusCode.OK, (await merchant.PatchAsJsonAsync($"/api/rides/{ride.Id}/status", new { status = "InProgress" })).StatusCode);
        var ended = await (terminal == RideStatus.Cancelled ? customer : merchant)
            .PatchAsJsonAsync($"/api/rides/{ride.Id}/status", new { status = terminal.ToString() });
        Assert.Equal(HttpStatusCode.OK, ended.StatusCode);
        Assert.Null((await Read<RideDto>(ended)).DriverLocation);
        Assert.Null((await Read<RideDto>(await customer.GetAsync($"/api/rides/{ride.Id}"))).DriverLocation);
        Assert.Equal(HttpStatusCode.Conflict, (await merchant.PatchAsJsonAsync(path, location)).StatusCode);
        using var scope = f.Services.CreateScope();
        var stored = await scope.ServiceProvider.GetRequiredService<GrabDbContext>().Rides.SingleAsync(r => r.Id == ride.Id);
        Assert.Null(stored.DriverLatitude);
        Assert.Null(stored.DriverLongitude);
        Assert.Null(stored.DriverLocationUpdatedAt);
    }

    [Fact]
    public async Task Assigned_driver_can_share_and_stop_GPS_during_an_active_ride()
    {
        await using var f = new ApiFactory();
        await f.InitializeDatabase();
        using var customer = f.CreateClient();
        using var driver = f.CreateClient();
        using var otherDriver = f.CreateClient();
        using var admin = await Admin(f);
        await Register(customer, f.Password);
        await Driver(f, admin, driver);
        await Driver(f, admin, otherDriver);
        var ride = await Read<RideDto>(await customer.PostAsJsonAsync("/api/rides", Booking()));
        Assert.Equal(HttpStatusCode.OK, (await driver.PatchAsJsonAsync($"/api/rides/{ride.Id}/status", new { status = "Accepted" })).StatusCode);
        var path = $"/api/rides/{ride.Id}/location";
        Assert.Equal(HttpStatusCode.NotFound, (await otherDriver.PatchAsJsonAsync(path, new RideLocationRequest(11.55, 104.92, 10))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await driver.PatchAsJsonAsync(path, new RideLocationRequest(11.55, 104.92, 10))).StatusCode);
        Assert.NotNull((await Read<RideDto>(await customer.GetAsync($"/api/rides/{ride.Id}"))).DriverLocation);
        Assert.Equal(HttpStatusCode.OK, (await driver.DeleteAsync(path)).StatusCode);
        Assert.Null((await Read<RideDto>(await customer.GetAsync($"/api/rides/{ride.Id}"))).DriverLocation);
    }
}
