using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Serialization;
using Grab.Api.Data;
using Grab.Api.DTOs;
using Grab.Api.Models;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Grab.Api.Tests;

public sealed class ApiFactory : WebApplicationFactory<Program>
{
    public string Password { get; } = Convert.ToBase64String(RandomNumberGenerator.GetBytes(24));
    private readonly string database = "GrabPlatformTest_" + Guid.NewGuid().ToString("N");
    public ApiFactory()
    {
        Environment.SetEnvironmentVariable("Jwt__SigningKey", Convert.ToBase64String(RandomNumberGenerator.GetBytes(48)));
        var server = Environment.GetEnvironmentVariable("GRAB_TEST_SQL_SERVER") ?? "localhost";
        Environment.SetEnvironmentVariable("ConnectionStrings__DefaultConnection", $"Server={server};Database={database};Trusted_Connection=True;TrustServerCertificate=True");
    }
    protected override void ConfigureWebHost(IWebHostBuilder builder) => builder.UseEnvironment("Development");
    public async Task InitializeDatabase()
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<GrabDbContext>();
        await db.Database.MigrateAsync();
        if (!await db.Users.AnyAsync(x => x.Role == Role.Admin))
        {
            var admin = new User { FullName = "Test Admin", Email = "admin@example.test", Role = Role.Admin };
            admin.PasswordHash = scope.ServiceProvider.GetRequiredService<IPasswordHasher<User>>().HashPassword(admin, Password);
            db.Users.Add(admin);
            await db.SaveChangesAsync();
        }
    }
    public override async ValueTask DisposeAsync()
    {
        using (var scope = Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<GrabDbContext>();
            // Only delete the unique database this fixture created, never the development database.
            Assert.Equal(database, db.Database.GetDbConnection().Database);
            Assert.StartsWith("GrabPlatformTest_", database);
            await db.Database.EnsureDeletedAsync();
        }
        await base.DisposeAsync();
    }
}

public class ApiTests
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };
    private static async Task<T> Read<T>(HttpResponseMessage response) => (await response.Content.ReadFromJsonAsync<T>(Json))!;
    private static void SignIn(HttpClient c, AuthResponse a) => c.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", a.AccessToken);
    private static async Task<AuthResponse> Register(HttpClient c, string password)
    {
        var response = await c.PostAsJsonAsync("/api/auth/register", new RegisterRequest("Test Customer", $"{Guid.NewGuid():N}@example.test", password, "+85512345678"));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var auth = await Read<AuthResponse>(response);
        SignIn(c, auth);
        return auth;
    }
    private static BookRideRequest Booking() => new("University", "Central Market", 11.56, 104.92, 11.57, 104.93);
    private static async Task<AuthResponse> Driver(ApiFactory f, HttpClient admin, HttpClient driver)
    {
        var account = await Register(driver, f.Password);
        var created = await admin.PostAsJsonAsync("/api/drivers", new DriverRequest(account.User.Id, "Car", Guid.NewGuid().ToString("N")[..10]));
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var login = await driver.PostAsJsonAsync("/api/auth/login", new LoginRequest(account.User.Email, f.Password));
        var auth = await Read<AuthResponse>(login);
        SignIn(driver, auth);
        return auth;
    }
    private static async Task<HttpClient> Admin(ApiFactory f)
    {
        var client = f.CreateClient();
        var login = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest("admin@example.test", f.Password));
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        SignIn(client, await Read<AuthResponse>(login));
        return client;
    }

    [Fact]
    public async Task Complete_sql_backed_booking_payment_review_flow_and_ownership()
    {
        await using var f = new ApiFactory();
        await f.InitializeDatabase();
        using var customer = f.CreateClient();
        using var stranger = f.CreateClient();
        using var driver = f.CreateClient();
        using var admin = await Admin(f);
        var account = await Register(customer, f.Password);
        Assert.Equal(HttpStatusCode.OK, (await customer.GetAsync("/api/auth/me")).StatusCode);
        var login = await customer.PostAsJsonAsync("/api/auth/login", new LoginRequest(account.User.Email, f.Password));
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        await Register(stranger, f.Password);
        await Driver(f, admin, driver);
        Assert.Single(await Read<List<DriverDto>>(await customer.GetAsync("/api/drivers/available")));
        var booked = await customer.PostAsJsonAsync("/api/rides", Booking());
        Assert.Equal(HttpStatusCode.Created, booked.StatusCode);
        var ride = await Read<RideDto>(booked);
        using (var scope = f.Services.CreateScope())
            Assert.True(await scope.ServiceProvider.GetRequiredService<GrabDbContext>().Rides.AnyAsync(x => x.Id == ride.Id));
        Assert.Single(await Read<List<RideDto>>(await customer.GetAsync("/api/rides/mine")));
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.GetAsync($"/api/rides/{ride.Id}")).StatusCode);
        Assert.Empty(await Read<List<RideDto>>(await stranger.GetAsync("/api/rides")));
        Assert.Equal(HttpStatusCode.Conflict, (await customer.PostAsJsonAsync("/api/payments", new PaymentRequest(ride.Id))).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await customer.PostAsJsonAsync("/api/reviews", new ReviewRequest(ride.Id, 5, "Early"))).StatusCode);
        foreach (var status in new[] { "Accepted", "InProgress", "Completed" })
            Assert.Equal(HttpStatusCode.OK, (await driver.PatchAsJsonAsync($"/api/rides/{ride.Id}/status", new { status })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.PostAsJsonAsync("/api/payments", new PaymentRequest(ride.Id))).StatusCode);
        var paid = await customer.PostAsJsonAsync("/api/payments", new PaymentRequest(ride.Id));
        Assert.Equal(HttpStatusCode.Created, paid.StatusCode);
        Assert.Equal("SimulatedSucceeded", (await Read<PaymentDto>(paid)).Status);
        Assert.Equal(HttpStatusCode.Conflict, (await customer.PostAsJsonAsync("/api/payments", new PaymentRequest(ride.Id))).StatusCode);
        Assert.Single(await Read<List<PaymentDto>>(await customer.GetAsync("/api/payments/mine")));
        Assert.Empty(await Read<List<PaymentDto>>(await stranger.GetAsync("/api/payments/mine")));
        var reviewed = await customer.PostAsJsonAsync("/api/reviews", new ReviewRequest(ride.Id, 5, "Good demo ride"));
        Assert.Equal(HttpStatusCode.Created, reviewed.StatusCode);
        var review = await Read<ReviewDto>(reviewed);
        Assert.Single(await Read<List<ReviewDto>>(await customer.GetAsync($"/api/drivers/{review.DriverId}/reviews")));
        Assert.Equal(HttpStatusCode.Conflict, (await customer.PostAsJsonAsync("/api/reviews", new ReviewRequest(ride.Id, 5, null))).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await customer.PatchAsJsonAsync($"/api/rides/{ride.Id}/status", new { status = "Cancelled" })).StatusCode);
    }

    [Fact]
    public async Task Validation_authentication_and_role_boundaries()
    {
        await using var f = new ApiFactory();
        await f.InitializeDatabase();
        using var c = f.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await c.GetAsync("/api/rides")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync("/api/auth/register", new RegisterRequest("A", "bad", "short", "x"))).StatusCode);
        var account = await Register(c, f.Password);
        Assert.Equal(HttpStatusCode.Conflict, (await c.PostAsJsonAsync("/api/auth/register", new RegisterRequest("Duplicate", account.User.Email.ToUpperInvariant(), f.Password, "+85512345678"))).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await c.PostAsJsonAsync("/api/auth/login", new LoginRequest(account.User.Email, "incorrect-password"))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await c.PostAsJsonAsync("/api/drivers", new DriverRequest(account.User.Id, "Car", "ABC"))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync("/api/rides", Booking() with { PickupLatitude = 100 })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync("/api/rides", new { pickupLocation = "University", destination = "Market" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.GetAsync("/api/rides?page=0")).StatusCode);
        var ride = await Read<RideDto>(await c.PostAsJsonAsync("/api/rides", Booking()));
        Assert.Equal(HttpStatusCode.Conflict, (await c.PatchAsJsonAsync($"/api/rides/{ride.Id}/status", new { status = "Accepted" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PatchAsJsonAsync($"/api/rides/{ride.Id}/status", new { status = "Unknown" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await c.PatchAsJsonAsync($"/api/rides/{ride.Id}/status", new { status = "Cancelled" })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await c.PatchAsJsonAsync($"/api/rides/{ride.Id}/status", new { status = "Cancelled" })).StatusCode);
        c.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", account.AccessToken + "corrupted");
        Assert.Equal(HttpStatusCode.Unauthorized, (await c.GetAsync("/api/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await c.GetAsync("/swagger/v1/swagger.json")).StatusCode);
    }

    [Fact]
    public async Task Two_drivers_cannot_accept_same_ride_and_unassigned_driver_cannot_update()
    {
        await using var f = new ApiFactory();
        await f.InitializeDatabase();
        using var admin = await Admin(f);
        using var c = f.CreateClient();
        using var a = f.CreateClient();
        using var b = f.CreateClient();
        await Register(c, f.Password);
        await Driver(f, admin, a);
        await Driver(f, admin, b);
        var ride = await Read<RideDto>(await c.PostAsJsonAsync("/api/rides", Booking()));
        var results = await Task.WhenAll(a.PatchAsJsonAsync($"/api/rides/{ride.Id}/status", new { status = "Accepted" }), b.PatchAsJsonAsync($"/api/rides/{ride.Id}/status", new { status = "Accepted" }));
        Assert.Single(results, r => r.StatusCode == HttpStatusCode.OK);
        Assert.Single(results, r => r.StatusCode is HttpStatusCode.Conflict or HttpStatusCode.Forbidden);
        var loser = results[0].IsSuccessStatusCode ? b : a;
        Assert.Equal(HttpStatusCode.Forbidden, (await loser.PatchAsJsonAsync($"/api/rides/{ride.Id}/status", new { status = "InProgress" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await c.PatchAsJsonAsync($"/api/rides/{ride.Id}/status", new { status = "Cancelled" })).StatusCode);
        Assert.Equal(2, (await Read<List<DriverDto>>(await c.GetAsync("/api/drivers/available"))).Count);
    }

    [Fact]
    public async Task One_driver_cannot_accept_two_rides_concurrently()
    {
        await using var f = new ApiFactory();
        await f.InitializeDatabase();
        using var admin = await Admin(f);
        using var c = f.CreateClient();
        using var d = f.CreateClient();
        await Register(c, f.Password);
        await Driver(f, admin, d);
        var first = await Read<RideDto>(await c.PostAsJsonAsync("/api/rides", Booking()));
        var second = await Read<RideDto>(await c.PostAsJsonAsync("/api/rides", Booking()));
        var results = await Task.WhenAll(d.PatchAsJsonAsync($"/api/rides/{first.Id}/status", new { status = "Accepted" }),
            d.PatchAsJsonAsync($"/api/rides/{second.Id}/status", new { status = "Accepted" }));
        Assert.Single(results, r => r.StatusCode == HttpStatusCode.OK);
        Assert.Single(results, r => r.StatusCode == HttpStatusCode.Conflict);
    }
}
