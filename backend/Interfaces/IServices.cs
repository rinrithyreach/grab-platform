using Grab.Api.DTOs;
using Grab.Api.Models;
namespace Grab.Api.Interfaces;
public interface IAuthService
{
    Task<AuthResponse> Register(RegisterRequest request, CancellationToken ct);
    Task<AuthResponse> Login(LoginRequest request, CancellationToken ct);
    Task<UserDto> Me(Guid userId, CancellationToken ct);
}
public interface IRideService
{
    Task<RideDto> Book(Guid customerId, BookRideRequest request, CancellationToken ct);
    Task<List<RideDto>> List(Guid userId, Role role, bool mine, int page, CancellationToken ct);
    Task<RideDto> Get(Guid userId, Role role, Guid id, CancellationToken ct);
    Task<RideDto> Transition(Guid userId, Role role, Guid id, RideStatus status, CancellationToken ct);
}
public interface IDriverService
{
    Task<List<DriverDto>> Available(CancellationToken ct);
    Task<DriverDto> Create(DriverRequest request, CancellationToken ct);
}
public interface ICommerceService
{
    Task<PaymentDto> Pay(Guid userId, Guid rideId, CancellationToken ct);
    Task<List<PaymentDto>> Payments(Guid userId, int page, CancellationToken ct);
    Task<ReviewDto> Review(Guid userId, ReviewRequest request, CancellationToken ct);
    Task<List<ReviewDto>> Reviews(Guid driverId, int page, CancellationToken ct);
}
