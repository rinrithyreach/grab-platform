using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Grab.Api.DTOs;
using Grab.Api.Models;

namespace Grab.Api.Tests;

public partial class ApiTests
{
    private static SavePromotionRequest Promo(string? code = null, string? store = null, string? product = null) =>
        new("Product savings", code, "percent", 50, 0, null, 2, 1, store, product, false, true, null, null, "Set up product promotion");

    [Fact]
    public async Task Promotions_require_permissions_validate_codes_and_audit_changes()
    {
        await using var f = new ApiFactory(); await f.InitializeDatabase();
        using var admin = await Admin(f); using var guest = f.CreateClient(); using var customer = f.CreateClient();
        await Register(customer, f.Password);
        Assert.Equal(7, (await Read<List<Promotion>>(await guest.GetAsync("/api/promotions"))).Count);
        Assert.Equal(HttpStatusCode.Unauthorized, (await guest.GetAsync("/api/admin/promotions")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await customer.PostAsJsonAsync("/api/admin/promotions", Promo())).StatusCode);
        var role = await CreateRole(admin, "Promotion observer", "promotions.view");
        Assert.Equal(HttpStatusCode.Created, (await admin.PostAsJsonAsync("/api/admin/team", new CreateAdminRequest("Observer", "promo@example.test", "Promotion observer", f.Password, "Read-only promotion access", role), Json)).StatusCode);
        using var viewer = await AdminByEmail(f, "promo@example.test", f.Password);
        Assert.Equal(HttpStatusCode.OK, (await viewer.GetAsync("/api/admin/promotions")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await viewer.GetAsync("/api/admin/promotions/targets")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await viewer.PostAsJsonAsync("/api/admin/promotions", Promo())).StatusCode);
        var created = await admin.PostAsJsonAsync("/api/admin/promotions", Promo("summer"));
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var id = (await Read<JsonElement>(created)).GetProperty("id").GetGuid();
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PostAsJsonAsync("/api/admin/promotions", Promo(" SUMMER "))).StatusCode);
        foreach (var bad in new[] { Promo() with { Value = 101 }, Promo() with { MinSubtotal = -1 }, Promo() with { MaxDiscount = 0 }, Promo() with { Code = "bad code" }, Promo() with { Reason = "" }, Promo() with { StartsAt = DateTimeOffset.UtcNow, EndsAt = DateTimeOffset.UtcNow.AddDays(-1) } })
            Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/admin/promotions", bad)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PutAsJsonAsync($"/api/admin/promotions/{id}", Promo("SUMMER") with { IsActive = false })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.DeleteAsync($"/api/admin/promotions/{id}?reason=Remove%20test%20offer")).StatusCode);
        Assert.DoesNotContain(await Read<List<Promotion>>(await guest.GetAsync("/api/promotions")), p => p.Id == id);
        var audit = await Read<AdminPage<AdminAudit>>(await admin.GetAsync("/api/admin/audit?filter=promotions"));
        Assert.Equal(3, audit.Total);
    }

    [Fact]
    public async Task Promotions_target_products_stack_coupons_and_preserve_past_order_totals()
    {
        await using var f = new ApiFactory(); await f.InitializeDatabase();
        using var admin = await Admin(f); using var merchant = f.CreateClient(); using var customer = f.CreateClient();
        await MerchantAccount(merchant, f.Password); await Register(customer, f.Password);
        var (store, item) = await PublishedListing(merchant, 10);
        var (_, other) = await PublishedListing(merchant, 20);
        var automatic = Promo(null, store.Id.ToString(), item.Id.ToString());
        var response = await admin.PostAsJsonAsync("/api/admin/promotions", automatic);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var id = (await Read<JsonElement>(response)).GetProperty("id").GetGuid();
        Assert.Contains(await Read<List<PromotionTarget>>(await admin.GetAsync("/api/admin/promotions/targets")), t => t.ProductId == item.Id.ToString());
        var coupon = Promo("SAVE5", store.Id.ToString()) with { Kind = "amount", Value = 5 };
        Assert.Equal(HttpStatusCode.Created, (await admin.PostAsJsonAsync("/api/admin/promotions", coupon)).StatusCode);
        var request = OrderFor(store.Id, (item.Id, 2), (other.Id, 1)) with { PromoCode = " save5 " };
        var quoteRequest = new OrderQuoteRequest(store.Id, request.Items, request.PromoCode);
        var quote = await Read<OrderQuoteDto>(await customer.PostAsJsonAsync("/api/orders/quote", quoteRequest));
        Assert.Equal(40, quote.Subtotal); Assert.Equal(10, quote.Discount); Assert.Equal(5, quote.CodeDiscount); Assert.Equal(26.5m, quote.Total);
        var placed = await customer.PostAsJsonAsync("/api/orders", request with { ExpectedTotal = quote.Total }, Json);
        Assert.Equal(HttpStatusCode.Created, placed.StatusCode);
        var order = await Read<MerchantOrderDto>(placed);
        Assert.Equal(quote.Total, order.Total); Assert.Equal("SAVE5", order.PromoCode);
        Assert.Equal(10, order.Discount); Assert.Equal(5, order.CodeDiscount);
        Assert.Equal(HttpStatusCode.OK, (await admin.PutAsJsonAsync($"/api/admin/promotions/{id}", automatic with { IsActive = false })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await customer.PostAsJsonAsync("/api/orders", request with { ExpectedTotal = quote.Total }, Json)).StatusCode);
        var updated = await Read<OrderQuoteDto>(await customer.PostAsJsonAsync("/api/orders/quote", quoteRequest));
        Assert.Equal(0, updated.Discount); Assert.Equal(36.5m, updated.Total);
        var saved = Assert.Single(await Read<List<MerchantOrderDto>>(await customer.GetAsync("/api/orders/mine")));
        Assert.Equal(order.Total, saved.Total); Assert.Equal(order.Discount, saved.Discount);
        Assert.Equal(HttpStatusCode.OK, (await admin.DeleteAsync($"/api/admin/promotions/{id}?reason=Remove%20test%20offer")).StatusCode);
        Assert.Equal(order.Total, Assert.Single(await Read<List<MerchantOrderDto>>(await merchant.GetAsync("/api/merchants/orders"))).Total);
    }

    [Fact]
    public async Task Coupons_enforce_schedule_scope_first_order_caps_and_minimum_spend()
    {
        await using var f = new ApiFactory(); await f.InitializeDatabase();
        using var admin = await Admin(f); using var merchant = f.CreateClient(); using var customer = f.CreateClient();
        await MerchantAccount(merchant, f.Password, MerchantServiceKind.GrabExpress); await Register(customer, f.Password);
        var (store, item) = await PublishedListing(merchant, 10);
        var coupon = Promo("CHECK", store.Id.ToString(), item.Id.ToString()) with { FirstOrderOnly = true, MaxDiscount = 3 };
        var response = await admin.PostAsJsonAsync("/api/admin/promotions", coupon);
        var id = (await Read<JsonElement>(response)).GetProperty("id").GetGuid();
        var request = new OrderQuoteRequest(store.Id, [new(item.Id, 1)], "CHECK");
        var quote = await Read<OrderQuoteDto>(await customer.PostAsJsonAsync("/api/orders/quote", request));
        Assert.Equal(3, quote.CodeDiscount);
        foreach (var unavailable in new[] { coupon with { IsActive = false }, coupon with { StartsAt = DateTimeOffset.UtcNow.AddDays(1) }, coupon with { EndsAt = DateTimeOffset.UtcNow.AddDays(-1) }, coupon with { MinSubtotal = 11 }, coupon with { StoreId = "golden-noodle", ProductId = null } })
        {
            Assert.Equal(HttpStatusCode.OK, (await admin.PutAsJsonAsync($"/api/admin/promotions/{id}", unavailable)).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await customer.PostAsJsonAsync("/api/orders/quote", request)).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await customer.PostAsJsonAsync("/api/orders", OrderFor(store.Id, (item.Id, 1)) with { PromoCode = "CHECK" }, Json)).StatusCode);
        }
        await admin.PutAsJsonAsync($"/api/admin/promotions/{id}", coupon);
        Assert.Equal(HttpStatusCode.Created, (await customer.PostAsJsonAsync("/api/orders", OrderFor(store.Id, (item.Id, 1)) with { PromoCode = "CHECK" }, Json)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await customer.PostAsJsonAsync("/api/orders/quote", request)).StatusCode);
        var shipping = await Read<OrderQuoteDto>(await customer.PostAsJsonAsync("/api/orders/quote", request with { PromoCode = "FREESHIP" }));
        Assert.Equal(0, shipping.DeliveryFee); Assert.Equal(10, shipping.Total);
    }
}
