using System.ComponentModel.DataAnnotations;
using Grab.Api.Data;
using Grab.Api.DTOs;
using Grab.Api.Middleware;
using Grab.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Grab.Api.Services;

public class PlatformSettingsService(GrabDbContext db)
{
    public async Task<PlatformSettings> Read(CancellationToken ct) =>
        await db.PlatformSettings.AsNoTracking().SingleOrDefaultAsync(x => x.Id == 1, ct) ?? new PlatformSettings();
    public static PlatformSettingsDto Dto(PlatformSettings s) => new(s.SupportEmail, s.SupportPhone, s.SupportHours, s.OfficeAddress,
        s.AnnouncementEnabled, s.Announcement, s.MaintenanceMode, s.MaintenanceMessage, s.RidesEnabled, s.FoodEnabled,
        s.ExpressEnabled, s.CustomerRegistrationEnabled, s.MerchantRegistrationEnabled, s.UpdatedAt, Convert.ToBase64String(s.Version));
    internal static string Clean(string? value, int max, string field)
    {
        var result = value?.Trim() ?? "";
        if (result.Length > max || result.Any(char.IsControl)) throw new ApiException(400, $"{field} must be at most {max} characters without control characters.");
        return result;
    }
    public async Task<PlatformSettingsDto> Save(Guid actorId, SavePlatformSettingsRequest r, CancellationToken ct)
    {
        var reason = Clean(r.Reason, 300, "Reason");
        if (reason.Length < 3) throw new ApiException(400, "Explain the change in at least 3 characters.");
        var saved = await db.PlatformSettings.SingleOrDefaultAsync(x => x.Id == 1, ct);
        var s = saved ?? new PlatformSettings();
        if (Convert.ToBase64String(s.Version) != r.Version) throw new ApiException(409, "Settings changed in another session. Reload the latest settings before saving.");
        var before = Dto(s);
        s.SupportEmail = Clean(r.SupportEmail, 254, "Support email").ToLowerInvariant();
        if (s.SupportEmail.Length > 0 && !new EmailAddressAttribute().IsValid(s.SupportEmail)) throw new ApiException(400, "Enter a valid support email.");
        s.SupportPhone = string.IsNullOrWhiteSpace(r.SupportPhone) ? "" : PhoneNumbers.Normalize(r.SupportPhone) ?? throw new ApiException(400, "Enter a valid support phone number.");
        s.SupportHours = Clean(r.SupportHours, 120, "Support hours");
        s.OfficeAddress = Clean(r.OfficeAddress, 300, "Office address");
        s.Announcement = Clean(r.Announcement, 300, "Announcement");
        s.MaintenanceMessage = Clean(r.MaintenanceMessage, 300, "Maintenance message");
        if (r.AnnouncementEnabled && s.Announcement.Length < 3) throw new ApiException(400, "Write an announcement before enabling it.");
        if (s.MaintenanceMessage.Length < 3) throw new ApiException(400, "Enter a maintenance message of at least 3 characters.");
        s.AnnouncementEnabled = r.AnnouncementEnabled;
        s.MaintenanceMode = r.MaintenanceMode;
        s.RidesEnabled = r.RidesEnabled; s.FoodEnabled = r.FoodEnabled; s.ExpressEnabled = r.ExpressEnabled;
        s.CustomerRegistrationEnabled = r.CustomerRegistrationEnabled; s.MerchantRegistrationEnabled = r.MerchantRegistrationEnabled;
        s.UpdatedAt = DateTimeOffset.UtcNow; s.UpdatedBy = actorId;
        if (saved is null) db.PlatformSettings.Add(s);
        var changes = new List<string>();
        if (before.MaintenanceMode != s.MaintenanceMode) changes.Add(s.MaintenanceMode ? "maintenance on" : "maintenance off");
        if (before.RidesEnabled != s.RidesEnabled) changes.Add(s.RidesEnabled ? "rides on" : "rides off");
        if (before.FoodEnabled != s.FoodEnabled) changes.Add(s.FoodEnabled ? "food on" : "food off");
        if (before.ExpressEnabled != s.ExpressEnabled) changes.Add(s.ExpressEnabled ? "express on" : "express off");
        var actor = await db.Users.SingleAsync(x => x.Id == actorId, ct);
        db.AdminAudits.Add(new AdminAudit { ActorId = actorId, ActorName = actor.FullName, Resource = "settings", TargetId = Guid.Empty,
            Action = changes.Count > 0 ? string.Join(", ", changes) : "Updated platform settings", Reason = reason });
        await db.SaveChangesAsync(ct);
        return Dto(s);
    }
    public async Task RequireService(MerchantServiceKind service, CancellationToken ct)
    {
        var s = await Read(ct);
        if (s.MaintenanceMode) throw new ApiException(503, s.MaintenanceMessage);
        if (!(service switch { MerchantServiceKind.GrabRide => s.RidesEnabled, MerchantServiceKind.GrabFood => s.FoodEnabled, _ => s.ExpressEnabled }))
            throw new ApiException(503, $"{service} is temporarily paused for new bookings. Please try again later.");
    }
    public async Task RequireRegistration(bool merchant, CancellationToken ct)
    {
        var s = await Read(ct);
        if (s.MaintenanceMode) throw new ApiException(503, s.MaintenanceMessage);
        if (!(merchant ? s.MerchantRegistrationEnabled : s.CustomerRegistrationEnabled))
            throw new ApiException(503, $"New {(merchant ? "merchant" : "customer")} registrations are temporarily paused.");
    }
}
