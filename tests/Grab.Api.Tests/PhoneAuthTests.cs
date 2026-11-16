using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Grab.Api.Data;
using Grab.Api.DTOs;
using Grab.Api.Models;
using Grab.Api.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Grab.Api.Tests;

public partial class ApiTests
{
    [Fact]
    public async Task Profile_name_update_is_private_persistent_and_preserves_login_details()
    {
        await using var f = new ApiFactory();
        await f.InitializeDatabase();
        using var c = f.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await c.PatchAsJsonAsync("/api/auth/me", new { fullName = "Dara" })).StatusCode);
        var account = await Register(c, f.Password);
        using var stranger = f.CreateClient();
        var other = await Register(stranger, f.Password);
        string passwordHash;
        using (var scope = f.Services.CreateScope())
            passwordHash = (await scope.ServiceProvider.GetRequiredService<GrabDbContext>().Users.SingleAsync(x => x.Id == account.User.Id)).PasswordHash;

        const string name = "សុខា Dara";
        var saved = await c.PatchAsJsonAsync("/api/auth/me", new { fullName = $"  {name}  ", userId = other.User.Id, role = "Admin", phoneNumber = "+85512345678" });
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        var profile = await Read<UserDto>(saved);
        Assert.Equal(account.User.Id, profile.Id);
        Assert.Equal(name, profile.FullName);
        Assert.Equal(account.User.PhoneNumber, profile.PhoneNumber);
        Assert.Equal(Role.Customer, profile.Role);
        Assert.Equal(name, (await Read<UserDto>(await c.GetAsync("/api/auth/me"))).FullName);
        Assert.Equal("Customer", (await Read<UserDto>(await stranger.GetAsync("/api/auth/me"))).FullName);

        foreach (var invalid in new[] { " ", "  ", "X", new string('A', 121), "A\nName" })
            Assert.Equal(HttpStatusCode.BadRequest, (await c.PatchAsJsonAsync("/api/auth/me", new { fullName = invalid })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PatchAsJsonAsync("/api/auth/me", new { role = "Admin" })).StatusCode);

        using var fresh = f.CreateClient();
        var login = await fresh.PostAsJsonAsync("/api/auth/login", new LoginRequest(account.User.PhoneNumber, f.Password));
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        Assert.Equal(name, (await Read<AuthResponse>(login)).User.FullName);
        using var check = f.Services.CreateScope();
        var row = await check.ServiceProvider.GetRequiredService<GrabDbContext>().Users.AsNoTracking().SingleAsync(x => x.Id == account.User.Id);
        Assert.Equal(name, row.FullName);
        Assert.Equal(passwordHash, row.PasswordHash);
        Assert.Equal(account.User.PhoneNumber, row.PhoneNumber);
    }

    [Fact]
    public void Phone_normalization_handles_equivalent_formats_and_rejects_invalid_numbers()
    {
        foreach (var input in new[] { "012345678", "12345678", "012 345 678", "(012) 345-678", "+85512345678", "85512345678", "0085512345678" })
            Assert.Equal("+85512345678", PhoneNumbers.Normalize(input));
        Assert.Equal("+855123456789", PhoneNumbers.Normalize("0123456789"));
        Assert.Equal("+14155552671", PhoneNumbers.Normalize("+1 (415) 555-2671"));
        foreach (var input in new[] { "", "123", "abc012345678", "+855012345678", "+855123", "+00012345678", "++85512345678", "+1234567890123456", "012345678\nextra" })
            Assert.Null(PhoneNumbers.Normalize(input));
        Assert.Null(PhoneNumbers.Normalize(null));
    }

    [Fact]
    public async Task Phone_only_registration_login_profile_and_duplicate_validation()
    {
        await using var f = new ApiFactory();
        await f.InitializeDatabase();
        using var c = f.CreateClient();
        var response = await c.PostAsJsonAsync("/api/auth/register", new { phoneNumber = "012 345 678", password = f.Password, role = "Admin" });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var account = await Read<AuthResponse>(response);
        Assert.Equal(Role.Customer, account.User.Role);
        Assert.Equal("+85512345678", account.User.PhoneNumber);
        using (var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync()))
        {
            Assert.False(json.RootElement.GetProperty("user").TryGetProperty("email", out _));
            Assert.False(json.RootElement.GetProperty("user").TryGetProperty("passwordHash", out _));
        }
        using (var scope = f.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<GrabDbContext>();
            var row = await db.Users.SingleAsync(x => x.Id == account.User.Id);
            Assert.Null(row.Email);
            Assert.NotEqual(f.Password, row.PasswordHash);
        }
        foreach (var phone in new[] { "012345678", "(012) 345-678", "+85512345678", "85512345678", "0085512345678" })
        {
            var login = await c.PostAsJsonAsync("/api/auth/login", new LoginRequest(phone, f.Password));
            Assert.Equal(HttpStatusCode.OK, login.StatusCode);
            Assert.Equal(account.User.Id, (await Read<AuthResponse>(login)).User.Id);
        }
        Assert.Equal(HttpStatusCode.Conflict, (await c.PostAsJsonAsync("/api/auth/register", new RegisterRequest("+85512345678", f.Password))).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await c.PostAsJsonAsync("/api/auth/register", new RegisterRequest("098765432", f.Password))).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await c.PostAsJsonAsync("/api/auth/login", new LoginRequest("012345678", "wrong-password"))).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await c.PostAsJsonAsync("/api/auth/login", new LoginRequest("011111111", f.Password))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync("/api/auth/login", new { email = "legacy@example.test", password = f.Password })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync("/api/auth/register", new RegisterRequest("not-a-phone", f.Password))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync("/api/auth/register", new RegisterRequest("012345678", "short"))).StatusCode);
        SignIn(c, account);
        Assert.Equal("+85512345678", (await Read<UserDto>(await c.GetAsync("/api/auth/me"))).PhoneNumber);
    }

    [Fact]
    public async Task Concurrent_registrations_cannot_create_the_same_phone_twice()
    {
        await using var f = new ApiFactory();
        await f.InitializeDatabase();
        using var a = f.CreateClient();
        using var b = f.CreateClient();
        var results = await Task.WhenAll(
            a.PostAsJsonAsync("/api/auth/register", new RegisterRequest("012 345 678", f.Password)),
            b.PostAsJsonAsync("/api/auth/register", new RegisterRequest("+85512345678", f.Password)));
        Assert.Single(results, r => r.StatusCode == HttpStatusCode.Created);
        Assert.Single(results, r => r.StatusCode == HttpStatusCode.Conflict);
        using var scope = f.Services.CreateScope();
        Assert.Equal(1, await scope.ServiceProvider.GetRequiredService<GrabDbContext>().Users.CountAsync(x => x.PhoneNumber == "+85512345678"));
    }

    [Theory]
    [InlineData("(012) 345-678", "+85512345678")]
    [InlineData("123456789", "+855123456789")]
    public async Task Phone_migration_preserves_legacy_account_password_and_name(string savedPhone, string normalizedPhone)
    {
        await using var f = new ApiFactory();
        await f.InitializeDatabase("20261113032709_InitialCreate");
        Guid id;
        string hash;
        using (var scope = f.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<GrabDbContext>();
            var legacy = new User { FullName = "Existing Customer", Email = "legacy@example.test", PhoneNumber = savedPhone };
            hash = scope.ServiceProvider.GetRequiredService<IPasswordHasher<User>>().HashPassword(legacy, f.Password);
            legacy.PasswordHash = hash;
            db.Users.Add(legacy);
            await db.SaveChangesAsync();
            id = legacy.Id;
            db.ChangeTracker.Clear();
            await db.Database.MigrateAsync();
            var upgraded = await db.Users.SingleAsync(x => x.Id == id);
            Assert.Equal(normalizedPhone, upgraded.PhoneNumber);
            Assert.Equal("Existing Customer", upgraded.FullName);
            Assert.Equal("legacy@example.test", upgraded.Email);
            Assert.Equal(hash, upgraded.PasswordHash);
        }
        using var c = f.CreateClient();
        var login = await c.PostAsJsonAsync("/api/auth/login", new LoginRequest(savedPhone, f.Password));
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        Assert.Equal(id, (await Read<AuthResponse>(login)).User.Id);
    }

    [Fact]
    public async Task Phone_migration_rolls_back_ambiguous_legacy_accounts_without_removing_them()
    {
        await using var f = new ApiFactory();
        await f.InitializeDatabase("20261113032709_InitialCreate");
        using var scope = f.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<GrabDbContext>();
        db.Users.AddRange(
            new User { FullName = "First", Email = "first@example.test", PhoneNumber = "012 345 678", PasswordHash = "unchanged-first" },
            new User { FullName = "Second", Email = "second@example.test", PhoneNumber = "+85512345678", PasswordHash = "unchanged-second" });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        var error = await Assert.ThrowsAsync<SqlException>(() => db.Database.MigrateAsync());
        Assert.Equal(50002, error.Number);
        Assert.Equal(3, await db.Users.CountAsync()); // Two customers plus the fixture admin.
        Assert.True(await db.Users.AnyAsync(x => x.Email == "first@example.test" && x.PhoneNumber == "012 345 678" && x.PasswordHash == "unchanged-first"));
        Assert.Single(await db.Database.GetAppliedMigrationsAsync());
    }
}
