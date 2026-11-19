namespace Grab.Api.Models;

public enum DeliveryServiceType { Instant, SameDay, Scheduled }
public enum DeliveryVehicleType { Motorcycle, Rickshaw, Car }
public enum DeliveryParcelSize { Documents, Small, Medium, Large }
public enum DeliveryPaymentMethod { CashAtPickup, GrabPay }
public enum DeliveryInsuranceTier { Basic, Standard, Premium }
public enum ParcelDeliveryStatus { Pending, Scheduled, Accepted, PickedUp, InTransit, Delivered, Failed, Cancelled }
public enum DeliveryStopStatus { Pending, Delivered, Failed, Returned }

/// <summary>Contact and fare snapshots survive later customer or merchant profile changes.</summary>
public class ParcelDelivery
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CustomerId { get; set; }
    public Guid? CourierMerchantId { get; set; }
    public Merchant? CourierMerchant { get; set; }
    public DeliveryServiceType ServiceType { get; set; } = DeliveryServiceType.Instant;
    public DeliveryVehicleType VehicleType { get; set; } = DeliveryVehicleType.Motorcycle;
    public ParcelDeliveryStatus Status { get; set; } = ParcelDeliveryStatus.Pending;
    public DeliveryPaymentMethod PaymentMethod { get; set; } = DeliveryPaymentMethod.CashAtPickup;
    public DeliveryInsuranceTier InsuranceTier { get; set; } = DeliveryInsuranceTier.Basic;
    public string PickupName { get; set; } = "";
    public string PickupPhone { get; set; } = "";
    public string PickupAddress { get; set; } = "";
    public double PickupLatitude { get; set; }
    public double PickupLongitude { get; set; }
    public DateTimeOffset? ScheduledPickupAt { get; set; }
    public decimal BaseFare { get; set; }
    public decimal DistanceFare { get; set; }
    public decimal VehicleFare { get; set; }
    public decimal SizeFare { get; set; }
    public decimal ExtraStopFare { get; set; }
    public decimal InsuranceFare { get; set; }
    public decimal CodFee { get; set; }
    public decimal TotalFare { get; set; }
    public decimal CodAmount { get; set; }
    public double DistanceKm { get; set; }
    public string PricingMode { get; set; } = "DemoStraightLineUsd";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? AcceptedAt { get; set; }
    public DateTimeOffset? PickedUpAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public DateTimeOffset? CancelledAt { get; set; }
    public double? CourierLatitude { get; set; }
    public double? CourierLongitude { get; set; }
    public double? CourierLocationAccuracy { get; set; }
    public DateTimeOffset? CourierLocationUpdatedAt { get; set; }
    public Guid? PickupProofPhotoId { get; set; }
    public List<DeliveryStop> Stops { get; set; } = [];
    public byte[] Version { get; set; } = [];
}

public class DeliveryStop
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid DeliveryId { get; set; }
    public int Position { get; set; }
    public string RecipientName { get; set; } = "";
    public string RecipientPhone { get; set; } = "";
    public string Address { get; set; } = "";
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public string Description { get; set; } = "";
    public DeliveryParcelSize ParcelSize { get; set; } = DeliveryParcelSize.Small;
    public decimal WeightKg { get; set; }
    public decimal CodAmount { get; set; }
    public bool CodCollected { get; set; }
    public bool CodPaidOut { get; set; }
    public DeliveryStopStatus Status { get; set; } = DeliveryStopStatus.Pending;
    public DateTimeOffset? DeliveredAt { get; set; }
    public Guid? ProofPhotoId { get; set; }
    public string? FailureReason { get; set; }
}
