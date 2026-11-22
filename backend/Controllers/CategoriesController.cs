using Grab.Api.DTOs;
using Grab.Api.Models;
using Grab.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Grab.Api.Controllers;

[ApiController, Route("api/categories")]
public class CategoriesController(CategoryService categories) : ControllerBase
{
    [HttpGet, AllowAnonymous, ResponseCache(NoStore = true)]
    public Task<List<CategoryDto>> List(CancellationToken ct, MerchantServiceKind? service = null) => categories.List(service, false, ct);
}

[ApiController, Route("api/admin/categories"), Authorize(Roles = "Admin")]
public class AdminCategoriesController(CategoryService categories, AdminAccessService access) : ApiControllerBase
{
    [HttpGet]
    public async Task<List<CategoryDto>> List(CancellationToken ct, MerchantServiceKind? service = null)
    { await access.Require(UserId, "categories.view", ct); return await categories.List(service, true, ct); }

    [HttpPost]
    public async Task<ActionResult<object>> Create(SaveCategoryRequest r, CancellationToken ct)
    { await access.Require(UserId, "categories.manage", ct); return StatusCode(201, new { id = await categories.Save(UserId, null, r, ct) }); }

    [HttpPut("{id:guid}")]
    public async Task<object> Update(Guid id, SaveCategoryRequest r, CancellationToken ct)
    { await access.Require(UserId, "categories.manage", ct); await categories.Save(UserId, id, r, ct); return new { saved = true }; }

    [HttpDelete("{id:guid}")]
    public async Task<object> Delete(Guid id, [FromQuery] string? reason, CancellationToken ct)
    { await access.Require(UserId, "categories.manage", ct); await categories.Delete(UserId, id, reason, ct); return new { saved = true }; }
}
