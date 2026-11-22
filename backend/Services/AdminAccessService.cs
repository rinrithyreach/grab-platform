using Grab.Api.Data;
using Grab.Api.Middleware;
using Grab.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Grab.Api.Services;

/// <summary>
/// The fixed permission catalog. Each console section has a "view" permission and, where it has controls, a "manage"
/// permission. Permissions are defined in code because every one must be enforced by an endpoint; administrators
/// combine them into roles.
/// </summary>
public static class AdminPermissions
{
    public record Section(string Key, string Label, string ViewDescription, string? ManageDescription);

    public static readonly Section[] Sections =
    [
        new("overview", "Overview", "See dashboard totals, queues and recent activity.", null),
        new("users", "Users & access", "Search and inspect accounts.", "Create customer accounts, edit names and suspend or reactivate accounts."),
        new("merchants", "Merchants", "Inspect merchant and ride-partner profiles.", "Edit business profiles, contacts and schedules."),
        new("listings", "Listings & banners", "Inspect listings and homepage banners.", "Edit, publish and feature listings, and upload homepage banners."),
        new("promotions", "Promotions & coupons", "Inspect product promotions and promo codes.", "Create, edit, schedule, pause and delete promotions and coupons."),
        new("categories", "Categories & subcategories", "Inspect GrabFood and GrabExpress categories.", "Create, edit and delete categories and subcategories."),
        new("rides", "Rides", "Inspect all rides.", "Cancel active rides."),
        new("orders", "Orders & Express", "Inspect GrabFood and GrabExpress shop orders.", "Advance, reject or cancel food and Express orders."),
        new("deliveries", "Deliveries", "Inspect parcel deliveries.", "Cancel deliveries or mark them failed."),
        new("drivers", "Drivers", "Inspect drivers.", "Onboard drivers and set availability."),
        new("payments", "Payments", "Inspect simulated payment records.", null),
        new("reviews", "Reviews", "Inspect driver reviews.", "Hide and restore reviews."),
        new("audit", "Activity log", "Inspect every administrator change.", null),
        new("settings", "Settings", "See platform settings.", "Change services, registrations, announcements and maintenance mode."),
        new("team", "Administrators", "See administrator profiles.", "Add administrators, change their roles, suspend them and sign out their sessions."),
        new("roles", "Roles & permissions", "See roles and their permissions.", "Create, edit and delete roles."),
    ];

    public static readonly IReadOnlySet<string> All = Sections
        .SelectMany(s => s.ManageDescription is null ? new[] { $"{s.Key}.view" } : new[] { $"{s.Key}.view", $"{s.Key}.manage" })
        .ToHashSet();

    public static HashSet<string> Parse(string? stored) =>
        (stored ?? "").Split(' ', StringSplitOptions.RemoveEmptyEntries).Where(All.Contains).ToHashSet();

    /// <summary>Validates requested codes, adds the implied "view" for every "manage", and returns them in catalog order.</summary>
    public static List<string> Normalize(IEnumerable<string>? codes)
    {
        var set = new HashSet<string>();
        foreach (var code in codes ?? [])
        {
            if (!All.Contains(code)) throw new ApiException(400, $"Unknown permission: {code}.");
            set.Add(code);
            if (code.EndsWith(".manage")) set.Add(code[..^".manage".Length] + ".view");
        }
        return All.Where(set.Contains).ToList();
    }
}

/// <summary>An administrator's effective access. A null role means the built-in Super administrator with every permission.</summary>
public record AdminAccess(Guid UserId, string FullName, Guid? RoleId, string RoleName, IReadOnlySet<string> Permissions)
{
    public const string SuperRoleName = "Super administrator";
    public bool IsSuper => RoleId is null;
    public bool Has(string permission) => IsSuper || Permissions.Contains(permission);
    /// <summary>True when this administrator holds every permission in <paramref name="other"/>, so granting or changing it is not an escalation.</summary>
    public bool Covers(IEnumerable<string> other) => IsSuper || other.All(Permissions.Contains);
}

public class AdminAccessService(GrabDbContext db)
{
    private readonly Dictionary<Guid, AdminAccess> cache = [];

    public async Task<AdminAccess> Get(Guid userId, CancellationToken ct)
    {
        if (cache.TryGetValue(userId, out var cached)) return cached;
        var row = await (from u in db.Users.AsNoTracking()
                         where u.Id == userId && u.Role == Role.Admin && u.IsActive
                         join p in db.AdminProfiles.AsNoTracking() on u.Id equals p.UserId into profiles
                         from p in profiles.DefaultIfEmpty()
                         join r in db.AdminRoles.AsNoTracking() on p.AdminRoleId equals (Guid?)r.Id into roles
                         from r in roles.DefaultIfEmpty()
                         select new { u.FullName, RoleId = r == null ? (Guid?)null : r.Id, RoleName = r == null ? null : r.Name, Permissions = r == null ? null : r.Permissions })
            .SingleOrDefaultAsync(ct) ?? throw new ApiException(403, "An active administrator account is required.");
        var access = row.RoleId is null
            ? new AdminAccess(userId, row.FullName, null, AdminAccess.SuperRoleName, AdminPermissions.All)
            : new AdminAccess(userId, row.FullName, row.RoleId, row.RoleName!, AdminPermissions.Parse(row.Permissions));
        return cache[userId] = access;
    }

    public async Task<AdminAccess> Require(Guid userId, string permission, CancellationToken ct)
    {
        var access = await Get(userId, ct);
        if (!access.Has(permission))
        {
            var section = AdminPermissions.Sections.FirstOrDefault(s => permission.StartsWith(s.Key + "."))?.Label ?? permission;
            throw new ApiException(403, $"Your role ({access.RoleName}) does not allow you to {(permission.EndsWith(".manage") ? "make changes in" : "view")} {section}.");
        }
        return access;
    }

    public async Task<AdminAccess> RequireSuper(Guid userId, string message, CancellationToken ct)
    {
        var access = await Get(userId, ct);
        if (!access.IsSuper) throw new ApiException(403, message);
        return access;
    }
}
