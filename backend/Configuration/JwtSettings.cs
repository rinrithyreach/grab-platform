namespace Grab.Api.Configuration;
public class JwtSettings
{
    public string Issuer { get; set; } = "GrabPlatform";
    public string Audience { get; set; } = "GrabFrontend";
    public string SigningKey { get; set; } = "";
    public int ExpiryMinutes { get; set; } = 30;
}
