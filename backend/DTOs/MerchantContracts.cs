using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using Grab.Api.Models;

namespace Grab.Api.DTOs;

public record MerchantProfileRequest(
    [property: JsonRequired] [EnumDataType(typeof(MerchantServiceKind))] MerchantServiceKind Service,
    [StringLength(120)] string? BusinessName,
    [Required, StringLength(120, MinimumLength = 2)] string OwnerName,
    [StringLength(30)] string? ContactPhone,
    [EmailAddress, StringLength(254)] string? Email,
    [Required, StringLength(300, MinimumLength = 2)] string Address,
    [StringLength(100)] string? City,
    [StringLength(100)] string? Category,
    [StringLength(1500)] string? Description,
    [StringLength(200)] string? OpeningHours,
    [StringLength(30)] string? MotorcycleLicensePlate = null);

public record MerchantRegisterRequest(
    [Required, StringLength(30)] string PhoneNumber,
    [Required, StringLength(128, MinimumLength = 12)] string Password,
    [Required] MerchantProfileRequest Profile);

public record MerchantListingRequest(
    [Required, StringLength(120, MinimumLength = 2)] string Title,
    [Required, StringLength(1500, MinimumLength = 10)] string Description,
    [property: JsonRequired] [Range(typeof(decimal), "0.01", "999999.99")] decimal Price,
    [property: JsonRequired] Guid ImageId,
    bool IsPublished, bool ShowInSlideshow);

// Public names use BusinessName (the rider's name for GrabRide). License plates stay private.
public record MerchantPublicDto(Guid Id, MerchantServiceKind Service, string BusinessName,
    string ContactPhone, string? Email, string Address, string City, string Category,
    string Description, string OpeningHours);
public record MerchantProfileDto(Guid Id, MerchantServiceKind Service, string BusinessName,
    string OwnerName, string ContactPhone, string? Email, string Address, string City,
    string Category, string Description, string OpeningHours, string? MotorcycleLicensePlate);
public record MerchantListingDto(Guid Id, string Title, string Description, decimal Price,
    Guid ImageId, string ImageUrl, bool IsPublished, bool ShowInSlideshow, DateTimeOffset UpdatedAt);
public record MerchantOfferDto(Guid Id, string Title, string Description, decimal Price,
    string ImageUrl, MerchantPublicDto Merchant);
public record MerchantStorefrontDto(MerchantPublicDto Merchant, List<MerchantOfferDto> Listings);
public record MerchantDashboardDto(MerchantProfileDto Profile, List<MerchantListingDto> Listings);
public record MerchantImageDto(Guid Id, string ImageUrl);
public record BannerDto(Guid Id, string ImageUrl, string Title, string Subtitle, string LinkUrl);
