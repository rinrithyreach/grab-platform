using Grab.Api.DTOs;
using Grab.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Grab.Api.Controllers;

/// <summary>Homepage banner uploads. Part of the "Listings &amp; banners" section, so it uses the listings permissions.</summary>
[ApiController, Route("api/admin/banners"), Authorize(Roles = "Admin")]
public class AdminBannersController(BannerService banners, AdminAccessService access) : ApiControllerBase
{
    [HttpGet]
    public async Task<List<AdminBannerDto>> List(CancellationToken ct)
    { await access.Require(UserId, "listings.view", ct); return await banners.List(ct); }

    [HttpPost]
    public async Task<ActionResult<object>> Create([FromForm] AdminBannerForm form, IFormFile? image, CancellationToken ct)
    { await access.Require(UserId, "listings.manage", ct); return StatusCode(201, new { id = await banners.Save(UserId, null, form, image, ct) }); }

    [HttpPatch("{id:guid}")]
    public async Task<object> Update(Guid id, [FromForm] AdminBannerForm form, IFormFile? image, CancellationToken ct)
    { await access.Require(UserId, "listings.manage", ct); await banners.Save(UserId, id, form, image, ct); return new { saved = true }; }

    [HttpDelete("{id:guid}")]
    public async Task<object> Delete(Guid id, [FromQuery] string? reason, CancellationToken ct)
    { await access.Require(UserId, "listings.manage", ct); await banners.Delete(UserId, id, reason, ct); return new { saved = true }; }
}
