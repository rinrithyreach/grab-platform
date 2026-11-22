using System.ComponentModel.DataAnnotations;

namespace Grab.Api.DTOs;

public record SavePromotionRequest(
    [Required, StringLength(100, MinimumLength = 2)] string Name,
    [StringLength(32)] string? Code,
    [Required] string Kind, decimal Value, decimal MinSubtotal, decimal? MaxDiscount,
    int BuyQuantity, int FreeQuantity,
    [StringLength(80)] string? StoreId, [StringLength(80)] string? ProductId,
    bool FirstOrderOnly, bool IsActive, DateTimeOffset? StartsAt, DateTimeOffset? EndsAt,
    [Required, StringLength(300, MinimumLength = 3)] string Reason);

public record PromotionTarget(string StoreId, string StoreName, string ProductId, string ProductName);
public record OrderQuoteRequest(Guid MerchantId, List<OrderItemRequest> Items, [StringLength(32)] string? PromoCode = null);
public record OrderQuoteDto(decimal Subtotal, decimal Discount, decimal CodeDiscount, decimal DeliveryFee,
    decimal Total, string? PromoCode, List<string> PromotionNames);
