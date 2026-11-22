namespace Grab.Api.Models;

/// <summary>
/// Order lifecycle for products published by GrabFood/GrabExpress merchants.
/// Pending → Accepted → OnTheWay → Delivered. A merchant may reject (cancel) the
/// order any time before delivery; a customer may cancel only while it is still Pending.
/// </summary>
public enum MerchantOrderStatus { Pending, Accepted, OnTheWay, Delivered, Rejected, Cancelled }

/// <summary>Payments are simulated; no money is taken.</summary>
public enum OrderPaymentMethod { Cash, Card }

public class MerchantOrder
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? CustomerId { get; set; }
    public string? GuestName { get; set; }
    public string? GuestPhone { get; set; }
    public string? GuestTokenHash { get; set; }
    public Guid MerchantId { get; set; }
    public Merchant Merchant { get; set; } = null!;
    public MerchantOrderStatus Status { get; set; } = MerchantOrderStatus.Pending;
    public OrderPaymentMethod PaymentMethod { get; set; }
    public string DeliveryAddress { get; set; } = "";
    public string Note { get; set; } = "";
    public decimal Subtotal { get; set; }
    public decimal Discount { get; set; }
    public decimal CodeDiscount { get; set; }
    public string? PromoCode { get; set; }
    public decimal DeliveryFee { get; set; }
    public decimal Total { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public List<MerchantOrderItem> Items { get; set; } = [];
    public byte[] Version { get; set; } = [];
}

/// <summary>Title and price are copied at checkout so later listing edits never change past orders.</summary>
public class MerchantOrderItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OrderId { get; set; }
    public Guid ListingId { get; set; }
    public string Title { get; set; } = "";
    public decimal UnitPrice { get; set; }
    public int Quantity { get; set; }
}
