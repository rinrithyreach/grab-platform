using System.ComponentModel.DataAnnotations;

namespace Grab.Api.DTOs;

public record PlatformSettingsDto(string SupportEmail, string SupportPhone, string SupportHours, string OfficeAddress,
    bool AnnouncementEnabled, string Announcement, bool MaintenanceMode, string MaintenanceMessage,
    bool RidesEnabled, bool FoodEnabled, bool ExpressEnabled, bool CustomerRegistrationEnabled,
    bool MerchantRegistrationEnabled, DateTimeOffset? UpdatedAt, string Version);

public record SavePlatformSettingsRequest(
    [StringLength(254)] string? SupportEmail, [StringLength(30)] string? SupportPhone,
    [StringLength(120)] string? SupportHours, [StringLength(300)] string? OfficeAddress,
    bool AnnouncementEnabled, [StringLength(300)] string? Announcement,
    bool MaintenanceMode, [StringLength(300)] string? MaintenanceMessage,
    bool RidesEnabled, bool FoodEnabled, bool ExpressEnabled, bool CustomerRegistrationEnabled, bool MerchantRegistrationEnabled,
    [StringLength(32)] string Version, [Required, StringLength(300, MinimumLength = 3)] string Reason);

public record AdminProfileDto(Guid Id, string FullName, string? Email, string ContactPhone, string JobTitle, string Bio,
    string? AvatarUrl, int RefreshSeconds, bool CompactTables, DateTimeOffset CreatedAt, DateTimeOffset? LastLoginAt,
    DateTimeOffset? PasswordChangedAt, string Version, Guid? RoleId = null, string RoleName = "Super administrator",
    bool IsSuperAdmin = true, IReadOnlyList<string>? Permissions = null);
public record SaveAdminProfileRequest([Required, StringLength(120, MinimumLength = 2)] string FullName,
    [Required, EmailAddress, StringLength(254)] string Email, [StringLength(30)] string? ContactPhone,
    [StringLength(100)] string? JobTitle, [StringLength(500)] string? Bio,
    int RefreshSeconds, bool CompactTables, [StringLength(32)] string Version, [StringLength(128)] string? CurrentPassword);
public record AdminProfileResponse(AdminProfileDto Profile, AuthResponse Session);
public record AdminPasswordRequest([Required, StringLength(128)] string CurrentPassword,
    [Required, StringLength(128, MinimumLength = 12)] string NewPassword,
    [Required, StringLength(128)] string ConfirmPassword);

public record AdminTeamMemberDto(Guid Id, string FullName, string? Email, string JobTitle, string ContactPhone, string Bio,
    string? AvatarUrl, bool IsActive, bool IsYou, DateTimeOffset CreatedAt, DateTimeOffset? LastLoginAt,
    DateTimeOffset? PasswordChangedAt, DateTimeOffset? LastActivityAt, int ChangesLast30Days, Guid? RoleId, string RoleName);
public record CreateAdminRequest([Required, StringLength(120, MinimumLength = 2)] string FullName,
    [Required, EmailAddress, StringLength(254)] string Email, [StringLength(100)] string? JobTitle,
    [Required, StringLength(128, MinimumLength = 12)] string TemporaryPassword,
    [Required, StringLength(300, MinimumLength = 3)] string Reason, Guid? AdminRoleId = null);
public record AdminTeamStatusRequest(bool IsActive, [Required, StringLength(300, MinimumLength = 3)] string Reason);
public record AdminTeamReasonRequest([Required, StringLength(300, MinimumLength = 3)] string Reason);
public record AdminActivityDto(Guid Id, string Resource, Guid TargetId, string Action, string Reason, DateTimeOffset CreatedAt);
public record AdminTeamRoleRequest(Guid? AdminRoleId, [Required, StringLength(300, MinimumLength = 3)] string Reason);

public record AdminRoleDto(Guid Id, string Name, string Description, IReadOnlyList<string> Permissions,
    int Administrators, int ActiveAdministrators, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, string Version);
public record AdminPermissionSectionDto(string Key, string Label, string ViewDescription, string? ManageDescription);
public record AdminRolesResponse(IReadOnlyList<AdminRoleDto> Roles, int SuperAdministrators, IReadOnlyList<AdminPermissionSectionDto> Catalog);
public record SaveAdminRoleRequest([Required, StringLength(60, MinimumLength = 2)] string Name, [StringLength(300)] string? Description,
    List<string> Permissions, [StringLength(32)] string? Version, [Required, StringLength(300, MinimumLength = 3)] string Reason);
