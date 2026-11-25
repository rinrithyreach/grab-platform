using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Grab.Api.Data;
using Grab.Api.DTOs;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Grab.Api.Tests;

public partial class ApiTests
{
    [Fact]
    public async Task Shared_storage_identity_matches_clients_and_distinguishes_separate_databases()
    {
        await using var first = new ApiFactory();
        await first.InitializeDatabase();
        using var a = first.CreateClient();
        using var b = first.CreateClient();
        var one = await Read<JsonElement>(await a.GetAsync("/api/sync/status"));
        var two = await Read<JsonElement>(await b.GetAsync("/api/sync/status"));
        Assert.Equal("ok", one.GetProperty("status").GetString());
        var storageId = one.GetProperty("storageId").GetGuid();
        Assert.NotEqual(Guid.Empty, storageId);
        Assert.Equal(storageId, two.GetProperty("storageId").GetGuid());
        await using var second = new ApiFactory();
        await second.InitializeDatabase();
        using var c = second.CreateClient();
        Assert.NotEqual(storageId, (await Read<JsonElement>(await c.GetAsync("/api/sync/status"))).GetProperty("storageId").GetGuid());
    }

    [Fact]
    public async Task Account_data_syncs_between_clients_is_private_and_rejects_stale_writes()
    {
        await using var f = new ApiFactory();
        await f.InitializeDatabase();
        using var a = f.CreateClient();
        using var b = f.CreateClient();
        using var other = f.CreateClient();
        using var anonymous = f.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/account-data")).StatusCode);
        var account = await Register(a, f.Password);
        await Register(other, f.Password);
        var login = await b.PostAsJsonAsync("/api/auth/login", new LoginRequest(account.User.PhoneNumber, f.Password));
        SignIn(b, await Read<AuthResponse>(login));
        var initial = await Read<AccountDataDto>(await a.GetAsync("/api/account-data"));
        Assert.Equal(0, initial.Version);
        var data = new Dictionary<string, object> {
            ["grab-shop-v1"] = new {
                cart = new { storeId = (string?)null, lines = Array.Empty<object>() },
                orders = new[] { new { id = "order-one", address = "Private address 12", total = 4.5 } },
                partnerCart = new { merchantId = "shop", merchantName = "Cafe", lines = new[] { new { listingId = "coffee", title = "Coffee", price = 2, imageUrl = "", qty = 1 } } }
            },
            ["grab-express-demo-v1"] = new { deliveries = new[] { new { id = "delivery-one", senderPhone = "012345678" } } },
            ["grab-wallet-v1"] = new { balance = 15.5, txns = new[] { new { id = "payment-one", amount = -4.5 } } },
            ["grab-profile-v1"] = new { addresses = new[] { new { label = "home", text = "Private address 12" } } },
            ["grab-favorites-v1"] = new { storeIds = new[] { "rice-bowl" } },
            ["grab-wishlist-v1"] = new { items = new[] { new { listingId = "listing-one", merchantId = "merchant-one", title = "Fried rice", price = 4.5 } } },
            ["grab-settings"] = new { lang = "km", theme = "dark" },
            ["grab-reviews-v1"] = new { reviews = new[] { new { id = "review-one", storeId = "rice-bowl", orderId = "private-order", name = "Reviewer", rating = 5, comment = "Good food", createdAt = DateTimeOffset.UtcNow.ToString("O") } } }
        };
        var saved = await a.PatchAsJsonAsync("/api/account-data", new { version = 0, data, userId = Guid.NewGuid() });
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        var onSecondDevice = await Read<AccountDataDto>(await b.GetAsync("/api/account-data"));
        Assert.Equal(1, onSecondDevice.Version);
        Assert.Equal(8, onSecondDevice.Data.Count);
        Assert.Equal("coffee", onSecondDevice.Data["grab-shop-v1"].GetProperty("partnerCart").GetProperty("lines")[0].GetProperty("listingId").GetString());
        Assert.Equal("Fried rice", onSecondDevice.Data["grab-wishlist-v1"].GetProperty("items")[0].GetProperty("title").GetString());
        Assert.Equal("Private address 12", onSecondDevice.Data["grab-profile-v1"].GetProperty("addresses")[0].GetProperty("text").GetString());
        Assert.Equal(0, (await Read<AccountDataDto>(await other.GetAsync("/api/account-data"))).Version);
        Assert.Equal(HttpStatusCode.Conflict, (await b.PatchAsJsonAsync("/api/account-data", new { version = 0, data })).StatusCode);
        var race = await Task.WhenAll(a.PatchAsJsonAsync("/api/account-data", new { version = 1, data }), b.PatchAsJsonAsync("/api/account-data", new { version = 1, data }));
        Assert.Single(race, response => response.StatusCode == HttpStatusCode.OK);
        Assert.Single(race, response => response.StatusCode == HttpStatusCode.Conflict);
        var publicReviews = await anonymous.GetAsync("/api/store-reviews");
        var publicJson = await publicReviews.Content.ReadAsStringAsync();
        Assert.Contains("Good food", publicJson);
        foreach (var privateText in new[] { "Private address", "012345678", "private-order", "senderPhone", "balance", "orderId" }) Assert.DoesNotContain(privateText, publicJson);
        Assert.Empty(await Read<List<StoreReviewDto>>(await a.GetAsync("/api/store-reviews"))); // Own reviews already come from the account snapshot.
        Assert.Single(await Read<List<StoreReviewDto>>(await other.GetAsync("/api/store-reviews")));
        using var scope = f.Services.CreateScope();
        Assert.Equal(2, (await scope.ServiceProvider.GetRequiredService<GrabDbContext>().AccountData.SingleAsync(x => x.UserId == account.User.Id)).Version);
    }

    [Fact]
    public async Task Account_data_rejects_unknown_sections_invalid_reviews_and_bad_settings()
    {
        await using var f = new ApiFactory();
        await f.InitializeDatabase();
        using var c = f.CreateClient();
        await Register(c, f.Password);
        foreach (var data in new object[] {
            new Dictionary<string, object> { ["passwords"] = new { value = "no" } },
            new Dictionary<string, object> { ["grab-wallet-v1"] = new[] { 1, 2 } },
            new Dictionary<string, object> { ["grab-settings"] = new { lang = "bad", theme = "dark" } },
            new Dictionary<string, object> { ["grab-reviews-v1"] = new { reviews = new[] { new { rating = "bad" } } } }
        }) Assert.Equal(HttpStatusCode.BadRequest, (await c.PatchAsJsonAsync("/api/account-data", new { version = 0, data })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PatchAsJsonAsync("/api/account-data", new { data = new { } })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PatchAsJsonAsync("/api/account-data", new { version = -1, data = new { } })).StatusCode);
    }
}
