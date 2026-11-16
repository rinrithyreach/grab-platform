using System.Text.RegularExpressions;

namespace Grab.Api.Services;

public static partial class PhoneNumbers
{
    /// <summary>Accept Cambodian local numbers or explicit international numbers; store one +country-code form.</summary>
    public static string? Normalize(string? input)
    {
        if (string.IsNullOrWhiteSpace(input) || input.Length > 30) return null;
        var phone = Formatting().Replace(input.Trim(), "");
        if (phone.StartsWith("00", StringComparison.Ordinal)) phone = "+" + phone[2..];
        else if (phone.StartsWith('0')) phone = "+855" + phone[1..];
        else if (LocalWithoutPrefix().IsMatch(phone)) phone = "+855" + phone;
        else if (phone.StartsWith("855", StringComparison.Ordinal)) phone = "+" + phone;
        if (!International().IsMatch(phone)) return null;
        if (phone.StartsWith("+855", StringComparison.Ordinal) && !Cambodian().IsMatch(phone)) return null;
        return phone;
    }

    [GeneratedRegex(@"[\s().-]")]
    private static partial Regex Formatting();
    [GeneratedRegex(@"^\+[1-9][0-9]{7,14}$")]
    private static partial Regex International();
    [GeneratedRegex(@"^\+855[1-9][0-9]{6,8}$")]
    private static partial Regex Cambodian();
    [GeneratedRegex(@"^[1-9][0-9]{6,8}$")]
    private static partial Regex LocalWithoutPrefix();
}
