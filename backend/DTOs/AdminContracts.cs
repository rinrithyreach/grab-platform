using System.ComponentModel.DataAnnotations;
using Grab.Api.Models;

namespace Grab.Api.DTOs;

public record AdminLoginRequest([Required, EmailAddress, StringLength(254)] string Email,
    [Required, StringLength(128)] string Password);
public record AdminUserRequest([Required, StringLength(120, MinimumLength = 2)] string FullName,
    [EnumDataType(typeof(Role))] Role Role, bool IsActive, [Required, StringLength(300, MinimumLength = 3)] string Reason);
public record AdminListingRequest([Required, StringLength(120, MinimumLength = 2)] string Title,
    [StringLength(1500)] string Description, [Range(typeof(decimal), "0.01", "999999.99")] decimal Price,
    bool IsPublished, bool ShowInSlideshow, [Required, StringLength(300, MinimumLength = 3)] string Reason, Guid? CategoryId = null);
public record AdminActionRequest([Required, StringLength(40)] string Action,
    [Required, StringLength(300, MinimumLength = 3)] string Reason);
public record AdminDriverRequest(Guid UserId, [Required, StringLength(50)] string VehicleType,
    [Required, StringLength(30)] string VehiclePlate, [Required, StringLength(300, MinimumLength = 3)] string Reason);
public record AdminMerchantRequest(MerchantProfileRequest Profile,
    [Required, StringLength(300, MinimumLength = 3)] string Reason);
public record AdminPage<T>(List<T> Items, int Total, int Page, int PageSize);
public record AdminCreateUserRequest([Required, StringLength(120, MinimumLength = 2)] string FullName,
    [Required, StringLength(30)] string PhoneNumber, [EmailAddress, StringLength(254)] string? Email,
    [Required, StringLength(128, MinimumLength = 12)] string Password, [Required, StringLength(300, MinimumLength = 3)] string Reason);
