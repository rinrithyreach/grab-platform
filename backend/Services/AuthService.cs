using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Grab.Api.Configuration;
using Grab.Api.Data;
using Grab.Api.DTOs;
using Grab.Api.Interfaces;
using Grab.Api.Middleware;
using Grab.Api.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace Grab.Api.Services;
public class AuthService(GrabDbContext db, IPasswordHasher<User> hasher, IOptions<JwtSettings> settings) : IAuthService
{
    public async Task<AuthResponse> Register(RegisterRequest r, CancellationToken ct)
    {
        var phone = PhoneNumbers.Normalize(r.PhoneNumber)
            ?? throw new ApiException(400, "Enter a valid phone number, for example 012345678 or +85512345678.");
        if (await db.Users.AnyAsync(x => x.PhoneNumber == phone, ct)) throw new ApiException(409, "Phone number is already registered. Sign in instead.");
        var user = new User { FullName = "Customer", PhoneNumber = phone };
        user.PasswordHash = hasher.HashPassword(user, r.Password);
        db.Users.Add(user);
        await db.SaveChangesAsync(ct);
        return Token(user);
    }
    public async Task<AuthResponse> Login(LoginRequest r, CancellationToken ct)
    {
        var phone = PhoneNumbers.Normalize(r.PhoneNumber)
            ?? throw new ApiException(400, "Enter a valid phone number, for example 012345678 or +85512345678.");
        var user = await db.Users.SingleOrDefaultAsync(x => x.PhoneNumber == phone, ct);
        // Run a hash verification even for unknown phone numbers to reduce timing differences.
        var candidate = user ?? new User { PasswordHash = hasher.HashPassword(new User(), Guid.NewGuid().ToString()) };
        var result = hasher.VerifyHashedPassword(candidate, candidate.PasswordHash, r.Password);
        if (user is null || result == PasswordVerificationResult.Failed) throw new ApiException(401, "Invalid phone number or password.");
        if (result == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.PasswordHash = hasher.HashPassword(user, r.Password);
            await db.SaveChangesAsync(ct);
        }
        return Token(user);
    }
    public async Task<AuthResponse> RegisterMerchant(MerchantRegisterRequest r, CancellationToken ct)
    {
        var phone = PhoneNumbers.Normalize(r.PhoneNumber)
            ?? throw new ApiException(400, "Enter a valid sign-in phone number.");
        if (await db.Users.AnyAsync(x => x.PhoneNumber == phone, ct))
            throw new ApiException(409, "Phone number is already registered. Use a separate phone number for your merchant account.");
        var merchant = new Merchant();
        var profile = r.Profile.Service == MerchantServiceKind.GrabRide ? r.Profile with { ContactPhone = phone } : r.Profile;
        MerchantService.ApplyProfile(merchant, profile);
        var user = new User { FullName = merchant.OwnerName, PhoneNumber = phone, Role = Role.Merchant };
        user.PasswordHash = hasher.HashPassword(user, r.Password);
        merchant.UserId = user.Id;
        db.Users.Add(user);
        db.Merchants.Add(merchant);
        await db.SaveChangesAsync(ct);
        return Token(user);
    }
    public async Task<UserDto> Me(Guid id, CancellationToken ct) =>
        (await db.Users.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw new ApiException(401, "User no longer exists.")).Dto();
    public async Task<UserDto> UpdateProfile(Guid id, UpdateProfileRequest r, CancellationToken ct)
    {
        var name = r.FullName.Trim();
        if (name.Length is < 2 or > 120 || name.Any(char.IsControl))
            throw new ApiException(400, "Enter a name between 2 and 120 characters without control characters.");
        var user = await db.Users.SingleOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new ApiException(401, "User no longer exists.");
        user.FullName = name;
        await db.SaveChangesAsync(ct);
        return user.Dto();
    }
    private AuthResponse Token(User u)
    {
        var s = settings.Value;
        var expires = DateTimeOffset.UtcNow.AddMinutes(s.ExpiryMinutes);
        var token = new JwtSecurityToken(s.Issuer, s.Audience,
            [new Claim("sub", u.Id.ToString()), new Claim("role", u.Role.ToString()), new Claim("jti", Guid.NewGuid().ToString())],
            expires: expires.UtcDateTime,
            signingCredentials: new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(s.SigningKey)), SecurityAlgorithms.HmacSha256));
        return new(new JwtSecurityTokenHandler().WriteToken(token), expires, u.Dto());
    }
}
