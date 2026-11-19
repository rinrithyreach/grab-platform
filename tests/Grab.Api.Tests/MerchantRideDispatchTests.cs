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
    [Fact]
    public async Task Customer_request_can_be_declined_by_one_merchant_accepted_by_another_and_completed_across_sessions()
    {
        await using var f = new ApiFactory();
        await f.InitializeDatabase();
        using var customer = f.CreateClient();
        using var stranger = f.CreateClient();
        using var first = f.CreateClient();
        using var second = f.CreateClient();
        using var food = f.CreateClient();
        using var guest = f.CreateClient();
        await Register(customer, f.Password);
        await Register(stranger, f.Password);
        await MerchantAccount(first, f.Password, MerchantServiceKind.GrabRide);
        var secondAccount = await MerchantAccount(second, f.Password, MerchantServiceKind.GrabRide);
        await MerchantAccount(food, f.Password, MerchantServiceKind.GrabFood);
        var secondProfile = (await Read<MerchantDashboardDto>(await second.GetAsync("/api/merchants/me"))).Profile;
        var ride = await Read<RideDto>(await customer.PostAsJsonAsync("/api/rides", Booking()));
        var inbox = await Read<MerchantRideInboxDto>(await first.GetAsync("/api/merchants/ride-requests"));
        Assert.Equal(ride.Id, Assert.Single(inbox.Requests).Ride.Id);
        Assert.Null(inbox.ActiveRide);
        Assert.Equal(HttpStatusCode.Unauthorized, (await guest.GetAsync("/api/merchants/ride-requests")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await customer.GetAsync("/api/merchants/ride-requests")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await food.GetAsync("/api/merchants/ride-requests")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await first.PostAsJsonAsync($"/api/merchants/ride-requests/{ride.Id}/response", new { })).StatusCode);
        Assert.Empty(await Read<List<RideDto>>(await first.GetAsync("/api/rides")));
        Assert.Equal(HttpStatusCode.NotFound, (await first.GetAsync($"/api/rides/{ride.Id}")).StatusCode);

        var declined = await first.PostAsJsonAsync($"/api/merchants/ride-requests/{ride.Id}/response", new { accept = false });
        Assert.Equal(HttpStatusCode.OK, declined.StatusCode);
        Assert.Empty((await Read<MerchantRideInboxDto>(declined)).Requests);
        Assert.Empty((await Read<MerchantRideInboxDto>(await first.GetAsync("/api/merchants/ride-requests"))).Requests);
        Assert.Single((await Read<MerchantRideInboxDto>(await second.GetAsync("/api/merchants/ride-requests"))).Requests);
        Assert.Equal(RideStatus.Pending, (await Read<RideDto>(await customer.GetAsync($"/api/rides/{ride.Id}"))).Status);
        Assert.Equal(HttpStatusCode.Conflict, (await first.PostAsJsonAsync($"/api/merchants/ride-requests/{ride.Id}/response", new { accept = true })).StatusCode);

        var accepted = await second.PostAsJsonAsync($"/api/merchants/ride-requests/{ride.Id}/response", new { accept = true });
        Assert.Equal(HttpStatusCode.OK, accepted.StatusCode);
        var active = (await Read<MerchantRideInboxDto>(accepted)).ActiveRide!;
        Assert.Equal(ride.Id, active.Ride.Id);
        Assert.Equal(secondProfile.Id, active.Ride.MerchantId);
        Assert.Null(active.Ride.DriverId);
        var customerView = await Read<RideDto>(await customer.GetAsync($"/api/rides/{ride.Id}"));
        Assert.Equal(RideStatus.Accepted, customerView.Status);
        Assert.Equal(secondProfile.BusinessName, customerView.MerchantName);
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.GetAsync($"/api/rides/{ride.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await first.GetAsync($"/api/rides/{ride.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await first.PatchAsJsonAsync($"/api/rides/{ride.Id}/status", new { status = "InProgress" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await second.PostAsJsonAsync("/api/drivers", new DriverRequest(secondAccount.User.Id, "Car", "OTHER"))).StatusCode);

        using var refreshedMerchant = f.CreateClient();
        var login = await refreshedMerchant.PostAsJsonAsync("/api/merchants/login", new LoginRequest(secondAccount.User.PhoneNumber, f.Password));
        SignIn(refreshedMerchant, await Read<AuthResponse>(login));
        Assert.Equal(ride.Id, (await Read<MerchantRideInboxDto>(await refreshedMerchant.GetAsync("/api/merchants/ride-requests"))).ActiveRide!.Ride.Id);
        Assert.Equal(HttpStatusCode.OK, (await refreshedMerchant.PatchAsJsonAsync($"/api/rides/{ride.Id}/status", new { status = "InProgress" })).StatusCode);
        Assert.Equal(RideStatus.InProgress, (await Read<RideDto>(await customer.GetAsync($"/api/rides/{ride.Id}"))).Status);
        Assert.Equal(HttpStatusCode.OK, (await refreshedMerchant.PatchAsJsonAsync($"/api/rides/{ride.Id}/status", new { status = "Completed" })).StatusCode);
        Assert.Equal(RideStatus.Completed, (await Read<RideDto>(await customer.GetAsync($"/api/rides/{ride.Id}"))).Status);
        Assert.Null((await Read<MerchantRideInboxDto>(await refreshedMerchant.GetAsync("/api/merchants/ride-requests"))).ActiveRide);
        Assert.Equal(HttpStatusCode.Created, (await customer.PostAsJsonAsync("/api/payments", new PaymentRequest(ride.Id))).StatusCode);
        Assert.Equal(ride.Id, Assert.Single(await Read<List<RideDto>>(await second.GetAsync("/api/rides/mine"))).Id);
    }

    [Fact]
    public async Task Simultaneous_merchants_cannot_both_accept_the_same_request()
    {
        await using var f = new ApiFactory();
        await f.InitializeDatabase();
        using var customer = f.CreateClient();
        using var first = f.CreateClient();
        using var second = f.CreateClient();
        await Register(customer, f.Password);
        await MerchantAccount(first, f.Password, MerchantServiceKind.GrabRide);
        await MerchantAccount(second, f.Password, MerchantServiceKind.GrabRide);
        var ride = await Read<RideDto>(await customer.PostAsJsonAsync("/api/rides", Booking()));
        var results = await Task.WhenAll(first.PostAsJsonAsync($"/api/merchants/ride-requests/{ride.Id}/response", new { accept = true }),
            second.PostAsJsonAsync($"/api/merchants/ride-requests/{ride.Id}/response", new { accept = true }));
        Assert.Single(results, response => response.StatusCode == HttpStatusCode.OK);
        Assert.Single(results, response => response.StatusCode == HttpStatusCode.Conflict);
        using var scope = f.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<GrabDbContext>();
        Assert.Single(await db.RideMerchantResponses.Where(response => response.RideId == ride.Id && response.IsActive).ToListAsync());
        Assert.NotNull((await Read<RideDto>(await customer.GetAsync($"/api/rides/{ride.Id}"))).MerchantId);
    }

    [Fact]
    public async Task One_merchant_cannot_accept_two_rides_simultaneously_and_customer_cancellation_releases_the_slot()
    {
        await using var f = new ApiFactory();
        await f.InitializeDatabase();
        using var customer = f.CreateClient();
        using var firstTab = f.CreateClient();
        using var secondTab = f.CreateClient();
        await Register(customer, f.Password);
        var account = await MerchantAccount(firstTab, f.Password, MerchantServiceKind.GrabRide);
        SignIn(secondTab, account);
        var firstRide = await Read<RideDto>(await customer.PostAsJsonAsync("/api/rides", Booking()));
        var secondRide = await Read<RideDto>(await customer.PostAsJsonAsync("/api/rides", Booking()));
        var responses = await Task.WhenAll(firstTab.PostAsJsonAsync($"/api/merchants/ride-requests/{firstRide.Id}/response", new { accept = true }),
            secondTab.PostAsJsonAsync($"/api/merchants/ride-requests/{secondRide.Id}/response", new { accept = true }));
        Assert.Single(responses, response => response.StatusCode == HttpStatusCode.OK);
        Assert.Single(responses, response => response.StatusCode == HttpStatusCode.Conflict);
        var rides = await Read<List<RideDto>>(await customer.GetAsync("/api/rides/mine"));
        var active = Assert.Single(rides, ride => ride.Status == RideStatus.Accepted);
        var pending = Assert.Single(rides, ride => ride.Status == RideStatus.Pending);
        Assert.Equal(HttpStatusCode.OK, (await customer.PatchAsJsonAsync($"/api/rides/{active.Id}/status", new { status = "Cancelled" })).StatusCode);
        Assert.Null((await Read<MerchantRideInboxDto>(await firstTab.GetAsync("/api/merchants/ride-requests"))).ActiveRide);
        Assert.Equal(HttpStatusCode.OK, (await firstTab.PostAsJsonAsync($"/api/merchants/ride-requests/{pending.Id}/response", new { accept = true })).StatusCode);
        Assert.Equal(pending.Id, (await Read<MerchantRideInboxDto>(await firstTab.GetAsync("/api/merchants/ride-requests"))).ActiveRide!.Ride.Id);
    }
}
