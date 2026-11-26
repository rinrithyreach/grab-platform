using System.Security.Cryptography;
using Grab.Api.Models;
using Microsoft.AspNetCore.Identity;

namespace Grab.Api.Services;

// Use the configured password hasher once per sign-in, including unknown accounts.
public sealed class LoginPasswordVerifier
{
    private readonly IPasswordHasher<User> hasher;
    private readonly User unknown = new();

    public LoginPasswordVerifier(IPasswordHasher<User> hasher)
    {
        this.hasher = hasher;
        unknown.PasswordHash = hasher.HashPassword(unknown, Convert.ToHexString(RandomNumberGenerator.GetBytes(32)));
    }

    public PasswordVerificationResult Verify(User? user, string password)
    {
        var candidate = user ?? unknown;
        var result = hasher.VerifyHashedPassword(candidate, candidate.PasswordHash, password);
        return user is { IsActive: true } ? result : PasswordVerificationResult.Failed;
    }
}
