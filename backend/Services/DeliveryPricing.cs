using Grab.Api.DTOs;
using Grab.Api.Middleware;
using Grab.Api.Models;

namespace Grab.Api.Services;

/// <summary>Server-owned USD demo tariff. Road routing and wallet settlement are later phases.</summary>
public static class DeliveryPricing
{
    private static decimal Money(decimal value) => decimal.Round(value, 2, MidpointRounding.AwayFromZero);

    private static string Text(string? value, int min, int max, string field)
    {
        var text = value?.Trim() ?? "";
        if (text.Length < min || text.Length > max || text.Any(char.IsControl))
            throw new ApiException(400, $"{field} must contain {min}–{max} characters without control characters.");
        return text;
    }

    private static void Coordinates(double latitude, double longitude)
    {
        if (!double.IsFinite(latitude) || latitude is < -90 or > 90
            || !double.IsFinite(longitude) || longitude is < -180 or > 180)
            throw new ApiException(400, "Valid latitude and longitude are required for every stop.");
    }

    private static double Kilometres(double lat1, double lon1, double lat2, double lon2)
    {
        const double radius = 6371.0088;
        var dLat = (lat2 - lat1) * Math.PI / 180;
        var dLon = (lon2 - lon1) * Math.PI / 180;
        var a = Math.Pow(Math.Sin(dLat / 2), 2)
            + Math.Cos(lat1 * Math.PI / 180) * Math.Cos(lat2 * Math.PI / 180) * Math.Pow(Math.Sin(dLon / 2), 2);
        return radius * 2 * Math.Asin(Math.Min(1, Math.Sqrt(a)));
    }

    public static DeliveryQuoteDto Quote(DeliveryRequest request, DateTimeOffset now, bool booking = false)
    {
        if (!Enum.IsDefined(request.ServiceType) || !Enum.IsDefined(request.VehicleType)
            || !Enum.IsDefined(request.PaymentMethod) || !Enum.IsDefined(request.InsuranceTier))
            throw new ApiException(400, "Choose valid delivery, vehicle, payment and guarantee options.");
        if (request.Stops is not { Count: >= 1 and <= 5 })
            throw new ApiException(400, "Choose between one and five drop-off stops.");
        if (request.ServiceType == DeliveryServiceType.SameDay && request.VehicleType != DeliveryVehicleType.Motorcycle)
            throw new ApiException(400, "Same-day delivery uses a motorcycle.");
        if (request.ServiceType == DeliveryServiceType.Scheduled)
        {
            if (request.ScheduledPickupAt is not DateTimeOffset pickup
                || pickup < now.AddMinutes(30) || pickup > now.AddDays(7))
                throw new ApiException(400, "Scheduled pickup must be 30 minutes to seven days ahead.");
        }
        else if (request.ScheduledPickupAt is not null)
            throw new ApiException(400, "Pickup time applies only to scheduled delivery.");

        Text(request.PickupAddress, 5, 300, "Pickup address");
        Coordinates(request.PickupLatitude, request.PickupLongitude);
        if (booking)
        {
            Text(request.PickupName, 2, 120, "Pickup contact name");
            if (PhoneNumbers.Normalize(request.PickupPhone) is null)
                throw new ApiException(400, "Enter a valid pickup contact phone number.");
            if (!request.ProhibitedItemsAcknowledged)
                throw new ApiException(400, "Acknowledge the prohibited-items rule before booking.");
        }

        var previousLatitude = request.PickupLatitude;
        var previousLongitude = request.PickupLongitude;
        double distanceKm = 0;
        decimal sizeFare = 0;
        decimal codAmount = 0;
        var codStops = 0;
        foreach (var stop in request.Stops)
        {
            if (stop is null) throw new ApiException(400, "Each drop-off stop is required.");
            Text(stop.Address, 5, 300, "Drop-off address");
            Coordinates(stop.Latitude, stop.Longitude);
            if (stop.Latitude == previousLatitude && stop.Longitude == previousLongitude)
                throw new ApiException(400, "Consecutive pickup and drop-off locations must differ.");
            if (!Enum.IsDefined(stop.ParcelSize)) throw new ApiException(400, "Choose a valid parcel size.");
            var sizeLimit = stop.ParcelSize switch
            {
                DeliveryParcelSize.Documents => 0.5m,
                DeliveryParcelSize.Small => 3m,
                DeliveryParcelSize.Medium => 10m,
                _ => 50m,
            };
            var vehicleLimit = request.VehicleType switch
            {
                DeliveryVehicleType.Motorcycle => 10m,
                DeliveryVehicleType.Rickshaw => 30m,
                _ => 50m,
            };
            if (stop.WeightKg < 0.01m || stop.WeightKg != Money(stop.WeightKg)
                || stop.WeightKg > sizeLimit || stop.WeightKg > vehicleLimit
                || request.VehicleType == DeliveryVehicleType.Motorcycle && stop.ParcelSize == DeliveryParcelSize.Large)
                throw new ApiException(400, "Parcel size or weight exceeds this vehicle's capacity.");
            if (stop.CodAmount is < 0 or > 200 || stop.CodAmount != Money(stop.CodAmount))
                throw new ApiException(400, "Cash on delivery must be between $0 and $200 per recipient.");
            if (booking)
            {
                Text(stop.RecipientName, 2, 120, "Recipient name");
                Text(stop.Description, 3, 300, "Parcel description");
                if (PhoneNumbers.Normalize(stop.RecipientPhone) is null)
                    throw new ApiException(400, "Enter a valid recipient phone number.");
            }
            distanceKm += Kilometres(previousLatitude, previousLongitude, stop.Latitude, stop.Longitude);
            previousLatitude = stop.Latitude;
            previousLongitude = stop.Longitude;
            sizeFare += stop.ParcelSize switch
            {
                DeliveryParcelSize.Documents => 0m,
                DeliveryParcelSize.Small => 0.50m,
                DeliveryParcelSize.Medium => 1.50m,
                _ => 3m,
            };
            codAmount += stop.CodAmount;
            if (stop.CodAmount > 0) codStops++;
        }

        var (baseFare, perKm) = request.ServiceType switch
        {
            DeliveryServiceType.SameDay => (1.00m, 0.30m),
            DeliveryServiceType.Scheduled => (1.50m, 0.40m),
            _ => (1.50m, 0.45m),
        };
        var distanceFare = Money((decimal)distanceKm * perKm);
        var vehicleFare = request.VehicleType switch
        {
            DeliveryVehicleType.Rickshaw => 1.25m,
            DeliveryVehicleType.Car => 2.50m,
            _ => 0m,
        };
        var extraStopFare = (request.Stops.Count - 1) * 0.50m;
        var insuranceFare = request.InsuranceTier switch
        {
            DeliveryInsuranceTier.Standard => 0.20m,
            DeliveryInsuranceTier.Premium => 0.35m,
            _ => 0m,
        };
        var codFee = codStops * 0.25m;
        var total = baseFare + distanceFare + vehicleFare + sizeFare + extraStopFare + insuranceFare + codFee;
        var eta = request.ServiceType == DeliveryServiceType.SameDay ? 240
            : Math.Max(20, (int)Math.Ceiling(distanceKm / 20 * 60) + 15);
        return new(request.ServiceType, request.VehicleType, request.InsuranceTier,
            Math.Round(distanceKm, 3), baseFare, distanceFare, vehicleFare, sizeFare,
            extraStopFare, insuranceFare, codFee, total, codAmount,
            eta, "DemoStraightLineUsd", now, now.AddMinutes(5));
    }
}
