using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using Grab.Api.Models;

namespace Grab.Api.DTOs;

public record SaveCategoryRequest(
    [property: JsonRequired] [EnumDataType(typeof(MerchantServiceKind))] MerchantServiceKind Service,
    [Required, StringLength(100, MinimumLength = 2)] string Name,
    [StringLength(100)] string? KhmerName, Guid? ParentId,
    [Range(0, 999)] int SortOrder,
    [Required, StringLength(300, MinimumLength = 3)] string Reason);

public record CategoryDto(Guid Id, MerchantServiceKind Service, string Name, string? KhmerName,
    Guid? ParentId, int SortOrder, int ProductCount = 0, int SubcategoryCount = 0);
