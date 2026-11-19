using System.ComponentModel.DataAnnotations;
using Grab.Api.Models;

namespace Grab.Api.DTOs;

public record DeliveryStopRequest(
    string Address, double Latitude, double Longitude, DeliveryParcelSize ParcelSize,
    decimal WeightKg, string? RecipientName = null, string? RecipientPhone = null,
    string? Description = null, decimal CodAmount = 0);

// Quote and create use the same route/parcel fields. Contact fields are needed only at create time.
public record DeliveryRequest(
    string PickupAddress, double PickupLatitude, double PickupLongitude,
    List<DeliveryStopRequest>? Stops,
    DeliveryServiceType ServiceType = DeliveryServiceType.Instant,
    DeliveryVehicleType VehicleType = DeliveryVehicleType.Motorcycle,
    DeliveryPaymentMethod PaymentMethod = DeliveryPaymentMethod.CashAtPickup,
    DeliveryInsuranceTier InsuranceTier = DeliveryInsuranceTier.Basic,
    DateTimeOffset? ScheduledPickupAt = null,
    string? PickupName = null, string? PickupPhone = null,
    bool ProhibitedItemsAcknowledged = false);

public record DeliveryQuoteDto(
    DeliveryServiceType ServiceType, DeliveryVehicleType VehicleType, DeliveryInsuranceTier InsuranceTier,
    double DistanceKm, decimal BaseFare, decimal DistanceFare, decimal VehicleFare, decimal SizeFare,
    decimal ExtraStopFare, decimal InsuranceFare, decimal CodFee, decimal TotalFare, decimal CodAmount,
    int EtaMinutes, string PricingMode, DateTimeOffset QuotedAt, DateTimeOffset ExpiresAt);

public record DeliveryStopDto(
    Guid Id, int Position, string RecipientName, string RecipientPhone, string Address,
    double Latitude, double Longitude, string Description, DeliveryParcelSize ParcelSize, decimal WeightKg,
    decimal CodAmount, bool CodCollected, bool CodPaidOut, DeliveryStopStatus Status,
    DateTimeOffset? DeliveredAt, Guid? ProofPhotoId, string? FailureReason);

public record DeliveryCourierLocationDto(double Latitude, double Longitude, double? Accuracy, DateTimeOffset UpdatedAt);

public record ParcelDeliveryDto(
    Guid Id, Guid CustomerId, Guid? CourierMerchantId, string? CourierName, string? CourierPhone,
    DeliveryServiceType ServiceType, DeliveryVehicleType VehicleType, ParcelDeliveryStatus Status,
    DeliveryPaymentMethod PaymentMethod, DeliveryInsuranceTier InsuranceTier,
    string PickupName, string PickupPhone, string PickupAddress, double PickupLatitude, double PickupLongitude,
    DateTimeOffset? ScheduledPickupAt, List<DeliveryStopDto> Stops,
    decimal BaseFare, decimal DistanceFare, decimal VehicleFare, decimal SizeFare, decimal ExtraStopFare,
    decimal InsuranceFare, decimal CodFee, decimal TotalFare, decimal CodAmount, double DistanceKm,
    string PricingMode, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, DateTimeOffset? AcceptedAt,
    DateTimeOffset? PickedUpAt, DateTimeOffset? CompletedAt, DateTimeOffset? CancelledAt,
    DeliveryCourierLocationDto? CourierLocation, Guid? PickupProofPhotoId);

// Pending offers deliberately omit phone numbers and parcel descriptions.
public record DeliveryOfferDto(Guid Id, DeliveryServiceType ServiceType, DeliveryVehicleType VehicleType,
    string PickupAddress, List<string> DropoffAddresses, int StopCount, decimal TotalWeightKg,
    decimal TotalFare, decimal CodAmount, DateTimeOffset? ScheduledPickupAt, DateTimeOffset CreatedAt);
public record DeliveryCourierInboxDto(List<DeliveryOfferDto> Requests, ParcelDeliveryDto? ActiveDelivery);

public record DeliveryStatusRequest([EnumDataType(typeof(ParcelDeliveryStatus))] ParcelDeliveryStatus Status);
public record DeliveryStopStatusRequest([EnumDataType(typeof(DeliveryStopStatus))] DeliveryStopStatus Status,
    [StringLength(300)] string? FailureReason = null);
public record DeliveryLocationRequest(double Latitude, double Longitude, double? Accuracy);
