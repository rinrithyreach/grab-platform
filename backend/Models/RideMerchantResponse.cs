namespace Grab.Api.Models;

public class RideMerchantResponse
{
    public Guid RideId { get; set; }
    public Guid MerchantId { get; set; }
    public bool Accepted { get; set; }
    public bool IsActive { get; set; }
    public DateTimeOffset RespondedAt { get; set; } = DateTimeOffset.UtcNow;
}
