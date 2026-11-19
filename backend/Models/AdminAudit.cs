namespace Grab.Api.Models;

public class AdminAudit
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ActorId { get; set; }
    public string ActorName { get; set; } = "";
    public string Resource { get; set; } = "";
    public Guid TargetId { get; set; }
    public string Action { get; set; } = "";
    public string Reason { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
