using Grab.Api.DTOs;
using Grab.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Grab.Api.Controllers;

/// <summary>Record sections of the admin console. Every endpoint checks the caller's role permissions, not only the Admin role.</summary>
[ApiController, Route("api/admin"), Authorize(Roles = "Admin")]
public class AdminController(AdminService admin, AdminAccessService access) : ApiControllerBase
{
    /// <summary>
    /// Requires "{section}.{level}" for catalog sections; unknown sections fall through to the service's 404.
    /// The Express section lists GrabExpress shop orders, so it is covered by the Orders permission.
    /// </summary>
    private async Task Require(string section, string level, CancellationToken ct)
    {
        var permission = $"{(section == "express" ? "orders" : section)}.{level}";
        if (AdminPermissions.All.Contains(permission)) await access.Require(UserId, permission, ct);
        else await access.Get(UserId, ct);
    }

    [HttpGet("overview")]
    public Task<object> Overview(CancellationToken ct) => admin.Overview(UserId, ct);

    [HttpGet("{resource}")]
    public async Task<object> List(string resource, CancellationToken ct, int page = 1, string? search = null, string? filter = null)
    { await Require(resource, "view", ct); return await admin.List(resource, page, search, filter, ct); }

    [HttpPost("users")]
    public async Task<ActionResult<object>> UserCreate(AdminCreateUserRequest r, CancellationToken ct)
    { await Require("users", "manage", ct); return StatusCode(201, new { id = await admin.CreateUser(UserId, r, ct) }); }

    [HttpPatch("users/{id:guid}")]
    public async Task<object> UserUpdate(Guid id, AdminUserRequest r, CancellationToken ct)
    { await Require("users", "manage", ct); await admin.UpdateUser(UserId, id, r, ct); return new { saved = true }; }

    [HttpPatch("merchants/{id:guid}")]
    public async Task<object> MerchantUpdate(Guid id, AdminMerchantRequest r, CancellationToken ct)
    { await Require("merchants", "manage", ct); await admin.UpdateMerchant(UserId, id, r, ct); return new { saved = true }; }

    [HttpPatch("listings/{id:guid}")]
    public async Task<object> ListingUpdate(Guid id, AdminListingRequest r, CancellationToken ct)
    { await Require("listings", "manage", ct); await admin.UpdateListing(UserId, id, r, ct); return new { saved = true }; }

    [HttpPost("drivers")]
    public async Task<ActionResult<DriverDto>> CreateDriver(AdminDriverRequest r, CancellationToken ct)
    { await Require("drivers", "manage", ct); return StatusCode(201, await admin.CreateDriver(UserId, r, ct)); }

    [HttpPost("{resource}/{id:guid}/actions")]
    public async Task<object> Action(string resource, Guid id, AdminActionRequest r, CancellationToken ct)
    { await Require(resource, "manage", ct); await admin.Action(UserId, resource, id, r, ct); return new { saved = true }; }
}
