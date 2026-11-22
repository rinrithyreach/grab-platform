using Grab.Api.Data;
using Grab.Api.DTOs;
using Grab.Api.Middleware;
using Grab.Api.Models;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;

namespace Grab.Api.Services;

public class MerchantService(GrabDbContext db)
{
    public const int MaxImageBytes = 2 * 1024 * 1024;
    public static string ImageUrl(Guid id) => $"/api/merchant-images/{id}";

    private static string Text(string? value, int min, int max, string field)
    {
        var text = value?.Trim() ?? "";
        if (text.Length < min || text.Length > max || text.Any(c => char.IsControl(c) && c is not '\n' and not '\r'))
            throw new ApiException(400, $"{field} must contain {min}–{max} characters.");
        return text;
    }

    private static string RideWorkingHours(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return "";
        if (value.Length > 200) throw new ApiException(400, "Working hours must contain at most 200 characters.");
        string[] days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        var shifts = new Dictionary<string, string>();
        foreach (var part in value.Split(';'))
        {
            var match = Regex.Match(part.Trim(), @"^(?<day>Mon|Tue|Wed|Thu|Fri|Sat|Sun) (?<start>(?:[01]\d|2[0-3]):[0-5]\d)-(?<end>(?:[01]\d|2[0-3]):[0-5]\d)$");
            if (!match.Success || match.Groups["start"].Value == match.Groups["end"].Value
                || !shifts.TryAdd(match.Groups["day"].Value, match.Value))
                throw new ApiException(400, "Choose each working day once and enter different start and end times in HH:mm format.");
        }
        return string.Join("; ", days.Where(shifts.ContainsKey).Select(day => shifts[day]));
    }

    public static void ApplyProfile(Merchant merchant, MerchantProfileRequest r)
    {
        if (!Enum.IsDefined(r.Service)) throw new ApiException(400, "Choose GrabRide, GrabFood or GrabExpress.");
        merchant.Service = r.Service;
        merchant.OwnerName = Text(r.OwnerName, 2, 120, "Owner name");
        merchant.ContactPhone = PhoneNumbers.Normalize(r.ContactPhone) ?? throw new ApiException(400, "Enter a valid public contact phone number.");
        if (r.Service == MerchantServiceKind.GrabRide)
        {
            if (r.VehicleType.HasValue && !Enum.IsDefined(r.VehicleType.Value))
                throw new ApiException(400, "Choose Motorcycle, Rickshaw or Classic.");
            var vehicleType = r.VehicleType ?? (Enum.TryParse<RideVehicleType>(merchant.Category, out var current)
                && Enum.IsDefined(current) ? current : RideVehicleType.Motorcycle);
            var plate = Text(r.MotorcycleLicensePlate, 2, 30, "Vehicle license plate");
            if (plate.Any(char.IsControl)) throw new ApiException(400, "Enter a vehicle license plate without control characters.");
            merchant.MotorcycleLicensePlate = plate.ToUpperInvariant();
            merchant.BusinessName = merchant.OwnerName;
            merchant.Address = Text(r.Address, 2, 300, "Location");
            merchant.Email = null;
            merchant.City = "";
            merchant.Category = vehicleType.ToString();
            merchant.Description = "";
            merchant.OpeningHours = RideWorkingHours(r.OpeningHours);
            return;
        }
        if (r.VehicleType.HasValue) throw new ApiException(400, "Vehicle type applies only to GrabRide partners.");
        merchant.MotorcycleLicensePlate = null;
        merchant.BusinessName = Text(r.BusinessName, 2, 120, "Business name");
        merchant.Email = string.IsNullOrWhiteSpace(r.Email) ? null : r.Email.Trim();
        merchant.Address = Text(r.Address, 5, 300, "Business address");
        merchant.City = Text(r.City, 2, 100, "City");
        merchant.Category = r.Service == MerchantServiceKind.GrabFood && string.IsNullOrWhiteSpace(r.Category)
            ? string.IsNullOrWhiteSpace(merchant.Category) ? "Food" : merchant.Category
            : Text(r.Category, 2, 100, "Category");
        merchant.Description = Text(r.Description, 10, 1500, "Business description");
        merchant.OpeningHours = string.IsNullOrWhiteSpace(r.OpeningHours)
            ? "" : Text(r.OpeningHours, 3, 200, "Opening hours");
    }

    private async Task<Merchant> Mine(Guid userId, CancellationToken ct) =>
        await db.Merchants.SingleOrDefaultAsync(x => x.UserId == userId, ct)
        ?? throw new ApiException(404, "Merchant profile was not found.");

    public static MerchantPublicDto PublicProfile(Merchant m) => new(m.Id, m.Service, m.BusinessName,
        m.ContactPhone, m.Email, m.Address, m.City, m.Category, m.Description, m.OpeningHours);
    private static MerchantProfileDto Profile(Merchant m) => new(m.Id, m.Service, m.BusinessName,
        m.OwnerName, m.ContactPhone, m.Email, m.Address, m.City, m.Category, m.Description, m.OpeningHours, m.MotorcycleLicensePlate,
        m.Service == MerchantServiceKind.GrabRide && Enum.TryParse<RideVehicleType>(m.Category, out var type) ? type : null);
    private static MerchantListingDto Listing(MerchantListing l) => new(l.Id, l.Title, l.Description,
        l.Price, l.ImageId, ImageUrl(l.ImageId), l.IsPublished, l.ShowInSlideshow, l.UpdatedAt, l.CategoryId);
    private static MerchantOfferDto Offer(MerchantListing l) => new(l.Id, l.Title, l.Description,
        l.Price, ImageUrl(l.ImageId), PublicProfile(l.Merchant), l.CategoryId);

    public async Task<MerchantDashboardDto> Dashboard(Guid userId, CancellationToken ct)
    {
        var merchant = await Mine(userId, ct);
        if (merchant.Service == MerchantServiceKind.GrabRide) return new(Profile(merchant), []);
        var listings = await db.MerchantListings.AsNoTracking().Where(x => x.MerchantId == merchant.Id)
            .OrderByDescending(x => x.UpdatedAt).ToListAsync(ct);
        return new(Profile(merchant), listings.Select(Listing).ToList());
    }

    public async Task<MerchantProfileDto> UpdateProfile(Guid userId, MerchantProfileRequest r, CancellationToken ct)
    {
        var merchant = await Mine(userId, ct);
        if (r.Service != merchant.Service)
            throw new ApiException(400, "Your merchant account can only use the service chosen at registration.");
        ApplyProfile(merchant, r);
        await db.SaveChangesAsync(ct);
        return Profile(merchant);
    }

    public async Task<MerchantImageDto> Upload(Guid userId, IFormFile file, CancellationToken ct)
    {
        var merchant = await Mine(userId, ct);
        if (merchant.Service == MerchantServiceKind.GrabRide)
            throw new ApiException(400, "GrabRide partners manage working days and hours instead of listings.");
        if (file.Length is < 12 or > MaxImageBytes) throw new ApiException(400, "Choose a JPG, PNG or WebP image up to 2 MB.");
        if (await db.MerchantImages.CountAsync(x => x.MerchantId == merchant.Id, ct) >= 200)
            throw new ApiException(409, "The limit of 200 uploaded images has been reached.");
        using var buffer = new MemoryStream();
        await file.CopyToAsync(buffer, ct);
        var bytes = buffer.ToArray();
        // Derive the served MIME type from the file bytes, never its extension or supplied MIME type.
        var mime = bytes.AsSpan(0, 8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }) ? "image/png"
            : bytes[0] == 255 && bytes[1] == 216 && bytes[2] == 255 ? "image/jpeg"
            : bytes.AsSpan(0, 4).SequenceEqual("RIFF"u8) && bytes.AsSpan(8, 4).SequenceEqual("WEBP"u8) ? "image/webp" : null;
        if (mime is null) throw new ApiException(400, "Only JPG, PNG and WebP image files are supported.");
        var image = new MerchantImage { MerchantId = merchant.Id, Data = bytes, ContentType = mime };
        db.MerchantImages.Add(image);
        await db.SaveChangesAsync(ct);
        return new(image.Id, ImageUrl(image.Id));
    }

    public async Task<MerchantListingDto> SaveListing(Guid userId, Guid? id, MerchantListingRequest r, CancellationToken ct)
    {
        var merchant = await Mine(userId, ct);
        if (merchant.Service == MerchantServiceKind.GrabRide)
            throw new ApiException(400, "GrabRide partners manage working days and hours instead of listings.");
        var listing = id.HasValue
            ? await db.MerchantListings.SingleOrDefaultAsync(x => x.Id == id && x.MerchantId == merchant.Id, ct)
                ?? throw new ApiException(404, "Listing was not found.")
            : new MerchantListing { MerchantId = merchant.Id };
        if (!id.HasValue && await db.MerchantListings.CountAsync(x => x.MerchantId == merchant.Id, ct) >= 100)
            throw new ApiException(409, "The limit of 100 listings has been reached. Edit an existing listing.");
        if (!await db.MerchantImages.AnyAsync(x => x.Id == r.ImageId && x.MerchantId == merchant.Id, ct))
            throw new ApiException(400, "Upload an image for this merchant before saving the listing.");
        listing.Title = Text(r.Title, 2, 120, "Listing title");
        listing.Description = Text(r.Description, 10, 1500, "Listing description");
        if (r.Price is < 0.01m or > 999999.99m || decimal.Round(r.Price, 2) != r.Price)
            throw new ApiException(400, "Enter a USD price between 0.01 and 999999.99 with at most two decimal places.");
        listing.Price = r.Price;
        await CategoryService.ValidateAssignment(db, r.CategoryId, merchant.Service, ct);
        listing.CategoryId = r.CategoryId;
        listing.ImageId = r.ImageId;
        listing.IsPublished = r.IsPublished;
        listing.ShowInSlideshow = r.ShowInSlideshow;
        listing.UpdatedAt = DateTimeOffset.UtcNow;
        if (!id.HasValue) db.MerchantListings.Add(listing);
        await db.SaveChangesAsync(ct);
        return Listing(listing);
    }

    public async Task<List<MerchantOfferDto>> Offers(MerchantServiceKind? service, int page, CancellationToken ct, Guid? categoryId = null)
    {
        if (page < 1 || page > 10000 || (service.HasValue && !Enum.IsDefined(service.Value)))
            throw new ApiException(400, "Invalid service or page.");
        var query = db.MerchantListings.AsNoTracking().Include(x => x.Merchant).Where(x => x.IsPublished && x.Merchant.Service != MerchantServiceKind.GrabRide
            && db.Users.Any(u => u.Id == x.Merchant.UserId && u.IsActive));
        if (service.HasValue) query = query.Where(x => x.Merchant.Service == service);
        if (categoryId.HasValue)
        {
            if (!await db.ProductCategories.AnyAsync(x => x.Id == categoryId && (service == null || x.Service == service), ct))
                throw new ApiException(400, "Choose a category belonging to the selected service.");
            query = query.Where(x => x.CategoryId == categoryId || (x.Category != null && x.Category.ParentId == categoryId));
        }
        var rows = await query.OrderByDescending(x => x.UpdatedAt).ThenBy(x => x.Id).Skip((page - 1) * 24).Take(24).ToListAsync(ct);
        return rows.Select(Offer).ToList();
    }

    public async Task<List<RideMerchantAreaDto>> RideAreas(int page, CancellationToken ct)
    {
        if (page < 1 || page > 10000) throw new ApiException(400, "Invalid page.");
        return await db.Merchants.AsNoTracking()
            .Where(m => m.Service == MerchantServiceKind.GrabRide && db.Users.Any(u => u.Id == m.UserId && u.Role == Role.Merchant && u.IsActive))
            .OrderBy(m => m.CreatedAt).ThenBy(m => m.Id).Skip((page - 1) * 100).Take(100)
            .Select(m => new RideMerchantAreaDto(m.Id, m.BusinessName, m.Address, m.OpeningHours,
                m.Category == "Rickshaw" ? RideVehicleType.Rickshaw : m.Category == "Classic" ? RideVehicleType.Classic : RideVehicleType.Motorcycle)).ToListAsync(ct);
    }

    public async Task<MerchantStorefrontDto> Storefront(Guid id, CancellationToken ct)
    {
        var merchant = await db.Merchants.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id && db.Users.Any(u => u.Id == x.UserId && u.IsActive), ct)
            ?? throw new ApiException(404, "This merchant is not available.");
        if (merchant.Service == MerchantServiceKind.GrabRide) throw new ApiException(404, "GrabRide partners do not have listings.");
        var rows = await db.MerchantListings.AsNoTracking().Include(x => x.Merchant)
            .Where(x => x.MerchantId == id && x.IsPublished).OrderByDescending(x => x.UpdatedAt).ToListAsync(ct);
        if (rows.Count == 0) throw new ApiException(404, "This merchant has no published listings yet.");
        return new(PublicProfile(merchant), rows.Select(Offer).ToList());
    }

    public async Task<List<BannerDto>> Banners(CancellationToken ct)
    {
        var rows = await db.MerchantListings.AsNoTracking().Include(x => x.Merchant)
            .Where(x => x.IsPublished && x.ShowInSlideshow && x.Merchant.Service != MerchantServiceKind.GrabRide
                && db.Users.Any(u => u.Id == x.Merchant.UserId && u.IsActive)).OrderByDescending(x => x.UpdatedAt).ThenBy(x => x.Id).Take(12).ToListAsync(ct);
        return rows.Select(x => new BannerDto(x.Id, ImageUrl(x.ImageId), x.Title,
            $"{x.Merchant.BusinessName} · {x.Merchant.Service} · {(x.Merchant.Service == MerchantServiceKind.GrabRide ? x.Merchant.Address : x.Merchant.City)} · ${x.Price:0.00}", $"/partners/{x.MerchantId}")).ToList();
    }
}
