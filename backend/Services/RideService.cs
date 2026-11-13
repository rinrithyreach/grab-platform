using Grab.Api.Data;
using Grab.Api.DTOs;
using Grab.Api.Interfaces;
using Grab.Api.Middleware;
using Grab.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Grab.Api.Services;
public class RideService(GrabDbContext db, IConfiguration config) : IRideService
{
    public async Task<RideDto> Book(Guid customerId, BookRideRequest r, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(r.PickupLocation) || string.IsNullOrWhiteSpace(r.Destination))
            throw new ApiException(400, "Pickup and destination are required.");
        var ride = new Ride { CustomerId = customerId, PickupLocation = r.PickupLocation.Trim(), Destination = r.Destination.Trim(),
            PickupLatitude = r.PickupLatitude, PickupLongitude = r.PickupLongitude,
            DestinationLatitude = r.DestinationLatitude, DestinationLongitude = r.DestinationLongitude,
            Fare = config.GetValue<decimal>("Pricing:DevelopmentFlatFareUsd", 5) };
        db.Rides.Add(ride);
        await db.SaveChangesAsync(ct);
        return ride.Dto();
    }
    public async Task<List<RideDto>> List(Guid userId, Role role, bool mine, int page, CancellationToken ct)
    {
        var q = db.Rides.AsNoTracking().AsQueryable();
        if (role == Role.Customer) q = q.Where(x => x.CustomerId == userId);
        if (role == Role.Driver)
        {
            var driver = await db.Drivers.SingleOrDefaultAsync(x => x.UserId == userId, ct) ?? throw new ApiException(403, "Driver profile required.");
            q = q.Where(x => x.DriverId == driver.Id || (!mine && x.Status == RideStatus.Pending));
        }
        var rides = await q.OrderByDescending(x => x.CreatedAt).Skip((page - 1) * 50).Take(50).ToListAsync(ct);
        return rides.Select(x => x.Dto()).ToList();
    }
    public async Task<RideDto> Get(Guid userId, Role role, Guid id, CancellationToken ct)
    {
        var ride = await db.Rides.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw new ApiException(404, "Ride not found.");
        var driverOwns = role == Role.Driver && await db.Drivers.AnyAsync(x => x.Id == ride.DriverId && x.UserId == userId, ct);
        if (role != Role.Admin && ride.CustomerId != userId && !driverOwns) throw new ApiException(404, "Ride not found.");
        return ride.Dto();
    }
    public async Task<RideDto> Transition(Guid userId, Role role, Guid id, RideStatus next, CancellationToken ct)
    {
        var ride = await db.Rides.SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw new ApiException(404, "Ride not found.");
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
        else if (role == Role.Admin)
        {
            if (next != RideStatus.Cancelled || ride.Status is RideStatus.Completed or RideStatus.Cancelled)
                throw new ApiException(409, "Admins may cancel active rides only.");
        }
        else throw new ApiException(403, "Driver profile required.");
        if (next is RideStatus.Completed or RideStatus.Cancelled && ride.DriverId.HasValue)
        {
            var assigned = await db.Drivers.SingleAsync(x => x.Id == ride.DriverId, ct);
            assigned.IsAvailable = true;
        }
        ride.Status = next;
        if (next == RideStatus.Completed) ride.CompletedAt = DateTimeOffset.UtcNow;
        // One atomic SaveChanges transaction plus ride AND driver rowversions prevents double acceptance.
        await db.SaveChangesAsync(ct);
        return ride.Dto();
    }
}
