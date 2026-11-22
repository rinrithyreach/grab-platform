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
    public async Task Guest_express_order_reaches_store_and_private_receipt_tracks_real_status()
    {
        await using var f = new ApiFactory(); await f.InitializeDatabase();
        using var merchant = f.CreateClient(); using var guest = f.CreateClient(); using var stranger = f.CreateClient();
        using var admin = await Admin(f);
        await MerchantAccount(merchant, f.Password, MerchantServiceKind.GrabExpress);
        var (store, item) = await PublishedListing(merchant, 7);
        var quote = await Read<OrderQuoteDto>(await guest.PostAsJsonAsync("/api/orders/guest/quote", new OrderQuoteRequest(store.Id, [new(item.Id, 2)])));
        var response = await guest.PostAsJsonAsync("/api/orders/guest", new GuestOrderRequest(
            OrderFor(store.Id, (item.Id, 2)) with { ExpectedTotal = quote.Total }, "  Sok Dara  ", "012 345 678"), Json);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var receipt = await Read<GuestOrderResponse>(response);
        Assert.Equal(15.5m, receipt.Order.Total);
        Assert.Equal("Sok Dara", receipt.Order.CustomerName);
        Assert.Equal("+85512345678", receipt.Order.CustomerPhone);
        Assert.Equal(64, receipt.AccessToken.Length);

        using (var scope = f.Services.CreateScope())
        {
            var saved = await scope.ServiceProvider.GetRequiredService<GrabDbContext>().MerchantOrders.SingleAsync(x => x.Id == receipt.Order.Id);
            Assert.Null(saved.CustomerId);
            Assert.Equal(Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(receipt.AccessToken))), saved.GuestTokenHash);
            Assert.NotEqual(receipt.AccessToken, saved.GuestTokenHash);
        }

        var path = $"/api/orders/guest/{receipt.Order.Id}";
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.GetAsync(path)).StatusCode);
        stranger.DefaultRequestHeaders.Add("X-Guest-Order-Token", new string('0', 64));
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.GetAsync(path)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.PostAsync(path + "/cancel", null)).StatusCode);
        guest.DefaultRequestHeaders.Add("X-Guest-Order-Token", receipt.AccessToken);
        Assert.Equal(receipt.Order.Id, (await Read<MerchantOrderDto>(await guest.GetAsync(path))).Id);

        var inbox = Assert.Single(await Read<List<MerchantOrderDto>>(await merchant.GetAsync("/api/merchants/orders")));
        Assert.Equal("Sok Dara", inbox.CustomerName); Assert.Equal("+85512345678", inbox.CustomerPhone);
        Assert.Equal("House 12, Street 271", inbox.DeliveryAddress); Assert.Equal("Call on arrival", inbox.Note);
        Assert.Equal(HttpStatusCode.OK, (await merchant.PostAsJsonAsync($"/api/merchants/orders/{receipt.Order.Id}/status", new OrderStatusRequest(MerchantOrderStatus.Accepted), Json)).StatusCode);
        Assert.Equal(MerchantOrderStatus.Accepted, (await Read<MerchantOrderDto>(await guest.GetAsync(path))).Status);
        Assert.Equal(HttpStatusCode.Conflict, (await guest.PostAsync(path + "/cancel", null)).StatusCode);
        var page = await Read<JsonElement>(await admin.GetAsync("/api/admin/express?search=Sok%20Dara"));
        var row = Assert.Single(page.GetProperty("items").EnumerateArray());
        Assert.Equal("Sok Dara", row.GetProperty("customerName").GetString());
        Assert.Equal("+85512345678", row.GetProperty("customerPhone").GetString());
        Assert.True(row.GetProperty("isGuest").GetBoolean());
        Assert.False(row.TryGetProperty("guestTokenHash", out _));
    }

    [Fact]
    public async Task Guest_checkout_requires_valid_contact_address_and_current_prices_and_can_cancel_pending()
    {
        await using var f = new ApiFactory(); await f.InitializeDatabase();
        using var merchant = f.CreateClient(); using var guest = f.CreateClient();
        await MerchantAccount(merchant, f.Password, MerchantServiceKind.GrabExpress);
        var (store, item) = await PublishedListing(merchant);
        var valid = new GuestOrderRequest(OrderFor(store.Id, (item.Id, 1)), "Sok Dara", "012345678");
        foreach (var bad in new[] { valid with { ContactName = "" }, valid with { ContactName = "123" }, valid with { ContactPhone = "hello" }, valid with { Order = valid.Order with { DeliveryAddress = "Phnom Penh" } } })
            Assert.Equal(HttpStatusCode.BadRequest, (await guest.PostAsJsonAsync("/api/orders/guest", bad, Json)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await guest.PostAsJsonAsync("/api/orders/guest", valid with { Order = valid.Order with { ExpectedTotal = 1 } }, Json)).StatusCode);
        var receipt = await Read<GuestOrderResponse>(await guest.PostAsJsonAsync("/api/orders/guest", valid, Json));
        guest.DefaultRequestHeaders.Add("X-Guest-Order-Token", receipt.AccessToken);
        Assert.Equal(MerchantOrderStatus.Cancelled, (await Read<MerchantOrderDto>(await guest.PostAsync($"/api/orders/guest/{receipt.Order.Id}/cancel", null))).Status);
        Assert.Equal(MerchantOrderStatus.Cancelled, Assert.Single(await Read<List<MerchantOrderDto>>(await merchant.GetAsync("/api/merchants/orders"))).Status);
        Assert.Equal(HttpStatusCode.Unauthorized, (await guest.GetAsync("/api/orders/mine")).StatusCode);
    }

    [Fact]
    public async Task Guest_checkout_rejects_food_and_first_order_coupons_but_accepts_normal_express_coupons()
    {
        await using var f = new ApiFactory(); await f.InitializeDatabase();
        using var food = f.CreateClient(); using var express = f.CreateClient(); using var guest = f.CreateClient(); using var admin = await Admin(f);
        await MerchantAccount(food, f.Password); await MerchantAccount(express, f.Password, MerchantServiceKind.GrabExpress);
        var (foodStore, foodItem) = await PublishedListing(food);
        var (store, item) = await PublishedListing(express, 10);
        Assert.Equal(HttpStatusCode.Forbidden, (await guest.PostAsJsonAsync("/api/orders/guest/quote", new OrderQuoteRequest(foodStore.Id, [new(foodItem.Id, 1)]))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await guest.PostAsJsonAsync("/api/orders/guest", new GuestOrderRequest(OrderFor(foodStore.Id, (foodItem.Id, 1)), "Sok Dara", "012345678"), Json)).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await admin.PostAsJsonAsync("/api/admin/promotions", Promo("FIRSTGUEST", store.Id.ToString()) with { FirstOrderOnly = true })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await guest.PostAsJsonAsync("/api/orders/guest/quote", new OrderQuoteRequest(store.Id, [new(item.Id, 1)], "FIRSTGUEST"))).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await admin.PostAsJsonAsync("/api/admin/promotions", Promo("GUESTSAVE", store.Id.ToString()))).StatusCode);
        var quote = await Read<OrderQuoteDto>(await guest.PostAsJsonAsync("/api/orders/guest/quote", new OrderQuoteRequest(store.Id, [new(item.Id, 1)], "GUESTSAVE")));
        var receipt = await Read<GuestOrderResponse>(await guest.PostAsJsonAsync("/api/orders/guest", new GuestOrderRequest(OrderFor(store.Id, (item.Id, 1)) with { PromoCode = "GUESTSAVE", ExpectedTotal = quote.Total }, "Sok Dara", "012345678"), Json));
        Assert.Equal(5, receipt.Order.CodeDiscount); Assert.Equal(6.5m, receipt.Order.Total);
    }
}
