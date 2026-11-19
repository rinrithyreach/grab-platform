using Grab.Api.Data;
using Grab.Api.DTOs;
using Grab.Api.Middleware;
using Grab.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Grab.Api.Services;

/// <summary>
/// Customer orders for merchant listings. Prices always come from the database at
/// checkout, never from the browser, and are copied onto the order lines.
/// </summary>
public class OrderService(GrabDbContext db, PlatformSettingsService platform)
{
    private const int PageSize = 20;

    // Which status each side may move an order to, from which current status.
    private static readonly Dictionary<MerchantOrderStatus, MerchantOrderStatus[]> MerchantMoves = new()
    {
        [MerchantOrderStatus.Pending] = [MerchantOrderStatus.Accepted, MerchantOrderStatus.Rejected],
        // Rejected after acceptance means the store cancelled the order (e.g. sold out, no rider).
        [MerchantOrderStatus.Accepted] = [MerchantOrderStatus.OnTheWay, MerchantOrderStatus.Rejected],
        [MerchantOrderStatus.OnTheWay] = [MerchantOrderStatus.Delivered, MerchantOrderStatus.Rejected],
    };

    private static string Address(string? value)
    {
        var text = value?.Trim() ?? "";
        // Same rule as the checkout form: a real address has letters and numbers (Khmer included).
        if (text.Length is < 5 or > 300 || !text.Any(char.IsLetter) || !text.Any(char.IsDigit) || text.Any(char.IsControl))
            throw new ApiException(400, "Enter a full delivery address with both letters and numbers (e.g. House 12, St. 271).");
        return text;
    }

    private static string Note(string? value)
    {
        var text = value?.Trim() ?? "";
        if (text.Length > 500 || text.Any(c => char.IsControl(c) && c is not '\n' and not '\r'))
            throw new ApiException(400, "The note must contain at most 500 characters.");
        return text;
    }

    private static MerchantOrderDto Dto(MerchantOrder o, User? customer = null) => new(
        o.Id, o.MerchantId, o.Merchant.BusinessName, o.Merchant.Service, o.Status, o.PaymentMethod,
        o.Items.Select(i => new MerchantOrderItemDto(i.ListingId, i.Title, i.UnitPrice, i.Quantity, i.UnitPrice * i.Quantity)).ToList(),
        o.Subtotal, o.DeliveryFee, o.Total, o.DeliveryAddress, o.Note, o.CreatedAt, o.UpdatedAt,
        customer is null ? null : string.IsNullOrWhiteSpace(customer.FullName) ? "Customer" : customer.FullName,
        customer?.PhoneNumber);

    private static void CheckPage(int page)
    {
        if (page is < 1 or > 10000) throw new ApiException(400, "Invalid page.");
    }

    public async Task<MerchantOrderDto> Place(Guid customerId, PlaceOrderRequest r, CancellationToken ct)
    {
        if (r.Items is null || r.Items.Count is < 1 or > OrderLimits.MaxLines)
            throw new ApiException(400, $"An order must contain 1–{OrderLimits.MaxLines} products.");
        if (!Enum.IsDefined(r.PaymentMethod)) throw new ApiException(400, "Choose Cash or Card.");
        // The same product sent twice becomes one line with the combined quantity.
        var quantities = new Dictionary<Guid, int>();
        foreach (var item in r.Items)
        {
            if (item is null || item.ListingId == Guid.Empty)
                throw new ApiException(400, "Each order item must identify a product.");
            if (item.Quantity is < 1 or > OrderLimits.MaxQuantity)
                throw new ApiException(400, $"Each quantity must be between 1 and {OrderLimits.MaxQuantity}.");
            quantities[item.ListingId] = quantities.GetValueOrDefault(item.ListingId) + item.Quantity;
            if (quantities[item.ListingId] > OrderLimits.MaxQuantity)
                throw new ApiException(400, $"Each quantity must be between 1 and {OrderLimits.MaxQuantity}.");
        }
        var address = Address(r.DeliveryAddress);
        var note = Note(r.Note);

        var merchant = await db.Merchants.SingleOrDefaultAsync(x => x.Id == r.MerchantId && db.Users.Any(u => u.Id == x.UserId && u.IsActive), ct)
            ?? throw new ApiException(404, "This store is not available.");
        if (merchant.Service == MerchantServiceKind.GrabRide) throw new ApiException(400, "GrabRide partners do not sell products.");
        await platform.RequireService(merchant.Service, ct);
        if (merchant.UserId == customerId) throw new ApiException(400, "You cannot order from your own store.");

        var ids = quantities.Keys.ToList();
        var listings = await db.MerchantListings.AsNoTracking()
            .Where(x => ids.Contains(x.Id) && x.MerchantId == merchant.Id && x.IsPublished).ToListAsync(ct);
        // 409 tells the browser to reload the storefront: a product was unpublished or removed.
        if (listings.Count != ids.Count)
            throw new ApiException(409, "Some products in your cart are no longer available. Your cart has been refreshed — please review it and try again.");

        var order = new MerchantOrder
        {
            CustomerId = customerId, MerchantId = merchant.Id, Merchant = merchant,
            PaymentMethod = r.PaymentMethod, DeliveryAddress = address, Note = note,
            Items = listings.OrderBy(l => ids.IndexOf(l.Id)).Select(l => new MerchantOrderItem
            {
                ListingId = l.Id, Title = l.Title, UnitPrice = l.Price, Quantity = quantities[l.Id],
            }).ToList(),
        };
        order.Subtotal = order.Items.Sum(i => i.UnitPrice * i.Quantity);
        order.DeliveryFee = OrderLimits.DeliveryFee;
        order.Total = order.Subtotal + order.DeliveryFee;
        db.MerchantOrders.Add(order);
        await db.SaveChangesAsync(ct);
        return Dto(order);
    }

    public async Task<List<MerchantOrderDto>> Mine(Guid customerId, int page, CancellationToken ct)
    {
        CheckPage(page);
        var rows = await db.MerchantOrders.AsNoTracking().Include(x => x.Merchant).Include(x => x.Items)
            .Where(x => x.CustomerId == customerId).OrderByDescending(x => x.CreatedAt).ThenBy(x => x.Id)
            .Skip((page - 1) * PageSize).Take(PageSize).AsSplitQuery().ToListAsync(ct);
        return rows.Select(o => Dto(o)).ToList();
    }

    public async Task<MerchantOrderDto> Cancel(Guid customerId, Guid id, CancellationToken ct)
    {
        var order = await db.MerchantOrders.Include(x => x.Merchant).Include(x => x.Items)
            .SingleOrDefaultAsync(x => x.Id == id && x.CustomerId == customerId, ct)
            ?? throw new ApiException(404, "Order not found.");
        if (order.Status != MerchantOrderStatus.Pending)
            throw new ApiException(409, "The store has already responded to this order, so it can no longer be cancelled.");
        order.Status = MerchantOrderStatus.Cancelled;
        order.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        return Dto(order);
    }

    private async Task<Merchant> MyStore(Guid userId, CancellationToken ct) =>
        await db.Merchants.AsNoTracking().SingleOrDefaultAsync(x => x.UserId == userId, ct)
        ?? throw new ApiException(404, "Merchant profile was not found.");

    public async Task<List<MerchantOrderDto>> MerchantOrders(Guid userId, int page, CancellationToken ct)
    {
        CheckPage(page);
        var merchant = await MyStore(userId, ct);
        var rows = await db.MerchantOrders.AsNoTracking().Include(x => x.Merchant).Include(x => x.Items)
            .Where(x => x.MerchantId == merchant.Id)
            // Orders that still need action come first, then the newest.
            .OrderBy(x => x.Status == MerchantOrderStatus.Pending ? 0
                : x.Status == MerchantOrderStatus.Accepted || x.Status == MerchantOrderStatus.OnTheWay ? 1 : 2)
            .ThenByDescending(x => x.CreatedAt).ThenBy(x => x.Id)
            .Skip((page - 1) * PageSize).Take(PageSize).AsSplitQuery().ToListAsync(ct);
        var customerIds = rows.Select(x => x.CustomerId).Distinct().ToList();
        var customers = await db.Users.AsNoTracking().Where(u => customerIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, ct);
        return rows.Select(o => Dto(o, customers.GetValueOrDefault(o.CustomerId))).ToList();
    }

    public async Task<MerchantOrderDto> MerchantUpdate(Guid userId, Guid id, MerchantOrderStatus status, CancellationToken ct)
    {
        var merchant = await MyStore(userId, ct);
        var order = await db.MerchantOrders.Include(x => x.Merchant).Include(x => x.Items)
            .SingleOrDefaultAsync(x => x.Id == id && x.MerchantId == merchant.Id, ct)
            ?? throw new ApiException(404, "Order not found.");
        if (!MerchantMoves.TryGetValue(order.Status, out var allowed) || !allowed.Contains(status))
            throw new ApiException(409, order.Status == MerchantOrderStatus.Cancelled
                ? "The customer cancelled this order."
                : $"An order that is {order.Status} cannot be changed to {status}.");
        order.Status = status;
        order.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        var customer = await db.Users.AsNoTracking().SingleOrDefaultAsync(u => u.Id == order.CustomerId, ct);
        return Dto(order, customer);
    }
}
