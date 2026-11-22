using Grab.Api.DTOs;
using Grab.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Grab.Api.Controllers;

/// <summary>Customer side of merchant product orders.</summary>
[ApiController, Authorize(Roles = "Customer"), Route("api/orders")]
public class OrdersController(OrderService orders) : ApiControllerBase
{
    [HttpPost("quote")]
    public Task<OrderQuoteDto> Quote(OrderQuoteRequest r, CancellationToken ct) => orders.Quote(UserId, r, ct);

    [HttpPost, ProducesResponseType<MerchantOrderDto>(201)]
    public async Task<ActionResult<MerchantOrderDto>> Place(PlaceOrderRequest r, CancellationToken ct) =>
        StatusCode(201, await orders.Place(UserId, r, ct));

    [HttpGet("mine")]
    public Task<List<MerchantOrderDto>> Mine(CancellationToken ct, int page = 1) => orders.Mine(UserId, page, ct);

    [HttpPost("{id:guid}/cancel")]
    public Task<MerchantOrderDto> Cancel(Guid id, CancellationToken ct) => orders.Cancel(UserId, id, ct);
}

/// <summary>GrabExpress guest checkout. Receipt access requires its secret token.</summary>
[ApiController, AllowAnonymous, Route("api/orders/guest")]
public class GuestOrdersController(OrderService orders) : ControllerBase
{
    [HttpPost("quote"), EnableRateLimiting("delivery-quote")]
    public Task<OrderQuoteDto> Quote(OrderQuoteRequest r, CancellationToken ct) => orders.Quote(null, r, ct);

    [HttpPost, EnableRateLimiting("delivery-booking"), ProducesResponseType<GuestOrderResponse>(201)]
    public async Task<ActionResult<GuestOrderResponse>> Place(GuestOrderRequest r, CancellationToken ct) =>
        StatusCode(201, await orders.PlaceGuest(r, ct));

    [HttpGet("{id:guid}"), EnableRateLimiting("delivery-quote")]
    public Task<MerchantOrderDto> Receipt(Guid id, [FromHeader(Name = "X-Guest-Order-Token")] string? token, CancellationToken ct) =>
        orders.GuestOrder(id, token, false, ct);

    [HttpPost("{id:guid}/cancel"), EnableRateLimiting("delivery-booking")]
    public Task<MerchantOrderDto> Cancel(Guid id, [FromHeader(Name = "X-Guest-Order-Token")] string? token, CancellationToken ct) =>
        orders.GuestOrder(id, token, true, ct);
}

/// <summary>Merchant side: incoming orders and status updates.</summary>
[ApiController, Authorize(Roles = "Merchant"), Route("api/merchants/orders")]
public class MerchantOrdersController(OrderService orders) : ApiControllerBase
{
    [HttpGet]
    public Task<List<MerchantOrderDto>> Inbox(CancellationToken ct, int page = 1) => orders.MerchantOrders(UserId, page, ct);

    [HttpPost("{id:guid}/status")]
    public Task<MerchantOrderDto> UpdateStatus(Guid id, OrderStatusRequest r, CancellationToken ct) =>
        orders.MerchantUpdate(UserId, id, r.Status, ct);
}
