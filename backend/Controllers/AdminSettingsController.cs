using Grab.Api.DTOs;
using Grab.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Grab.Api.Controllers;

[ApiController, Route("api/admin"), Authorize(Roles = "Admin")]
public class AdminSettingsController(PlatformSettingsService settings, AdminAccountService account, AdminTeamService team,
    AdminRoleService roles, AdminAccessService access) : ApiControllerBase
{
    [HttpGet("roles")]
    public Task<AdminRolesResponse> Roles(CancellationToken ct) => roles.List(UserId, ct);
    [HttpPost("roles")]
    public async Task<ActionResult<object>> CreateRole(SaveAdminRoleRequest r, CancellationToken ct) =>
        StatusCode(201, new { id = await roles.Create(UserId, r, ct) });
    [HttpPut("roles/{id:guid}")]
    public async Task<object> UpdateRole(Guid id, SaveAdminRoleRequest r, CancellationToken ct)
    { await roles.Update(UserId, id, r, ct); return new { saved = true }; }
    [HttpPost("roles/{id:guid}/delete")]
    public async Task<object> DeleteRole(Guid id, AdminTeamReasonRequest r, CancellationToken ct)
    { await roles.Delete(UserId, id, r.Reason, ct); return new { saved = true }; }
    [HttpPatch("team/{id:guid}/role")]
    public async Task<object> AdminRole(Guid id, AdminTeamRoleRequest r, CancellationToken ct)
    { await team.SetRole(UserId, id, r, ct); return new { saved = true }; }

    [HttpGet("team")]
    public Task<List<AdminTeamMemberDto>> Team(CancellationToken ct) => team.List(UserId, ct);
    [HttpPost("team"), EnableRateLimiting("auth")]
    public async Task<ActionResult<object>> AddAdmin(CreateAdminRequest r, CancellationToken ct) =>
        StatusCode(201, new { id = await team.Create(UserId, r, ct) });
    [HttpPatch("team/{id:guid}")]
    public async Task<object> AdminStatus(Guid id, AdminTeamStatusRequest r, CancellationToken ct)
    { await team.SetStatus(UserId, id, r, ct); return new { saved = true }; }
    [HttpPost("team/{id:guid}/revoke-sessions"), EnableRateLimiting("auth")]
    public async Task<object> RevokeAdminSessions(Guid id, AdminTeamReasonRequest r, CancellationToken ct)
    { await team.RevokeSessions(UserId, id, r, ct); return new { saved = true }; }
    [HttpGet("profile/activity")]
    public Task<List<AdminActivityDto>> Activity(CancellationToken ct) => team.Activity(UserId, ct);

    [HttpGet("settings")]
    public async Task<PlatformSettingsDto> Settings(CancellationToken ct)
    { await access.Require(UserId, "settings.view", ct); return PlatformSettingsService.Dto(await settings.Read(ct)); }
    [HttpPatch("settings")]
    public async Task<PlatformSettingsDto> SaveSettings(SavePlatformSettingsRequest r, CancellationToken ct)
    { await access.Require(UserId, "settings.manage", ct); return await settings.Save(UserId, r, ct); }
    [HttpGet("profile")]
    public Task<AdminProfileDto> Profile(CancellationToken ct) => account.Get(UserId, ct);
    [HttpPatch("profile"), EnableRateLimiting("auth")]
    public Task<AdminProfileResponse> UpdateProfile(SaveAdminProfileRequest r, CancellationToken ct) => account.Update(UserId, r, ct);
    [HttpPost("profile/password"), EnableRateLimiting("auth")]
    public Task<AdminProfileResponse> Password(AdminPasswordRequest r, CancellationToken ct) => account.ChangePassword(UserId, r, ct);
    [HttpPost("profile/revoke-sessions"), EnableRateLimiting("auth")]
    public Task<AdminProfileResponse> RevokeSessions(CancellationToken ct) => account.RevokeSessions(UserId, ct);
    [HttpPost("profile/avatar")]
    public Task<AdminProfileDto> Avatar(IFormFile file, CancellationToken ct) => account.Avatar(UserId, file, ct);
    [HttpDelete("profile/avatar")]
    public Task<AdminProfileDto> DeleteAvatar(CancellationToken ct) => account.Avatar(UserId, null, ct);
}

[ApiController, Route("api/platform"), AllowAnonymous]
public class PlatformController(PlatformSettingsService settings) : ControllerBase
{
    [HttpGet("settings")]
    public async Task<object> Get(CancellationToken ct)
    {
        var s = await settings.Read(ct);
        // Public operational information only: no editor identity, audit reason or private profile.
        return new { s.SupportEmail, s.SupportPhone, s.SupportHours, s.OfficeAddress, s.AnnouncementEnabled, s.Announcement,
            s.MaintenanceMode, s.MaintenanceMessage, s.RidesEnabled, s.FoodEnabled, s.ExpressEnabled,
            s.CustomerRegistrationEnabled, s.MerchantRegistrationEnabled };
    }
}
