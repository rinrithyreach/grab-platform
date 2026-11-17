using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using Grab.Api.Data;
using Grab.Api.DTOs;
using Grab.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Grab.Api.Tests;

public partial class ApiTests
{
    private static MerchantProfileRequest Business(MerchantServiceKind service = MerchantServiceKind.GrabFood) => new(
        service, "Dara's Business", "Private Owner", "012345678", "business@example.test",
        "House 12, Street 271", "Phnom Penh", "Local specialty", "A local business serving our neighbourhood.",
        service == MerchantServiceKind.GrabRide ? "Mon 07:00-20:00; Sat 07:00-20:00" : "Mon–Sat 7 AM–8 PM",
        service == MerchantServiceKind.GrabRide ? "1AB-1234" : null);

    private static async Task<AuthResponse> MerchantAccount(HttpClient client, string password, MerchantServiceKind service = MerchantServiceKind.GrabFood)
    {
        var response = await client.PostAsJsonAsync("/api/merchants/register", new MerchantRegisterRequest(
            $"+855{RandomNumberGenerator.GetInt32(20000000, 99999999)}", password, Business(service)), Json);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var auth = await Read<AuthResponse>(response);
        SignIn(client, auth);
        return auth;
    }

    private static MultipartFormDataContent Photo(byte[]? data = null, string filename = "photo.png")
    {
        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(data ?? Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII="));
        file.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        form.Add(file, "file", filename);
        return form;
    }

    [Fact]
    public async Task Merchant_publishing_is_durable_scoped_and_visible_only_when_published()
    {
        await using var f = new ApiFactory();
        await f.InitializeDatabase();
        using var publicClient = f.CreateClient();
        using var merchant = f.CreateClient();
        using var other = f.CreateClient();
        using var customer = f.CreateClient();
        var account = await MerchantAccount(merchant, f.Password);
        Assert.Equal(Role.Merchant, account.User.Role);
        await MerchantAccount(other, f.Password);
        await Register(customer, f.Password);
        Assert.Equal(HttpStatusCode.Unauthorized, (await publicClient.GetAsync("/api/merchants/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await customer.GetAsync("/api/merchants/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await customer.PostAsJsonAsync("/api/merchants/login", new LoginRequest((await Read<UserDto>(await customer.GetAsync("/api/auth/me"))).PhoneNumber, f.Password))).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await merchant.PostAsJsonAsync("/api/merchants/register", new MerchantRegisterRequest(account.User.PhoneNumber, f.Password, Business()), Json)).StatusCode);

        var uploaded = await merchant.PostAsync("/api/merchants/images", Photo());
        Assert.Equal(HttpStatusCode.OK, uploaded.StatusCode);
        var image = await Read<MerchantImageDto>(uploaded);
        var photo = await publicClient.GetAsync(image.ImageUrl);
        Assert.Equal("image/png", photo.Content.Headers.ContentType?.MediaType);
        Assert.Equal("nosniff", photo.Headers.GetValues("X-Content-Type-Options").Single());
        var draftRequest = new MerchantListingRequest("Special lunch", "Fresh local food made to order.", 4.50m, image.Id, false, true);
        var draft = await Read<MerchantListingDto>(await merchant.PostAsJsonAsync("/api/merchants/listings", draftRequest));
        var dashboard = await Read<MerchantDashboardDto>(await merchant.GetAsync("/api/merchants/me"));
        Assert.Single(dashboard.Listings);
        Assert.Equal("Private Owner", dashboard.Profile.OwnerName);
        Assert.Empty(await Read<List<MerchantOfferDto>>(await publicClient.GetAsync("/api/merchants/offers")));
        Assert.Empty(await Read<List<BannerDto>>(await publicClient.GetAsync("/api/banners")));
        Assert.Equal(HttpStatusCode.NotFound, (await publicClient.GetAsync($"/api/merchants/{dashboard.Profile.Id}")).StatusCode);
        Assert.Empty((await Read<MerchantDashboardDto>(await other.GetAsync("/api/merchants/me"))).Listings);
        Assert.Equal(HttpStatusCode.NotFound, (await other.PatchAsJsonAsync($"/api/merchants/listings/{draft.Id}", draftRequest)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await other.PostAsJsonAsync("/api/merchants/listings", draftRequest)).StatusCode);

        var published = draftRequest with { IsPublished = true };
        Assert.Equal(HttpStatusCode.OK, (await merchant.PatchAsJsonAsync($"/api/merchants/listings/{draft.Id}", published)).StatusCode);
        Assert.Single(await Read<List<MerchantOfferDto>>(await publicClient.GetAsync("/api/merchants/offers?service=GrabFood")));
        Assert.Empty(await Read<List<MerchantOfferDto>>(await publicClient.GetAsync("/api/merchants/offers?service=GrabRide")));
        var banner = Assert.Single(await Read<List<BannerDto>>(await publicClient.GetAsync("/api/banners")));
        Assert.Equal($"/partners/{dashboard.Profile.Id}", banner.LinkUrl);
        Assert.Equal(image.ImageUrl, banner.ImageUrl);
        var storefrontResponse = await publicClient.GetAsync($"/api/merchants/{dashboard.Profile.Id}");
        var storefront = await Read<MerchantStorefrontDto>(storefrontResponse);
        Assert.Single(storefront.Listings);
        using (var json = JsonDocument.Parse(await storefrontResponse.Content.ReadAsStringAsync()))
        {
            var profile = json.RootElement.GetProperty("merchant");
            foreach (var privateField in new[] { "ownerName", "userId", "phoneNumber", "passwordHash", "password" })
                Assert.False(profile.TryGetProperty(privateField, out _));
        }
        var updatedProfile = Business(MerchantServiceKind.GrabRide) with { OwnerName = "Dara's Rides" };
        Assert.Equal(HttpStatusCode.BadRequest, (await merchant.PatchAsJsonAsync("/api/merchants/me", updatedProfile, Json)).StatusCode);
        Assert.Single(await Read<List<MerchantOfferDto>>(await publicClient.GetAsync("/api/merchants/offers?service=GrabFood")));
        Assert.Empty(await Read<List<MerchantOfferDto>>(await publicClient.GetAsync("/api/merchants/offers?service=GrabRide")));
        Assert.Single(await Read<List<BannerDto>>(await publicClient.GetAsync("/api/banners")));
        Assert.Equal(HttpStatusCode.OK, (await publicClient.GetAsync($"/api/merchants/{dashboard.Profile.Id}")).StatusCode);

        using var fresh = f.CreateClient();
        var login = await fresh.PostAsJsonAsync("/api/merchants/login", new LoginRequest(account.User.PhoneNumber, f.Password));
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        SignIn(fresh, await Read<AuthResponse>(login));
        Assert.Single((await Read<MerchantDashboardDto>(await fresh.GetAsync("/api/merchants/me"))).Listings);
        using (var scope = f.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<GrabDbContext>();
            Assert.NotEqual(f.Password, (await db.Users.SingleAsync(x => x.Id == account.User.Id)).PasswordHash);
            Assert.True(await db.MerchantListings.AnyAsync(x => x.Id == draft.Id && x.IsPublished));
        }
        Assert.Equal(HttpStatusCode.OK, (await merchant.PatchAsJsonAsync($"/api/merchants/listings/{draft.Id}", draftRequest)).StatusCode);
        Assert.Empty(await Read<List<MerchantOfferDto>>(await publicClient.GetAsync("/api/merchants/offers")));
        Assert.Empty(await Read<List<BannerDto>>(await publicClient.GetAsync("/api/banners")));
        Assert.Equal(HttpStatusCode.OK, (await publicClient.GetAsync("/swagger/v1/swagger.json")).StatusCode);
    }

    [Theory]
    [InlineData(MerchantServiceKind.GrabRide)]
    [InlineData(MerchantServiceKind.GrabFood)]
    [InlineData(MerchantServiceKind.GrabExpress)]
    public async Task Merchant_account_keeps_only_its_registered_service(MerchantServiceKind registeredService)
    {
        await using var f = new ApiFactory();
        await f.InitializeDatabase();
        using var merchant = f.CreateClient();
        await MerchantAccount(merchant, f.Password, registeredService);
        var original = (await Read<MerchantDashboardDto>(await merchant.GetAsync("/api/merchants/me"))).Profile;
        foreach (var otherService in Enum.GetValues<MerchantServiceKind>().Where(service => service != registeredService))
        {
            var response = await merchant.PatchAsJsonAsync("/api/merchants/me", Business(otherService), Json);
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal(original, (await Read<MerchantDashboardDto>(await merchant.GetAsync("/api/merchants/me"))).Profile);
        }
        var edit = await merchant.PatchAsJsonAsync("/api/merchants/me", Business(registeredService) with { OwnerName = "Updated Owner" }, Json);
        Assert.Equal(HttpStatusCode.OK, edit.StatusCode);
        var saved = await Read<MerchantProfileDto>(edit);
        Assert.Equal(registeredService, saved.Service);
        Assert.Equal("Updated Owner", saved.OwnerName);
    }

    [Theory]
    [InlineData(MerchantServiceKind.GrabFood)]
    [InlineData(MerchantServiceKind.GrabExpress)]
    public async Task Merchant_services_validate_profiles_prices_and_uploads(MerchantServiceKind service)
    {
        await using var f = new ApiFactory();
        await f.InitializeDatabase();
        using var c = f.CreateClient();
        await MerchantAccount(c, f.Password, service);
        var profile = (await Read<MerchantDashboardDto>(await c.GetAsync("/api/merchants/me"))).Profile;
        Assert.Equal(service, profile.Service);
        foreach (var invalid in new[] { Business(service) with { BusinessName = "  " }, Business(service) with { Address = "   " }, Business(service) with { ContactPhone = "bad-phone" }, Business(service) with { Email = "invalid" } })
            Assert.Equal(HttpStatusCode.BadRequest, (await c.PatchAsJsonAsync("/api/merchants/me", invalid, Json)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsync("/api/merchants/images", Photo("<svg onload='alert(1)'/>"u8.ToArray(), "evil.png"))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsync("/api/merchants/images", Photo(new byte[2 * 1024 * 1024 + 1]))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsync("/api/merchants/images", new MultipartFormDataContent())).StatusCode);
        var image = await Read<MerchantImageDto>(await c.PostAsync("/api/merchants/images", Photo()));
        var listing = new MerchantListingRequest("Service offer", "Detailed description of the offer.", 3.00m, image.Id, true, true);
        foreach (var price in new[] { 0m, -1m, 1000000m, 1.001m })
            Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync("/api/merchants/listings", listing with { Price = price })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync("/api/merchants/listings", listing with { ImageId = Guid.NewGuid() })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.GetAsync("/api/merchants/offers?service=unknown")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.GetAsync("/api/merchants/offers?page=0")).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await c.PostAsJsonAsync("/api/merchants/listings", listing)).StatusCode);
        Assert.Equal(service, Assert.Single(await Read<List<MerchantOfferDto>>(await c.GetAsync($"/api/merchants/offers?service={service}"))).Merchant.Service);
    }

    [Fact]
    public async Task GrabRide_registration_needs_only_name_phone_password_motorcycle_plate_and_location()
    {
        await using var f = new ApiFactory();
        await f.InitializeDatabase();
        using var c = f.CreateClient();
        var request = new {
            phoneNumber = "098765432", password = f.Password,
            profile = new { service = "GrabRide", ownerName = "  Dara Sok  ", motorcycleLicensePlate = "  1ab-1234  ", address = "  Phnom Penh  " }
        };
        var response = await c.PostAsJsonAsync("/api/merchants/register", request);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var account = await Read<AuthResponse>(response);
        SignIn(c, account);
        Assert.Equal("Dara Sok", account.User.FullName);
        var dashboard = await Read<MerchantDashboardDto>(await c.GetAsync("/api/merchants/me"));
        Assert.Equal("Dara Sok", dashboard.Profile.BusinessName);
        Assert.Equal("+85598765432", dashboard.Profile.ContactPhone);
        Assert.Equal("Phnom Penh", dashboard.Profile.Address);
        Assert.Equal("1AB-1234", dashboard.Profile.MotorcycleLicensePlate);
        Assert.Null(dashboard.Profile.Email);
        Assert.Empty(dashboard.Profile.City);
        Assert.Empty(dashboard.Profile.OpeningHours);

        foreach (var plate in new[] { "", "  ", "X", new string('A', 31), "1AB\n1234" })
            Assert.Equal(HttpStatusCode.BadRequest, (await c.PatchAsJsonAsync("/api/merchants/me", new {
                service = "GrabRide", ownerName = "Dara Sok", contactPhone = "098765432", address = "Phnom Penh", motorcycleLicensePlate = plate
            })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PatchAsJsonAsync("/api/merchants/me", new {
            service = "GrabRide", ownerName = "Dara Sok", contactPhone = "098765432", address = "Phnom Penh"
        })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await c.PatchAsJsonAsync("/api/merchants/me", new {
            service = "GrabRide", ownerName = "Sok Dara", contactPhone = "098765432", address = "Siem Reap", motorcycleLicensePlate = "1XY-5678"
        })).StatusCode);

        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsync("/api/merchants/images", Photo())).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync("/api/merchants/listings", new MerchantListingRequest("Motorcycle ride", "Motorcycle rides around the city.", 2m, Guid.NewGuid(), true, true))).StatusCode);
        using var publicClient = f.CreateClient();
        var publicResponse = await publicClient.GetAsync($"/api/merchants/{dashboard.Profile.Id}");
        Assert.Equal(HttpStatusCode.NotFound, publicResponse.StatusCode);
        var publicJson = await publicResponse.Content.ReadAsStringAsync();
        Assert.DoesNotContain("motorcycleLicensePlate", publicJson);
        Assert.DoesNotContain("1XY-5678", publicJson);
        Assert.Empty(await Read<List<MerchantOfferDto>>(await publicClient.GetAsync("/api/merchants/offers?service=GrabRide")));
        Assert.Empty(await Read<List<BannerDto>>(await publicClient.GetAsync("/api/banners")));

        using var fresh = f.CreateClient();
        var login = await fresh.PostAsJsonAsync("/api/merchants/login", new LoginRequest("098765432", f.Password));
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        SignIn(fresh, await Read<AuthResponse>(login));
        Assert.Equal("1XY-5678", (await Read<MerchantDashboardDto>(await fresh.GetAsync("/api/merchants/me"))).Profile.MotorcycleLicensePlate);
        using var scope = f.Services.CreateScope();
        Assert.Equal("1XY-5678", (await scope.ServiceProvider.GetRequiredService<GrabDbContext>().Merchants.SingleAsync(x => x.Id == dashboard.Profile.Id)).MotorcycleLicensePlate);

        foreach (var service in new[] { "GrabFood", "GrabExpress" })
            Assert.Equal(HttpStatusCode.BadRequest, (await publicClient.PostAsJsonAsync("/api/merchants/register", new {
                phoneNumber = "011222333", password = f.Password,
                profile = new { service, ownerName = "Dara Sok", motorcycleLicensePlate = "1AB-1234", address = "Phnom Penh" }
            })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await publicClient.PostAsJsonAsync("/api/merchants/register", new {
            phoneNumber = "011222333", password = f.Password,
            profile = new { service = "GrabRide", ownerName = "Dara Sok", address = "Phnom Penh" }
        })).StatusCode);
    }
}
