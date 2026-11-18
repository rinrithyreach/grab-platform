/** Browser API client. The client itself keeps the access token in memory; lib/auth.tsx
 * saves it to sessionStorage (cleared when the tab closes) so a page refresh keeps you logged in.
 * Never put a JWT signing key in NEXT_PUBLIC_ variables.
 */
export type Role = "Customer" | "Driver" | "Admin" | "Merchant";
export type RideStatus = "Pending" | "Accepted" | "InProgress" | "Completed" | "Cancelled";
export interface User { id: string; fullName: string; phoneNumber: string; role: Role }
export interface AuthResponse { accessToken: string; expiresAt: string; user: User }
export interface RegisterRequest { phoneNumber: string; password: string }
export interface AccountData { version: number; data: Record<string, object> }
export interface StoreReview { id: string; storeId: string; name: string; rating: number; comment: string; createdAt: string }
export type MerchantServiceKind = "GrabRide" | "GrabFood" | "GrabExpress";
export type RideVehicleType = "Motorcycle" | "Rickshaw" | "Classic";
export interface MerchantProfileRequest {
  service: MerchantServiceKind; businessName: string; ownerName: string; contactPhone: string;
  email: string | null; address: string; city: string; category: string; description: string; openingHours: string;
  motorcycleLicensePlate?: string | null;
  vehicleType?: RideVehicleType | null;
}
export interface RideMerchantRegistrationProfile {
  service: "GrabRide"; ownerName: string; address: string; motorcycleLicensePlate: string;
  openingHours: string;
  vehicleType: RideVehicleType;
}
export interface MerchantProfile extends MerchantProfileRequest { id: string }
export type MerchantPublic = Omit<MerchantProfile, "ownerName" | "motorcycleLicensePlate">;
export interface MerchantListingRequest {
  title: string; description: string; price: number; imageId: string; isPublished: boolean; showInSlideshow: boolean;
}
export interface MerchantListing extends MerchantListingRequest { id: string; imageUrl: string; updatedAt: string }
export interface MerchantOffer { id: string; title: string; description: string; price: number; imageUrl: string; merchant: MerchantPublic }
export interface MerchantDashboard { profile: MerchantProfile; listings: MerchantListing[] }
export interface RideMerchantArea { id: string; name: string; address: string; openingHours: string; vehicleType: RideVehicleType }
export interface MerchantStorefront { merchant: MerchantPublic; listings: MerchantOffer[] }
/** Pending → Accepted → OnTheWay → Delivered; Rejected (by the store) or Cancelled (by the customer) end it early. */
export type MerchantOrderStatus = "Pending" | "Accepted" | "OnTheWay" | "Delivered" | "Rejected" | "Cancelled";
export type OrderPaymentMethod = "Cash" | "Card";
export interface PlaceOrderRequest {
  merchantId: string; items: { listingId: string; quantity: number }[];
  deliveryAddress: string; note: string; paymentMethod: OrderPaymentMethod;
}
export interface MerchantOrderItem { listingId: string; title: string; unitPrice: number; quantity: number; lineTotal: number }
export interface MerchantOrder {
  id: string; merchantId: string; merchantName: string; service: MerchantServiceKind; status: MerchantOrderStatus;
  paymentMethod: OrderPaymentMethod; items: MerchantOrderItem[]; subtotal: number; deliveryFee: number; total: number;
  deliveryAddress: string; note: string; createdAt: string; updatedAt: string;
  /** Only filled for the merchant who delivers the order. */
  customerName: string | null; customerPhone: string | null;
}
export interface BookRideRequest {
  pickupLocation: string; destination: string; pickupLatitude: number; pickupLongitude: number;
  destinationLatitude: number; destinationLongitude: number; vehicleType?: RideVehicleType;
}
export interface Ride extends BookRideRequest {
  vehicleType: RideVehicleType;
  id: string; customerId: string; driverId: string | null; fare: number; pricingMode: string;
  status: RideStatus; createdAt: string; completedAt: string | null;
  merchantId?: string | null; merchantName?: string | null;
  driverLocation?: RideDriverLocation | null;
}
export interface RideLocation { latitude: number; longitude: number; accuracy: number | null }
export interface RideDriverLocation extends RideLocation { updatedAt: string }
export interface MerchantRideRequest { ride: Ride; customerName: string }
export interface MerchantRideInbox { requests: MerchantRideRequest[]; activeRide: MerchantRideRequest | null }
export interface Driver {
  id: string; fullName: string; vehicleType: string; vehiclePlate: string; isAvailable: boolean;
  currentLatitude: number | null; currentLongitude: number | null;
}
export interface Payment { id: string; rideId: string; amount: number; paymentMethod: string; status: string; createdAt: string }
export interface Review { id: string; rideId: string; driverId: string; rating: number; comment: string | null }
/**
 * Home-page slideshow banner, returned by GET /api/banners (public, no login).
 * The backend decides how many banners there are and their order.
 */
export interface Banner {
  id: string;
  imageUrl: string;      // full URL of the picture; shown full-width in the home hero, so use wide images (e.g. 1920×520). Edges may be cropped on phones.
  title?: string;        // optional text shown on top of the picture
  subtitle?: string;
  linkUrl?: string;      // optional: where clicking the banner goes, e.g. "/food" or "/store/pizza-lab"
}
export interface ApiProblem { title?: string; detail?: string; errors?: Record<string, string[]>; traceId?: string }
export class ApiError extends Error {
  constructor(public status: number, public problem: ApiProblem) {
    super(problem.detail ?? (Object.values(problem.errors ?? {}).flat().join(" ") || problem.title || `Request failed (${status})`));
  }
}
export function createApiClient(baseUrl = process.env.NEXT_PUBLIC_API_URL || "/backend") {
  const origin = baseUrl.replace(/\/$/, "");
  const assetUrl = (url: string) => url.startsWith("/") ? `${origin}${url}` : url;
  const withImage = <T extends { imageUrl: string }>(value: T): T => ({ ...value, imageUrl: assetUrl(value.imageUrl) });
  let session: AuthResponse | null = null;
  let sessionVersion = 0;
  let authAttempt = 0;
  const listeners = new Set<(session: AuthResponse | null) => void>();
  function setSession(next: AuthResponse | null) {
    if (session?.accessToken !== next?.accessToken) sessionVersion++;
    session = next;
    listeners.forEach((listener) => listener(next));
  }
  async function request<T>(path: string, method = "GET", body?: unknown, signal?: AbortSignal, authenticated = true): Promise<T> {
    if (session && Date.parse(session.expiresAt) <= Date.now()) setSession(null);
    const requestToken = authenticated ? session?.accessToken : undefined;
    const version = sessionVersion;
    const timeout = AbortSignal.timeout(12000);
    const multipart = typeof FormData !== "undefined" && body instanceof FormData;
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
      method, signal: signal ? AbortSignal.any([signal, timeout]) : timeout, cache: "no-store", credentials: "omit",
      headers: { ...(body === undefined || multipart ? {} : { "Content-Type": "application/json" }),
        ...(requestToken ? { Authorization: `Bearer ${requestToken}` } : {}) },
      body: body === undefined ? undefined : multipart ? body as FormData : JSON.stringify(body),
    });
    if (!response.ok) {
      if (authenticated && response.status === 401 && session?.accessToken === requestToken) setSession(null);
      const payload: unknown = await response.json().catch(() => null);
      const problem = payload && typeof payload === "object" ? payload as ApiProblem : { title: response.statusText };
      throw new ApiError(response.status, problem);
    }
    const result = await response.json() as T;
    // Do not render private data from a request made before logout/account switching.
    if (authenticated && requestToken && version !== sessionVersion)
      throw new DOMException("The account changed while the request was pending.", "AbortError");
    return result;
  }
  async function authenticate(path: string, body: unknown) {
    const attempt = ++authAttempt;
    const version = sessionVersion;
    const result = await request<AuthResponse>(path, "POST", body, undefined, false);
    if (attempt !== authAttempt || version !== sessionVersion)
      throw new DOMException("This sign-in attempt was cancelled.", "AbortError");
    setSession(result);
    return result.user;
  }
  return {
    register: (body: RegisterRequest) => authenticate("/api/auth/register", body),
    accountData: (signal?: AbortSignal) => request<AccountData>("/api/account-data", "GET", undefined, signal),
    saveAccountData: (body: AccountData, signal?: AbortSignal) => request<AccountData>("/api/account-data", "PATCH", body, signal),
    storeReviews: (signal?: AbortSignal) => request<StoreReview[]>("/api/store-reviews", "GET", undefined, signal),
    login: (phoneNumber: string, password: string) => authenticate("/api/auth/login", { phoneNumber, password }),
    merchantRegister: (body: RegisterRequest & { profile: MerchantProfileRequest | RideMerchantRegistrationProfile }) => authenticate("/api/merchants/register", body),
    merchantLogin: (phoneNumber: string, password: string) => authenticate("/api/merchants/login", { phoneNumber, password }),
    rideMerchantAreas: (page = 1, signal?: AbortSignal) => request<RideMerchantArea[]>(`/api/merchants/ride-areas?page=${page}`, "GET", undefined, signal),
    merchantRideInbox: (signal?: AbortSignal) => request<MerchantRideInbox>("/api/merchants/ride-requests", "GET", undefined, signal),
    respondMerchantRide: (id: string, accept: boolean) => request<MerchantRideInbox>(`/api/merchants/ride-requests/${encodeURIComponent(id)}/response`, "POST", { accept }),
    merchantDashboard: async (signal?: AbortSignal) => {
      const data = await request<MerchantDashboard>("/api/merchants/me", "GET", undefined, signal);
      return { ...data, listings: data.listings.map(withImage) };
    },
    updateMerchantProfile: (body: MerchantProfileRequest) => request<MerchantProfile>("/api/merchants/me", "PATCH", body),
    uploadMerchantImage: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return withImage(await request<{ id: string; imageUrl: string }>("/api/merchants/images", "POST", form));
    },
    saveMerchantListing: async (body: MerchantListingRequest, id?: string) => withImage(await request<MerchantListing>(
      id ? `/api/merchants/listings/${encodeURIComponent(id)}` : "/api/merchants/listings", id ? "PATCH" : "POST", body)),
    merchantOffers: async (service?: MerchantServiceKind, page = 1, signal?: AbortSignal) =>
      (await request<MerchantOffer[]>(`/api/merchants/offers?page=${page}${service ? `&service=${encodeURIComponent(service)}` : ""}`, "GET", undefined, signal)).map(withImage),
    merchantStorefront: async (id: string, signal?: AbortSignal) => {
      const data = await request<MerchantStorefront>(`/api/merchants/${encodeURIComponent(id)}`, "GET", undefined, signal);
      return { ...data, listings: data.listings.map(withImage) };
    },
    placeOrder: (body: PlaceOrderRequest) => request<MerchantOrder>("/api/orders", "POST", body),
    myOrders: (page = 1, signal?: AbortSignal) => request<MerchantOrder[]>(`/api/orders/mine?page=${page}`, "GET", undefined, signal),
    cancelOrder: (id: string) => request<MerchantOrder>(`/api/orders/${encodeURIComponent(id)}/cancel`, "POST"),
    merchantOrders: (page = 1, signal?: AbortSignal) => request<MerchantOrder[]>(`/api/merchants/orders?page=${page}`, "GET", undefined, signal),
    updateMerchantOrder: (id: string, status: MerchantOrderStatus) => request<MerchantOrder>(`/api/merchants/orders/${encodeURIComponent(id)}/status`, "POST", { status }),
    logout: () => { authAttempt++; setSession(null); },
    subscribeSession: (listener: (session: AuthResponse | null) => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    /** Current login (token + user), or null. Used by lib/auth.tsx to survive page refreshes. */
    getSession: () => session,
    /** Put back a saved login. Ignored if it has already expired. */
    restoreSession: (saved: unknown) => {
      authAttempt++;
      const value = saved as Partial<AuthResponse> | null;
      const valid = value && typeof value.accessToken === "string" && value.accessToken.length > 0
        && typeof value.expiresAt === "string" && Date.parse(value.expiresAt) > Date.now()
        && value.user && typeof value.user.id === "string" && typeof value.user.fullName === "string"
        && typeof value.user.phoneNumber === "string"
        && ["Customer", "Driver", "Admin", "Merchant"].includes(value.user.role);
      setSession(valid ? value as AuthResponse : null);
      return session !== null;
    },
    /** A readable, successful health response from this API, including CORS. */
    isOnline: async () => {
      try {
        const response = await fetch(`${baseUrl.replace(/\/$/, "")}/health`, { cache: "no-store", credentials: "omit", signal: AbortSignal.timeout(4000) });
        if (!response.ok) return false;
        const health = await response.json();
        return health?.status === "ok";
      }
      catch { return false; }
    },
    me: (signal?: AbortSignal) => request<User>("/api/auth/me", "GET", undefined, signal),
    refreshMe: async (signal?: AbortSignal) => {
      const token = session?.accessToken;
      const user = await request<User>("/api/auth/me", "GET", undefined, signal);
      if (session && session.accessToken === token && session.user.id === user.id && JSON.stringify(session.user) !== JSON.stringify(user))
        setSession({ ...session, user });
      return user;
    },
    updateProfile: async (body: { fullName: string }) => {
      const token = session?.accessToken;
      const user = await request<User>("/api/auth/me", "PATCH", body);
      // An outstanding save must not restore a session after logout/account switching.
      if (session && session.accessToken === token && session.user.id === user.id) setSession({ ...session, user });
      return user;
    },
    rides: (page = 1, signal?: AbortSignal) => request<Ride[]>(`/api/rides?page=${page}`, "GET", undefined, signal),
    myRides: (page = 1, signal?: AbortSignal) => request<Ride[]>(`/api/rides/mine?page=${page}`, "GET", undefined, signal),
    ride: (id: string, signal?: AbortSignal) => request<Ride>(`/api/rides/${encodeURIComponent(id)}`, "GET", undefined, signal),
    bookRide: (body: BookRideRequest) => request<Ride>("/api/rides", "POST", body),
    updateRideStatus: (id: string, status: RideStatus) => request<Ride>(`/api/rides/${encodeURIComponent(id)}/status`, "PATCH", { status }),
    updateRideLocation: (id: string, location: RideLocation, signal?: AbortSignal) => request<Ride>(`/api/rides/${encodeURIComponent(id)}/location`, "PATCH", location, signal),
    stopRideLocation: (id: string, signal?: AbortSignal) => request<Ride>(`/api/rides/${encodeURIComponent(id)}/location`, "DELETE", undefined, signal),
    availableDrivers: () => request<Driver[]>("/api/drivers/available"),
    createDriver: (body: { userId: string; vehicleType: string; vehiclePlate: string }) => request<Driver>("/api/drivers", "POST", body),
    simulatePayment: (rideId: string) => request<Payment>("/api/payments", "POST", { rideId }),
    myPayments: (page = 1, signal?: AbortSignal) => request<Payment[]>(`/api/payments/mine?page=${page}`, "GET", undefined, signal),
    reviewRide: (rideId: string, rating: number, comment?: string) => request<Review>("/api/reviews", "POST", { rideId, rating, comment }),
    banners: async (signal?: AbortSignal) => (await request<Banner[]>("/api/banners", "GET", undefined, signal)).map(withImage),
    driverReviews: (id: string, page = 1) => request<Review[]>(`/api/drivers/${encodeURIComponent(id)}/reviews?page=${page}`),
  };
}
