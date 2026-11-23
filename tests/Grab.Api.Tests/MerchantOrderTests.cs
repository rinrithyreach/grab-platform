using System.Net;
using System.Net.Http.Json;
using Grab.Api.DTOs;
using Grab.Api.Models;

namespace Grab.Api.Tests;

public partial class ApiTests
{
    private static async Task<(MerchantProfileDto Profile, MerchantListingDto Listing)> PublishedListing(HttpClient merchant, decimal price = 4.50m)
    {
        var image = await Read<MerchantImageDto>(await merchant.PostAsync("/api/merchants/images", Photo()));
        var listing = await Read<MerchantListingDto>(await merchant.PostAsJsonAsync("/api/merchants/listings",
            new MerchantListingRequest("Fried rice", "Fresh fried rice with egg.", price, image.Id, true, false)));
        var profile = (await Read<MerchantDashboardDto>(await merchant.GetAsync("/api/merchants/me"))).Profile;
        return (profile, listing);
    }

    private static PlaceOrderRequest OrderFor(Guid merchantId, params (Guid Id, int Qty)[] items) => new(
        merchantId, items.Select(i => new OrderItemRequest(i.Id, i.Qty)).ToList(), "House 12, Street 271", "Call on arrival", OrderPaymentMethod.Cash);

    [Fact]
    public async Task Customer_order_reaches_the_merchant_with_server_prices_and_follows_the_status_flow()
    {
        await using var f = new ApiFactory();
        await f.InitializeDatabase();
        using var merchant = f.CreateClient();
        using var customer = f.CreateClient();
        using var stranger = f.CreateClient();
        using var anonymous = f.CreateClient();
        await MerchantAccount(merchant, f.Password);
        await Register(customer, f.Password);
        await Register(stranger, f.Password);
        var (profile, listing) = await PublishedListing(merchant, 4.50m);

        // Guests and merchants cannot place customer orders.
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.PostAsJsonAsync("/api/orders", OrderFor(profile.Id, (listing.Id, 1)), Json)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await merchant.PostAsJsonAsync("/api/orders", OrderFor(profile.Id, (listing.Id, 1)), Json)).StatusCode);

        // Duplicate lines merge; totals come from the database price.
        var placedResponse = await customer.PostAsJsonAsync("/api/orders", OrderFor(profile.Id, (listing.Id, 2), (listing.Id, 1)), Json);
        Assert.Equal(HttpStatusCode.Created, placedResponse.StatusCode);
        var placed = await Read<MerchantOrderDto>(placedResponse);
        var line = Assert.Single(placed.Items);
        Assert.Equal(3, line.Quantity);
        Assert.Equal(4.50m, line.UnitPrice);
        Assert.Equal(13.50m, placed.Subtotal);
        Assert.Equal(OrderLimits.DeliveryFee, placed.DeliveryFee);
        Assert.Equal(15.00m, placed.Total);
        Assert.Equal(MerchantOrderStatus.Pending, placed.Status);
        Assert.Null(placed.CustomerPhone);

        // The merchant sees it with the customer's contact details; nobody else does.
        var inbox = Assert.Single(await Read<List<MerchantOrderDto>>(await merchant.GetAsync("/api/merchants/orders")));
        Assert.Equal(placed.Id, inbox.Id);
        Assert.NotNull(inbox.CustomerPhone);
        Assert.Empty(await Read<List<MerchantOrderDto>>(await stranger.GetAsync("/api/orders/mine")));
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.PostAsync($"/api/orders/{placed.Id}/cancel", null)).StatusCode);

        // Later listing edits never rewrite a past order.
        await merchant.PatchAsJsonAsync($"/api/merchants/listings/{listing.Id}",
            new MerchantListingRequest("Renamed", "Fresh fried rice with egg.", 9.99m, listing.ImageId, true, false));
        Assert.Equal("Fried rice", Assert.Single(Assert.Single(await Read<List<MerchantOrderDto>>(await customer.GetAsync("/api/orders/mine"))).Items).Title);

        // Status flow: no skipping steps, then accept → on the way → delivered.
        async Task<HttpResponseMessage> Move(Guid id, MerchantOrderStatus status) =>
            await merchant.PostAsJsonAsync($"/api/merchants/orders/{id}/status", new OrderStatusRequest(status), Json);
        Assert.Equal(HttpStatusCode.Conflict, (await Move(placed.Id, MerchantOrderStatus.Delivered)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Move(placed.Id, MerchantOrderStatus.Accepted)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await customer.PostAsync($"/api/orders/{placed.Id}/cancel", null)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Move(placed.Id, MerchantOrderStatus.OnTheWay)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Move(placed.Id, MerchantOrderStatus.Delivered)).StatusCode);
        Assert.Equal(MerchantOrderStatus.Delivered, Assert.Single(await Read<List<MerchantOrderDto>>(await customer.GetAsync("/api/orders/mine"))).Status);

        // A second order is cancelled by the customer, and the merchant can no longer accept it.
        var second = await Read<MerchantOrderDto>(await customer.PostAsJsonAsync("/api/orders", OrderFor(profile.Id, (listing.Id, 1)), Json));
        Assert.Equal(9.99m, second.Subtotal);
        Assert.Equal(MerchantOrderStatus.Cancelled, (await Read<MerchantOrderDto>(await customer.PostAsync($"/api/orders/{second.Id}/cancel", null))).Status);
        Assert.Equal(HttpStatusCode.Conflict, (await Move(second.Id, MerchantOrderStatus.Accepted)).StatusCode);

        // The store may cancel an order it already accepted (or sent out), but not a delivered one.
        var third = await Read<MerchantOrderDto>(await customer.PostAsJsonAsync("/api/orders", OrderFor(profile.Id, (listing.Id, 1)), Json));
        Assert.Equal(HttpStatusCode.OK, (await Move(third.Id, MerchantOrderStatus.Accepted)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Move(third.Id, MerchantOrderStatus.OnTheWay)).StatusCode);
        Assert.Equal(MerchantOrderStatus.Rejected, (await Read<MerchantOrderDto>(await Move(third.Id, MerchantOrderStatus.Rejected))).Status);
        Assert.Equal(HttpStatusCode.Conflict, (await Move(third.Id, MerchantOrderStatus.Delivered)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Move(placed.Id, MerchantOrderStatus.Rejected)).StatusCode);

        // Another merchant cannot see or change these orders.
        using var otherMerchant = f.CreateClient();
        await MerchantAccount(otherMerchant, f.Password);
        Assert.Empty(await Read<List<MerchantOrderDto>>(await otherMerchant.GetAsync("/api/merchants/orders")));
        Assert.Equal(HttpStatusCode.NotFound, (await otherMerchant.PostAsJsonAsync($"/api/merchants/orders/{placed.Id}/status", new OrderStatusRequest(MerchantOrderStatus.Rejected), Json)).StatusCode);
    }

    [Fact]
    public async Task Orders_reject_unpublished_foreign_or_invalid_items()
    {
        await using var f = new ApiFactory();
        await f.InitializeDatabase();
        using var merchant = f.CreateClient();
        using var otherMerchant = f.CreateClient();
        using var customer = f.CreateClient();
        await MerchantAccount(merchant, f.Password);
        await MerchantAccount(otherMerchant, f.Password);
        await Register(customer, f.Password);
        var (profile, listing) = await PublishedListing(merchant);
        var (_, foreign) = await PublishedListing(otherMerchant);

        async Task<HttpStatusCode> Place(PlaceOrderRequest r) => (await customer.PostAsJsonAsync("/api/orders", r, Json)).StatusCode;
        Assert.Equal(HttpStatusCode.Conflict, await Place(OrderFor(profile.Id, (foreign.Id, 1))));
        Assert.Equal(HttpStatusCode.Conflict, await Place(OrderFor(profile.Id, (Guid.NewGuid(), 1))));
        Assert.Equal(HttpStatusCode.NotFound, await Place(OrderFor(Guid.NewGuid(), (listing.Id, 1))));
        Assert.Equal(HttpStatusCode.BadRequest, await Place(OrderFor(profile.Id)));
        Assert.Equal(HttpStatusCode.BadRequest, await Place(OrderFor(profile.Id, (listing.Id, 0))));
        Assert.Equal(HttpStatusCode.BadRequest, await Place(OrderFor(profile.Id, (listing.Id, 30), (listing.Id, 30))));
        foreach (var address in new[] { "", "   ", "Home", "12345", "House twelve" })
            Assert.Equal(HttpStatusCode.BadRequest, await Place(OrderFor(profile.Id, (listing.Id, 1)) with { DeliveryAddress = address }));
        Assert.Equal(HttpStatusCode.Created, await Place(OrderFor(profile.Id, (listing.Id, 1)) with { DeliveryAddress = "ផ្ទះលេខ ១២ ផ្លូវ ២៧១" }));

        await merchant.PatchAsJsonAsync($"/api/merchants/listings/{listing.Id}",
            new MerchantListingRequest("Fried rice", "Fresh fried rice with egg.", 4.50m, listing.ImageId, false, false));
        Assert.Equal(HttpStatusCode.Conflict, await Place(OrderFor(profile.Id, (listing.Id, 1))));
        Assert.Equal(HttpStatusCode.BadRequest, (await customer.GetAsync("/api/orders/mine?page=0")).StatusCode);
    }

    [Fact]
    public async Task Customers_choose_to_pay_in_USD_or_KHR_and_the_merchant_sees_the_riel_amount()
    {
        await using var f = new ApiFactory();
        await f.InitializeDatabase();
        using var merchant = f.CreateClient();
        using var customer = f.CreateClient();
        await MerchantAccount(merchant, f.Password);
        await Register(customer, f.Password);
        var (profile, listing) = await PublishedListing(merchant, 4.50m);

        // Without a currency the order is paid in dollars, as before.
        var usd = await Read<MerchantOrderDto>(await customer.PostAsJsonAsync("/api/orders", OrderFor(profile.Id, (listing.Id, 1)), Json));
        Assert.Equal(PaymentCurrency.USD, usd.Currency);
        Assert.Equal(Currencies.KhrPerUsd, usd.ExchangeRate);

        // $4.50 + $1.50 delivery = $6.00 → 24,600 ៛ at 4,100 ៛ per dollar.
        var request = OrderFor(profile.Id, (listing.Id, 1)) with { Currency = PaymentCurrency.KHR };
        var khr = await Read<MerchantOrderDto>(await customer.PostAsJsonAsync("/api/orders", request, Json));
        Assert.Equal(PaymentCurrency.KHR, khr.Currency);
        Assert.Equal(6.00m, khr.Total);
        Assert.Equal(24_600, khr.TotalKhr);

        var inbox = await Read<List<MerchantOrderDto>>(await merchant.GetAsync("/api/merchants/orders"));
        Assert.Equal(PaymentCurrency.KHR, inbox.Single(o => o.Id == khr.Id).Currency);
        Assert.Equal(24_600, inbox.Single(o => o.Id == khr.Id).TotalKhr);

        // Unknown currencies are rejected.
        var bad = await customer.PostAsync("/api/orders", new StringContent(
            $$"""{"merchantId":"{{profile.Id}}","items":[{"listingId":"{{listing.Id}}","quantity":1}],"deliveryAddress":"House 12, Street 271","paymentMethod":"Cash","currency":"EUR"}""",
            System.Text.Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.BadRequest, bad.StatusCode);
    }

    [Theory]
    [InlineData(6.00, 24_600)]
    [InlineData(1.25, 5_100)]   // 5,125 ៛ rounds up to the nearest 100
    [InlineData(0.01, 0)]
    [InlineData(19.99, 82_000)] // 81,959 ៛
    public void Riel_amounts_round_to_the_nearest_100(decimal usd, long khr) => Assert.Equal(khr, Currencies.ToKhr(usd));
}
