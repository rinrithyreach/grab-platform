using System.ComponentModel.DataAnnotations;
using Grab.Api.DTOs;
using Grab.Api.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
namespace Grab.Api.Controllers;
[ApiController, Authorize, Route("api/rides")]
public class RidesController(IRideService rides) : ApiControllerBase
{
    [HttpGet]
    public Task<List<RideDto>> List([FromQuery, Range(1, 100000)] int page = 1, CancellationToken ct = default) => rides.List(UserId, UserRole, false, page, ct);
    [HttpGet("mine")]
    public Task<List<RideDto>> Mine([FromQuery, Range(1, 100000)] int page = 1, CancellationToken ct = default) => rides.List(UserId, UserRole, true, page, ct);
    [HttpGet("{id:guid}")]
    public Task<RideDto> Get(Guid id, CancellationToken ct) => rides.Get(UserId, UserRole, id, ct);
    [HttpPost, Authorize(Roles = "Customer"), ProducesResponseType<RideDto>(201)]
    public async Task<ActionResult<RideDto>> Book(BookRideRequest r, CancellationToken ct)
    {
        var ride = await rides.Book(UserId, r, ct);
        return CreatedAtAction(nameof(Get), new { id = ride.Id }, ride);
    }
    [HttpPatch("{id:guid}/status")]
    public Task<RideDto> Status(Guid id, StatusRequest r, CancellationToken ct) => rides.Transition(UserId, UserRole, id, r.Status, ct);
    [HttpPatch("{id:guid}/location"), Authorize(Roles = "Merchant,Driver")]
    public Task<RideDto> Location(Guid id, RideLocationRequest r, CancellationToken ct) => rides.UpdateLocation(UserId, UserRole, id, r, ct);
    [HttpDelete("{id:guid}/location"), Authorize(Roles = "Merchant,Driver")]
    public Task<RideDto> StopSharing(Guid id, CancellationToken ct) => rides.UpdateLocation(UserId, UserRole, id, null, ct);
}

/// <summary>Book a ride without an account. Tracking and cancelling need the secret token returned at booking.</summary>
[ApiController, AllowAnonymous, Route("api/rides/guest")]
public class GuestRidesController(IRideService rides) : ControllerBase
{
    public const string TokenHeader = "X-Guest-Ride-Token";

    [HttpPost, EnableRateLimiting("delivery-booking"), ProducesResponseType<GuestRideResponse>(201)]
    public async Task<ActionResult<GuestRideResponse>> Book(GuestRideRequest r, CancellationToken ct) =>
        StatusCode(201, await rides.BookGuest(r, ct));

    [HttpGet("{id:guid}"), EnableRateLimiting("delivery-quote")]
    public Task<RideDto> Get(Guid id, [FromHeader(Name = TokenHeader)] string? token, CancellationToken ct) =>
        rides.GuestRide(id, token, false, ct);

    [HttpPost("{id:guid}/cancel"), EnableRateLimiting("delivery-booking")]
    public Task<RideDto> Cancel(Guid id, [FromHeader(Name = TokenHeader)] string? token, CancellationToken ct) =>
        rides.GuestRide(id, token, true, ct);
}
