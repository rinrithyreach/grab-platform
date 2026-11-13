using Grab.Api.DTOs;
using Grab.Api.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
namespace Grab.Api.Controllers;
[ApiController, Route("api/auth")]
public class AuthController(IAuthService auth) : ApiControllerBase
{
    [HttpPost("register"), EnableRateLimiting("auth"), ProducesResponseType<AuthResponse>(201)]
    public async Task<ActionResult<AuthResponse>> Register(RegisterRequest r, CancellationToken ct) => StatusCode(201, await auth.Register(r, ct));
    [HttpPost("login"), EnableRateLimiting("auth")]
    public Task<AuthResponse> Login(LoginRequest r, CancellationToken ct) => auth.Login(r, ct);
    [Authorize, HttpGet("me")]
    public Task<UserDto> Me(CancellationToken ct) => auth.Me(UserId, ct);
}
