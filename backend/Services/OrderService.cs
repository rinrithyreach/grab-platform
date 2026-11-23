using System.Security.Cryptography;
using System.Text;
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
public class OrderService(GrabDbContext db, PlatformSettingsService platform, PromotionService promotions)
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
        customer is null ? o.GuestName : string.IsNullOrWhiteSpace(customer.FullName) ? "Customer" : customer.FullName,
        customer?.PhoneNumber ?? o.GuestPhone, o.Discount, o.CodeDiscount, o.PromoCode,
        o.Currency, o.ExchangeRate, Currencies.ToKhr(o.Total, o.ExchangeRate));

    private static void CheckPage(int page)
    {
        if (page is < 1 or > 10000) throw new ApiException(400, "Invalid page.");
    }

    public async Task<MerchantOrderDto> Place(Guid customerId, PlaceOrderRequest r, CancellationToken ct)
    {
        var order = await Prepare(customerId, r, ct);
        db.MerchantOrders.Add(order);
        await db.SaveChangesAsync(ct);
        return Dto(order);
    }

    public async Task<GuestOrderResponse> PlaceGuest(GuestOrderRequest r, CancellationToken ct)
    {
        var name = r.ContactName?.Trim() ?? "";
        if (name.Length is < 2 or > 120 || !name.Any(char.IsLetter) || name.Any(char.IsControl))
            throw new ApiException(400, "Enter the recipient's full name (2 to 120 characters).");
        var phone = PhoneNumbers.Normalize(r.ContactPhone)
            ?? throw new ApiException(400, "Enter a valid contact phone number.");
        var order = await Prepare(null, r.Order, ct);
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        order.GuestName = name; order.GuestPhone = phone; order.GuestTokenHash = TokenHash(token);
        db.MerchantOrders.Add(order);
        await db.SaveChangesAsync(ct);
        return new(Dto(order), token);
    }

    private static string TokenHash(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    public async Task<MerchantOrderDto> GuestOrder(Guid id, string? token, bool cancel, CancellationToken ct)
    {
        // A receipt ID alone never grants access to guest contact details.
        if (token is null || token.Length != 64) throw new ApiException(404, "Order not found.");
        var hash = TokenHash(token);
        var order = await db.MerchantOrders.Include(x => x.Merchant).Include(x => x.Items)
            .SingleOrDefaultAsync(x => x.Id == id && x.CustomerId == null && x.GuestTokenHash == hash, ct)
            ?? throw new ApiException(404, "Order not found.");
        if (cancel)
        {
            if (order.Status != MerchantOrderStatus.Pending)
                throw new ApiException(409, "The store has already responded to this order, so it can no longer be cancelled.");
            order.Status = MerchantOrderStatus.Cancelled;
            order.UpdatedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);
        }
        return Dto(order);
    }

    private async Task<MerchantOrder> Prepare(Guid? customerId, PlaceOrderRequest r, CancellationToken ct)
    {
        if (!Enum.IsDefined(r.PaymentMethod)) throw new ApiException(400, "Choose Cash or Card.");
        if (r.Currency is { } currency && !Enum.IsDefined(currency)) throw new ApiException(400, "Choose USD or KHR.");
        var address = Address(r.DeliveryAddress); var note = Note(r.Note);
        var order = await Build(customerId, r.MerchantId, r.Items, ct);
        order.PaymentMethod = r.PaymentMethod; order.DeliveryAddress = address; order.Note = note;
        order.Currency = r.Currency ?? PaymentCurrency.USD; order.ExchangeRate = Currencies.KhrPerUsd;
        var quote = await Price(customerId, order, r.PromoCode, ct);
        if (r.ExpectedTotal.HasValue && r.ExpectedTotal.Value != quote.Total)
            throw new ApiException(409, "Prices or promotions changed. Review the updated total and place the order again.");
        order.Discount = quote.Discount; order.CodeDiscount = quote.CodeDiscount; order.PromoCode = quote.PromoCode;
        order.DeliveryFee = quote.DeliveryFee; order.Total = quote.Total;
        return order;
    }

    public async Task<OrderQuoteDto> Quote(Guid? customerId, OrderQuoteRequest r, CancellationToken ct)
    {
        var order = await Build(customerId, r.MerchantId, r.Items, ct);
        return await Price(customerId, order, r.PromoCode, ct);
    }

    private Task<OrderQuoteDto> Price(Guid? customerId, MerchantOrder order, string? code, CancellationToken ct) =>
        promotions.Calculate(customerId, order.MerchantId.ToString(), order.Items.Select(x => new PromotionService.Line(x.ListingId.ToString(), x.UnitPrice, x.Quantity)).ToList(), code, ct);

    private async Task<MerchantOrder> Build(Guid? customerId, Guid merchantId, List<OrderItemRequest>? items, CancellationToken ct)
    {
        if (items is null || items.Count is < 1 or > OrderLimits.MaxLines)
            throw new ApiException(400, $"An order must contain 1–{OrderLimits.MaxLines} products.");
        // The same product sent twice becomes one line with the combined quantity.
        var quantities = new Dictionary<Guid, int>();
        foreach (var item in items)
        {
            if (item is null || item.ListingId == Guid.Empty)
                throw new ApiException(400, "Each order item must identify a product.");
            if (item.Quantity is < 1 or > OrderLimits.MaxQuantity)
                throw new ApiException(400, $"Each quantity must be between 1 and {OrderLimits.MaxQuantity}.");
            quantities[item.ListingId] = quantities.GetValueOrDefault(item.ListingId) + item.Quantity;
            if (quantities[item.ListingId] > OrderLimits.MaxQuantity)
                throw new ApiException(400, $"Each quantity must be between 1 and {OrderLimits.MaxQuantity}.");
        }
        var merchant = await db.Merchants.SingleOrDefaultAsync(x => x.Id == merchantId && db.Users.Any(u => u.Id == x.UserId && u.IsActive), ct)
            ?? throw new ApiException(404, "This store is not available.");
        if (merchant.Service == MerchantServiceKind.GrabRide) throw new ApiException(400, "GrabRide partners do not sell products.");
        if (!customerId.HasValue && merchant.Service != MerchantServiceKind.GrabExpress)
            throw new ApiException(403, "Guest checkout is available for GrabExpress only. Sign in to order GrabFood.");
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
            Items = listings.OrderBy(l => ids.IndexOf(l.Id)).Select(l => new MerchantOrderItem
            {
                ListingId = l.Id, Title = l.Title, UnitPrice = l.Price, Quantity = quantities[l.Id],
            }).ToList(),
        };
        order.Subtotal = order.Items.Sum(i => i.UnitPrice * i.Quantity);
        order.DeliveryFee = OrderLimits.DeliveryFee;
        order.Total = order.Subtotal + order.DeliveryFee;
        return order;
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
        var customerIds = rows.Where(x => x.CustomerId.HasValue).Select(x => x.CustomerId!.Value).Distinct().ToList();
        var customers = await db.Users.AsNoTracking().Where(u => customerIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, ct);
        return rows.Select(o => Dto(o, o.CustomerId.HasValue ? customers.GetValueOrDefault(o.CustomerId.Value) : null)).ToList();
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
