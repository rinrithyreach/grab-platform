using Grab.Api.Data;
using Grab.Api.DTOs;
using Grab.Api.Interfaces;
using Grab.Api.Middleware;
using Grab.Api.Models;
using Microsoft.EntityFrameworkCore;
namespace Grab.Api.Services;
public class DriverService(GrabDbContext db) : IDriverService
{
    public Task<List<DriverDto>> Available(CancellationToken ct) =>
        (from d in db.Drivers.AsNoTracking() join u in db.Users on d.UserId equals u.Id where d.IsAvailable
         orderby d.Id select new DriverDto(d.Id, u.FullName, d.VehicleType, d.VehiclePlate, d.IsAvailable, d.CurrentLatitude, d.CurrentLongitude))
        .Take(100).ToListAsync(ct);
    public async Task<DriverDto> Create(DriverRequest r, CancellationToken ct)
    {
        var user = await db.Users.SingleOrDefaultAsync(x => x.Id == r.UserId, ct) ?? throw new ApiException(404, "User not found.");
        if (user.Role != Role.Customer || await db.Rides.AnyAsync(x => x.CustomerId == user.Id, ct))
            throw new ApiException(409, "Use a dedicated customer account with no ride history for driver onboarding.");
        if (string.IsNullOrWhiteSpace(r.VehicleType) || string.IsNullOrWhiteSpace(r.VehiclePlate)) throw new ApiException(400, "Vehicle details are required.");
        var d = new Driver { UserId = user.Id, VehicleType = r.VehicleType.Trim(), VehiclePlate = r.VehiclePlate.Trim().ToUpperInvariant() };
        user.Role = Role.Driver;
        db.Drivers.Add(d);
        await db.SaveChangesAsync(ct);
        return new(d.Id, user.FullName, d.VehicleType, d.VehiclePlate, d.IsAvailable, null, null);
    }
}
