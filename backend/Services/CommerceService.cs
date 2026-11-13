using Grab.Api.Data;
using Grab.Api.DTOs;
using Grab.Api.Interfaces;
using Grab.Api.Middleware;
using Grab.Api.Models;
using Microsoft.EntityFrameworkCore;
namespace Grab.Api.Services;
public class CommerceService(GrabDbContext db) : ICommerceService
{
    private async Task<Ride> CompletedOwnRide(Guid userId, Guid rideId, CancellationToken ct)
    {
        var ride = await db.Rides.SingleOrDefaultAsync(x => x.Id == rideId && x.CustomerId == userId, ct)
            ?? throw new ApiException(404, "Ride not found.");
        if (ride.Status != RideStatus.Completed) throw new ApiException(409, "Ride must be completed first.");
        return ride;
    }
    public async Task<PaymentDto> Pay(Guid userId, Guid rideId, CancellationToken ct)
    {
        var ride = await CompletedOwnRide(userId, rideId, ct);
        if (await db.Payments.AnyAsync(x => x.RideId == rideId, ct)) throw new ApiException(409, "Ride already paid.");
        var p = new Payment { RideId = ride.Id, Amount = ride.Fare };
        db.Payments.Add(p);
        await db.SaveChangesAsync(ct);
        return p.Dto();
    }
    public async Task<List<PaymentDto>> Payments(Guid userId, int page, CancellationToken ct)
    {
        var rows = await (from p in db.Payments.AsNoTracking() join r in db.Rides on p.RideId equals r.Id
            where r.CustomerId == userId orderby p.CreatedAt descending select p).Skip((page - 1) * 50).Take(50).ToListAsync(ct);
        return rows.Select(x => x.Dto()).ToList();
    }
    public async Task<ReviewDto> Review(Guid userId, ReviewRequest r, CancellationToken ct)
    {
        var ride = await CompletedOwnRide(userId, r.RideId, ct);
        if (ride.DriverId is null) throw new ApiException(409, "Ride has no driver.");
        if (await db.Reviews.AnyAsync(x => x.RideId == ride.Id, ct)) throw new ApiException(409, "Ride already reviewed.");
        var review = new Review { RideId = ride.Id, CustomerId = userId, DriverId = ride.DriverId.Value, Rating = r.Rating, Comment = r.Comment?.Trim() };
        db.Reviews.Add(review);
        await db.SaveChangesAsync(ct);
        return review.Dto();
    }
    public async Task<List<ReviewDto>> Reviews(Guid driverId, int page, CancellationToken ct)
    {
        if (!await db.Drivers.AnyAsync(x => x.Id == driverId, ct)) throw new ApiException(404, "Driver not found.");
        var rows = await db.Reviews.AsNoTracking().Where(x => x.DriverId == driverId).OrderBy(x => x.Id).Skip((page - 1) * 50).Take(50).ToListAsync(ct);
        return rows.Select(x => x.Dto()).ToList();
    }
}
