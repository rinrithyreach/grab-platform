namespace Grab.Api.Models;

// Persists the existing demo features together so wallet/order edits save atomically.
// Live rides, authentication and merchant publishing keep their dedicated tables.
public class AccountData
{
    public Guid UserId { get; set; }
    public string Json { get; set; } = "{}";
    public long Version { get; set; }
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class SharedStorageIdentity
{
    public int Id { get; set; }
    public Guid StorageId { get; set; }
}
