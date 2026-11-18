using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using Grab.Api.DTOs;
using Grab.Api.Models;

namespace Grab.Api.Tests;

public partial class ApiTests
{
    [Fact]
    public async Task Ride_vehicle_choice_persists_and_only_matching_partners_can_claim_it()
    {
        await using var f = new ApiFactory();
        await f.InitializeDatabase();
        using var customer = f.CreateClient();
        await Register(customer, f.Password);
        var clients = new List<HttpClient>();
        try
        {
            foreach (var type in Enum.GetValues<RideVehicleType>())
            {
                var merchant = f.CreateClient();
                clients.Add(merchant);
                var profile = Business(MerchantServiceKind.GrabRide) with { VehicleType = type };
                var registered = await merchant.PostAsJsonAsync("/api/merchants/register", new MerchantRegisterRequest(
                    $"+855{RandomNumberGenerator.GetInt32(20000000, 99999999)}", f.Password, profile), Json);
                Assert.Equal(HttpStatusCode.Created, registered.StatusCode);
                SignIn(merchant, await Read<AuthResponse>(registered));
                Assert.Equal(type, (await Read<MerchantDashboardDto>(await merchant.GetAsync("/api/merchants/me"))).Profile.VehicleType);
            }

            var areas = await Read<List<RideMerchantAreaDto>>(await customer.GetAsync("/api/merchants/ride-areas"));
            Assert.Equal(3, areas.Count);
            Assert.Equal(3, areas.Select(x => x.VehicleType).Distinct().Count());

            foreach (var type in Enum.GetValues<RideVehicleType>())
            {
                var booked = await customer.PostAsJsonAsync("/api/rides", Booking() with { VehicleType = type }, Json);
                Assert.Equal(HttpStatusCode.Created, booked.StatusCode);
                var ride = await Read<RideDto>(booked);
                Assert.Equal(type, ride.VehicleType);
                for (var index = 0; index < clients.Count; index++)
                {
                    var inbox = await Read<MerchantRideInboxDto>(await clients[index].GetAsync("/api/merchants/ride-requests"));
                    Assert.Equal(index == (int)type, inbox.Requests.Any(x => x.Ride.Id == ride.Id));
                }
                var wrong = clients[((int)type + 1) % clients.Count];
                Assert.Equal(HttpStatusCode.Forbidden,
                    (await wrong.PostAsJsonAsync($"/api/merchants/ride-requests/{ride.Id}/response", new { accept = true })).StatusCode);
                var matching = clients[(int)type];
                Assert.Equal(HttpStatusCode.OK,
                    (await matching.PostAsJsonAsync($"/api/merchants/ride-requests/{ride.Id}/response", new { accept = true })).StatusCode);
                Assert.Equal(type, (await Read<RideDto>(await customer.GetAsync($"/api/rides/{ride.Id}"))).VehicleType);
            }
        }
        finally { foreach (var client in clients) client.Dispose(); }
    }
}
