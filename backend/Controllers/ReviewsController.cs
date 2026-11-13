using Grab.Api.DTOs;
using Grab.Api.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace Grab.Api.Controllers;
[ApiController, Authorize(Roles = "Customer"), Route("api/reviews")]
public class ReviewsController(ICommerceService commerce) : ApiControllerBase
{
    [HttpPost, ProducesResponseType<ReviewDto>(201)]
    public async Task<ActionResult<ReviewDto>> Create(ReviewRequest r, CancellationToken ct) => StatusCode(201, await commerce.Review(UserId, r, ct));
}
