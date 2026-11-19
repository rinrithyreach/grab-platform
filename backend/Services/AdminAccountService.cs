using Grab.Api.Data;
using Grab.Api.DTOs;
using Grab.Api.Middleware;
using Grab.Api.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Grab.Api.Services;

public class AdminAccountService(GrabDbContext db, IPasswordHasher<User> hasher, AuthService auth)
{
    private async Task<User> User(Guid id, CancellationToken ct) => await db.Users.SingleOrDefaultAsync(x => x.Id == id && x.Role == Role.Admin && x.IsActive, ct)
        ?? throw new ApiException(403, "An active administrator account is required.");
    private async Task<AdminProfile> Profile(Guid id, CancellationToken ct) =>
        await db.AdminProfiles.SingleOrDefaultAsync(x => x.UserId == id, ct) ?? new AdminProfile { UserId = id };
    private async Task<AdminProfileDto> Dto(User u, AdminProfile p, CancellationToken ct)
    {
        var role = p.AdminRoleId is null ? null : await db.AdminRoles.AsNoTracking().SingleOrDefaultAsync(x => x.Id == p.AdminRoleId, ct);
        return new(u.Id, u.FullName, u.Email, p.ContactPhone, p.JobTitle, p.Bio,
        p.AvatarData is null ? null : $"data:{p.AvatarContentType};base64,{Convert.ToBase64String(p.AvatarData)}",
        p.RefreshSeconds, p.CompactTables, u.CreatedAt, u.LastLoginAt, p.PasswordChangedAt, Convert.ToBase64String(p.Version),
        role?.Id, role?.Name ?? AdminAccess.SuperRoleName, role is null,
        role is null ? AdminPermissions.All.ToList() : AdminPermissions.Normalize(AdminPermissions.Parse(role.Permissions)));
    }
    private void VerifyPassword(User u, string? password)
    {
        if (string.IsNullOrEmpty(password) || hasher.VerifyHashedPassword(u, u.PasswordHash, password) == PasswordVerificationResult.Failed)
            throw new ApiException(400, "Your current password is incorrect.");
    }
    private async Task Save(User u, AdminProfile p, string action, CancellationToken ct)
    {
        if (db.Entry(p).State == EntityState.Detached) db.AdminProfiles.Add(p);
        p.UpdatedAt = DateTimeOffset.UtcNow;
        db.AdminAudits.Add(new AdminAudit { ActorId = u.Id, ActorName = u.FullName, Resource = "profile", TargetId = u.Id,
            Action = action, Reason = "Administrator self-service" });
        await db.SaveChangesAsync(ct);
    }
    public async Task<AdminProfileDto> Get(Guid id, CancellationToken ct) => await Dto(await User(id, ct), await Profile(id, ct), ct);
    public async Task<AdminProfileResponse> Update(Guid id, SaveAdminProfileRequest r, CancellationToken ct)
    {
        var u = await User(id, ct); var p = await Profile(id, ct);
        if (Convert.ToBase64String(p.Version) != r.Version) throw new ApiException(409, "Your profile changed in another session. Reload it before saving.");
        var name = PlatformSettingsService.Clean(r.FullName, 120, "Full name");
        if (name.Length < 2) throw new ApiException(400, "Enter a name of at least 2 characters.");
        var email = r.Email.Trim().ToLowerInvariant();
        var emailChanged = !string.Equals(u.Email, email, StringComparison.OrdinalIgnoreCase);
        if (emailChanged)
        {
            VerifyPassword(u, r.CurrentPassword);
            if (await db.Users.AnyAsync(x => x.Id != id && x.Email == email, ct)) throw new ApiException(409, "This email is already in use.");
            u.Email = email; u.SecurityVersion++;
        }
        if (r.RefreshSeconds is not (0 or 15 or 30 or 60)) throw new ApiException(400, "Choose a valid dashboard refresh interval.");
        u.FullName = name;
        p.ContactPhone = string.IsNullOrWhiteSpace(r.ContactPhone) ? "" : PhoneNumbers.Normalize(r.ContactPhone) ?? throw new ApiException(400, "Enter a valid contact phone number.");
        p.JobTitle = PlatformSettingsService.Clean(r.JobTitle, 100, "Job title");
        p.Bio = PlatformSettingsService.Clean(r.Bio, 500, "Bio");
        p.RefreshSeconds = r.RefreshSeconds; p.CompactTables = r.CompactTables;
        await Save(u, p, emailChanged ? "Updated profile and sign-in email" : "Updated administrator profile", ct);
        return new(await Dto(u, p, ct), auth.Token(u));
    }
    public async Task<AdminProfileResponse> ChangePassword(Guid id, AdminPasswordRequest r, CancellationToken ct)
    {
        var u = await User(id, ct); var p = await Profile(id, ct);
        VerifyPassword(u, r.CurrentPassword);
        if (r.NewPassword != r.ConfirmPassword) throw new ApiException(400, "New password and confirmation must match.");
        if (r.NewPassword == r.CurrentPassword) throw new ApiException(400, "Choose a different new password.");
        u.PasswordHash = hasher.HashPassword(u, r.NewPassword); u.SecurityVersion++;
        p.PasswordChangedAt = DateTimeOffset.UtcNow;
        await Save(u, p, "Changed administrator password; revoked other sessions", ct);
        return new(await Dto(u, p, ct), auth.Token(u));
    }
    public async Task<AdminProfileResponse> RevokeSessions(Guid id, CancellationToken ct)
    {
        var u = await User(id, ct); var p = await Profile(id, ct);
        u.SecurityVersion++;
        await Save(u, p, "Signed out other administrator sessions", ct);
        return new(await Dto(u, p, ct), auth.Token(u));
    }
    public async Task<AdminProfileDto> Avatar(Guid id, IFormFile? file, CancellationToken ct)
    {
        var u = await User(id, ct); var p = await Profile(id, ct);
        if (file is null) { p.AvatarData = null; p.AvatarContentType = null; }
        else
        {
            if (file.Length is < 12 or > 524288) throw new ApiException(400, "Choose a JPG, PNG or WebP photo up to 512 KB.");
            using var buffer = new MemoryStream(); await file.CopyToAsync(buffer, ct); var bytes = buffer.ToArray();
            var mime = bytes.AsSpan(0, 8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }) ? "image/png"
                : bytes[0] == 255 && bytes[1] == 216 && bytes[2] == 255 ? "image/jpeg"
                : bytes.AsSpan(0, 4).SequenceEqual("RIFF"u8) && bytes.AsSpan(8, 4).SequenceEqual("WEBP"u8) ? "image/webp" : null;
            if (mime is null) throw new ApiException(400, "Only JPG, PNG and WebP photos are supported.");
            p.AvatarData = bytes; p.AvatarContentType = mime;
        }
        await Save(u, p, file is null ? "Removed administrator photo" : "Updated administrator photo", ct);
        return await Dto(u, p, ct);
    }
}
