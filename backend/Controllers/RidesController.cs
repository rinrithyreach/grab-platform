using System.ComponentModel.DataAnnotations;
using Grab.Api.DTOs;
using Grab.Api.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
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
}
