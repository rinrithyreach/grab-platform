using System.Text.Json;
using Grab.Api.Data;
using Grab.Api.DTOs;
using Grab.Api.Middleware;
using Grab.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Grab.Api.Controllers;

[ApiController, Authorize, Route("api/account-data")]
public class AccountDataController(GrabDbContext db) : ApiControllerBase
{
    private static readonly HashSet<string> Keys = ["grab-shop-v1", "grab-express-demo-v1", "grab-wallet-v1",
        "grab-profile-v1", "grab-favorites-v1", "grab-wishlist-v1", "grab-reviews-v1", "grab-settings"];

    [HttpGet]
    public async Task<AccountDataDto> Get(CancellationToken ct)
    {
        var row = await db.AccountData.AsNoTracking().SingleOrDefaultAsync(x => x.UserId == UserId, ct);
        return row is null ? new(0, []) : new(row.Version, JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(row.Json)!);
    }

    [HttpPatch, RequestSizeLimit(2_000_000)]
    public async Task<AccountDataDto> Save(SaveAccountDataRequest r, CancellationToken ct)
    {
        if (r.Data.Count > Keys.Count || r.Data.Any(x => !Keys.Contains(x.Key) || x.Value.ValueKind != JsonValueKind.Object))
            throw new ApiException(400, "Only supported account data sections can be saved.");
        if (r.Data.TryGetValue("grab-reviews-v1", out var reviews)) ValidateReviews(reviews);
        if (r.Data.TryGetValue("grab-settings", out var settings)
            && (!settings.TryGetProperty("lang", out var lang) || lang.ValueKind != JsonValueKind.String || lang.GetString() is not ("en" or "km")
                || !settings.TryGetProperty("theme", out var theme) || theme.ValueKind != JsonValueKind.String || theme.GetString() is not ("light" or "dark" or "system")))
            throw new ApiException(400, "Invalid language or theme.");
        var json = JsonSerializer.Serialize(r.Data);
        if (json.Length > 1_000_000) throw new ApiException(400, "Account data exceeds the 1 MB limit. Contact the project administrator.");
        var row = await db.AccountData.SingleOrDefaultAsync(x => x.UserId == UserId, ct);
        if ((row?.Version ?? 0) != r.Version || r.Version == long.MaxValue)
            throw new ApiException(409, "Your data changed on another device. Load the latest version before saving.");
        if (row is null) { row = new AccountData { UserId = UserId }; db.AccountData.Add(row); }
        row.Json = json;
        row.Version = r.Version + 1;
        row.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        return new(row.Version, r.Data);
    }

    private static void ValidateReviews(JsonElement section)
    {
        if (!section.TryGetProperty("reviews", out var reviews) || reviews.ValueKind != JsonValueKind.Array || reviews.GetArrayLength() > 1000)
            throw new ApiException(400, "Invalid store reviews.");
        foreach (var review in reviews.EnumerateArray())
        {
            if (review.ValueKind != JsonValueKind.Object || !Text(review, "id", 1, 120) || !Text(review, "storeId", 1, 120)
                || !Text(review, "name", 1, 120) || !Text(review, "comment", 0, 1500) || !Text(review, "createdAt", 1, 60)
                || !DateTimeOffset.TryParse(review.GetProperty("createdAt").GetString(), out _)
                || !review.TryGetProperty("rating", out var rating) || rating.ValueKind != JsonValueKind.Number || !rating.TryGetInt32(out var number) || number is < 1 or > 5)
                throw new ApiException(400, "Invalid store review. Ratings must be 1–5 with a valid store, date and comment.");
        }
    }
    private static bool Text(JsonElement element, string key, int min, int max) =>
        element.TryGetProperty(key, out var value) && value.ValueKind == JsonValueKind.String && value.GetString()!.Length >= min && value.GetString()!.Length <= max;
}

[ApiController, Route("api/store-reviews")]
public class StoreReviewsController(GrabDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<List<StoreReviewDto>> Get(CancellationToken ct)
    {
        var subject = User.FindFirst("sub")?.Value;
        Guid.TryParse(subject, out var currentId);
        // Project only public fields and bound results in SQL. Loading every full
        // account snapshot here allowed anonymous requests to exhaust API memory.
        return await db.Database.SqlQuery<StoreReviewDto>($"""
            SELECT TOP (1000)
                LOWER(CONVERT(nvarchar(36), a.UserId)) + ':' + r.Id AS Id,
                r.StoreId, r.Name, r.Rating, r.Comment, r.CreatedAt
            FROM AccountData AS a
            CROSS APPLY OPENJSON(a.Json, '$."grab-reviews-v1".reviews') WITH (
                Id nvarchar(120) '$.id', StoreId nvarchar(120) '$.storeId',
                Name nvarchar(120) '$.name', Rating int '$.rating',
                Comment nvarchar(1500) '$.comment', CreatedAt nvarchar(60) '$.createdAt'
            ) AS r
            WHERE a.UserId <> {currentId}
                AND r.Id IS NOT NULL AND r.StoreId IS NOT NULL AND r.Name IS NOT NULL
                AND r.Rating BETWEEN 1 AND 5 AND r.Comment IS NOT NULL
                AND TRY_CONVERT(datetimeoffset, r.CreatedAt) IS NOT NULL
            ORDER BY TRY_CONVERT(datetimeoffset, r.CreatedAt) DESC, a.UserId, r.Id
            """).ToListAsync(ct);
    }
}

[ApiController, Route("api/sync/status")]
public class SyncStatusController(GrabDbContext db) : ControllerBase
{
    // A different database gets a different ID when migrations run. No SQL host,
    // connection string, account data or credentials are disclosed.
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var identity = await db.SharedStorageIdentities.AsNoTracking().SingleAsync(x => x.Id == 1, ct);
        return Ok(new { status = "ok", storageId = identity.StorageId });
    }
}
