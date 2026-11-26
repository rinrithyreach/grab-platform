using System.Data;
using Grab.Api.Data;
using Grab.Api.DTOs;
using Grab.Api.Interfaces;
using Grab.Api.Middleware;
using Grab.Api.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Grab.Api.Services;

public class AdminService(GrabDbContext db, IRideService rides, OrderService orders,
    MerchantService merchants, IDriverService drivers, DeliveryService deliveries, IPasswordHasher<User> hasher, AdminAccessService access)
{
    private const int PageSize = 20;
    private static string Clean(string? value, int min, int max, string field)
    {
        var text = value?.Trim() ?? "";
        if (text.Length < min || text.Length > max || text.Any(char.IsControl))
            throw new ApiException(400, $"{field} must contain {min}-{max} characters without control characters.");
        return text;
    }

    private async Task<object> Page<T>(IQueryable<T> query, int page, CancellationToken ct) =>
        new AdminPage<T>(await query.Skip((page - 1) * PageSize).Take(PageSize).ToListAsync(ct),
            await query.CountAsync(ct), page, PageSize);

    public async Task<object> List(string resource, int page, string? search, string? filter, CancellationToken ct)
    {
        if (page is < 1 or > 100000) throw new ApiException(400, "Invalid page.");
        var q = (search ?? "").Trim();
        if (q.Length > 120) throw new ApiException(400, "Search is limited to 120 characters.");
        var f = filter ?? "";
        Role? role = Enum.TryParse<Role>(f, out var roleValue) ? roleValue : null;
        MerchantServiceKind? service = Enum.TryParse<MerchantServiceKind>(f, out var serviceValue) ? serviceValue : null;
        RideStatus? rideStatus = Enum.TryParse<RideStatus>(f, out var rideValue) ? rideValue : null;
        MerchantOrderStatus? orderStatus = Enum.TryParse<MerchantOrderStatus>(f, out var orderValue) ? orderValue : null;
        ParcelDeliveryStatus? deliveryStatus = Enum.TryParse<ParcelDeliveryStatus>(f, out var deliveryValue) ? deliveryValue : null;
        switch (resource)
        {
            case "users":
                return await Page(db.Users.AsNoTracking()
                    .Where(x => q == "" || x.FullName.Contains(q) || x.PhoneNumber.Contains(q) || (x.Email != null && x.Email.Contains(q)) || x.Id.ToString() == q)
                    .Where(x => f == "" || (f == "Active" && x.IsActive) || (f == "Suspended" && !x.IsActive) || x.Role == role)
                    .OrderByDescending(x => x.CreatedAt).ThenBy(x => x.Id)
                    .Select(x => new { x.Id, x.FullName, x.Email, x.PhoneNumber, x.Role, x.IsActive, x.CreatedAt }), page, ct);
            case "merchants":
                return await Page(db.Merchants.AsNoTracking()
                    .Where(x => q == "" || x.BusinessName.Contains(q) || x.OwnerName.Contains(q) || x.ContactPhone.Contains(q) || x.Id.ToString() == q)
                    .Where(x => f == "" || x.Service == service)
                    .OrderByDescending(x => x.CreatedAt).ThenBy(x => x.Id)
                    .Select(x => new { x.Id, x.UserId, x.BusinessName, x.OwnerName, x.Service, x.ContactPhone, x.Email, x.Address, x.City,
                        x.Category, x.Description, x.OpeningHours, x.MotorcycleLicensePlate, x.CreatedAt,
                        IsActive = db.Users.Where(u => u.Id == x.UserId).Select(u => u.IsActive).First() }), page, ct);
            case "listings":
                return await Page(db.MerchantListings.AsNoTracking()
                    .Where(x => x.Merchant.Service != MerchantServiceKind.GrabRide)
                    .Where(x => q == "" || x.Title.Contains(q) || x.Merchant.BusinessName.Contains(q) || x.Id.ToString() == q)
                    .Where(x => f == "" || (f == "Published" && x.IsPublished) || (f == "Draft" && !x.IsPublished) || (f == "Featured" && x.IsPublished && x.ShowInSlideshow))
                    .OrderByDescending(x => x.UpdatedAt).ThenBy(x => x.Id)
                    .Select(x => new { x.Id, x.MerchantId, MerchantName = x.Merchant.BusinessName, x.Title, x.Description, x.Price,
                        x.IsPublished, x.ShowInSlideshow, x.ImageId, x.UpdatedAt, x.CategoryId, Service = x.Merchant.Service,
                        CategoryName = x.Category == null ? null : x.Category.Name }), page, ct);
            case "rides":
                return await Page(db.Rides.AsNoTracking()
                    .Where(x => q == "" || x.PickupLocation.Contains(q) || x.Destination.Contains(q) || x.Id.ToString() == q
                        || (x.GuestName != null && x.GuestName.Contains(q)) || (x.GuestPhone != null && x.GuestPhone.Contains(q)))
                    .Where(x => f == "" || x.Status == rideStatus)
                    .OrderByDescending(x => x.CreatedAt).ThenBy(x => x.Id)
                    .Select(x => new { x.Id, x.CustomerId,
                        CustomerName = x.GuestName ?? db.Users.Where(u => u.Id == x.CustomerId).Select(u => u.FullName).FirstOrDefault(),
                        CustomerPhone = x.GuestPhone ?? db.Users.Where(u => u.Id == x.CustomerId).Select(u => u.PhoneNumber).FirstOrDefault(),
                        IsGuest = x.CustomerId == null,
                        x.DriverId, x.MerchantId, MerchantName = x.Merchant == null ? null : x.Merchant.BusinessName,
                        x.PickupLocation, x.Destination, x.VehicleType, x.Fare, x.Status, x.CreatedAt, x.CompletedAt }), page, ct);
            // "orders" lists GrabFood orders; "express" lists GrabExpress shop orders. Both are merchant orders.
            case "orders" or "express":
                var orderService = resource == "express" ? MerchantServiceKind.GrabExpress : MerchantServiceKind.GrabFood;
                return await Page(db.MerchantOrders.AsNoTracking()
                    .Where(x => x.Merchant.Service == orderService)
                    .Where(x => q == "" || x.Merchant.BusinessName.Contains(q) || x.DeliveryAddress.Contains(q) || x.Id.ToString() == q
                        || (x.GuestName != null && x.GuestName.Contains(q)) || (x.GuestPhone != null && x.GuestPhone.Contains(q)))
                    .Where(x => f == "" || x.Status == orderStatus)
                    .OrderByDescending(x => x.CreatedAt).ThenBy(x => x.Id)
                    .Select(x => new { x.Id, x.CustomerId,
                        CustomerName = x.GuestName ?? db.Users.Where(u => u.Id == x.CustomerId).Select(u => u.FullName).FirstOrDefault(),
                        CustomerPhone = x.GuestPhone ?? db.Users.Where(u => u.Id == x.CustomerId).Select(u => u.PhoneNumber).FirstOrDefault(),
                        IsGuest = x.CustomerId == null,
                        x.MerchantId, MerchantName = x.Merchant.BusinessName, x.DeliveryAddress, x.Note, x.Status, x.PaymentMethod, x.Currency,
                        x.Subtotal, x.DeliveryFee, x.Total, x.CreatedAt, x.UpdatedAt,
                        Items = x.Items.Select(i => new { i.Title, i.Quantity, i.UnitPrice }).ToList() }), page, ct);
            case "deliveries":
                return await Page(db.ParcelDeliveries.AsNoTracking()
                    .Where(x => q == "" || x.PickupName.Contains(q) || x.PickupAddress.Contains(q) || x.Id.ToString() == q)
                    .Where(x => f == "" || x.Status == deliveryStatus)
                    .OrderByDescending(x => x.CreatedAt).ThenBy(x => x.Id)
                    .Select(x => new { x.Id, x.CustomerId, x.CourierMerchantId, CourierName = x.CourierMerchant == null ? null : x.CourierMerchant.BusinessName,
                        x.PickupName, x.PickupPhone, x.PickupAddress, x.ServiceType, x.VehicleType, x.Status, x.PaymentMethod,
                        x.TotalFare, x.CodAmount, x.ScheduledPickupAt, x.CreatedAt, x.UpdatedAt,
                        Stops = x.Stops.OrderBy(s => s.Position).Select(s => new { s.Position, s.RecipientName, s.RecipientPhone, s.Address,
                            s.Description, s.Status, s.CodAmount, s.CodCollected, s.CodPaidOut }).ToList() }), page, ct);
            case "drivers":
                return await Page((from d in db.Drivers.AsNoTracking() join u in db.Users on d.UserId equals u.Id
                    where q == "" || u.FullName.Contains(q) || d.VehiclePlate.Contains(q) || d.Id.ToString() == q
                    where f == "" || (f == "Available" && d.IsAvailable) || (f == "Unavailable" && !d.IsAvailable)
                    orderby u.CreatedAt descending, d.Id
                    select new { d.Id, d.UserId, u.FullName, u.PhoneNumber, d.VehicleType, d.VehiclePlate, d.IsAvailable, u.IsActive }), page, ct);
            case "payments":
                return await Page(db.Payments.AsNoTracking().Where(x => q == "" || x.Id.ToString() == q || x.RideId.ToString() == q)
                    .OrderByDescending(x => x.CreatedAt).ThenBy(x => x.Id)
                    .Select(x => new { x.Id, x.RideId, x.Amount, x.PaymentMethod, x.Status, x.CreatedAt }), page, ct);
            case "reviews":
                return await Page(db.Reviews.AsNoTracking()
                    .Where(x => q == "" || (x.Comment != null && x.Comment.Contains(q)) || x.Id.ToString() == q)
                    .Where(x => f == "" || (f == "Visible" && !x.IsHidden) || (f == "Hidden" && x.IsHidden))
                    .OrderBy(x => x.Id)
                    .Select(x => new { x.Id, x.RideId, x.CustomerId, x.DriverId, x.Rating, x.Comment, x.IsHidden,
                        CustomerName = db.Users.Where(u => u.Id == x.CustomerId).Select(u => u.FullName).First() }), page, ct);
            case "audit":
                return await Page(db.AdminAudits.AsNoTracking()
                    .Where(x => q == "" || x.ActorName.Contains(q) || x.Reason.Contains(q) || x.Action.Contains(q) || x.TargetId.ToString() == q)
                    .Where(x => f == "" || x.Resource == f)
                    .OrderByDescending(x => x.CreatedAt).ThenBy(x => x.Id), page, ct);
            default: throw new ApiException(404, "Unknown admin section.");
        }
    }

    public async Task<object> Overview(Guid actorId, CancellationToken ct)
    {
        var viewer = await access.Require(actorId, "overview.view", ct);
        var today = DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(7)).Date;
        var start = new DateTimeOffset(today.AddDays(-6), TimeSpan.FromHours(7));
        var recentRides = await db.Rides.AsNoTracking().Where(x => x.CreatedAt >= start).Select(x => x.CreatedAt).ToListAsync(ct);
        var recentOrders = await db.MerchantOrders.AsNoTracking().Where(x => x.CreatedAt >= start).Select(x => x.CreatedAt).ToListAsync(ct);
        var recentDeliveries = await db.ParcelDeliveries.AsNoTracking().Where(x => x.CreatedAt >= start).Select(x => x.CreatedAt).ToListAsync(ct);
        return new {
            Users = await db.Users.CountAsync(ct), ActiveUsers = await db.Users.CountAsync(x => x.IsActive, ct),
            Merchants = await db.Merchants.CountAsync(ct), Drivers = await db.Drivers.CountAsync(ct),
            PublishedListings = await db.MerchantListings.CountAsync(x => x.IsPublished && x.Merchant.Service != MerchantServiceKind.GrabRide
                && db.Users.Any(u => u.Id == x.Merchant.UserId && u.IsActive), ct),
            PendingRides = await db.Rides.CountAsync(x => x.Status == RideStatus.Pending, ct),
            // PendingOrders/ActiveOrders cover every store order; the Express counts are the GrabExpress share of them.
            PendingOrders = await db.MerchantOrders.CountAsync(x => x.Status == MerchantOrderStatus.Pending, ct),
            PendingExpressOrders = await db.MerchantOrders.CountAsync(x => x.Status == MerchantOrderStatus.Pending && x.Merchant.Service == MerchantServiceKind.GrabExpress, ct),
            ActiveExpressOrders = await db.MerchantOrders.CountAsync(x => x.Merchant.Service == MerchantServiceKind.GrabExpress
                && (x.Status == MerchantOrderStatus.Pending || x.Status == MerchantOrderStatus.Accepted || x.Status == MerchantOrderStatus.OnTheWay), ct),
            PendingDeliveries = await db.ParcelDeliveries.CountAsync(x => x.Status == ParcelDeliveryStatus.Pending || x.Status == ParcelDeliveryStatus.Scheduled, ct),
            ActiveRides = await db.Rides.CountAsync(x => x.Status == RideStatus.Pending || x.Status == RideStatus.Accepted || x.Status == RideStatus.InProgress, ct),
            ActiveOrders = await db.MerchantOrders.CountAsync(x => x.Status == MerchantOrderStatus.Pending || x.Status == MerchantOrderStatus.Accepted || x.Status == MerchantOrderStatus.OnTheWay, ct),
            ActiveDeliveries = await db.ParcelDeliveries.CountAsync(x => x.Status != ParcelDeliveryStatus.Delivered && x.Status != ParcelDeliveryStatus.Failed && x.Status != ParcelDeliveryStatus.Cancelled, ct),
            SimulatedPayments = await db.Payments.SumAsync(x => (decimal?)x.Amount, ct) ?? 0,
            CompletedOrderValue = await db.MerchantOrders.Where(x => x.Status == MerchantOrderStatus.Delivered).SumAsync(x => (decimal?)x.Total, ct) ?? 0,
            Activity = Enumerable.Range(0, 7).Select(i => { var date = today.AddDays(i - 6); return new {
                Date = date.ToString("yyyy-MM-dd"),
                Rides = recentRides.Count(d => d.ToOffset(TimeSpan.FromHours(7)).Date == date),
                Orders = recentOrders.Count(d => d.ToOffset(TimeSpan.FromHours(7)).Date == date),
                Deliveries = recentDeliveries.Count(d => d.ToOffset(TimeSpan.FromHours(7)).Date == date)
            }; }).ToList(),
            RecentAudit = viewer.Has("audit.view")
                ? await db.AdminAudits.AsNoTracking().OrderByDescending(x => x.CreatedAt).ThenBy(x => x.Id).Take(5)
                    .Select(x => new { x.Id, x.Resource, x.ActorName, x.Action, x.Reason, x.CreatedAt }).ToListAsync(ct)
                : [],
            UpdatedAt = DateTimeOffset.UtcNow
        };
    }

    private async Task Audit(Guid actorId, string resource, Guid targetId, string action, string reason, CancellationToken ct)
    {
        var actor = await db.Users.SingleAsync(x => x.Id == actorId, ct);
        db.AdminAudits.Add(new AdminAudit { ActorId = actorId, ActorName = actor.FullName, Resource = resource,
            TargetId = targetId, Action = action, Reason = Clean(reason, 3, 300, "Reason") });
        await db.SaveChangesAsync(ct);
    }

    public async Task UpdateUser(Guid actorId, Guid id, AdminUserRequest r, CancellationToken ct)
    {
        Clean(r.Reason, 3, 300, "Reason");
        // Serialize role changes so two admins cannot concurrently remove the last active admin.
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var user = await db.Users.SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw new ApiException(404, "User not found.");
        if (id == actorId && (!r.IsActive || r.Role != Role.Admin)) throw new ApiException(409, "You cannot suspend or demote your own administrator account.");
        // Promotion grants Super administrator, so only super administrators may touch administrator accounts here.
        if (user.Role == Role.Admin || r.Role == Role.Admin)
            await access.RequireSuper(actorId, "Only super administrators can change administrator accounts from Users & access. Use Administrators to manage your team.", ct);
        var profile = await db.AdminProfiles.SingleOrDefaultAsync(x => x.UserId == id, ct);
        if (user.Role == Role.Admin && user.IsActive && profile?.AdminRoleId is null && (!r.IsActive || r.Role != Role.Admin)
            && !await db.Users.AnyAsync(x => x.Id != id && x.Role == Role.Admin && x.IsActive
                && !db.AdminProfiles.Any(p => p.UserId == x.Id && p.AdminRoleId != null), ct))
            throw new ApiException(409, "Keep at least one active super administrator.");
        if (user.Role != Role.Admin && r.Role == Role.Admin && profile is not null) profile.AdminRoleId = null;
        if (r.Role != user.Role && (r.Role is not (Role.Admin or Role.Customer) || user.Role is not (Role.Admin or Role.Customer)))
            throw new ApiException(409, "Merchant and driver roles are managed through their dedicated profiles.");
        if (!r.IsActive && await db.Rides.AnyAsync(x => (x.DriverId != null && db.Drivers.Any(d => d.Id == x.DriverId && d.UserId == id)
                || x.MerchantId != null && db.Merchants.Any(m => m.Id == x.MerchantId && m.UserId == id))
                && (x.Status == RideStatus.Accepted || x.Status == RideStatus.InProgress), ct))
            throw new ApiException(409, "Complete or cancel this account's active ride before suspending it.");
        if (!r.IsActive && await db.ParcelDeliveries.AnyAsync(x => x.CourierMerchantId != null
                && db.Merchants.Any(m => m.Id == x.CourierMerchantId && m.UserId == id)
                && (x.Status == ParcelDeliveryStatus.Accepted || x.Status == ParcelDeliveryStatus.PickedUp || x.Status == ParcelDeliveryStatus.InTransit), ct))
            throw new ApiException(409, "Resolve this courier's active delivery before suspending it.");
        var before = $"{user.Role}/{(user.IsActive ? "Active" : "Suspended")}";
        if (user.Role != r.Role || user.IsActive != r.IsActive) user.SecurityVersion++;
        user.FullName = Clean(r.FullName, 2, 120, "Name");
        user.Role = r.Role;
        user.IsActive = r.IsActive;
        await Audit(actorId, "users", id, $"Updated {before} to {user.Role}/{(user.IsActive ? "Active" : "Suspended")}", r.Reason, ct);
        await tx.CommitAsync(ct);
    }

    public async Task<Guid> CreateUser(Guid actorId, AdminCreateUserRequest r, CancellationToken ct)
    {
        var reason = Clean(r.Reason, 3, 300, "Reason");
        var name = Clean(r.FullName, 2, 120, "Name");
        var phone = PhoneNumbers.Normalize(r.PhoneNumber) ?? throw new ApiException(400, "Enter a valid phone number, for example 012345678 or +85512345678.");
        var email = string.IsNullOrWhiteSpace(r.Email) ? null : r.Email.Trim().ToLowerInvariant();
        if (email is not null && !new System.ComponentModel.DataAnnotations.EmailAddressAttribute().IsValid(email)) throw new ApiException(400, "Enter a valid email or leave it blank.");
        if (r.Password.Length is < 12 or > 128) throw new ApiException(400, "Use a password of 12-128 characters.");
        if (await db.Users.AnyAsync(x => x.PhoneNumber == phone, ct)) throw new ApiException(409, "This phone number is already registered.");
        if (email is not null && await db.Users.AnyAsync(x => x.Email == email, ct)) throw new ApiException(409, "This email is already in use.");
        var user = new User { FullName = name, PhoneNumber = phone, Email = email, Role = Role.Customer };
        user.PasswordHash = hasher.HashPassword(user, r.Password);
        db.Users.Add(user);
        await Audit(actorId, "users", user.Id, $"Created customer account {(name.Length > 70 ? name[..70] : name)}", reason, ct);
        return user.Id;
    }

    public async Task UpdateListing(Guid actorId, Guid id, AdminListingRequest r, CancellationToken ct)
    {
        var listing = await db.MerchantListings.Include(x => x.Merchant).SingleOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new ApiException(404, "Listing not found.");
        if (listing.Merchant.Service == MerchantServiceKind.GrabRide) throw new ApiException(400, "Ride partners do not sell listings.");
        if (r.Price is < 0.01m or > 999999.99m || decimal.Round(r.Price, 2) != r.Price)
            throw new ApiException(400, "Enter a USD price between 0.01 and 999999.99 with at most two decimal places.");
        listing.Title = Clean(r.Title, 2, 120, "Title");
        listing.Description = r.Description?.Trim() ?? "";
        listing.Price = r.Price;
        await CategoryService.ValidateAssignment(db, r.CategoryId, listing.Merchant.Service, ct);
        listing.CategoryId = r.CategoryId;
        listing.IsPublished = r.IsPublished;
        listing.ShowInSlideshow = r.IsPublished && r.ShowInSlideshow;
        listing.UpdatedAt = DateTimeOffset.UtcNow;
        await Audit(actorId, "listings", id, r.IsPublished ? "Updated published listing" : "Saved listing as draft", r.Reason, ct);
    }

    public async Task UpdateMerchant(Guid actorId, Guid id, AdminMerchantRequest r, CancellationToken ct)
    {
        Clean(r.Reason, 3, 300, "Reason");
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var merchant = await db.Merchants.SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw new ApiException(404, "Merchant not found.");
        await merchants.UpdateProfile(merchant.UserId, r.Profile, ct);
        await Audit(actorId, "merchants", id, "Updated merchant profile", r.Reason, ct);
        await tx.CommitAsync(ct);
    }

    public async Task<DriverDto> CreateDriver(Guid actorId, AdminDriverRequest r, CancellationToken ct)
    {
        Clean(r.Reason, 3, 300, "Reason");
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        if (!await db.Users.AnyAsync(x => x.Id == r.UserId && x.IsActive, ct)) throw new ApiException(409, "Choose an active customer account.");
        var driver = await drivers.Create(new(r.UserId, r.VehicleType, r.VehiclePlate), ct);
        await Audit(actorId, "drivers", driver.Id, "Onboarded driver", r.Reason, ct);
        await tx.CommitAsync(ct);
        return driver;
    }

    public async Task Action(Guid actorId, string resource, Guid id, AdminActionRequest r, CancellationToken ct)
    {
        Clean(r.Reason, 3, 300, "Reason");
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        switch (resource)
        {
            case "rides" when r.Action == "Cancelled":
                await rides.Transition(actorId, Role.Admin, id, RideStatus.Cancelled, ct);
                break;
            case "orders" or "express":
                var actionService = resource == "express" ? MerchantServiceKind.GrabExpress : MerchantServiceKind.GrabFood;
                var order = await db.MerchantOrders.Include(x => x.Merchant).SingleOrDefaultAsync(x => x.Id == id && x.Merchant.Service == actionService, ct)
                    ?? throw new ApiException(404, "Order not found.");
                if (!Enum.TryParse<MerchantOrderStatus>(r.Action, out var status) || !Enum.IsDefined(status)) throw new ApiException(400, "Invalid order action.");
                await orders.MerchantUpdate(order.Merchant.UserId, id, status, ct);
                break;
            case "deliveries":
                var delivery = await db.ParcelDeliveries.Include(x => x.Stops).SingleOrDefaultAsync(x => x.Id == id, ct)
                    ?? throw new ApiException(404, "Delivery not found.");
                if (r.Action == "Cancelled") await deliveries.Cancel(delivery.CustomerId, id, ct);
                else if (r.Action == "Failed" && delivery.Status is ParcelDeliveryStatus.PickedUp or ParcelDeliveryStatus.InTransit)
                {
                    foreach (var stop in delivery.Stops.Where(x => x.Status == DeliveryStopStatus.Pending))
                    { stop.Status = DeliveryStopStatus.Failed; stop.FailureReason = r.Reason.Trim(); }
                    delivery.Status = ParcelDeliveryStatus.Failed;
                    delivery.CompletedAt = delivery.UpdatedAt = DateTimeOffset.UtcNow;
                    delivery.CourierLatitude = delivery.CourierLongitude = delivery.CourierLocationAccuracy = null;
                    delivery.CourierLocationUpdatedAt = null;
                }
                else throw new ApiException(409, "Only deliveries before pickup can be cancelled; a picked-up delivery can be marked failed.");
                break;
            case "drivers" when r.Action is "Available" or "Unavailable":
                var driver = await db.Drivers.SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw new ApiException(404, "Driver not found.");
                if (await db.Rides.AnyAsync(x => x.DriverId == id && (x.Status == RideStatus.Accepted || x.Status == RideStatus.InProgress), ct))
                    throw new ApiException(409, "Finish or cancel the driver's active ride first.");
                driver.IsAvailable = r.Action == "Available";
                break;
            case "reviews" when r.Action is "Hide" or "Restore":
                var review = await db.Reviews.SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw new ApiException(404, "Review not found.");
                review.IsHidden = r.Action == "Hide";
                break;
            default: throw new ApiException(400, "This action is not supported.");
        }
        await Audit(actorId, resource, id, r.Action, r.Reason, ct);
        await tx.CommitAsync(ct);
    }
}
