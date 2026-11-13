using System.ComponentModel.DataAnnotations;
using Grab.Api.DTOs;
using Grab.Api.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace Grab.Api.Controllers;
[ApiController, Authorize, Route("api/drivers")]
public class DriversController(IDriverService drivers, ICommerceService commerce) : ControllerBase
{
    [HttpGet("available")]
    public Task<List<DriverDto>> Available(CancellationToken ct) => drivers.Available(ct);
    [HttpPost, Authorize(Roles = "Admin"), ProducesResponseType<DriverDto>(201)]
    public async Task<ActionResult<DriverDto>> Create(DriverRequest r, CancellationToken ct) => StatusCode(201, await drivers.Create(r, ct));
    [HttpGet("{id:guid}/reviews")]
    public Task<List<ReviewDto>> Reviews(Guid id, [FromQuery, Range(1, 100000)] int page = 1, CancellationToken ct = default) => commerce.Reviews(id, page, ct);
}
