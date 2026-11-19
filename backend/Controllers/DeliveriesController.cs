using System.ComponentModel.DataAnnotations;
using Grab.Api.DTOs;
using Grab.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Grab.Api.Controllers;

[ApiController, Authorize, Route("api/deliveries")]
public class DeliveriesController(DeliveryService deliveries) : ApiControllerBase
{
    [HttpPost("quote"), AllowAnonymous, EnableRateLimiting("delivery-quote")]
    public DeliveryQuoteDto Quote(DeliveryRequest request) => deliveries.Quote(request);

    [HttpPost, Authorize(Roles = "Customer"), EnableRateLimiting("delivery-booking"), ProducesResponseType<ParcelDeliveryDto>(201)]
    public async Task<ActionResult<ParcelDeliveryDto>> Create(DeliveryRequest request, CancellationToken ct)
    {
        var delivery = await deliveries.Create(UserId, request, ct);
        return CreatedAtAction(nameof(Get), new { id = delivery.Id }, delivery);
    }

    [HttpGet("mine"), Authorize(Roles = "Customer")]
    public Task<List<ParcelDeliveryDto>> Mine([FromQuery, Range(1, 100000)] int page = 1, CancellationToken ct = default) =>
        deliveries.Mine(UserId, page, ct);

    [HttpGet("{id:guid}")]
    public Task<ParcelDeliveryDto> Get(Guid id, CancellationToken ct) => deliveries.Get(UserId, UserRole, id, ct);

    [HttpPatch("{id:guid}/cancel"), Authorize(Roles = "Customer")]
    public Task<ParcelDeliveryDto> Cancel(Guid id, CancellationToken ct) => deliveries.Cancel(UserId, id, ct);

    [HttpGet("courier/inbox"), Authorize(Roles = "Merchant")]
    public Task<DeliveryCourierInboxDto> CourierInbox(CancellationToken ct) => deliveries.CourierInbox(UserId, ct);

    [HttpPost("{id:guid}/accept"), Authorize(Roles = "Merchant")]
    public Task<ParcelDeliveryDto> Accept(Guid id, CancellationToken ct) => deliveries.Accept(UserId, id, ct);

    [HttpPatch("{id:guid}/status"), Authorize(Roles = "Merchant")]
    public Task<ParcelDeliveryDto> Status(Guid id, DeliveryStatusRequest request, CancellationToken ct) =>
        deliveries.CourierStatus(UserId, id, request.Status, ct);

    [HttpPatch("{id:guid}/stops/{stopId:guid}/status"), Authorize(Roles = "Merchant")]
    public Task<ParcelDeliveryDto> StopStatus(Guid id, Guid stopId, DeliveryStopStatusRequest request, CancellationToken ct) =>
        deliveries.UpdateStop(UserId, id, stopId, request.Status, request.FailureReason, ct);

    [HttpPost("{id:guid}/stops/{stopId:guid}/cod/collected"), Authorize(Roles = "Merchant")]
    public Task<ParcelDeliveryDto> CodCollected(Guid id, Guid stopId, CancellationToken ct) =>
        deliveries.ConfirmCod(UserId, id, stopId, false, ct);

    [HttpPost("{id:guid}/stops/{stopId:guid}/cod/paid-out"), Authorize(Roles = "Merchant")]
    public Task<ParcelDeliveryDto> CodPaidOut(Guid id, Guid stopId, CancellationToken ct) =>
        deliveries.ConfirmCod(UserId, id, stopId, true, ct);

    [HttpPatch("{id:guid}/location"), Authorize(Roles = "Merchant")]
    public Task<ParcelDeliveryDto> Location(Guid id, DeliveryLocationRequest request, CancellationToken ct) =>
        deliveries.Location(UserId, id, request, ct);

    [HttpDelete("{id:guid}/location"), Authorize(Roles = "Merchant")]
    public Task<ParcelDeliveryDto> StopSharing(Guid id, CancellationToken ct) => deliveries.Location(UserId, id, null, ct);
}
