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
        var email = r.Email.Trim().ToLowerInvariant();
        if (await db.Users.AnyAsync(x => x.Email == email, ct)) throw new ApiException(409, "Email is already registered.");
        if (string.IsNullOrWhiteSpace(r.FullName)) throw new ApiException(400, "Full name is required.");
        var user = new User { Email = email, FullName = r.FullName.Trim(), PhoneNumber = r.PhoneNumber.Trim() };
        user.PasswordHash = hasher.HashPassword(user, r.Password);
        db.Users.Add(user);
        await db.SaveChangesAsync(ct);
        return Token(user);
    }
    public async Task<AuthResponse> Login(LoginRequest r, CancellationToken ct)
    {
        var user = await db.Users.SingleOrDefaultAsync(x => x.Email == r.Email.Trim().ToLowerInvariant(), ct);
        // Run a hash verification even for unknown emails to reduce timing differences.
        var candidate = user ?? new User { PasswordHash = hasher.HashPassword(new User(), Guid.NewGuid().ToString()) };
        var result = hasher.VerifyHashedPassword(candidate, candidate.PasswordHash, r.Password);
        if (user is null || result == PasswordVerificationResult.Failed) throw new ApiException(401, "Invalid email or password.");
        if (result == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.PasswordHash = hasher.HashPassword(user, r.Password);
            await db.SaveChangesAsync(ct);
        }
        return Token(user);
    }
    public async Task<UserDto> Me(Guid id, CancellationToken ct) =>
        (await db.Users.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw new ApiException(401, "User no longer exists.")).Dto();
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
