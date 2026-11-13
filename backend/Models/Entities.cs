namespace Grab.Api.Models;

public enum Role { Customer, Driver, Admin }
public enum RideStatus { Pending, Accepted, InProgress, Completed, Cancelled }

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string FullName { get; set; } = "";
    public string Email { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string PhoneNumber { get; set; } = "";
    public Role Role { get; set; } = Role.Customer;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
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
    public string PickupLocation { get; set; } = "";
    public string Destination { get; set; } = "";
    public double PickupLatitude { get; set; }
    public double PickupLongitude { get; set; }
    public double DestinationLatitude { get; set; }
    public double DestinationLongitude { get; set; }
    public decimal Fare { get; set; }
    public RideStatus Status { get; set; } = RideStatus.Pending;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? CompletedAt { get; set; }
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
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid RideId { get; set; }
    public Guid CustomerId { get; set; }
    public Guid DriverId { get; set; }
    public int Rating { get; set; }
    public string? Comment { get; set; }
}
