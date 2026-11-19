using Grab.Api.Data;
using Grab.Api.DTOs;
using Grab.Api.Middleware;
using Grab.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Grab.Api.Services;

/// <summary>Custom administrator roles built from the fixed permission catalog.</summary>
public class AdminRoleService(GrabDbContext db, AdminAccessService access)
{
    private static string Reason(string? value)
    {
        var reason = PlatformSettingsService.Clean(value, 300, "Reason");
        if (reason.Length < 3) throw new ApiException(400, "Explain the change in at least 3 characters.");
        return reason;
    }

    private static string Short(string text) => text.Length > 100 ? text[..99] + "…" : text;

    private void Audit(AdminAccess actor, Guid target, string action, string reason) =>
        db.AdminAudits.Add(new AdminAudit { ActorId = actor.UserId, ActorName = actor.FullName, Resource = "roles",
            TargetId = target, Action = Short(action), Reason = reason });

    private static void RequireCovers(AdminAccess actor, IEnumerable<string> permissions)
    {
        if (!actor.Covers(permissions))
            throw new ApiException(403, "You can only grant or change permissions that your own role includes.");
    }

    public async Task<AdminRolesResponse> List(Guid actorId, CancellationToken ct)
    {
        var actor = await access.Get(actorId, ct);
        // The Administrators page needs role names for its role picker, so team viewers may read roles too.
        if (!actor.Has("roles.view") && !actor.Has("team.view")) await access.Require(actorId, "roles.view", ct);
        var admins = await (from u in db.Users.AsNoTracking()
                            where u.Role == Role.Admin
                            join p in db.AdminProfiles.AsNoTracking() on u.Id equals p.UserId into profiles
                            from p in profiles.DefaultIfEmpty()
                            select new { RoleId = p == null ? null : p.AdminRoleId, u.IsActive }).ToListAsync(ct);
        var roles = await db.AdminRoles.AsNoTracking().OrderBy(x => x.Name).ToListAsync(ct);
        return new(
            roles.Select(r => new AdminRoleDto(r.Id, r.Name, r.Description, AdminPermissions.Normalize(AdminPermissions.Parse(r.Permissions)),
                admins.Count(a => a.RoleId == r.Id), admins.Count(a => a.RoleId == r.Id && a.IsActive), r.CreatedAt, r.UpdatedAt,
                Convert.ToBase64String(r.Version))).ToList(),
            admins.Count(a => a.RoleId is null && a.IsActive),
            AdminPermissions.Sections.Select(s => new AdminPermissionSectionDto(s.Key, s.Label, s.ViewDescription, s.ManageDescription)).ToList());
    }

    private async Task<(string Name, string Description, List<string> Permissions)> Validate(Guid? id, SaveAdminRoleRequest r, CancellationToken ct)
    {
        var name = PlatformSettingsService.Clean(r.Name, 60, "Role name");
        if (name.Length < 2) throw new ApiException(400, "Enter a role name of at least 2 characters.");
        if (string.Equals(name, AdminAccess.SuperRoleName, StringComparison.OrdinalIgnoreCase))
            throw new ApiException(409, "Super administrator is a built-in role. Choose a different name.");
        if (await db.AdminRoles.AnyAsync(x => x.Id != id && x.Name == name, ct)) throw new ApiException(409, "A role with this name already exists.");
        var permissions = AdminPermissions.Normalize(r.Permissions);
        if (permissions.Count == 0) throw new ApiException(400, "Choose at least one permission.");
        return (name, PlatformSettingsService.Clean(r.Description, 300, "Description"), permissions);
    }

    public async Task<Guid> Create(Guid actorId, SaveAdminRoleRequest r, CancellationToken ct)
    {
        var actor = await access.Require(actorId, "roles.manage", ct);
        var reason = Reason(r.Reason);
        var (name, description, permissions) = await Validate(null, r, ct);
        RequireCovers(actor, permissions);
        var role = new AdminRole { Name = name, Description = description, Permissions = string.Join(' ', permissions) };
        db.AdminRoles.Add(role);
        Audit(actor, role.Id, $"Created role {name} ({permissions.Count} permissions)", reason);
        await db.SaveChangesAsync(ct);
        return role.Id;
    }

    public async Task Update(Guid actorId, Guid id, SaveAdminRoleRequest r, CancellationToken ct)
    {
        var actor = await access.Require(actorId, "roles.manage", ct);
        var reason = Reason(r.Reason);
        var role = await db.AdminRoles.SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw new ApiException(404, "Role not found.");
        if (Convert.ToBase64String(role.Version) != r.Version) throw new ApiException(409, "This role changed in another session. Reload it before saving.");
        var before = AdminPermissions.Parse(role.Permissions);
        var (name, description, permissions) = await Validate(id, r, ct);
        // Editing a role that holds permissions you lack would let you reshape access above your own level.
        RequireCovers(actor, before.Concat(permissions));
        var added = permissions.Count(p => !before.Contains(p));
        var removed = before.Count(p => !permissions.Contains(p));
        role.Name = name; role.Description = description; role.Permissions = string.Join(' ', permissions);
        role.UpdatedAt = DateTimeOffset.UtcNow;
        Audit(actor, id, $"Updated role {name} (+{added} / -{removed} permissions)", reason);
        await db.SaveChangesAsync(ct);
    }

    public async Task Delete(Guid actorId, Guid id, string? reasonText, CancellationToken ct)
    {
        var actor = await access.Require(actorId, "roles.manage", ct);
        var reason = Reason(reasonText);
        var role = await db.AdminRoles.SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw new ApiException(404, "Role not found.");
        RequireCovers(actor, AdminPermissions.Parse(role.Permissions));
        var assigned = await db.AdminProfiles.CountAsync(x => x.AdminRoleId == id, ct);
        if (assigned > 0) throw new ApiException(409, $"Move the {assigned} administrator{(assigned == 1 ? "" : "s")} with this role to another role before deleting it.");
        db.AdminRoles.Remove(role);
        Audit(actor, id, $"Deleted role {role.Name}", reason);
        await db.SaveChangesAsync(ct);
    }
}
