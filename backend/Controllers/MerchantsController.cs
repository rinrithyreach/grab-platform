using Grab.Api.Data;
using Grab.Api.DTOs;
using Grab.Api.Interfaces;
using Grab.Api.Middleware;
using Grab.Api.Models;
using Grab.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace Grab.Api.Controllers;

[ApiController, Route("api/merchants")]
public class MerchantsController(MerchantService merchants, IAuthService auth) : ApiControllerBase
{
    [HttpPost("register"), EnableRateLimiting("auth")]
    public async Task<ActionResult<AuthResponse>> Register(MerchantRegisterRequest r, CancellationToken ct) =>
        StatusCode(201, await auth.RegisterMerchant(r, ct));

    [HttpPost("login"), EnableRateLimiting("auth")]
    public async Task<AuthResponse> Login(LoginRequest r, CancellationToken ct)
    {
        var result = await auth.Login(r, ct);
        if (result.User.Role != Role.Merchant) throw new ApiException(403, "Use a merchant account to sign in here.");
        return result;
    }

    [Authorize(Roles = "Merchant"), HttpGet("me")]
    public Task<MerchantDashboardDto> Me(CancellationToken ct) => merchants.Dashboard(UserId, ct);

    [Authorize(Roles = "Merchant"), HttpPatch("me")]
    public Task<MerchantProfileDto> UpdateProfile(MerchantProfileRequest r, CancellationToken ct) => merchants.UpdateProfile(UserId, r, ct);

    [Authorize(Roles = "Merchant"), HttpPost("images"), RequestSizeLimit(MerchantService.MaxImageBytes + 65536)]
    public Task<MerchantImageDto> Upload(IFormFile file, CancellationToken ct) => merchants.Upload(UserId, file, ct);

    [Authorize(Roles = "Merchant"), HttpPost("listings")]
    public async Task<ActionResult<MerchantListingDto>> Create(MerchantListingRequest r, CancellationToken ct) =>
        StatusCode(201, await merchants.SaveListing(UserId, null, r, ct));

    [Authorize(Roles = "Merchant"), HttpPatch("listings/{id:guid}")]
    public Task<MerchantListingDto> Update(Guid id, MerchantListingRequest r, CancellationToken ct) => merchants.SaveListing(UserId, id, r, ct);

    [HttpGet("offers")]
    public Task<List<MerchantOfferDto>> Offers(MerchantServiceKind? service, CancellationToken ct, int page = 1) => merchants.Offers(service, page, ct);

    [HttpGet("{id:guid}")]
    public Task<MerchantStorefrontDto> Storefront(Guid id, CancellationToken ct) => merchants.Storefront(id, ct);
}

[ApiController]
public class MerchantMediaController(GrabDbContext db, MerchantService merchants) : ControllerBase
{
    [HttpGet("api/banners")]
    public Task<List<BannerDto>> Banners(CancellationToken ct) => merchants.Banners(ct);

    [HttpGet("api/merchant-images/{id:guid}")]
    public async Task<IActionResult> Image(Guid id, CancellationToken ct)
    {
        var image = await db.MerchantImages.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct);
        if (image is null) return NotFound();
        Response.Headers.XContentTypeOptions = "nosniff";
        Response.Headers.CacheControl = "public, max-age=86400, immutable";
        return File(image.Data, image.ContentType);
    }
}
