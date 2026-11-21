using System.ComponentModel.DataAnnotations;

namespace Grab.Api.DTOs;

/// <summary>Multipart form fields for creating or editing a homepage banner. The image travels as the "image" file part.</summary>
public class AdminBannerForm
{
    [StringLength(80)] public string? Title { get; set; }
    [StringLength(160)] public string? Subtitle { get; set; }
    [StringLength(300)] public string? LinkUrl { get; set; }
    [Range(0, 999)] public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    [Required, StringLength(300, MinimumLength = 3)] public string Reason { get; set; } = "";
}

public record AdminBannerDto(Guid Id, string ImageUrl, string Title, string Subtitle, string LinkUrl,
    int SortOrder, bool IsActive, DateTimeOffset UpdatedAt);
