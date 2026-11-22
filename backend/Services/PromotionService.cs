using System.Text.RegularExpressions;
using Grab.Api.Data;
using Grab.Api.DTOs;
using Grab.Api.Middleware;
using Grab.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Grab.Api.Services;

public class PromotionService(GrabDbContext db)
{
    public Task<List<Promotion>> List(CancellationToken ct) => db.Promotions.AsNoTracking().OrderBy(x => x.Name).ThenBy(x => x.Id).ToListAsync(ct);

    public async Task<List<PromotionTarget>> Targets(CancellationToken ct) => await db.MerchantListings.AsNoTracking()
        .Where(x => x.Merchant.Service != MerchantServiceKind.GrabRide)
        .OrderBy(x => x.Merchant.BusinessName).ThenBy(x => x.Title)
        .Select(x => new PromotionTarget(x.MerchantId.ToString().ToLower(), x.Merchant.BusinessName, x.Id.ToString().ToLower(), x.Title)).ToListAsync(ct);

    private static string? Target(string? value)
    {
        var text = value?.Trim();
        if (string.IsNullOrEmpty(text)) return null;
        if (!Regex.IsMatch(text, "^[a-zA-Z0-9-]{1,80}$")) throw new ApiException(400, "Choose a valid store or product.");
        return Guid.TryParse(text, out var id) ? id.ToString() : text;
    }

    public async Task<Guid> Save(Guid actorId, Guid? id, SavePromotionRequest r, CancellationToken ct)
    {
        var name = r.Name?.Trim() ?? "";
        if (name.Length is < 2 or > 100 || name.Any(char.IsControl)) throw new ApiException(400, "Enter a promotion name of 2-100 characters.");
        var code = string.IsNullOrWhiteSpace(r.Code) ? null : r.Code.Trim().ToUpperInvariant();
        if (code is not null && !Regex.IsMatch(code, "^[A-Z0-9][A-Z0-9_-]{1,31}$")) throw new ApiException(400, "Codes need 2-32 letters, numbers, underscores or hyphens.");
        if (code is not null && await db.Promotions.AnyAsync(x => x.Code == code && x.Id != id, ct)) throw new ApiException(409, "This promo code already exists.");
        if (r.Kind is not ("amount" or "percent" or "freeDelivery" or "buyGetFree")) throw new ApiException(400, "Choose a valid discount type.");
        if (r.Value < 0 || r.Value > 100000 || (r.Kind is "amount" or "percent" && r.Value <= 0) || (r.Kind == "percent" && r.Value > 100)
            || r.MinSubtotal < 0 || r.MinSubtotal > 100000 || r.MaxDiscount is <= 0 or > 100000
            || decimal.Round(r.Value, 2) != r.Value || decimal.Round(r.MinSubtotal, 2) != r.MinSubtotal
            || (r.MaxDiscount.HasValue && decimal.Round(r.MaxDiscount.Value, 2) != r.MaxDiscount.Value))
            throw new ApiException(400, "Enter valid discount amounts with at most two decimal places. Percentages cannot exceed 100.");
        if (r.BuyQuantity is < 1 or > 50 || r.FreeQuantity is < 1 or > 50) throw new ApiException(400, "Buy and free quantities must be between 1 and 50.");
        if (r.StartsAt.HasValue && r.EndsAt.HasValue && r.EndsAt <= r.StartsAt) throw new ApiException(400, "The end date must be after the start date.");
        var store = Target(r.StoreId); var product = Target(r.ProductId);
        if (product is not null && store is null) throw new ApiException(400, "Choose the product's store.");
        if (Guid.TryParse(store, out var storeGuid) && !await db.Merchants.AnyAsync(x => x.Id == storeGuid && x.Service != MerchantServiceKind.GrabRide, ct))
            throw new ApiException(400, "This store is unavailable.");
        if (Guid.TryParse(product, out var productGuid) && !await db.MerchantListings.AnyAsync(x => x.Id == productGuid && x.MerchantId.ToString() == store, ct))
            throw new ApiException(400, "This product does not belong to the selected store.");
        var row = id.HasValue ? await db.Promotions.SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw new ApiException(404, "Promotion not found.") : new Promotion();
        row.Name = name; row.Code = code; row.Kind = r.Kind; row.Value = r.Kind is "freeDelivery" or "buyGetFree" ? 0 : r.Value;
        row.MinSubtotal = r.MinSubtotal; row.MaxDiscount = r.MaxDiscount; row.BuyQuantity = r.BuyQuantity; row.FreeQuantity = r.FreeQuantity;
        row.StoreId = store; row.ProductId = product; row.FirstOrderOnly = r.FirstOrderOnly; row.IsActive = r.IsActive;
        row.StartsAt = r.StartsAt; row.EndsAt = r.EndsAt; row.UpdatedAt = DateTimeOffset.UtcNow;
        if (!id.HasValue) db.Promotions.Add(row);
        await Audit(actorId, row.Id, $"{(id.HasValue ? "Updated" : "Created")} promotion {name}", r.Reason, ct);
        return row.Id;
    }

    public async Task Delete(Guid actorId, Guid id, string? reason, CancellationToken ct)
    {
        var row = await db.Promotions.SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw new ApiException(404, "Promotion not found.");
        db.Promotions.Remove(row);
        await Audit(actorId, id, $"Deleted promotion {row.Name}", reason, ct);
    }

    private async Task Audit(Guid actorId, Guid targetId, string action, string? reason, CancellationToken ct)
    {
        var why = reason?.Trim() ?? "";
        if (why.Length is < 3 or > 300 || why.Any(char.IsControl)) throw new ApiException(400, "Enter a reason of 3-300 characters.");
        var actor = await db.Users.AsNoTracking().SingleAsync(x => x.Id == actorId, ct);
        db.AdminAudits.Add(new AdminAudit { ActorId = actorId, ActorName = actor.FullName, Resource = "promotions", TargetId = targetId,
            Action = action.Length > 100 ? action[..100] : action, Reason = why });
        await db.SaveChangesAsync(ct);
    }

    public record Line(string ProductId, decimal Price, int Quantity);
    private static decimal Round(decimal n) => decimal.Round(n, 2, MidpointRounding.AwayFromZero);

    public async Task<OrderQuoteDto> Calculate(Guid? customerId, string storeId, List<Line> lines, string? rawCode, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var rules = await db.Promotions.AsNoTracking().Where(x => x.IsActive
            && (x.StartsAt == null || x.StartsAt <= now) && (x.EndsAt == null || x.EndsAt > now)
            && (x.StoreId == null || x.StoreId == storeId)).OrderBy(x => x.Id).ToListAsync(ct);
        var first = customerId.HasValue && !await db.MerchantOrders.AnyAsync(x => x.CustomerId == customerId && x.Status != MerchantOrderStatus.Cancelled && x.Status != MerchantOrderStatus.Rejected, ct);
        var subtotal = lines.Sum(x => x.Price * x.Quantity);
        bool Eligible(Promotion p) => (!p.FirstOrderOnly || first) && subtotal >= p.MinSubtotal && lines.Any(x => p.ProductId == null || p.ProductId == x.ProductId);
        decimal Amount(Promotion p, decimal remaining, decimal reduction = 0)
        {
            var eligible = lines.Where(x => p.ProductId == null || p.ProductId == x.ProductId).ToList();
            var basis = Round(Math.Max(0, Math.Min(remaining, eligible.Sum(x => x.Price * x.Quantity) - reduction)));
            var amount = p.Kind switch {
                "amount" => p.Value,
                "percent" => Round(basis * p.Value / 100),
                "buyGetFree" => eligible.GroupBy(x => x.ProductId).Sum(g => (g.Sum(x => x.Quantity) / (p.BuyQuantity + p.FreeQuantity)) * p.FreeQuantity * g.Min(x => x.Price)),
                _ => 0,
            };
            return Round(Math.Min(basis, Math.Min(amount, p.MaxDiscount ?? decimal.MaxValue)));
        }
        // The best automatic product discount applies; automatic free delivery can accompany it.
        var automatic = rules.Where(x => x.Code == null && Eligible(x)).ToList();
        var best = automatic.OrderByDescending(x => Amount(x, subtotal)).FirstOrDefault();
        var discount = best is null ? 0 : Amount(best, subtotal);
        var shipping = automatic.FirstOrDefault(x => x.Kind == "freeDelivery");
        var fee = shipping is null ? OrderLimits.DeliveryFee : 0;
        var names = new List<string>();
        if (discount > 0) names.Add(best!.Name);
        if (shipping is not null) names.Add(shipping.Name);
        var code = string.IsNullOrWhiteSpace(rawCode) ? null : rawCode.Trim().ToUpperInvariant();
        decimal codeDiscount = 0;
        if (code is not null)
        {
            var promo = rules.SingleOrDefault(x => x.Code == code);
            if (promo is null) throw new ApiException(400, "This promo code is invalid, paused or expired.");
            if (!Eligible(promo)) throw new ApiException(400, $"This code is not eligible for these products, your order history or the minimum spend of ${promo.MinSubtotal:0.00}.");
            var automaticBasis = best is null ? 0 : lines.Where(x => best.ProductId == null || best.ProductId == x.ProductId).Sum(x => x.Price * x.Quantity);
            var overlap = best is null ? 0 : lines.Where(x => (best.ProductId == null || best.ProductId == x.ProductId) && (promo.ProductId == null || promo.ProductId == x.ProductId)).Sum(x => x.Price * x.Quantity);
            codeDiscount = Amount(promo, subtotal - discount, automaticBasis > 0 ? discount * overlap / automaticBasis : 0);
            if (promo.Kind == "freeDelivery") fee = 0;
            names.Add(promo.Name);
        }
        return new(subtotal, discount, codeDiscount, fee, Round(subtotal - discount - codeDiscount + fee), code, names);
    }
}
