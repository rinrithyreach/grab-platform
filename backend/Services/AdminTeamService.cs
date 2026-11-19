using System.Data;
using Grab.Api.Data;
using Grab.Api.DTOs;
using Grab.Api.Middleware;
using Grab.Api.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Grab.Api.Services;

/// <summary>Administrator team directory: every admin's profile and role, onboarding new admins and controlling their access.</summary>
public class AdminTeamService(GrabDbContext db, IPasswordHasher<User> hasher, AdminAccessService access)
{
    private static string Reason(string? value)
    {
        var reason = PlatformSettingsService.Clean(value, 300, "Reason");
        if (reason.Length < 3) throw new ApiException(400, "Explain the change in at least 3 characters.");
        return reason;
    }

    private async Task<User> Member(Guid actorId, Guid id, CancellationToken ct)
    {
        if (id == actorId) throw new ApiException(409, "Manage your own account from My profile.");
        return await db.Users.SingleOrDefaultAsync(x => x.Id == id && x.Role == Role.Admin, ct)
            ?? throw new ApiException(404, "Administrator not found.");
    }

    private async Task<AdminProfile> Profile(Guid id, CancellationToken ct) =>
        await db.AdminProfiles.SingleOrDefaultAsync(x => x.UserId == id, ct) ?? db.AdminProfiles.Add(new AdminProfile { UserId = id }).Entity;

    /// <summary>Permissions of a role id; null (Super administrator) means every permission.</summary>
    private async Task<(string Name, IReadOnlySet<string> Permissions)> RolePermissions(Guid? roleId, CancellationToken ct)
    {
        if (roleId is null) return (AdminAccess.SuperRoleName, AdminPermissions.All);
        var role = await db.AdminRoles.AsNoTracking().SingleOrDefaultAsync(x => x.Id == roleId, ct) ?? throw new ApiException(400, "Choose an existing role.");
        return (role.Name, AdminPermissions.Parse(role.Permissions));
    }

    /// <summary>Blocks managing or granting access above the actor's own level.</summary>
    private static void RequireCovers(AdminAccess actor, Guid? roleId, IReadOnlySet<string> permissions, string message)
    {
        if (!actor.IsSuper && (roleId is null || !actor.Covers(permissions))) throw new ApiException(403, message);
    }

    private Task<int> OtherActiveSupers(Guid excludeId, CancellationToken ct) =>
        db.Users.CountAsync(x => x.Id != excludeId && x.Role == Role.Admin && x.IsActive
            && !db.AdminProfiles.Any(p => p.UserId == x.Id && p.AdminRoleId != null), ct);

    private void Audit(AdminAccess actor, Guid target, string action, string reason) =>
        db.AdminAudits.Add(new AdminAudit { ActorId = actor.UserId, ActorName = actor.FullName, Resource = "team",
            TargetId = target, Action = action.Length > 100 ? action[..99] + "…" : action, Reason = reason });

    public async Task<List<AdminTeamMemberDto>> List(Guid actorId, CancellationToken ct)
    {
        await access.Require(actorId, "team.view", ct);
        var since = DateTimeOffset.UtcNow.AddDays(-30);
        var rows = await (from u in db.Users.AsNoTracking()
                          where u.Role == Role.Admin
                          join p in db.AdminProfiles.AsNoTracking() on u.Id equals p.UserId into profiles
                          from p in profiles.DefaultIfEmpty()
                          join r in db.AdminRoles.AsNoTracking() on p.AdminRoleId equals (Guid?)r.Id into roles
                          from r in roles.DefaultIfEmpty()
                          select new
                          {
                              u.Id, u.FullName, u.Email, u.IsActive, u.CreatedAt, u.LastLoginAt,
                              JobTitle = p == null ? "" : p.JobTitle, ContactPhone = p == null ? "" : p.ContactPhone, Bio = p == null ? "" : p.Bio,
                              AvatarData = p == null ? null : p.AvatarData, AvatarType = p == null ? null : p.AvatarContentType,
                              PasswordChangedAt = p == null ? null : p.PasswordChangedAt,
                              RoleId = r == null ? (Guid?)null : r.Id, RoleName = r == null ? null : r.Name,
                              LastActivityAt = db.AdminAudits.Where(a => a.ActorId == u.Id).Max(a => (DateTimeOffset?)a.CreatedAt),
                              Changes = db.AdminAudits.Count(a => a.ActorId == u.Id && a.CreatedAt >= since)
                          }).ToListAsync(ct);
        return rows
            .OrderByDescending(x => x.Id == actorId).ThenByDescending(x => x.IsActive).ThenBy(x => x.FullName)
            .Select(x => new AdminTeamMemberDto(x.Id, x.FullName, x.Email, x.JobTitle, x.ContactPhone, x.Bio,
                x.AvatarData is null ? null : $"data:{x.AvatarType};base64,{Convert.ToBase64String(x.AvatarData)}",
                x.IsActive, x.Id == actorId, x.CreatedAt, x.LastLoginAt, x.PasswordChangedAt, x.LastActivityAt, x.Changes,
                x.RoleId, x.RoleName ?? AdminAccess.SuperRoleName))
            .ToList();
    }

    public async Task<Guid> Create(Guid actorId, CreateAdminRequest r, CancellationToken ct)
    {
        var actor = await access.Require(actorId, "team.manage", ct);
        var reason = Reason(r.Reason);
        var (roleName, permissions) = await RolePermissions(r.AdminRoleId, ct);
        RequireCovers(actor, r.AdminRoleId, permissions, "You can only add administrators with a role whose permissions you also hold. Only super administrators can add super administrators.");
        var name = PlatformSettingsService.Clean(r.FullName, 120, "Full name");
        if (name.Length < 2) throw new ApiException(400, "Enter a name of at least 2 characters.");
        var email = r.Email.Trim().ToLowerInvariant();
        if (r.TemporaryPassword.Length is < 12 or > 128) throw new ApiException(400, "Use a temporary password of 12-128 characters.");
        if (await db.Users.AnyAsync(x => x.Email == email, ct))
            throw new ApiException(409, "This email already belongs to an account. Promote it from Users & access instead.");
        // Email administrators have no phone sign-in; a unique placeholder satisfies the phone index, as local provisioning does.
        var admin = new User { FullName = name, Email = email, Role = Role.Admin, PhoneNumber = "admin-" + Guid.NewGuid().ToString("N")[..20] };
        admin.PasswordHash = hasher.HashPassword(admin, r.TemporaryPassword);
        db.Users.Add(admin);
        db.AdminProfiles.Add(new AdminProfile { UserId = admin.Id, AdminRoleId = r.AdminRoleId, JobTitle = PlatformSettingsService.Clean(r.JobTitle, 100, "Job title") });
        Audit(actor, admin.Id, $"Added administrator {name} as {roleName}", reason);
        await db.SaveChangesAsync(ct);
        return admin.Id;
    }

    public async Task SetRole(Guid actorId, Guid id, AdminTeamRoleRequest r, CancellationToken ct)
    {
        var reason = Reason(r.Reason);
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var actor = await access.Require(actorId, "team.manage", ct);
        var member = await Member(actorId, id, ct);
        var profile = await Profile(id, ct);
        var (currentName, current) = await RolePermissions(profile.AdminRoleId, ct);
        var (nextName, next) = await RolePermissions(r.AdminRoleId, ct);
        RequireCovers(actor, profile.AdminRoleId, current, "You cannot change the role of an administrator whose access exceeds your own.");
        RequireCovers(actor, r.AdminRoleId, next, "You can only assign roles whose permissions you also hold. Only super administrators can assign Super administrator.");
        if (profile.AdminRoleId == r.AdminRoleId) throw new ApiException(409, $"{member.FullName} already has the {nextName} role.");
        if (profile.AdminRoleId is null && member.IsActive && await OtherActiveSupers(id, ct) == 0)
            throw new ApiException(409, "Keep at least one active super administrator.");
        profile.AdminRoleId = r.AdminRoleId;
        profile.UpdatedAt = DateTimeOffset.UtcNow;
        Audit(actor, id, $"Changed {member.FullName} from {currentName} to {nextName}", reason);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }

    public async Task SetStatus(Guid actorId, Guid id, AdminTeamStatusRequest r, CancellationToken ct)
    {
        var reason = Reason(r.Reason);
        // Serializable so two admins cannot suspend each other and leave the platform without a super administrator.
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var actor = await access.Require(actorId, "team.manage", ct);
        var member = await Member(actorId, id, ct);
        var roleId = await db.AdminProfiles.Where(x => x.UserId == id).Select(x => x.AdminRoleId).SingleOrDefaultAsync(ct);
        var (_, permissions) = await RolePermissions(roleId, ct);
        RequireCovers(actor, roleId, permissions, "You cannot suspend or reactivate an administrator whose access exceeds your own.");
        if (member.IsActive == r.IsActive) throw new ApiException(409, r.IsActive ? "This administrator is already active." : "This administrator is already suspended.");
        if (!r.IsActive && roleId is null && await OtherActiveSupers(id, ct) == 0)
            throw new ApiException(409, "Keep at least one active super administrator.");
        member.IsActive = r.IsActive;
        member.SecurityVersion++;
        Audit(actor, id, r.IsActive ? $"Reactivated administrator {member.FullName}" : $"Suspended administrator {member.FullName}", reason);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }

    public async Task RevokeSessions(Guid actorId, Guid id, AdminTeamReasonRequest r, CancellationToken ct)
    {
        var reason = Reason(r.Reason);
        var actor = await access.Require(actorId, "team.manage", ct);
        var member = await Member(actorId, id, ct);
        var roleId = await db.AdminProfiles.Where(x => x.UserId == id).Select(x => x.AdminRoleId).SingleOrDefaultAsync(ct);
        var (_, permissions) = await RolePermissions(roleId, ct);
        RequireCovers(actor, roleId, permissions, "You cannot sign out an administrator whose access exceeds your own.");
        member.SecurityVersion++;
        Audit(actor, id, $"Signed out all sessions of {member.FullName}", reason);
        await db.SaveChangesAsync(ct);
    }

    public async Task<List<AdminActivityDto>> Activity(Guid actorId, CancellationToken ct)
    {
        await access.Get(actorId, ct);
        return await db.AdminAudits.AsNoTracking().Where(x => x.ActorId == actorId)
            .OrderByDescending(x => x.CreatedAt).ThenBy(x => x.Id).Take(25)
            .Select(x => new AdminActivityDto(x.Id, x.Resource, x.TargetId, x.Action, x.Reason, x.CreatedAt))
            .ToListAsync(ct);
    }
}
