using Grab.Api.Data;
using Grab.Api.DTOs;
using Grab.Api.Middleware;
using Grab.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Grab.Api.Services;

/// <summary>Homepage banners that administrators upload in the admin console ("Listings &amp; banners").</summary>
public class BannerService(GrabDbContext db)
{
    public const int MaxBanners = 20;
    public static string ImageUrl(Guid id, Guid version) => $"/api/banner-images/{id}/{version}";

    private static string Text(string? value, int max, string field)
    {
        var text = value?.Trim() ?? "";
        if (text.Length > max || text.Any(char.IsControl)) throw new ApiException(400, $"{field} must be at most {max} characters without control characters.");
        return text;
    }

    /// <summary>Empty, a site path ("/food", not "//host"), or an absolute http(s) URL.</summary>
    private static string Link(string? value)
    {
        var link = Text(value, 300, "Link");
        if (link == "" || (link.StartsWith('/') && !link.StartsWith("//") && !link.Contains('\\'))) return link;
        if (Uri.TryCreate(link, UriKind.Absolute, out var uri) && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps)) return link;
        throw new ApiException(400, "Link must be empty, a site path such as /food, or a full http(s) address.");
    }

    private static async Task<(byte[] Data, string Mime)> ReadImage(IFormFile file, CancellationToken ct)
    {
        if (file.Length is < 12 or > MerchantService.MaxImageBytes) throw new ApiException(400, "Choose a JPG, PNG or WebP image up to 2 MB.");
        using var buffer = new MemoryStream();
        await file.CopyToAsync(buffer, ct);
        var bytes = buffer.ToArray();
        // Derive the served MIME type from the file bytes, never its extension or supplied MIME type.
        var mime = bytes.AsSpan(0, 8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }) ? "image/png"
            : bytes[0] == 255 && bytes[1] == 216 && bytes[2] == 255 ? "image/jpeg"
            : bytes.AsSpan(0, 4).SequenceEqual("RIFF"u8) && bytes.AsSpan(8, 4).SequenceEqual("WEBP"u8) ? "image/webp" : null;
        return (bytes, mime ?? throw new ApiException(400, "Only JPG, PNG and WebP images are supported."));
    }

    /// <summary>Active banners for the public homepage, in display order. Image bytes are not loaded.</summary>
    public async Task<List<BannerDto>> Public(CancellationToken ct) =>
        (await db.HomeBanners.AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.SortOrder).ThenBy(x => x.CreatedAt)
            .Select(x => new { x.Id, x.ImageVersion, x.Title, x.Subtitle, x.LinkUrl }).ToListAsync(ct))
        .Select(x => new BannerDto(x.Id, ImageUrl(x.Id, x.ImageVersion), x.Title, x.Subtitle, x.LinkUrl)).ToList();

    public async Task<List<AdminBannerDto>> List(CancellationToken ct) =>
        (await db.HomeBanners.AsNoTracking().OrderBy(x => x.SortOrder).ThenBy(x => x.CreatedAt)
            .Select(x => new { x.Id, x.ImageVersion, x.Title, x.Subtitle, x.LinkUrl, x.SortOrder, x.IsActive, x.UpdatedAt }).ToListAsync(ct))
        .Select(x => new AdminBannerDto(x.Id, ImageUrl(x.Id, x.ImageVersion), x.Title, x.Subtitle, x.LinkUrl, x.SortOrder, x.IsActive, x.UpdatedAt)).ToList();

    public async Task<(byte[] Data, string ContentType)?> Image(Guid id, Guid version, CancellationToken ct)
    {
        var row = await db.HomeBanners.AsNoTracking().Where(x => x.Id == id && x.ImageVersion == version)
            .Select(x => new { x.ImageData, x.ContentType }).SingleOrDefaultAsync(ct);
        return row is null ? null : (row.ImageData, row.ContentType);
    }

    /// <summary>Creates a banner (image required) or updates one (image optional: keeps the current picture).</summary>
    public async Task<Guid> Save(Guid actorId, Guid? id, AdminBannerForm form, IFormFile? image, CancellationToken ct)
    {
        var banner = id.HasValue
            ? await db.HomeBanners.SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw new ApiException(404, "Banner not found.")
            : new HomeBanner();
        if (!id.HasValue)
        {
            if (image is null) throw new ApiException(400, "Choose an image for the new banner.");
            if (await db.HomeBanners.CountAsync(ct) >= MaxBanners)
                throw new ApiException(409, $"The limit of {MaxBanners} banners has been reached. Delete or edit an existing banner.");
        }
        if (form.SortOrder is < 0 or > 999) throw new ApiException(400, "Position must be between 0 and 999.");
        banner.Title = Text(form.Title, 80, "Title");
        banner.Subtitle = Text(form.Subtitle, 160, "Subtitle");
        banner.LinkUrl = Link(form.LinkUrl);
        banner.SortOrder = form.SortOrder;
        banner.IsActive = form.IsActive;
        if (image is not null)
        {
            (banner.ImageData, banner.ContentType) = await ReadImage(image, ct);
            banner.ImageVersion = Guid.NewGuid();
        }
        banner.UpdatedAt = DateTimeOffset.UtcNow;
        if (!id.HasValue) db.HomeBanners.Add(banner);
        var name = banner.Title == "" ? "untitled banner" : banner.Title;
        await Audit(actorId, banner.Id, $"{(id.HasValue ? "Updated" : "Uploaded")} homepage banner {name}", form.Reason, ct);
        return banner.Id;
    }

    public async Task Delete(Guid actorId, Guid id, string? reason, CancellationToken ct)
    {
        var banner = await db.HomeBanners.SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw new ApiException(404, "Banner not found.");
        db.HomeBanners.Remove(banner);
        await Audit(actorId, id, $"Deleted homepage banner {(banner.Title == "" ? "untitled banner" : banner.Title)}", reason, ct);
    }

    /// <summary>Saves the change and its activity-log entry together. Banners share the "listings" section and permission.</summary>
    private async Task Audit(Guid actorId, Guid targetId, string action, string? reason, CancellationToken ct)
    {
        var why = reason?.Trim() ?? "";
        if (why.Length is < 3 or > 300 || why.Any(char.IsControl)) throw new ApiException(400, "Enter a reason of 3-300 characters.");
        var actor = await db.Users.AsNoTracking().SingleAsync(x => x.Id == actorId, ct);
        db.AdminAudits.Add(new AdminAudit { ActorId = actorId, ActorName = actor.FullName, Resource = "listings",
            TargetId = targetId, Action = action.Length > 100 ? action[..100] : action, Reason = why });
        await db.SaveChangesAsync(ct);
    }
}
