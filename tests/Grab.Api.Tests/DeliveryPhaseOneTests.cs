using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using Grab.Api.DTOs;
using Grab.Api.Middleware;
using Grab.Api.Models;
using Grab.Api.Services;

namespace Grab.Api.Tests;

public partial class ApiTests
{
    private static DeliveryRequest Parcel(params DeliveryStopRequest[] stops) => new(
        "University of Phnom Penh", 11.56, 104.92,
        stops.Length > 0 ? stops.ToList() : [new("Central Market, Phnom Penh", 11.57, 104.93,
            DeliveryParcelSize.Small, 2m, "Recipient Dara", "012345679", "Books and documents")],
        PickupName: "Sender Sokha", PickupPhone: "012345678", ProhibitedItemsAcknowledged: true);

    [Fact]
    public void Parcel_quote_prices_are_server_owned_and_reject_invalid_options()
    {
        var now = new DateTimeOffset(2026, 11, 18, 10, 0, 0, TimeSpan.FromHours(7));
        var request = Parcel();
        var quote = DeliveryPricing.Quote(request, now, booking: true);
        Assert.Equal(1.50m, quote.BaseFare);
        Assert.Equal(0.50m, quote.SizeFare);
        Assert.True(quote.DistanceKm > 0);
        Assert.Equal(quote.BaseFare + quote.DistanceFare + quote.VehicleFare + quote.SizeFare
            + quote.ExtraStopFare + quote.InsuranceFare + quote.CodFee, quote.TotalFare);

        var cod = request.Stops![0] with { CodAmount = 200m };
        var premium = DeliveryPricing.Quote(request with { Stops = [cod], InsuranceTier = DeliveryInsuranceTier.Premium }, now);
        Assert.Equal(0.35m, premium.InsuranceFare);
        Assert.Equal(0.25m, premium.CodFee);
        Assert.Equal(200m, premium.CodAmount);
        var second = cod with { Address = "Olympic Market, Phnom Penh", Latitude = 11.55, Longitude = 104.91 };
        Assert.Equal(0.50m, DeliveryPricing.Quote(request with { Stops = [cod, second] }, now).ExtraStopFare);

        Assert.Equal(400, Assert.Throws<ApiException>(() => DeliveryPricing.Quote(request with {
            Stops = Enumerable.Repeat(cod, 6).ToList()
        }, now)).Status);
        Assert.Equal(400, Assert.Throws<ApiException>(() => DeliveryPricing.Quote(request with {
            Stops = [cod with { WeightKg = 10.01m }]
        }, now)).Status);
        Assert.Equal(400, Assert.Throws<ApiException>(() => DeliveryPricing.Quote(request with {
            Stops = [cod with { CodAmount = 200.01m }]
        }, now)).Status);
        Assert.Equal(400, Assert.Throws<ApiException>(() => DeliveryPricing.Quote(request with {
            ServiceType = DeliveryServiceType.Scheduled, ScheduledPickupAt = now.AddMinutes(29)
        }, now)).Status);
        Assert.Equal(400, Assert.Throws<ApiException>(() => DeliveryPricing.Quote(request with {
            ServiceType = DeliveryServiceType.Scheduled, ScheduledPickupAt = now.AddDays(8)
        }, now)).Status);
        Assert.Equal(DeliveryServiceType.Scheduled, DeliveryPricing.Quote(request with {
            ServiceType = DeliveryServiceType.Scheduled, ScheduledPickupAt = now.AddHours(1)
        }, now).ServiceType);
    }

    [Fact]
    public async Task Parcel_booking_is_private_persistent_and_customer_can_cancel_before_pickup()
    {
        await using var f = new ApiFactory();
        await f.InitializeDatabase();
        using var customer = f.CreateClient();
        using var stranger = f.CreateClient();
        using var courier = f.CreateClient();
        using var food = f.CreateClient();
        await Register(customer, f.Password);
        await Register(stranger, f.Password);
        await MerchantAccount(courier, f.Password, MerchantServiceKind.GrabExpress);
        await MerchantAccount(food, f.Password, MerchantServiceKind.GrabFood);

        var quoted = await customer.PostAsJsonAsync("/api/deliveries/quote", Parcel(), Json);
        Assert.Equal(HttpStatusCode.OK, quoted.StatusCode);
        var quote = await Read<DeliveryQuoteDto>(quoted);
        var tampered = JsonSerializer.SerializeToNode(Parcel(), Json)!.AsObject();
        tampered["totalFare"] = 0;
        tampered["distanceKm"] = 0;
        tampered["status"] = "Delivered";
        var booked = await customer.PostAsJsonAsync("/api/deliveries", tampered, Json);
        Assert.Equal(HttpStatusCode.Created, booked.StatusCode);
        var delivery = await Read<ParcelDeliveryDto>(booked);
        Assert.Equal(quote.TotalFare, delivery.TotalFare);
        Assert.True(delivery.DistanceKm > 0);
        Assert.Equal(ParcelDeliveryStatus.Pending, delivery.Status);
        Assert.Equal("+85512345678", delivery.PickupPhone);
        Assert.Equal("+85512345679", delivery.Stops[0].RecipientPhone);
        Assert.Single(await Read<List<ParcelDeliveryDto>>(await customer.GetAsync("/api/deliveries/mine")));
        Assert.Empty(await Read<List<ParcelDeliveryDto>>(await stranger.GetAsync("/api/deliveries/mine")));
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.GetAsync($"/api/deliveries/{delivery.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.PatchAsync($"/api/deliveries/{delivery.Id}/cancel", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await courier.GetAsync($"/api/deliveries/{delivery.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await food.GetAsync("/api/deliveries/courier/inbox")).StatusCode);
        var inboxResponse = await courier.GetAsync("/api/deliveries/courier/inbox");
        Assert.Equal(HttpStatusCode.OK, inboxResponse.StatusCode);
        var inboxText = await inboxResponse.Content.ReadAsStringAsync();
        Assert.DoesNotContain("+85512345678", inboxText);
        Assert.DoesNotContain("+85512345679", inboxText);
        Assert.DoesNotContain("Books and documents", inboxText);
        Assert.Single((await Read<DeliveryCourierInboxDto>(await courier.GetAsync("/api/deliveries/courier/inbox"))).Requests);

        var cancelled = await customer.PatchAsync($"/api/deliveries/{delivery.Id}/cancel", null);
        Assert.Equal(HttpStatusCode.OK, cancelled.StatusCode);
        Assert.Equal(ParcelDeliveryStatus.Cancelled, (await Read<ParcelDeliveryDto>(cancelled)).Status);
        Assert.Equal(HttpStatusCode.Conflict, (await courier.PostAsync($"/api/deliveries/{delivery.Id}/accept", null)).StatusCode);
    }

    [Fact]
    public async Task Courier_finishes_ordered_stops_and_confirms_cod_before_delivery()
    {
        await using var f = new ApiFactory();
        await f.InitializeDatabase();
        using var customer = f.CreateClient();
        using var courier = f.CreateClient();
        await Register(customer, f.Password);
        await MerchantAccount(courier, f.Password, MerchantServiceKind.GrabExpress);
        var firstStop = new DeliveryStopRequest("Central Market, Phnom Penh", 11.57, 104.93,
            DeliveryParcelSize.Small, 2m, "Recipient Dara", "012345679", "Books", 20m);
        var secondStop = firstStop with { Address = "Olympic Market, Phnom Penh", Latitude = 11.55,
            Longitude = 104.91, RecipientName = "Recipient Nary", RecipientPhone = "012345680", CodAmount = 0 };
        var request = Parcel(firstStop, secondStop) with { InsuranceTier = DeliveryInsuranceTier.Premium };
        var delivery = await Read<ParcelDeliveryDto>(await customer.PostAsJsonAsync("/api/deliveries", request, Json));
        Assert.Equal(0.50m, delivery.ExtraStopFare);
        Assert.Equal(0.35m, delivery.InsuranceFare);
        Assert.Equal(20m, delivery.CodAmount);
        Assert.Equal(HttpStatusCode.OK, (await courier.PostAsync($"/api/deliveries/{delivery.Id}/accept", null)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await courier.PatchAsJsonAsync($"/api/deliveries/{delivery.Id}/status", new { status = "PickedUp" })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await courier.PatchAsJsonAsync(
            $"/api/deliveries/{delivery.Id}/stops/{delivery.Stops[1].Id}/status", new { status = "Delivered" })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await courier.PatchAsJsonAsync(
            $"/api/deliveries/{delivery.Id}/stops/{delivery.Stops[0].Id}/status", new { status = "Delivered" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await courier.PostAsync(
            $"/api/deliveries/{delivery.Id}/stops/{delivery.Stops[0].Id}/cod/collected", null)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await courier.PatchAsJsonAsync(
            $"/api/deliveries/{delivery.Id}/stops/{delivery.Stops[0].Id}/status", new { status = "Delivered" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await courier.PostAsync(
            $"/api/deliveries/{delivery.Id}/stops/{delivery.Stops[0].Id}/cod/paid-out", null)).StatusCode);
        var failed = await courier.PatchAsJsonAsync($"/api/deliveries/{delivery.Id}/stops/{delivery.Stops[1].Id}/status",
            new { status = "Failed", failureReason = "Recipient unreachable" });
        Assert.Equal(HttpStatusCode.OK, failed.StatusCode);
        var result = await Read<ParcelDeliveryDto>(failed);
        Assert.Equal(ParcelDeliveryStatus.Failed, result.Status);
        Assert.True(result.Stops[0].CodCollected && result.Stops[0].CodPaidOut);
        Assert.Equal("Recipient unreachable", result.Stops[1].FailureReason);
    }

    [Fact]
    public async Task Courier_claim_is_single_owner_and_active_slot_releases_on_cancel()
    {
        await using var f = new ApiFactory();
        await f.InitializeDatabase();
        using var customer = f.CreateClient();
        using var first = f.CreateClient();
        using var second = f.CreateClient();
        await Register(customer, f.Password);
        await MerchantAccount(first, f.Password, MerchantServiceKind.GrabExpress);
        await MerchantAccount(second, f.Password, MerchantServiceKind.GrabExpress);
        var one = await Read<ParcelDeliveryDto>(await customer.PostAsJsonAsync("/api/deliveries", Parcel(), Json));
        var two = await Read<ParcelDeliveryDto>(await customer.PostAsJsonAsync("/api/deliveries", Parcel(), Json));

        var claims = await Task.WhenAll(first.PostAsync($"/api/deliveries/{one.Id}/accept", null),
            second.PostAsync($"/api/deliveries/{one.Id}/accept", null));
        Assert.Equal(1, claims.Count(x => x.StatusCode == HttpStatusCode.OK));
        Assert.Equal(1, claims.Count(x => x.StatusCode == HttpStatusCode.Conflict));
        var winner = claims[0].StatusCode == HttpStatusCode.OK ? first : second;
        var loser = winner == first ? second : first;
        Assert.Equal(HttpStatusCode.NotFound, (await loser.GetAsync($"/api/deliveries/{one.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await winner.PostAsync($"/api/deliveries/{two.Id}/accept", null)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await customer.PatchAsync($"/api/deliveries/{one.Id}/cancel", null)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await winner.PostAsync($"/api/deliveries/{two.Id}/accept", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await customer.PatchAsJsonAsync($"/api/deliveries/{two.Id}/status", new { status = "PickedUp" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await loser.PatchAsJsonAsync($"/api/deliveries/{two.Id}/status", new { status = "PickedUp" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await winner.PatchAsJsonAsync($"/api/deliveries/{two.Id}/status", new { status = "PickedUp" })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await customer.PatchAsync($"/api/deliveries/{two.Id}/cancel", null)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await winner.PatchAsJsonAsync($"/api/deliveries/{two.Id}/status", new { status = "InTransit" })).StatusCode);
        var stop = two.Stops[0];
        Assert.Equal(HttpStatusCode.OK, (await winner.PatchAsJsonAsync($"/api/deliveries/{two.Id}/stops/{stop.Id}/status", new { status = "Delivered" })).StatusCode);
        Assert.Equal(ParcelDeliveryStatus.Delivered, (await Read<ParcelDeliveryDto>(await customer.GetAsync($"/api/deliveries/{two.Id}"))).Status);
    }

    [Fact]
    public async Task Parcel_booking_has_a_per_ip_rate_limit()
    {
        await using var f = new ApiFactory();
        await f.InitializeDatabase();
        using var customer = f.CreateClient();
        await Register(customer, f.Password);
        for (var attempt = 0; attempt < 10; attempt++)
            Assert.Equal(HttpStatusCode.Created, (await customer.PostAsJsonAsync("/api/deliveries", Parcel(), Json)).StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests,
            (await customer.PostAsJsonAsync("/api/deliveries", Parcel(), Json)).StatusCode);
    }
}
