using Grab.Api.Data;
using Grab.Api.DTOs;
using Grab.Api.Middleware;
using Grab.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Grab.Api.Controllers;

[ApiController, Route("api/auth/me/avatar"), Authorize]
public class ProfilePhotoController(GrabDbContext db) : ApiControllerBase
{
    private const int MaxBytes = 512 * 1024;

    [HttpPost, RequestSizeLimit(MaxBytes + 65536)]
    public async Task<UserDto> Upload(IFormFile file, CancellationToken ct)
    {
        if (file.Length is < 12 or > MaxBytes)
            throw new ApiException(400, "Choose a JPG, PNG or WebP photo up to 512 KB.");
        using var buffer = new MemoryStream();
        await file.CopyToAsync(buffer, ct);
        var bytes = buffer.ToArray();
        var mime = bytes.AsSpan(0, 8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }) ? "image/png"
            : bytes[0] == 255 && bytes[1] == 216 && bytes[2] == 255 ? "image/jpeg"
            : bytes.AsSpan(0, 4).SequenceEqual("RIFF"u8) && bytes.AsSpan(8, 4).SequenceEqual("WEBP"u8) ? "image/webp" : null;
        if (mime is null) throw new ApiException(400, "Only JPG, PNG and WebP photos are supported.");
        var user = await Owner(ct);
        user.ProfilePhoto ??= new UserProfilePhoto { UserId = user.Id };
        user.ProfilePhoto.Data = bytes;
        user.ProfilePhoto.ContentType = mime;
        await db.SaveChangesAsync(ct);
        return user.Dto();
    }

    [HttpDelete]
    public async Task<UserDto> Remove(CancellationToken ct)
    {
        var user = await Owner(ct);
        if (user.ProfilePhoto is { } photo)
        {
            db.UserProfilePhotos.Remove(photo);
            user.ProfilePhoto = null;
            await db.SaveChangesAsync(ct);
        }
        return user.Dto();
    }

    private async Task<User> Owner(CancellationToken ct) =>
        await db.Users.Include(x => x.ProfilePhoto).SingleOrDefaultAsync(x => x.Id == UserId, ct)
        ?? throw new ApiException(401, "User no longer exists.");
}
