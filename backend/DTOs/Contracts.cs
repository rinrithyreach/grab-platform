using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using Grab.Api.Models;

namespace Grab.Api.DTOs;

public record RegisterRequest(
    [Required, StringLength(30)] string PhoneNumber,
    [Required, StringLength(128, MinimumLength = 12)] string Password);
public record LoginRequest([Required, StringLength(30)] string PhoneNumber, [Required, StringLength(128)] string Password);
public record UpdateProfileRequest([Required, StringLength(120, MinimumLength = 2)] string FullName);
public record UserDto(Guid Id, string FullName, string PhoneNumber, Role Role, string? AvatarUrl = null);
public record AuthResponse(string AccessToken, DateTimeOffset ExpiresAt, UserDto User);
public record BookRideRequest(
    [Required, StringLength(300, MinimumLength = 2)] string PickupLocation,
    [Required, StringLength(300, MinimumLength = 2)] string Destination,
    [property: JsonRequired] [Range(-90, 90)] double PickupLatitude,
    [property: JsonRequired] [Range(-180, 180)] double PickupLongitude,
    [property: JsonRequired] [Range(-90, 90)] double DestinationLatitude,
    [property: JsonRequired] [Range(-180, 180)] double DestinationLongitude,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    [EnumDataType(typeof(RideVehicleType))] RideVehicleType VehicleType = RideVehicleType.Motorcycle);
public record StatusRequest([EnumDataType(typeof(RideStatus))] RideStatus Status);
public record RideLocationRequest(
    [property: JsonRequired] [Range(-90, 90)] double Latitude,
    [property: JsonRequired] [Range(-180, 180)] double Longitude,
    [Range(0, double.MaxValue)] double? Accuracy);
public record RideDriverLocationDto(double Latitude, double Longitude, double? Accuracy, DateTimeOffset UpdatedAt);
public record DriverRequest(Guid UserId,
    [Required, StringLength(50)] string VehicleType,
    [Required, StringLength(30)] string VehiclePlate);
public record PaymentRequest(Guid RideId);
public record ReviewRequest(Guid RideId, [Range(1, 5)] int Rating, [StringLength(1000)] string? Comment);
public record RideDto(Guid Id, Guid CustomerId, Guid? DriverId, string PickupLocation, string Destination,
    double PickupLatitude, double PickupLongitude, double DestinationLatitude, double DestinationLongitude,
    decimal Fare, string PricingMode, RideStatus Status, DateTimeOffset CreatedAt, DateTimeOffset? CompletedAt,
    Guid? MerchantId, string? MerchantName, RideDriverLocationDto? DriverLocation, RideVehicleType VehicleType);
public record DriverDto(Guid Id, string FullName, string VehicleType, string VehiclePlate, bool IsAvailable,
    double? CurrentLatitude, double? CurrentLongitude);
public record PaymentDto(Guid Id, Guid RideId, decimal Amount, string PaymentMethod, string Status, DateTimeOffset CreatedAt);
public record ReviewDto(Guid Id, Guid RideId, Guid DriverId, int Rating, string? Comment);

public static class Mapping
{
    public static UserDto Dto(this User u) => new(u.Id, u.FullName, u.PhoneNumber, u.Role,
        u.ProfilePhoto is { } photo ? $"data:{photo.ContentType};base64,{Convert.ToBase64String(photo.Data)}" : null);
    public static RideDto Dto(this Ride r) => new(r.Id, r.CustomerId, r.DriverId, r.PickupLocation, r.Destination,
        r.PickupLatitude, r.PickupLongitude, r.DestinationLatitude, r.DestinationLongitude,
        r.Fare, "DevelopmentMockFlatFareUSD", r.Status, r.CreatedAt, r.CompletedAt, r.MerchantId, r.Merchant?.BusinessName,
        r.Status is RideStatus.Accepted or RideStatus.InProgress && r.DriverLatitude is double lat
            && r.DriverLongitude is double lng && r.DriverLocationUpdatedAt is DateTimeOffset updated
            ? new(lat, lng, r.DriverLocationAccuracy, updated) : null, r.VehicleType);
    public static PaymentDto Dto(this Payment p) => new(p.Id, p.RideId, p.Amount, p.PaymentMethod, p.Status, p.CreatedAt);
    public static ReviewDto Dto(this Review r) => new(r.Id, r.RideId, r.DriverId, r.Rating, r.Comment);
}
