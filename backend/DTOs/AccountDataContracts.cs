using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Grab.Api.DTOs;

public record AccountDataDto(long Version, Dictionary<string, JsonElement> Data);
public record SaveAccountDataRequest(
    [property: JsonRequired] [Range(0, long.MaxValue)] long Version,
    [Required] Dictionary<string, JsonElement> Data);
public record StoreReviewDto(string Id, string StoreId, string Name, int Rating, string Comment, string CreatedAt);
