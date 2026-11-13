/** Browser API client. Access tokens live only in memory; re-login after reload.
 * Never put a JWT signing key in NEXT_PUBLIC_ variables.
 */
export type Role = "Customer" | "Driver" | "Admin";
export type RideStatus = "Pending" | "Accepted" | "InProgress" | "Completed" | "Cancelled";
export interface User { id: string; fullName: string; email: string; phoneNumber: string; role: Role }
export interface AuthResponse { accessToken: string; expiresAt: string; user: User }
export interface RegisterRequest { fullName: string; email: string; password: string; phoneNumber: string }
export interface BookRideRequest {
  pickupLocation: string; destination: string; pickupLatitude: number; pickupLongitude: number;
  destinationLatitude: number; destinationLongitude: number;
}
export interface Ride extends BookRideRequest {
  id: string; customerId: string; driverId: string | null; fare: number; pricingMode: string;
  status: RideStatus; createdAt: string; completedAt: string | null;
}
export interface Driver {
  id: string; fullName: string; vehicleType: string; vehiclePlate: string; isAvailable: boolean;
  currentLatitude: number | null; currentLongitude: number | null;
}
export interface Payment { id: string; rideId: string; amount: number; paymentMethod: string; status: string; createdAt: string }
export interface Review { id: string; rideId: string; driverId: string; rating: number; comment: string | null }
export interface ApiProblem { title?: string; detail?: string; errors?: Record<string, string[]>; traceId?: string }
export class ApiError extends Error {
  constructor(public status: number, public problem: ApiProblem) {
    super(problem.detail ?? (Object.values(problem.errors ?? {}).flat().join(" ") || problem.title || `Request failed (${status})`));
  }
}
export function createApiClient(baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000") {
  let session: AuthResponse | null = null;
  async function request<T>(path: string, method = "GET", body?: unknown, signal?: AbortSignal): Promise<T> {
    if (session && Date.parse(session.expiresAt) <= Date.now()) session = null;
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
      method, signal, cache: "no-store", credentials: "omit",
      headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      if (response.status === 401) session = null;
      const problem = await response.json().catch(() => ({ title: response.statusText })) as ApiProblem;
      throw new ApiError(response.status, problem);
    }
    return response.json() as Promise<T>;
  }
  async function authenticate(path: string, body: unknown) {
    session = await request<AuthResponse>(path, "POST", body);
    return session.user;
  }
  return {
    register: (body: RegisterRequest) => authenticate("/api/auth/register", body),
    login: (email: string, password: string) => authenticate("/api/auth/login", { email, password }),
    logout: () => { session = null; },
    me: (signal?: AbortSignal) => request<User>("/api/auth/me", "GET", undefined, signal),
    rides: (page = 1, signal?: AbortSignal) => request<Ride[]>(`/api/rides?page=${page}`, "GET", undefined, signal),
    myRides: (page = 1, signal?: AbortSignal) => request<Ride[]>(`/api/rides/mine?page=${page}`, "GET", undefined, signal),
    ride: (id: string) => request<Ride>(`/api/rides/${encodeURIComponent(id)}`),
    bookRide: (body: BookRideRequest) => request<Ride>("/api/rides", "POST", body),
    updateRideStatus: (id: string, status: RideStatus) => request<Ride>(`/api/rides/${encodeURIComponent(id)}/status`, "PATCH", { status }),
    availableDrivers: () => request<Driver[]>("/api/drivers/available"),
    createDriver: (body: { userId: string; vehicleType: string; vehiclePlate: string }) => request<Driver>("/api/drivers", "POST", body),
    simulatePayment: (rideId: string) => request<Payment>("/api/payments", "POST", { rideId }),
    myPayments: (page = 1) => request<Payment[]>(`/api/payments/mine?page=${page}`),
    reviewRide: (rideId: string, rating: number, comment?: string) => request<Review>("/api/reviews", "POST", { rideId, rating, comment }),
    driverReviews: (id: string, page = 1) => request<Review[]>(`/api/drivers/${encodeURIComponent(id)}/reviews?page=${page}`),
  };
}
