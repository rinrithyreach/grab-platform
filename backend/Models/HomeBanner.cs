namespace Grab.Api.Models;

/// <summary>A homepage hero slide uploaded by an administrator. Shown before merchant-featured listings.</summary>
public class HomeBanner
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Title { get; set; } = "";
    public string Subtitle { get; set; } = "";
    /// <summary>Empty, a site path such as "/food", or an absolute http(s) URL.</summary>
    public string LinkUrl { get; set; } = "";
    /// <summary>Lower numbers are shown first.</summary>
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public byte[] ImageData { get; set; } = [];
    public string ContentType { get; set; } = "";
    /// <summary>Changes whenever the image is replaced, so the public image URL can be cached forever.</summary>
    public Guid ImageVersion { get; set; } = Guid.NewGuid();
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
