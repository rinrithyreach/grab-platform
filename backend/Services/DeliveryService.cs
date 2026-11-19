using Grab.Api.Data;
using Grab.Api.DTOs;
using Grab.Api.Middleware;
using Grab.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Grab.Api.Services;

public class DeliveryService(GrabDbContext db, PlatformSettingsService platform)
{
    private static ParcelDeliveryDto Dto(ParcelDelivery delivery) => new(
        delivery.Id, delivery.CustomerId, delivery.CourierMerchantId,
        delivery.CourierMerchant?.BusinessName, delivery.CourierMerchant?.ContactPhone,
        delivery.ServiceType, delivery.VehicleType, delivery.Status, delivery.PaymentMethod, delivery.InsuranceTier,
        delivery.PickupName, delivery.PickupPhone, delivery.PickupAddress, delivery.PickupLatitude, delivery.PickupLongitude,
        delivery.ScheduledPickupAt, delivery.Stops.OrderBy(x => x.Position).Select(x => new DeliveryStopDto(
            x.Id, x.Position, x.RecipientName, x.RecipientPhone, x.Address, x.Latitude, x.Longitude,
            x.Description, x.ParcelSize, x.WeightKg, x.CodAmount, x.CodCollected, x.CodPaidOut,
            x.Status, x.DeliveredAt, x.ProofPhotoId, x.FailureReason)).ToList(),
        delivery.BaseFare, delivery.DistanceFare, delivery.VehicleFare, delivery.SizeFare,
        delivery.ExtraStopFare, delivery.InsuranceFare, delivery.CodFee, delivery.TotalFare,
        delivery.CodAmount, delivery.DistanceKm, delivery.PricingMode,
        delivery.CreatedAt, delivery.UpdatedAt, delivery.AcceptedAt, delivery.PickedUpAt,
        delivery.CompletedAt, delivery.CancelledAt,
        delivery.Status is ParcelDeliveryStatus.Accepted or ParcelDeliveryStatus.PickedUp or ParcelDeliveryStatus.InTransit
            && delivery.CourierLatitude is double lat && delivery.CourierLongitude is double lng
            && delivery.CourierLocationUpdatedAt is DateTimeOffset updated
            ? new DeliveryCourierLocationDto(lat, lng, delivery.CourierLocationAccuracy, updated) : null,
        delivery.PickupProofPhotoId);

    private IQueryable<ParcelDelivery> Details() => db.ParcelDeliveries.Include(x => x.CourierMerchant)
        .Include(x => x.Stops).AsSplitQuery();

    private async Task<Merchant> Courier(Guid userId, CancellationToken ct) =>
        await db.Merchants.SingleOrDefaultAsync(x => x.UserId == userId && x.Service == MerchantServiceKind.GrabExpress, ct)
        ?? throw new ApiException(403, "Only GrabExpress merchants can handle parcel deliveries.");

    private static void CheckPage(int page)
    {
        if (page is < 1 or > 100000) throw new ApiException(400, "Invalid page.");
    }

    private static void ClearLocation(ParcelDelivery delivery)
    {
        delivery.CourierLatitude = null;
        delivery.CourierLongitude = null;
        delivery.CourierLocationAccuracy = null;
        delivery.CourierLocationUpdatedAt = null;
    }

    public DeliveryQuoteDto Quote(DeliveryRequest request) => DeliveryPricing.Quote(request, DateTimeOffset.UtcNow);

    public async Task<ParcelDeliveryDto> Create(Guid customerId, DeliveryRequest request, CancellationToken ct)
    {
        await platform.RequireService(MerchantServiceKind.GrabExpress, ct);
        var now = DateTimeOffset.UtcNow;
        var quote = DeliveryPricing.Quote(request, now, booking: true);
        var delivery = new ParcelDelivery
        {
            CustomerId = customerId,
            ServiceType = request.ServiceType,
            VehicleType = request.VehicleType,
            Status = request.ServiceType == DeliveryServiceType.Scheduled ? ParcelDeliveryStatus.Scheduled : ParcelDeliveryStatus.Pending,
            PaymentMethod = request.PaymentMethod,
            InsuranceTier = request.InsuranceTier,
            PickupName = request.PickupName!.Trim(),
            PickupPhone = PhoneNumbers.Normalize(request.PickupPhone)!,
            PickupAddress = request.PickupAddress.Trim(),
            PickupLatitude = request.PickupLatitude,
            PickupLongitude = request.PickupLongitude,
            ScheduledPickupAt = request.ScheduledPickupAt?.ToUniversalTime(),
            BaseFare = quote.BaseFare,
            DistanceFare = quote.DistanceFare,
            VehicleFare = quote.VehicleFare,
            SizeFare = quote.SizeFare,
            ExtraStopFare = quote.ExtraStopFare,
            InsuranceFare = quote.InsuranceFare,
            CodFee = quote.CodFee,
            TotalFare = quote.TotalFare,
            CodAmount = quote.CodAmount,
            DistanceKm = quote.DistanceKm,
            PricingMode = quote.PricingMode,
            CreatedAt = now,
            UpdatedAt = now,
            Stops = request.Stops!.Select((stop, index) => new DeliveryStop
            {
                Position = index + 1,
                RecipientName = stop.RecipientName!.Trim(),
                RecipientPhone = PhoneNumbers.Normalize(stop.RecipientPhone)!,
                Address = stop.Address.Trim(),
                Latitude = stop.Latitude,
                Longitude = stop.Longitude,
                Description = stop.Description!.Trim(),
                ParcelSize = stop.ParcelSize,
                WeightKg = stop.WeightKg,
                CodAmount = stop.CodAmount,
            }).ToList(),
        };
        db.ParcelDeliveries.Add(delivery);
        await db.SaveChangesAsync(ct);
        return Dto(delivery);
    }

    public async Task<List<ParcelDeliveryDto>> Mine(Guid customerId, int page, CancellationToken ct)
    {
        CheckPage(page);
        var rows = await Details().AsNoTracking().Where(x => x.CustomerId == customerId)
            .OrderByDescending(x => x.CreatedAt).ThenBy(x => x.Id)
            .Skip((page - 1) * 50).Take(50).ToListAsync(ct);
        return rows.Select(Dto).ToList();
    }

    public async Task<ParcelDeliveryDto> Get(Guid userId, Role role, Guid id, CancellationToken ct)
    {
        var delivery = await Details().AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new ApiException(404, "Delivery not found.");
        var courierOwns = role == Role.Merchant && delivery.CourierMerchant?.UserId == userId
            && delivery.CourierMerchant.Service == MerchantServiceKind.GrabExpress;
        if (role != Role.Admin && delivery.CustomerId != userId && !courierOwns)
            throw new ApiException(404, "Delivery not found.");
        return Dto(delivery);
    }

    public async Task<ParcelDeliveryDto> Cancel(Guid customerId, Guid id, CancellationToken ct)
    {
        var delivery = await Details().SingleOrDefaultAsync(x => x.Id == id && x.CustomerId == customerId, ct)
            ?? throw new ApiException(404, "Delivery not found.");
        if (delivery.Status is not (ParcelDeliveryStatus.Pending or ParcelDeliveryStatus.Scheduled or ParcelDeliveryStatus.Accepted))
            throw new ApiException(409, "A delivery cannot be cancelled after pickup.");
        delivery.Status = ParcelDeliveryStatus.Cancelled;
        delivery.CancelledAt = delivery.UpdatedAt = DateTimeOffset.UtcNow;
        ClearLocation(delivery);
        await db.SaveChangesAsync(ct);
        return Dto(delivery);
    }

    public async Task<DeliveryCourierInboxDto> CourierInbox(Guid userId, CancellationToken ct)
    {
        var courier = await Courier(userId, ct);
        var active = await Details().AsNoTracking().SingleOrDefaultAsync(x => x.CourierMerchantId == courier.Id
            && (x.Status == ParcelDeliveryStatus.Accepted || x.Status == ParcelDeliveryStatus.PickedUp
                || x.Status == ParcelDeliveryStatus.InTransit), ct);
        if (active is not null) return new([], Dto(active));
        // Existing GrabExpress business profiles do not specify a vehicle. Until courier
        // registration gains that choice, they can claim motorcycle-sized jobs only.
        var now = DateTimeOffset.UtcNow;
        var pending = await Details().AsNoTracking().Where(x => x.CourierMerchantId == null
            && x.VehicleType == DeliveryVehicleType.Motorcycle
            && (x.Status == ParcelDeliveryStatus.Pending
                || x.Status == ParcelDeliveryStatus.Scheduled && x.ScheduledPickupAt <= now.AddMinutes(30)))
            .OrderBy(x => x.CreatedAt).ThenBy(x => x.Id).Take(25).ToListAsync(ct);
        return new(pending.Select(x => new DeliveryOfferDto(x.Id, x.ServiceType, x.VehicleType,
            x.PickupAddress, x.Stops.OrderBy(s => s.Position).Select(s => s.Address).ToList(),
            x.Stops.Count, x.Stops.Sum(s => s.WeightKg), x.TotalFare, x.CodAmount,
            x.ScheduledPickupAt, x.CreatedAt)).ToList(), null);
    }

    public async Task<ParcelDeliveryDto> Accept(Guid userId, Guid id, CancellationToken ct)
    {
        var courier = await Courier(userId, ct);
        var delivery = await Details().SingleOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new ApiException(404, "Delivery not found.");
        if (delivery.CourierMerchantId is not null || delivery.Status is not (ParcelDeliveryStatus.Pending or ParcelDeliveryStatus.Scheduled))
            throw new ApiException(409, "This delivery is no longer available.");
        if (delivery.VehicleType != DeliveryVehicleType.Motorcycle)
            throw new ApiException(403, "This delivery needs a courier vehicle that is not registered yet.");
        if (delivery.Status == ParcelDeliveryStatus.Scheduled && delivery.ScheduledPickupAt > DateTimeOffset.UtcNow.AddMinutes(30))
            throw new ApiException(409, "This scheduled delivery is not ready for pickup yet.");
        if (await db.ParcelDeliveries.AnyAsync(x => x.CourierMerchantId == courier.Id
            && (x.Status == ParcelDeliveryStatus.Accepted || x.Status == ParcelDeliveryStatus.PickedUp
                || x.Status == ParcelDeliveryStatus.InTransit), ct))
            throw new ApiException(409, "Finish your current delivery before accepting another.");
        delivery.CourierMerchantId = courier.Id;
        delivery.CourierMerchant = courier;
        delivery.Status = ParcelDeliveryStatus.Accepted;
        delivery.AcceptedAt = delivery.UpdatedAt = DateTimeOffset.UtcNow;
        // Rowversion prevents two couriers claiming the same request; the filtered unique
        // index prevents one courier claiming two active deliveries in a race.
        await db.SaveChangesAsync(ct);
        return Dto(delivery);
    }

    public async Task<ParcelDeliveryDto> CourierStatus(Guid userId, Guid id, ParcelDeliveryStatus status, CancellationToken ct)
    {
        var courier = await Courier(userId, ct);
        var delivery = await Details().SingleOrDefaultAsync(x => x.Id == id && x.CourierMerchantId == courier.Id, ct)
            ?? throw new ApiException(404, "Delivery not found.");
        if (delivery.Status == ParcelDeliveryStatus.Accepted && status == ParcelDeliveryStatus.PickedUp)
            delivery.PickedUpAt = DateTimeOffset.UtcNow;
        else if (delivery.Status != ParcelDeliveryStatus.PickedUp || status != ParcelDeliveryStatus.InTransit)
            throw new ApiException(409, "Invalid courier status transition.");
        delivery.Status = status;
        delivery.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        return Dto(delivery);
    }

    public async Task<ParcelDeliveryDto> UpdateStop(Guid userId, Guid id, Guid stopId, DeliveryStopStatus status,
        string? failureReason, CancellationToken ct)
    {
        var courier = await Courier(userId, ct);
        var delivery = await Details().SingleOrDefaultAsync(x => x.Id == id && x.CourierMerchantId == courier.Id, ct)
            ?? throw new ApiException(404, "Delivery not found.");
        if (delivery.Status is not (ParcelDeliveryStatus.PickedUp or ParcelDeliveryStatus.InTransit))
            throw new ApiException(409, "Pick up the parcel before updating a stop.");
        var stop = delivery.Stops.SingleOrDefault(x => x.Id == stopId) ?? throw new ApiException(404, "Stop not found.");
        if (stop.Status != DeliveryStopStatus.Pending || status is not (DeliveryStopStatus.Delivered or DeliveryStopStatus.Failed))
            throw new ApiException(409, "Invalid stop status transition.");
        if (delivery.Stops.Any(x => x.Position < stop.Position && x.Status == DeliveryStopStatus.Pending))
            throw new ApiException(409, "Finish earlier drop-off stops first.");
        if (status == DeliveryStopStatus.Delivered && stop.CodAmount > 0 && !stop.CodCollected)
            throw new ApiException(409, "Confirm cash on delivery collection before marking this stop delivered.");
        var reason = failureReason?.Trim();
        if (status == DeliveryStopStatus.Failed && (reason?.Length is not (>= 3 and <= 300) || reason.Any(char.IsControl)))
            throw new ApiException(400, "Enter a failure reason of 3–300 characters.");
        stop.Status = status;
        stop.FailureReason = status == DeliveryStopStatus.Failed ? reason : null;
        stop.DeliveredAt = status == DeliveryStopStatus.Delivered ? DateTimeOffset.UtcNow : null;
        delivery.UpdatedAt = DateTimeOffset.UtcNow;
        if (delivery.Stops.All(x => x.Status != DeliveryStopStatus.Pending))
        {
            delivery.Status = delivery.Stops.All(x => x.Status == DeliveryStopStatus.Delivered)
                ? ParcelDeliveryStatus.Delivered : ParcelDeliveryStatus.Failed;
            delivery.CompletedAt = delivery.UpdatedAt;
            ClearLocation(delivery);
        }
        await db.SaveChangesAsync(ct);
        return Dto(delivery);
    }

    public async Task<ParcelDeliveryDto> ConfirmCod(Guid userId, Guid id, Guid stopId, bool paidOut, CancellationToken ct)
    {
        var courier = await Courier(userId, ct);
        var delivery = await Details().SingleOrDefaultAsync(x => x.Id == id && x.CourierMerchantId == courier.Id, ct)
            ?? throw new ApiException(404, "Delivery not found.");
        var stop = delivery.Stops.SingleOrDefault(x => x.Id == stopId) ?? throw new ApiException(404, "Stop not found.");
        if (stop.CodAmount <= 0) throw new ApiException(409, "This stop has no cash on delivery amount.");
        if (paidOut)
        {
            if (stop.Status != DeliveryStopStatus.Delivered || !stop.CodCollected)
                throw new ApiException(409, "Deliver and collect the cash before confirming payout.");
            stop.CodPaidOut = true;
        }
        else
        {
            if (delivery.Status is not (ParcelDeliveryStatus.PickedUp or ParcelDeliveryStatus.InTransit)
                || stop.Status != DeliveryStopStatus.Pending)
                throw new ApiException(409, "Collect cash while this drop-off is active.");
            stop.CodCollected = true;
        }
        delivery.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        return Dto(delivery);
    }

    public async Task<ParcelDeliveryDto> Location(Guid userId, Guid id, DeliveryLocationRequest? location, CancellationToken ct)
    {
        var courier = await Courier(userId, ct);
        var delivery = await Details().SingleOrDefaultAsync(x => x.Id == id && x.CourierMerchantId == courier.Id, ct)
            ?? throw new ApiException(404, "Delivery not found.");
        if (delivery.Status is not (ParcelDeliveryStatus.Accepted or ParcelDeliveryStatus.PickedUp or ParcelDeliveryStatus.InTransit))
            throw new ApiException(409, "Location sharing is available only during an active delivery.");
        if (location is not null && (!double.IsFinite(location.Latitude) || location.Latitude is < -90 or > 90
            || !double.IsFinite(location.Longitude) || location.Longitude is < -180 or > 180
            || location.Accuracy is double accuracy && (!double.IsFinite(accuracy) || accuracy < 0)))
            throw new ApiException(400, "A valid courier location is required.");
        delivery.CourierLatitude = location?.Latitude;
        delivery.CourierLongitude = location?.Longitude;
        delivery.CourierLocationAccuracy = location?.Accuracy;
        delivery.CourierLocationUpdatedAt = location is null ? null : DateTimeOffset.UtcNow;
        delivery.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        return Dto(delivery);
    }
}
