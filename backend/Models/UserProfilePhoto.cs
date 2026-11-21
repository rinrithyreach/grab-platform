namespace Grab.Api.Models;

/// <summary>Private account photo, loaded only when returning the owner's profile.</summary>
public class UserProfilePhoto
{
    public Guid UserId { get; set; }
    public byte[] Data { get; set; } = [];
    public string ContentType { get; set; } = "";
}
