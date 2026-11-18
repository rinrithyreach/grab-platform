using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Grab.Api.Data;
using Grab.Api.DTOs;
using Grab.Api.Models;
using Microsoft.Extensions.DependencyInjection;

namespace Grab.Api.Tests;

public partial class ApiTests
{
    [Fact]
    public async Task Public_reviews_are_bounded_sorted_by_instant_and_exclude_private_snapshots()
    {
        await using var f = new ApiFactory();
        await f.InitializeDatabase();
        using var first = f.CreateClient();
        using var second = f.CreateClient();
        using var anonymous = f.CreateClient();
        var firstAccount = await Register(first, f.Password);
        var secondAccount = await Register(second, f.Password);
        var start = new DateTimeOffset(2026, 11, 18, 0, 0, 0, TimeSpan.Zero);
        using (var scope = f.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<GrabDbContext>();
            foreach (var (userId, offset) in new[] { (firstAccount.User.Id, 0), (secondAccount.User.Id, 600) })
                db.AccountData.Add(new AccountData { UserId = userId, Version = 1,
                    Json = JsonSerializer.Serialize(new Dictionary<string, object> {
                        ["grab-profile-v1"] = new { addresses = new[] { new { label = "home", text = "Private house 12" } } },
                        ["grab-reviews-v1"] = new { reviews = Enumerable.Range(offset, 600).Select(i => new {
                            id = $"review-{i}", storeId = "rice-bowl", name = "Reviewer", rating = 5, comment = $"Review {i}",
                            orderId = "private-order", createdAt = start.AddMinutes(i).ToOffset(i % 2 == 0 ? TimeSpan.Zero : TimeSpan.FromHours(7)).ToString("O")
                        }) }
                    }) });
            await db.SaveChangesAsync();
        }
        var response = await anonymous.GetAsync("/api/store-reviews");
        var reviews = await Read<List<StoreReviewDto>>(response);
        Assert.Equal(1000, reviews.Count);
        Assert.Equal("Review 1199", reviews[0].Comment);
        Assert.Equal("Review 200", reviews[^1].Comment);
        var json = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("Private house", json);
        Assert.DoesNotContain("private-order", json);
        Assert.Equal(600, (await Read<List<StoreReviewDto>>(await first.GetAsync("/api/store-reviews"))).Count);
    }

    [Fact]
    public async Task Private_api_responses_and_authentication_failures_are_not_cacheable()
    {
        await using var f = new ApiFactory();
        await f.InitializeDatabase();
        using var customer = f.CreateClient();
        using var anonymous = f.CreateClient();

        void Check(HttpResponseMessage response)
        {
            Assert.True(response.Headers.CacheControl?.NoStore);
            Assert.Equal("nosniff", Assert.Single(response.Headers.GetValues("X-Content-Type-Options")));
            Assert.Equal("DENY", Assert.Single(response.Headers.GetValues("X-Frame-Options")));
        }

        var denied = await anonymous.GetAsync("/api/account-data");
        Assert.Equal(HttpStatusCode.Unauthorized, denied.StatusCode);
        Check(denied);
        var account = await Register(customer, f.Password);
        Check(await anonymous.PostAsJsonAsync("/api/auth/login", new LoginRequest(account.User.PhoneNumber, f.Password)));
        Check(await customer.GetAsync("/api/auth/me"));
        Check(await customer.GetAsync("/api/account-data"));
        var missing = await customer.GetAsync($"/api/rides/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
        Check(missing);
    }

    [Fact]
    public async Task Null_order_lines_and_empty_product_ids_are_rejected_without_server_errors()
    {
        await using var f = new ApiFactory();
        await f.InitializeDatabase();
        using var customer = f.CreateClient();
        await Register(customer, f.Password);
        foreach (var items in new List<OrderItemRequest>[] { [null!], [new(Guid.Empty, 1)] })
        {
            var request = new PlaceOrderRequest(Guid.NewGuid(), items, "House 12, Street 271", null, OrderPaymentMethod.Cash);
            var response = await customer.PostAsJsonAsync("/api/orders", request, Json);
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }
        Assert.Empty(await Read<List<MerchantOrderDto>>(await customer.GetAsync("/api/orders/mine")));
    }

    [Fact]
    public async Task Ride_booking_checks_coordinates_on_the_server()
    {
        await using var f = new ApiFactory();
        await f.InitializeDatabase();
        using var customer = f.CreateClient();
        await Register(customer, f.Password);
        var booking = Booking();
        foreach (var invalid in new[] {
            booking with { DestinationLatitude = booking.PickupLatitude, DestinationLongitude = booking.PickupLongitude },
            booking with { PickupLatitude = 91 },
            booking with { DestinationLongitude = -181 },
        })
            Assert.Equal(HttpStatusCode.BadRequest, (await customer.PostAsJsonAsync("/api/rides", invalid)).StatusCode);
        Assert.Empty(await Read<List<RideDto>>(await customer.GetAsync("/api/rides/mine")));
    }

    [Fact]
    public async Task Driver_onboarding_cannot_remove_access_to_customer_orders()
    {
        await using var f = new ApiFactory();
        await f.InitializeDatabase();
        using var customer = f.CreateClient();
        using var merchant = f.CreateClient();
        using var admin = await Admin(f);
        var account = await Register(customer, f.Password);
        await MerchantAccount(merchant, f.Password);
        var (profile, listing) = await PublishedListing(merchant);
        Assert.Equal(HttpStatusCode.Created, (await customer.PostAsJsonAsync("/api/orders", OrderFor(profile.Id, (listing.Id, 1)), Json)).StatusCode);
        var response = await admin.PostAsJsonAsync("/api/drivers", new DriverRequest(account.User.Id, "Car", "TEST-123"));
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Single(await Read<List<MerchantOrderDto>>(await customer.GetAsync("/api/orders/mine")));
        Assert.Equal(Role.Customer, (await Read<UserDto>(await customer.GetAsync("/api/auth/me"))).Role);
    }
}
