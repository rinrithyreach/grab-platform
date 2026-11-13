using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using Grab.Api.Models;

namespace Grab.Api.DTOs;

public record RegisterRequest(
    [Required, StringLength(120, MinimumLength = 2)] string FullName,
    [Required, EmailAddress, StringLength(254)] string Email,
    [Required, StringLength(128, MinimumLength = 12)] string Password,
    [Required, Phone, StringLength(30)] string PhoneNumber);
public record LoginRequest([Required, EmailAddress] string Email, [Required, StringLength(128)] string Password);
public record UserDto(Guid Id, string FullName, string Email, string PhoneNumber, Role Role);
public record AuthResponse(string AccessToken, DateTimeOffset ExpiresAt, UserDto User);
public record BookRideRequest(
    [Required, StringLength(300, MinimumLength = 2)] string PickupLocation,
    [Required, StringLength(300, MinimumLength = 2)] string Destination,
    [property: JsonRequired] [Range(-90, 90)] double PickupLatitude,
    [property: JsonRequired] [Range(-180, 180)] double PickupLongitude,
    [property: JsonRequired] [Range(-90, 90)] double DestinationLatitude,
    [property: JsonRequired] [Range(-180, 180)] double DestinationLongitude);
public record StatusRequest([EnumDataType(typeof(RideStatus))] RideStatus Status);
public record DriverRequest(Guid UserId,
    [Required, StringLength(50)] string VehicleType,
    [Required, StringLength(30)] string VehiclePlate);
public record PaymentRequest(Guid RideId);
public record ReviewRequest(Guid RideId, [Range(1, 5)] int Rating, [StringLength(1000)] string? Comment);
public record RideDto(Guid Id, Guid CustomerId, Guid? DriverId, string PickupLocation, string Destination,
    double PickupLatitude, double PickupLongitude, double DestinationLatitude, double DestinationLongitude,
    decimal Fare, string PricingMode, RideStatus Status, DateTimeOffset CreatedAt, DateTimeOffset? CompletedAt);
public record DriverDto(Guid Id, string FullName, string VehicleType, string VehiclePlate, bool IsAvailable,
    double? CurrentLatitude, double? CurrentLongitude);
public record PaymentDto(Guid Id, Guid RideId, decimal Amount, string PaymentMethod, string Status, DateTimeOffset CreatedAt);
public record ReviewDto(Guid Id, Guid RideId, Guid DriverId, int Rating, string? Comment);

public static class Mapping
{
    public static UserDto Dto(this User u) => new(u.Id, u.FullName, u.Email, u.PhoneNumber, u.Role);
    public static RideDto Dto(this Ride r) => new(r.Id, r.CustomerId, r.DriverId, r.PickupLocation, r.Destination,
        r.PickupLatitude, r.PickupLongitude, r.DestinationLatitude, r.DestinationLongitude,
        r.Fare, "DevelopmentMockFlatFareUSD", r.Status, r.CreatedAt, r.CompletedAt);
    public static PaymentDto Dto(this Payment p) => new(p.Id, p.RideId, p.Amount, p.PaymentMethod, p.Status, p.CreatedAt);
    public static ReviewDto Dto(this Review r) => new(r.Id, r.RideId, r.DriverId, r.Rating, r.Comment);
}
