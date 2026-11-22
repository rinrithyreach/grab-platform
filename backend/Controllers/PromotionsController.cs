using Grab.Api.DTOs;
using Grab.Api.Models;
using Grab.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Grab.Api.Controllers;

[ApiController, Route("api/promotions")]
public class PromotionsController(PromotionService promotions) : ControllerBase
{
    [HttpGet, AllowAnonymous, ResponseCache(NoStore = true)]
    public Task<List<Promotion>> List(CancellationToken ct) => promotions.List(ct);
}

[ApiController, Route("api/admin/promotions"), Authorize(Roles = "Admin")]
public class AdminPromotionsController(PromotionService promotions, AdminAccessService access) : ApiControllerBase
{
    [HttpGet]
    public async Task<List<Promotion>> List(CancellationToken ct)
    { await access.Require(UserId, "promotions.view", ct); return await promotions.List(ct); }

    [HttpGet("targets")]
    public async Task<List<PromotionTarget>> Targets(CancellationToken ct)
    { await access.Require(UserId, "promotions.view", ct); return await promotions.Targets(ct); }

    [HttpPost]
    public async Task<ActionResult<object>> Create(SavePromotionRequest r, CancellationToken ct)
    { await access.Require(UserId, "promotions.manage", ct); return StatusCode(201, new { id = await promotions.Save(UserId, null, r, ct) }); }

    [HttpPut("{id:guid}")]
    public async Task<object> Update(Guid id, SavePromotionRequest r, CancellationToken ct)
    { await access.Require(UserId, "promotions.manage", ct); await promotions.Save(UserId, id, r, ct); return new { saved = true }; }

    [HttpDelete("{id:guid}")]
    public async Task<object> Delete(Guid id, [FromQuery] string? reason, CancellationToken ct)
    { await access.Require(UserId, "promotions.manage", ct); await promotions.Delete(UserId, id, reason, ct); return new { saved = true }; }
}
