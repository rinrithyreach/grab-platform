using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
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
    public async Task Guest_ride_needs_name_and_phone_reaches_merchants_and_private_token_tracks_it()
    {
        await using var f = new ApiFactory(); await f.InitializeDatabase();
        using var guest = f.CreateClient(); using var stranger = f.CreateClient(); using var merchant = f.CreateClient();
        using var admin = await Admin(f);
        await MerchantAccount(merchant, f.Password, MerchantServiceKind.GrabRide);

        var valid = new GuestRideRequest(Booking(), "  Sok Dara  ", "012 345 678");
        foreach (var bad in new[] { valid with { ContactName = "" }, valid with { ContactName = "123" }, valid with { ContactPhone = "" }, valid with { ContactPhone = "hello" } })
            Assert.Equal(HttpStatusCode.BadRequest, (await guest.PostAsJsonAsync("/api/rides/guest", bad, Json)).StatusCode);

        var response = await guest.PostAsJsonAsync("/api/rides/guest", valid, Json);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var booked = await Read<GuestRideResponse>(response);
        Assert.Null(booked.Ride.CustomerId);
        Assert.Equal(RideStatus.Pending, booked.Ride.Status);
        Assert.Equal(64, booked.AccessToken.Length);
        using (var scope = f.Services.CreateScope())
        {
            var saved = await scope.ServiceProvider.GetRequiredService<GrabDbContext>().Rides.SingleAsync(x => x.Id == booked.Ride.Id);
            Assert.Equal("Sok Dara", saved.GuestName);
            Assert.Equal("+85512345678", saved.GuestPhone);
            Assert.Equal(Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(booked.AccessToken))), saved.GuestTokenHash);
        }

        // The ride ID alone, or a wrong token, never opens a guest ride.
        var path = $"/api/rides/guest/{booked.Ride.Id}";
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.GetAsync(path)).StatusCode);
        stranger.DefaultRequestHeaders.Add("X-Guest-Ride-Token", new string('0', 64));
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.GetAsync(path)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.PostAsync(path + "/cancel", null)).StatusCode);
        guest.DefaultRequestHeaders.Add("X-Guest-Ride-Token", booked.AccessToken);
        Assert.Equal(booked.Ride.Id, (await Read<RideDto>(await guest.GetAsync(path))).Id);
        Assert.Equal(HttpStatusCode.Unauthorized, (await guest.GetAsync("/api/rides/mine")).StatusCode);

        // Open requests show the guest's name but not their phone; the accepted ride shows the phone.
        var request = Assert.Single((await Read<MerchantRideInboxDto>(await merchant.GetAsync("/api/merchants/ride-requests"))).Requests);
        Assert.Equal("Sok Dara", request.CustomerName);
        Assert.Null(request.CustomerPhone);
        var inbox = await Read<MerchantRideInboxDto>(await merchant.PostAsJsonAsync($"/api/merchants/ride-requests/{booked.Ride.Id}/response", new { accept = true }));
        Assert.Equal("+85512345678", inbox.ActiveRide!.CustomerPhone);
        var tracked = await Read<RideDto>(await guest.GetAsync(path));
        Assert.Equal(RideStatus.Accepted, tracked.Status);
        Assert.NotNull(tracked.MerchantName);

        // Cancelling frees the merchant for the next request.
        Assert.Equal(RideStatus.Cancelled, (await Read<RideDto>(await guest.PostAsync(path + "/cancel", null))).Status);
        Assert.Null((await Read<MerchantRideInboxDto>(await merchant.GetAsync("/api/merchants/ride-requests"))).ActiveRide);
        Assert.Equal(HttpStatusCode.Conflict, (await guest.PostAsync(path + "/cancel", null)).StatusCode);

        var page = await Read<JsonElement>(await admin.GetAsync("/api/admin/rides?search=Sok%20Dara"));
        var row = Assert.Single(page.GetProperty("items").EnumerateArray());
        Assert.Equal("+85512345678", row.GetProperty("customerPhone").GetString());
        Assert.True(row.GetProperty("isGuest").GetBoolean());
        Assert.False(row.TryGetProperty("guestTokenHash", out _));
    }

    [Fact]
    public async Task Signed_in_customer_ride_still_uses_the_account_and_the_accepted_merchant_sees_its_phone()
    {
        await using var f = new ApiFactory(); await f.InitializeDatabase();
        using var customer = f.CreateClient(); using var merchant = f.CreateClient();
        await Register(customer, f.Password);
        await MerchantAccount(merchant, f.Password, MerchantServiceKind.GrabRide);
        var ride = await Read<RideDto>(await customer.PostAsJsonAsync("/api/rides", Booking()));
        Assert.NotNull(ride.CustomerId);
        var inbox = await Read<MerchantRideInboxDto>(await merchant.PostAsJsonAsync($"/api/merchants/ride-requests/{ride.Id}/response", new { accept = true }));
        Assert.False(string.IsNullOrEmpty(inbox.ActiveRide!.CustomerPhone));
    }
}
