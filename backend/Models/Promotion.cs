namespace Grab.Api.Models;

public class Promotion
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = "";
    public string? Code { get; set; }
    public string Kind { get; set; } = "percent";
    public decimal Value { get; set; }
    public decimal MinSubtotal { get; set; }
    public decimal? MaxDiscount { get; set; }
    public int BuyQuantity { get; set; } = 2;
    public int FreeQuantity { get; set; } = 1;
    // Demo catalog slugs and merchant/listing GUIDs share the same targeting fields.
    public string? StoreId { get; set; }
    public string? ProductId { get; set; }
    public bool FirstOrderOnly { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTimeOffset? StartsAt { get; set; }
    public DateTimeOffset? EndsAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
