namespace Grab.Api.Models;

public class PlatformSettings
{
    public int Id { get; set; } = 1;
    public string SupportEmail { get; set; } = "";
    public string SupportPhone { get; set; } = "";
    public string SupportHours { get; set; } = "";
    public string OfficeAddress { get; set; } = "";
    public bool AnnouncementEnabled { get; set; }
    public string Announcement { get; set; } = "";
    public bool MaintenanceMode { get; set; }
    public string MaintenanceMessage { get; set; } = "New bookings are temporarily paused. Please try again soon.";
    public bool RidesEnabled { get; set; } = true;
    public bool FoodEnabled { get; set; } = true;
    public bool ExpressEnabled { get; set; } = true;
    public bool CustomerRegistrationEnabled { get; set; } = true;
    public bool MerchantRegistrationEnabled { get; set; } = true;
    public DateTimeOffset? UpdatedAt { get; set; }
    public Guid? UpdatedBy { get; set; }
    public byte[] Version { get; set; } = [];
}

/// <summary>A named set of console permissions. Administrators without a role are Super administrators.</summary>
public class AdminRole
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    /// <summary>Space-separated permission codes from <c>AdminPermissions</c>, e.g. "orders.view orders.manage".</summary>
    public string Permissions { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public byte[] Version { get; set; } = [];
}

public class AdminProfile
{
    public Guid UserId { get; set; }
    /// <summary>Null means Super administrator (every permission).</summary>
    public Guid? AdminRoleId { get; set; }
    public string ContactPhone { get; set; } = "";
    public string JobTitle { get; set; } = "";
    public string Bio { get; set; } = "";
    public byte[]? AvatarData { get; set; }
    public string? AvatarContentType { get; set; }
    public int RefreshSeconds { get; set; } = 30;
    public bool CompactTables { get; set; }
    public DateTimeOffset? PasswordChangedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public byte[] Version { get; set; } = [];
}
