namespace Grab.Api.Models;

public enum Role { Customer, Driver, Admin, Merchant }
public enum RideStatus { Pending, Accepted, InProgress, Completed, Cancelled }
public enum RideVehicleType { Motorcycle, Rickshaw, Classic }

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string FullName { get; set; } = "";
    // Retained for existing records; new phone-only accounts do not need an email.
    public string? Email { get; set; }
    public string PasswordHash { get; set; } = "";
    public string PhoneNumber { get; set; } = "";
    public Role Role { get; set; } = Role.Customer;
    public bool IsActive { get; set; } = true;
    public int SecurityVersion { get; set; }
    public DateTimeOffset? LastLoginAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public UserProfilePhoto? ProfilePhoto { get; set; }
}
public class Driver
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string VehicleType { get; set; } = "";
    public string VehiclePlate { get; set; } = "";
    public bool IsAvailable { get; set; } = true;
    public double? CurrentLatitude { get; set; }
    public double? CurrentLongitude { get; set; }
    public byte[] Version { get; set; } = [];
}
public class Ride
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CustomerId { get; set; }
    public Guid? DriverId { get; set; }
    public Guid? MerchantId { get; set; }
    public Merchant? Merchant { get; set; }
    public string PickupLocation { get; set; } = "";
    public string Destination { get; set; } = "";
    public double PickupLatitude { get; set; }
    public double PickupLongitude { get; set; }
    public double DestinationLatitude { get; set; }
    public double DestinationLongitude { get; set; }
    public decimal Fare { get; set; }
    public RideVehicleType VehicleType { get; set; } = RideVehicleType.Motorcycle;
    public RideStatus Status { get; set; } = RideStatus.Pending;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? CompletedAt { get; set; }
    public double? DriverLatitude { get; set; }
    public double? DriverLongitude { get; set; }
    public double? DriverLocationAccuracy { get; set; }
    public DateTimeOffset? DriverLocationUpdatedAt { get; set; }
    public byte[] Version { get; set; } = [];
}
public class Payment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid RideId { get; set; }
    public decimal Amount { get; set; }
    public string PaymentMethod { get; set; } = "Simulated";
    public string Status { get; set; } = "SimulatedSucceeded";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
public class Review
{
    public bool IsHidden { get; set; }
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid RideId { get; set; }
    public Guid CustomerId { get; set; }
    public Guid DriverId { get; set; }
    public int Rating { get; set; }
    public string? Comment { get; set; }
}
