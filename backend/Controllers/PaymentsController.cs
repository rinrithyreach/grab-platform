using System.ComponentModel.DataAnnotations;
using Grab.Api.DTOs;
using Grab.Api.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace Grab.Api.Controllers;
[ApiController, Authorize(Roles = "Customer"), Route("api/payments")]
public class PaymentsController(ICommerceService commerce) : ApiControllerBase
{
    [HttpPost, ProducesResponseType<PaymentDto>(201)]
    public async Task<ActionResult<PaymentDto>> Pay(PaymentRequest r, CancellationToken ct) => StatusCode(201, await commerce.Pay(UserId, r.RideId, ct));
    [HttpGet("mine")]
    public Task<List<PaymentDto>> Mine([FromQuery, Range(1, 100000)] int page = 1, CancellationToken ct = default) => commerce.Payments(UserId, page, ct);
}
