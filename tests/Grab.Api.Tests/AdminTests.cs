using System.Net;
using System.Net.Http.Json;
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
    public async Task Admin_email_login_and_all_sections_require_admin_and_paginate_without_secrets()
    {
        await using var f = new ApiFactory();
        await f.InitializeDatabase();
        using var admin = f.CreateClient();
        using var guest = f.CreateClient();
        using var customer = f.CreateClient();
        await Register(customer, f.Password);
        var login = await admin.PostAsJsonAsync("/api/auth/admin/login", new AdminLoginRequest("ADMIN@example.test", f.Password));
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        SignIn(admin, await Read<AuthResponse>(login));
        Assert.Equal(HttpStatusCode.Unauthorized, (await guest.PostAsJsonAsync("/api/auth/admin/login", new AdminLoginRequest("admin@example.test", "wrong-password"))).StatusCode);
        using (var scope = f.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<GrabDbContext>();
            db.Users.AddRange(Enumerable.Range(0, 23).Select(i => new User { FullName = $"Pagination account {i:D2}", PhoneNumber = $"+85570000{i:D3}", PasswordHash = "not-a-login" }));
            await db.SaveChangesAsync();
        }
        foreach (var resource in new[] { "overview", "users", "merchants", "listings", "rides", "orders", "deliveries", "drivers", "payments", "reviews", "audit" })
        {
            Assert.Equal(HttpStatusCode.Unauthorized, (await guest.GetAsync($"/api/admin/{resource}")).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await customer.GetAsync($"/api/admin/{resource}")).StatusCode);
            var response = await admin.GetAsync($"/api/admin/{resource}");
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.DoesNotContain("passwordHash", await response.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);
        }
        var page1 = await Read<AdminPage<JsonElement>>(await admin.GetAsync("/api/admin/users?search=Pagination&filter=Customer"));
        var page2 = await Read<AdminPage<JsonElement>>(await admin.GetAsync("/api/admin/users?search=Pagination&filter=Customer&page=2"));
        Assert.Equal(23, page1.Total); Assert.Equal(20, page1.Items.Count); Assert.Equal(3, page2.Items.Count);
        Assert.Empty(page1.Items.Select(x => x.GetProperty("id").GetGuid()).Intersect(page2.Items.Select(x => x.GetProperty("id").GetGuid())));
        foreach (var query in new[] { "merchants?filter=GrabRide", "listings?filter=Featured", "rides?filter=Pending", "orders?filter=Delivered", "deliveries?filter=Scheduled", "drivers?filter=Available", "reviews?filter=Visible", "audit?filter=users" })
            Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync($"/api/admin/{query}")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.GetAsync("/api/admin/users?page=0")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.GetAsync("/api/admin/missing")).StatusCode);
    }

    [Fact]
    public async Task Admin_account_controls_revoke_sessions_protect_self_and_write_audit_atomically()
    {
        await using var f = new ApiFactory(); await f.InitializeDatabase();
        using var admin = await Admin(f);
        using var customer = f.CreateClient();
        var account = await Register(customer, f.Password);
        var me = await Read<UserDto>(await admin.GetAsync("/api/auth/me"));
        var path = $"/api/admin/users/{account.User.Id}";
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PatchAsJsonAsync($"/api/admin/users/{me.Id}", new AdminUserRequest(me.FullName, Role.Customer, false, "Test protection"), Json)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await customer.PatchAsJsonAsync(path, new AdminUserRequest("Changed Name", Role.Admin, true, "Self promotion"), Json)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PatchAsJsonAsync(path, new AdminUserRequest("Changed Name", Role.Customer, true, ""), Json)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PatchAsJsonAsync(path, new AdminUserRequest("Changed Name", Role.Driver, true, "Invalid role change"), Json)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PatchAsJsonAsync(path, new AdminUserRequest("Suspended Customer", Role.Customer, false, "Account support request"), Json)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await customer.GetAsync("/api/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await customer.PostAsJsonAsync("/api/auth/login", new LoginRequest(account.User.PhoneNumber, f.Password))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PatchAsJsonAsync(path, new AdminUserRequest("Restored Customer", Role.Customer, true, "Resolved support request"), Json)).StatusCode);
        SignIn(customer, await Read<AuthResponse>(await customer.PostAsJsonAsync("/api/auth/login", new LoginRequest(account.User.PhoneNumber, f.Password))));
        Assert.Equal(HttpStatusCode.OK, (await customer.GetAsync("/api/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PatchAsJsonAsync(path, new AdminUserRequest("New Administrator", Role.Admin, true, "Approved administrator access"), Json)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await customer.GetAsync("/api/admin/overview")).StatusCode);
        var audit = await Read<AdminPage<AdminAudit>>(await admin.GetAsync("/api/admin/audit?filter=users"));
        Assert.Equal(3, audit.Total); Assert.All(audit.Items, a => Assert.Equal(me.Id, a.ActorId));
        Assert.All(audit.Items, a => Assert.Equal(account.User.Id, a.TargetId));
    }

    [Fact]
    public async Task Admin_listing_order_and_merchant_changes_reach_customers_and_preserve_order_history()
    {
        await using var f = new ApiFactory(); await f.InitializeDatabase();
        using var admin = await Admin(f); using var merchant = f.CreateClient(); using var customer = f.CreateClient(); using var guest = f.CreateClient();
        var merchantAccount = await MerchantAccount(merchant, f.Password);
        await Register(customer, f.Password);
        var (profile, listing) = await PublishedListing(merchant);
        var order = await Read<MerchantOrderDto>(await customer.PostAsJsonAsync("/api/orders", OrderFor(profile.Id, (listing.Id, 2)), Json));
        Assert.Equal(HttpStatusCode.OK, (await admin.PatchAsJsonAsync($"/api/admin/listings/{listing.Id}", new AdminListingRequest("Updated food", "Updated product description", 8.50m, true, true, "Correct listing details"))).StatusCode);
        var offer = Assert.Single(await Read<List<MerchantOfferDto>>(await guest.GetAsync("/api/merchants/offers")));
        Assert.Equal(8.50m, offer.Price); Assert.Equal("Updated food", offer.Title);
        Assert.Single(await Read<List<BannerDto>>(await guest.GetAsync("/api/banners")));
        Assert.Equal(order.Total, Assert.Single(await Read<List<MerchantOrderDto>>(await customer.GetAsync("/api/orders/mine"))).Total);
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PostAsJsonAsync($"/api/admin/orders/{order.Id}/actions", new AdminActionRequest("Delivered", "Cannot skip fulfillment"))).StatusCode);
        foreach (var status in new[] { "Accepted", "OnTheWay", "Delivered" })
            Assert.Equal(HttpStatusCode.OK, (await admin.PostAsJsonAsync($"/api/admin/orders/{order.Id}/actions", new AdminActionRequest(status, "Support fulfillment update"))).StatusCode);
        Assert.Equal(MerchantOrderStatus.Delivered, Assert.Single(await Read<List<MerchantOrderDto>>(await customer.GetAsync("/api/orders/mine"))).Status);
        Assert.Equal(HttpStatusCode.OK, (await admin.PatchAsJsonAsync($"/api/admin/users/{merchantAccount.User.Id}", new AdminUserRequest("Merchant Owner", Role.Merchant, false, "Temporarily suspend merchant"), Json)).StatusCode);
        Assert.Empty(await Read<List<MerchantOfferDto>>(await guest.GetAsync("/api/merchants/offers")));
        Assert.Empty(await Read<List<BannerDto>>(await guest.GetAsync("/api/banners")));
        Assert.Equal(HttpStatusCode.NotFound, (await guest.GetAsync($"/api/merchants/{profile.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await customer.PostAsJsonAsync("/api/orders", OrderFor(profile.Id, (listing.Id, 1)), Json)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await merchant.GetAsync("/api/merchants/me")).StatusCode);
    }

    [Fact]
    public async Task Admin_driver_onboarding_cancellation_and_review_moderation_preserve_booking_rules()
    {
        await using var f = new ApiFactory(); await f.InitializeDatabase();
        using var admin = await Admin(f); using var driver = f.CreateClient(); using var customer = f.CreateClient();
        var candidate = await Register(driver, f.Password); await Register(customer, f.Password);
        var created = await admin.PostAsJsonAsync("/api/admin/drivers", new AdminDriverRequest(candidate.User.Id, "Car", "ADMIN-TEST-01", "Driver onboarded after review"));
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var profile = await Read<DriverDto>(created);
        SignIn(driver, await Read<AuthResponse>(await driver.PostAsJsonAsync("/api/auth/login", new LoginRequest(candidate.User.PhoneNumber, f.Password))));
        var ride = await Read<RideDto>(await customer.PostAsJsonAsync("/api/rides", Booking(), Json));
        Assert.Equal(HttpStatusCode.OK, (await driver.PatchAsJsonAsync($"/api/rides/{ride.Id}/status", new StatusRequest(RideStatus.Accepted), Json)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PostAsJsonAsync($"/api/admin/drivers/{profile.Id}/actions", new AdminActionRequest("Available", "Invalid availability change"))).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PatchAsJsonAsync($"/api/admin/users/{candidate.User.Id}", new AdminUserRequest("Driver", Role.Driver, false, "Cannot strand active ride"), Json)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PostAsJsonAsync($"/api/admin/rides/{ride.Id}/actions", new AdminActionRequest("Cancelled", "Customer support cancellation"))).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PostAsJsonAsync($"/api/admin/rides/{ride.Id}/actions", new AdminActionRequest("Cancelled", "Duplicate cancellation"))).StatusCode);
        Assert.Contains(await Read<List<DriverDto>>(await customer.GetAsync("/api/drivers/available")), d => d.Id == profile.Id && d.IsAvailable);
        var completed = await Read<RideDto>(await customer.PostAsJsonAsync("/api/rides", Booking(), Json));
        foreach (var status in new[] { RideStatus.Accepted, RideStatus.InProgress, RideStatus.Completed })
            Assert.Equal(HttpStatusCode.OK, (await driver.PatchAsJsonAsync($"/api/rides/{completed.Id}/status", new StatusRequest(status), Json)).StatusCode);
        var review = await Read<ReviewDto>(await customer.PostAsJsonAsync("/api/reviews", new ReviewRequest(completed.Id, 4, "Moderation test")));
        Assert.Equal(HttpStatusCode.OK, (await admin.PostAsJsonAsync($"/api/admin/reviews/{review.Id}/actions", new AdminActionRequest("Hide", "Review under moderation"))).StatusCode);
        Assert.Empty(await Read<List<ReviewDto>>(await customer.GetAsync($"/api/drivers/{profile.Id}/reviews")));
        Assert.Equal(HttpStatusCode.OK, (await admin.PostAsJsonAsync($"/api/admin/reviews/{review.Id}/actions", new AdminActionRequest("Restore", "Review moderation complete"))).StatusCode);
        Assert.Single(await Read<List<ReviewDto>>(await customer.GetAsync($"/api/drivers/{profile.Id}/reviews")));
    }

    [Fact]
    public async Task Admin_can_resolve_parcel_exceptions_without_fabricating_delivery_or_cash_collection()
    {
        await using var f = new ApiFactory(); await f.InitializeDatabase();
        using var admin = await Admin(f); using var customer = f.CreateClient(); using var courier = f.CreateClient();
        await Register(customer, f.Password); await MerchantAccount(courier, f.Password, MerchantServiceKind.GrabExpress);
        var delivery = await Read<ParcelDeliveryDto>(await customer.PostAsJsonAsync("/api/deliveries", Parcel(), Json));
        Assert.Equal(HttpStatusCode.OK, (await admin.PostAsJsonAsync($"/api/admin/deliveries/{delivery.Id}/actions", new AdminActionRequest("Cancelled", "Sender requested cancellation"))).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PostAsJsonAsync($"/api/admin/deliveries/{delivery.Id}/actions", new AdminActionRequest("Delivered", "Invalid completion"))).StatusCode);
        using var scope = f.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<GrabDbContext>();
        var active = new ParcelDelivery { CustomerId = (await Read<UserDto>(await customer.GetAsync("/api/auth/me"))).Id,
            Status = ParcelDeliveryStatus.InTransit, PickupName = "Sender", PickupPhone = "+85512345678", PickupAddress = "Test pickup",
            CourierLatitude = 11.56, CourierLongitude = 104.92,
            Stops = [new DeliveryStop { Position = 1, RecipientName = "Recipient", RecipientPhone = "+85512345679", Address = "Test destination", WeightKg = 1, CodAmount = 10 }] };
        db.ParcelDeliveries.Add(active); await db.SaveChangesAsync();
        Assert.Equal(HttpStatusCode.OK, (await admin.PostAsJsonAsync($"/api/admin/deliveries/{active.Id}/actions", new AdminActionRequest("Failed", "Recipient unavailable; return parcel"))).StatusCode);
        db.ChangeTracker.Clear();
        var resolved = await db.ParcelDeliveries.Include(x => x.Stops).SingleAsync(x => x.Id == active.Id);
        Assert.Equal(ParcelDeliveryStatus.Failed, resolved.Status); Assert.Null(resolved.CourierLatitude);
        var stop = Assert.Single(resolved.Stops); Assert.Equal(DeliveryStopStatus.Failed, stop.Status); Assert.False(stop.CodCollected);
    }
}
