using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using Grab.Api.Models;

namespace Grab.Api.DTOs;

public record OrderItemRequest(
    [property: JsonRequired] Guid ListingId,
    [property: JsonRequired] [Range(1, OrderLimits.MaxQuantity)] int Quantity);

public record PlaceOrderRequest(
    [property: JsonRequired] Guid MerchantId,
    [Required, MinLength(1), MaxLength(OrderLimits.MaxLines)] List<OrderItemRequest> Items,
    [Required, StringLength(300, MinimumLength = 5)] string DeliveryAddress,
    [StringLength(500)] string? Note,
    [property: JsonRequired] [EnumDataType(typeof(OrderPaymentMethod))] OrderPaymentMethod PaymentMethod,
    [StringLength(32)] string? PromoCode = null, [Range(0, 100000000)] decimal? ExpectedTotal = null,
    [EnumDataType(typeof(PaymentCurrency))] PaymentCurrency? Currency = null);

public record OrderStatusRequest([property: JsonRequired] [EnumDataType(typeof(MerchantOrderStatus))] MerchantOrderStatus Status);

public record GuestOrderRequest([Required] PlaceOrderRequest Order,
    [Required, StringLength(120, MinimumLength = 2)] string ContactName,
    [Required, StringLength(30)] string ContactPhone);

public record GuestOrderResponse(MerchantOrderDto Order, string AccessToken);

public record MerchantOrderItemDto(Guid ListingId, string Title, decimal UnitPrice, int Quantity, decimal LineTotal);

/// <summary>Contact details are available to the owner of the receipt and the fulfilling merchant.</summary>
public record MerchantOrderDto(Guid Id, Guid MerchantId, string MerchantName, MerchantServiceKind Service,
    MerchantOrderStatus Status, OrderPaymentMethod PaymentMethod, List<MerchantOrderItemDto> Items,
    decimal Subtotal, decimal DeliveryFee, decimal Total, string DeliveryAddress, string Note,
    DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, string? CustomerName, string? CustomerPhone,
    decimal Discount = 0, decimal CodeDiscount = 0, string? PromoCode = null,
    PaymentCurrency Currency = PaymentCurrency.USD, decimal ExchangeRate = Currencies.KhrPerUsd, long TotalKhr = 0);

public static class OrderLimits
{
    public const int MaxLines = 30;
    public const int MaxQuantity = 50;
    /// <summary>Same flat demo fee as the frontend (lib/brand.ts DELIVERY_FEE).</summary>
    public const decimal DeliveryFee = 1.50m;
}
