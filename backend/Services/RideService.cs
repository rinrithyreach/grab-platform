using System.Security.Cryptography;
using System.Text;
using Grab.Api.Data;
using Grab.Api.DTOs;
using Grab.Api.Interfaces;
using Grab.Api.Middleware;
using Grab.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Grab.Api.Services;
public class RideService(GrabDbContext db, IConfiguration config, PlatformSettingsService platform) : IRideService
{
    private static RideVehicleType MerchantVehicleType(Merchant merchant) =>
        Enum.TryParse<RideVehicleType>(merchant.Category, out var selected) && Enum.IsDefined(selected)
            ? selected : RideVehicleType.Motorcycle;

    private async Task<Merchant> RideMerchant(Guid userId, CancellationToken ct) =>
        await db.Merchants.SingleOrDefaultAsync(m => m.UserId == userId && m.Service == MerchantServiceKind.GrabRide, ct)
        ?? throw new ApiException(403, "Only registered GrabRide merchants can receive ride requests.");

    public async Task<MerchantRideInboxDto> MerchantInbox(Guid userId, CancellationToken ct)
    {
        var merchant = await RideMerchant(userId, ct);
        var vehicleType = MerchantVehicleType(merchant);
        var active = await db.Rides.AsNoTracking().Include(r => r.Merchant)
            .SingleOrDefaultAsync(r => r.MerchantId == merchant.Id && (r.Status == RideStatus.Accepted || r.Status == RideStatus.InProgress), ct);
        if (active is not null)
        {
            // The accepted ride shows the rider phone so the merchant can call them at pickup.
            var customer = active.CustomerId is Guid customerId
                ? await db.Users.Where(u => u.Id == customerId).Select(u => new { u.FullName, u.PhoneNumber }).SingleAsync(ct)
                : new { FullName = active.GuestName ?? "Guest", PhoneNumber = active.GuestPhone ?? "" };
            return new([], new(active.Dto(), customer.FullName, customer.PhoneNumber));
        }
        var pending = await db.Rides.AsNoTracking()
            .Where(r => r.Status == RideStatus.Pending && r.VehicleType == vehicleType && r.DriverId == null && r.MerchantId == null
                && !db.RideMerchantResponses.Any(response => response.RideId == r.Id && response.MerchantId == merchant.Id))
            .OrderByDescending(r => r.CreatedAt).ThenBy(r => r.Id).Take(25)
            .Select(r => new { Ride = r, Name = r.GuestName ?? db.Users.Where(u => u.Id == r.CustomerId).Select(u => u.FullName).First() }).ToListAsync(ct);
        return new(pending.Select(row => new MerchantRideRequestDto(row.Ride.Dto(), row.Name)).ToList(), null);
    }

    public async Task<MerchantRideInboxDto> MerchantRespond(Guid userId, Guid rideId, bool accept, CancellationToken ct)
    {
        var merchant = await RideMerchant(userId, ct);
        var ride = await db.Rides.SingleOrDefaultAsync(r => r.Id == rideId, ct) ?? throw new ApiException(404, "Ride not found.");
        var previous = await db.RideMerchantResponses.SingleOrDefaultAsync(r => r.RideId == rideId && r.MerchantId == merchant.Id, ct);
        if (previous is not null)
        {
            if (previous.Accepted == accept) return await MerchantInbox(userId, ct);
            throw new ApiException(409, "You have already responded to this request.");
        }
        if (ride.Status != RideStatus.Pending || ride.DriverId is not null || ride.MerchantId is not null)
            throw new ApiException(409, "This ride request is no longer available.");
        if (ride.VehicleType != MerchantVehicleType(merchant))
            throw new ApiException(403, "This ride requires a different vehicle type.");
        if (accept)
        {
            if (await db.RideMerchantResponses.AnyAsync(r => r.MerchantId == merchant.Id && r.IsActive, ct))
                throw new ApiException(409, "Finish or cancel your current ride before accepting another.");
            ride.MerchantId = merchant.Id;
            ride.Merchant = merchant;
            ride.Status = RideStatus.Accepted;
        }
        db.RideMerchantResponses.Add(new RideMerchantResponse { RideId = rideId, MerchantId = merchant.Id, Accepted = accept, IsActive = accept });
        // The ride rowversion and filtered unique indexes make simultaneous claims atomic.
        await db.SaveChangesAsync(ct);
        return await MerchantInbox(userId, ct);
    }

    public async Task<RideDto> Book(Guid customerId, BookRideRequest r, CancellationToken ct)
    {
        var ride = await NewRide(customerId, r, ct);
        db.Rides.Add(ride);
        await db.SaveChangesAsync(ct);
        return ride.Dto();
    }

    /// <summary>A ride without an account. The guest keeps a one-time token to track or cancel it.</summary>
    public async Task<GuestRideResponse> BookGuest(GuestRideRequest r, CancellationToken ct)
    {
        var name = r.ContactName?.Trim() ?? "";
        if (name.Length is < 2 or > 120 || !name.Any(char.IsLetter) || name.Any(char.IsControl))
            throw new ApiException(400, "Enter your full name (2 to 120 characters).");
        var phone = PhoneNumbers.Normalize(r.ContactPhone)
            ?? throw new ApiException(400, "Enter a valid phone number so the driver can reach you.");
        var ride = await NewRide(null, r.Ride, ct);
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        ride.GuestName = name; ride.GuestPhone = phone; ride.GuestTokenHash = TokenHash(token);
        db.Rides.Add(ride);
        await db.SaveChangesAsync(ct);
        return new(ride.Dto(), token);
    }

    private static string TokenHash(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    public async Task<RideDto> GuestRide(Guid id, string? token, bool cancel, CancellationToken ct)
    {
        // A ride ID alone never grants access to a guest ride.
        if (token is null || token.Length != 64) throw new ApiException(404, "Ride not found.");
        var hash = TokenHash(token);
        var ride = await db.Rides.Include(x => x.Merchant)
            .SingleOrDefaultAsync(x => x.Id == id && x.CustomerId == null && x.GuestTokenHash == hash, ct)
            ?? throw new ApiException(404, "Ride not found.");
        if (!cancel) return ride.Dto();
        if (ride.Status is not (RideStatus.Pending or RideStatus.Accepted))
            throw new ApiException(409, "Only pending or accepted rides can be cancelled.");
        return await Apply(ride, RideStatus.Cancelled, ct);
    }

    private async Task<Ride> NewRide(Guid? customerId, BookRideRequest r, CancellationToken ct)
    {
        await platform.RequireService(MerchantServiceKind.GrabRide, ct);
        if (string.IsNullOrWhiteSpace(r.PickupLocation) || string.IsNullOrWhiteSpace(r.Destination))
            throw new ApiException(400, "Pickup and destination are required.");
        if (!double.IsFinite(r.PickupLatitude) || r.PickupLatitude is < -90 or > 90
            || !double.IsFinite(r.PickupLongitude) || r.PickupLongitude is < -180 or > 180
            || !double.IsFinite(r.DestinationLatitude) || r.DestinationLatitude is < -90 or > 90
            || !double.IsFinite(r.DestinationLongitude) || r.DestinationLongitude is < -180 or > 180)
            throw new ApiException(400, "Valid pickup and destination coordinates are required.");
        if (r.PickupLatitude == r.DestinationLatitude && r.PickupLongitude == r.DestinationLongitude)
            throw new ApiException(400, "Pickup and destination must be different locations.");
        if (!Enum.IsDefined(r.VehicleType)) throw new ApiException(400, "Choose Motorcycle, Rickshaw or Classic.");
        return new Ride { CustomerId = customerId, PickupLocation = r.PickupLocation.Trim(), Destination = r.Destination.Trim(),
            PickupLatitude = r.PickupLatitude, PickupLongitude = r.PickupLongitude,
            DestinationLatitude = r.DestinationLatitude, DestinationLongitude = r.DestinationLongitude,
            Fare = config.GetValue<decimal>("Pricing:DevelopmentFlatFareUsd", 5), VehicleType = r.VehicleType };
    }
    public async Task<List<RideDto>> List(Guid userId, Role role, bool mine, int page, CancellationToken ct)
    {
        var q = db.Rides.AsNoTracking().Include(r => r.Merchant).AsQueryable();
        if (role == Role.Customer) q = q.Where(x => x.CustomerId == userId);
        if (role == Role.Driver)
        {
            var driver = await db.Drivers.SingleOrDefaultAsync(x => x.UserId == userId, ct) ?? throw new ApiException(403, "Driver profile required.");
            q = q.Where(x => x.DriverId == driver.Id || (!mine && x.Status == RideStatus.Pending));
        }
        if (role == Role.Merchant)
        {
            var merchant = await RideMerchant(userId, ct);
            q = q.Where(r => r.MerchantId == merchant.Id);
        }
        var rides = await q.OrderByDescending(x => x.CreatedAt).Skip((page - 1) * 50).Take(50).ToListAsync(ct);
        return rides.Select(x => x.Dto()).ToList();
    }
    public async Task<RideDto> Get(Guid userId, Role role, Guid id, CancellationToken ct)
    {
        var ride = await db.Rides.AsNoTracking().Include(r => r.Merchant).SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw new ApiException(404, "Ride not found.");
        var driverOwns = role == Role.Driver && await db.Drivers.AnyAsync(x => x.Id == ride.DriverId && x.UserId == userId, ct);
        var merchantOwns = role == Role.Merchant && ride.Merchant?.UserId == userId && ride.Merchant.Service == MerchantServiceKind.GrabRide;
        if (role != Role.Admin && ride.CustomerId != userId && !driverOwns && !merchantOwns) throw new ApiException(404, "Ride not found.");
        return ride.Dto();
    }
    public async Task<RideDto> Transition(Guid userId, Role role, Guid id, RideStatus next, CancellationToken ct)
    {
        var ride = await db.Rides.Include(r => r.Merchant).SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw new ApiException(404, "Ride not found.");
        Driver? driver = role == Role.Driver ? await db.Drivers.SingleOrDefaultAsync(x => x.UserId == userId, ct) : null;
        if (role == Role.Customer)
        {
            if (ride.CustomerId != userId) throw new ApiException(404, "Ride not found.");
            if (next != RideStatus.Cancelled || ride.Status is not (RideStatus.Pending or RideStatus.Accepted))
                throw new ApiException(409, "Customers may cancel only pending or accepted rides.");
        }
        else if (role == Role.Driver && driver is not null)
        {
            if (ride.Status == RideStatus.Pending && next == RideStatus.Accepted)
            {
                if (!driver.IsAvailable) throw new ApiException(409, "Driver is already on a ride.");
                ride.DriverId = driver.Id;
                driver.IsAvailable = false;
            }
            else
            {
                if (ride.DriverId != driver.Id) throw new ApiException(403, "Only the assigned driver may update this ride.");
                if (!((ride.Status == RideStatus.Accepted && next is RideStatus.InProgress or RideStatus.Cancelled)
                    || (ride.Status == RideStatus.InProgress && next == RideStatus.Completed)))
                    throw new ApiException(409, "Invalid ride status transition.");
            }
        }
        else if (role == Role.Merchant)
        {
            var merchant = await RideMerchant(userId, ct);
            if (ride.MerchantId != merchant.Id) throw new ApiException(403, "Only the assigned GrabRide merchant may update this ride.");
            if (!((ride.Status == RideStatus.Accepted && next is RideStatus.InProgress or RideStatus.Cancelled)
                || (ride.Status == RideStatus.InProgress && next == RideStatus.Completed)))
                throw new ApiException(409, "Invalid ride status transition.");
        }
        else if (role == Role.Admin)
        {
            if (next != RideStatus.Cancelled || ride.Status is RideStatus.Completed or RideStatus.Cancelled)
                throw new ApiException(409, "Admins may cancel active rides only.");
        }
        else throw new ApiException(403, "Driver profile required.");
        return await Apply(ride, next, ct);
    }

    /// <summary>Moves an authorized ride to its next status and frees the assigned driver or merchant when it ends.</summary>
    private async Task<RideDto> Apply(Ride ride, RideStatus next, CancellationToken ct)
    {
        if (next is RideStatus.Completed or RideStatus.Cancelled && ride.DriverId.HasValue)
        {
            var assigned = await db.Drivers.SingleAsync(x => x.Id == ride.DriverId, ct);
            assigned.IsAvailable = true;
        }
        if (next is RideStatus.Completed or RideStatus.Cancelled && ride.MerchantId.HasValue)
        {
            var response = await db.RideMerchantResponses.SingleAsync(r => r.RideId == ride.Id && r.MerchantId == ride.MerchantId, ct);
            response.IsActive = false;
        }
        ride.Status = next;
        if (next is RideStatus.Completed or RideStatus.Cancelled)
        {
            ride.DriverLatitude = null;
            ride.DriverLongitude = null;
            ride.DriverLocationAccuracy = null;
            ride.DriverLocationUpdatedAt = null;
        }
        if (next == RideStatus.Completed) ride.CompletedAt = DateTimeOffset.UtcNow;
        // One atomic SaveChanges transaction plus ride AND driver rowversions prevents double acceptance.
        await db.SaveChangesAsync(ct);
        return ride.Dto();
    }

    public async Task<RideDto> UpdateLocation(Guid userId, Role role, Guid id, RideLocationRequest? location, CancellationToken ct)
    {
        var ride = await db.Rides.Include(r => r.Merchant).SingleOrDefaultAsync(r => r.Id == id, ct)
            ?? throw new ApiException(404, "Ride not found.");
        var assigned = role == Role.Merchant
            ? ride.Merchant?.UserId == userId && ride.Merchant.Service == MerchantServiceKind.GrabRide
            : role == Role.Driver && await db.Drivers.AnyAsync(d => d.Id == ride.DriverId && d.UserId == userId, ct);
        if (!assigned) throw new ApiException(404, "Ride not found.");
        if (ride.Status is not (RideStatus.Accepted or RideStatus.InProgress))
            throw new ApiException(409, "Location sharing is available only during an active assigned ride.");
        if (location is not null && (!double.IsFinite(location.Latitude) || location.Latitude is < -90 or > 90
            || !double.IsFinite(location.Longitude) || location.Longitude is < -180 or > 180
            || location.Accuracy is double accuracy && (!double.IsFinite(accuracy) || accuracy < 0)))
            throw new ApiException(400, "A valid GPS location is required.");
        ride.DriverLatitude = location?.Latitude;
        ride.DriverLongitude = location?.Longitude;
        ride.DriverLocationAccuracy = location?.Accuracy;
        ride.DriverLocationUpdatedAt = location is null ? null : DateTimeOffset.UtcNow;
        // The ride rowversion prevents a GPS write from racing a cancellation or completion.
        await db.SaveChangesAsync(ct);
        return ride.Dto();
    }
}
