namespace Grab.Api.Models;

public enum MerchantServiceKind { GrabRide, GrabFood, GrabExpress }

public class Merchant
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public MerchantServiceKind Service { get; set; }
    public string BusinessName { get; set; } = "";
    public string OwnerName { get; set; } = "";
    public string ContactPhone { get; set; } = "";
    public string? Email { get; set; }
    public string Address { get; set; } = "";
    public string City { get; set; } = "";
    public string Category { get; set; } = "";
    public string Description { get; set; } = "";
    public string OpeningHours { get; set; } = "";
    public string? MotorcycleLicensePlate { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class MerchantListing
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid MerchantId { get; set; }
    public Merchant Merchant { get; set; } = null!;
    public string Title { get; set; } = "";
    public string Description { get; set; } = "";
    public decimal Price { get; set; }
    public Guid ImageId { get; set; }
    public Guid? CategoryId { get; set; }
    public ProductCategory? Category { get; set; }
    public bool IsPublished { get; set; }
    public bool ShowInSlideshow { get; set; }
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class MerchantImage
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid MerchantId { get; set; }
    public string ContentType { get; set; } = "";
    public byte[] Data { get; set; } = [];
}
