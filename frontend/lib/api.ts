/** Browser API client. The client itself keeps the access token in memory; lib/auth.tsx
 * saves it to sessionStorage (cleared when the tab closes) so a page refresh keeps you logged in.
 * Never put a JWT signing key in NEXT_PUBLIC_ variables.
 */
import type { AdminOverview, AdminPage, AdminResource } from "./admin";
import type { Currency } from "./currency";
import type { Promotion, PromotionTarget, SavePromotion } from "./promotion-rules";
import type { CategoryService, ProductCategory, SaveCategory } from "./category-types";
import type { AdminActivity, AdminProfile, AdminRoles, AdminSettings, AdminTeamMember, CreateAdmin, CreateUser, PlatformSettings, SaveAdminProfile, SaveAdminRole } from "./admin-settings";
export type Role = "Customer" | "Driver" | "Admin" | "Merchant";
export type RideStatus = "Pending" | "Accepted" | "InProgress" | "Completed" | "Cancelled";
export interface User { id: string; fullName: string; phoneNumber: string; role: Role; avatarUrl?: string | null }
export interface AuthResponse { accessToken: string; expiresAt: string; user: User }
export interface RegisterRequest { phoneNumber: string; password: string }
export interface AccountData { version: number; data: Record<string, object> }
// SQL already persists shopping data in grab-shop-v1. Keep that wire format
// compatible with running APIs and retain separate cart stores in the browser.
function toAccountSnapshot(snapshot: AccountData): AccountData {
  const { "grab-partner-cart-v1": partnerCart, ...data } = snapshot.data;
  if (!partnerCart) return snapshot;
  data["grab-shop-v1"] = { ...data["grab-shop-v1"], partnerCart };
  return { version: snapshot.version, data };
}
function fromAccountSnapshot(snapshot: AccountData): AccountData {
  const shop = snapshot.data["grab-shop-v1"];
  if (!shop || !("partnerCart" in shop)) return snapshot;
  const { partnerCart, ...food } = shop;
  const data = { ...snapshot.data };
  if (Object.keys(food).length) data["grab-shop-v1"] = food;
  else delete data["grab-shop-v1"];
  if (partnerCart && typeof partnerCart === "object" && !Array.isArray(partnerCart)) data["grab-partner-cart-v1"] = partnerCart;
  return { version: snapshot.version, data };
}
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
  categoryId?: string | null;
}
export interface MerchantListing extends MerchantListingRequest { id: string; imageUrl: string; updatedAt: string }
export interface MerchantOffer { id: string; title: string; description: string; price: number; imageUrl: string; merchant: MerchantPublic; categoryId?: string | null }
export interface MerchantDashboard { profile: MerchantProfile; listings: MerchantListing[] }
export interface RideMerchantArea { id: string; name: string; address: string; openingHours: string; vehicleType: RideVehicleType }
export interface MerchantStorefront { merchant: MerchantPublic; listings: MerchantOffer[] }
/** Pending → Accepted → OnTheWay → Delivered; Rejected (by the store) or Cancelled (by the customer) end it early. */
export type MerchantOrderStatus = "Pending" | "Accepted" | "OnTheWay" | "Delivered" | "Rejected" | "Cancelled";
export type OrderPaymentMethod = "Cash" | "Card";
export interface PlaceOrderRequest {
  merchantId: string; items: { listingId: string; quantity: number }[];
  deliveryAddress: string; note: string; paymentMethod: OrderPaymentMethod;
  promoCode?: string;
  expectedTotal?: number;
  /** Which currency the customer hands over (prices stay in USD). Defaults to USD. */
  currency?: Currency;
}
export interface OrderQuote { subtotal: number; discount: number; codeDiscount: number; deliveryFee: number; total: number; promoCode: string | null; promotionNames: string[] }
export interface MerchantOrderItem { listingId: string; title: string; unitPrice: number; quantity: number; lineTotal: number }
export interface MerchantOrder {
  id: string; merchantId: string; merchantName: string; service: MerchantServiceKind; status: MerchantOrderStatus;
  paymentMethod: OrderPaymentMethod; items: MerchantOrderItem[]; subtotal: number; deliveryFee: number; total: number;
  discount?: number; codeDiscount?: number; promoCode?: string | null;
  deliveryAddress: string; note: string; createdAt: string; updatedAt: string;
  /** Contact details for the fulfilling merchant and the guest's private receipt. */
  customerName: string | null; customerPhone: string | null;
  /** Payment currency; older API versions omit it (= USD). */
  currency?: Currency; exchangeRate?: number; totalKhr?: number;
}
export interface BookRideRequest {
  pickupLocation: string; destination: string; pickupLatitude: number; pickupLongitude: number;
  destinationLatitude: number; destinationLongitude: number; vehicleType?: RideVehicleType;
}
export interface Ride extends BookRideRequest {
  vehicleType: RideVehicleType;
  /** Null for a guest ride. */
  id: string; customerId: string | null; driverId: string | null; fare: number; pricingMode: string;
  status: RideStatus; createdAt: string; completedAt: string | null;
  merchantId?: string | null; merchantName?: string | null;
  driverLocation?: RideDriverLocation | null;
}
export interface RideLocation { latitude: number; longitude: number; accuracy: number | null }
export interface RideDriverLocation extends RideLocation { updatedAt: string }
/** `customerPhone` is only sent for the merchant’s accepted (active) ride. */
export interface MerchantRideRequest { ride: Ride; customerName: string; customerPhone?: string | null }
export interface GuestRideContact { contactName: string; contactPhone: string }
export interface MerchantRideInbox { requests: MerchantRideRequest[]; activeRide: MerchantRideRequest | null }
export interface Driver {
  id: string; fullName: string; vehicleType: string; vehiclePlate: string | null; isAvailable: boolean;
  currentLatitude: number | null; currentLongitude: number | null;
}
export interface Payment { id: string; rideId: string; amount: number; paymentMethod: string; status: string; createdAt: string }
export interface Review { id: string; rideId: string; driverId: string; rating: number; comment: string | null }
/**
 * Home-page slideshow banner, returned by GET /api/banners (public, no login).
 * The backend decides how many banners there are and their order.
 */
/**
 * Wallet top-up through a payment provider (Bakong KHQR). NOT BUILT IN THE BACKEND YET —
 * the website uses a demo provider until NEXT_PUBLIC_PAYMENT_PROVIDER=api (see lib/payments.ts).
 *
 * Contract for the backend (all need login):
 *   POST /api/wallet/topups          body { amount, currency, method: "bakong_khqr" }  -> TopUp (status "pending")
 *        `amount` is the USD credited to the wallet; `currency` ("USD" | "KHR") is what the customer pays in.
 *        The backend asks Bakong for a KHQR code for `paidAmount` in that currency and returns it in `qr`.
 *   GET  /api/wallet/topups/{id}                                             -> TopUp (latest status)
 *        The backend checks the payment with Bakong (e.g. by the KHQR md5 hash) and, the first
 *        time it sees "paid", credits the user's wallet. Calling it again must not credit twice.
 *   POST /api/wallet/topups/{id}/cancel                                      -> TopUp (status "cancelled")
 */
export type TopUpStatus = "pending" | "paid" | "expired" | "failed" | "cancelled";
export interface TopUp {
  id: string;
  amount: number;          // USD credited to the wallet
  currency: Currency;      // what the customer pays in
  paidAmount?: number;     // in `currency` (riel for KHR); same as amount for USD
  method: "bakong_khqr";
  qr: string;              // the KHQR text; the website draws it as a QR code
  status: TopUpStatus;
  createdAt: string;
  expiresAt: string;       // the QR stops working after this
  paidAt?: string | null;
}

export interface Banner {
  id: string;
  imageUrl: string;      // full URL of the picture; shown full-width in the home hero, so use wide images (e.g. 1920×520). Edges may be cropped on phones.
  title?: string;        // optional text shown on top of the picture
  subtitle?: string;
  linkUrl?: string;      // optional: where clicking the banner goes, e.g. "/food" or "/store/pizza-lab"
}
/** A homepage banner uploaded in the admin console (Listings & banners). */
export interface AdminBanner {
  id: string;
  imageUrl: string;
  title: string;
  subtitle: string;
  linkUrl: string;
  sortOrder: number;     // lower numbers show first
  isActive: boolean;     // hidden from the homepage when false
  updatedAt: string;
}
/** Text fields sent with a banner upload; the image is optional when editing. */
export interface SaveAdminBanner { title: string; subtitle: string; linkUrl: string; sortOrder: number; isActive: boolean; reason: string }
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
  let profileRevision = 0;
  let authAttempt = 0;
  const listeners = new Set<(session: AuthResponse | null) => void>();
  function setSession(next: AuthResponse | null) {
    if (session?.accessToken !== next?.accessToken) sessionVersion++;
    session = next;
    listeners.forEach((listener) => listener(next));
  }
  async function request<T>(path: string, method = "GET", body?: unknown, signal?: AbortSignal, authenticated = true, extraHeaders?: Record<string, string>): Promise<T> {
    if (session && Date.parse(session.expiresAt) <= Date.now()) setSession(null);
    const requestToken = authenticated ? session?.accessToken : undefined;
    const version = sessionVersion;
    const timeout = AbortSignal.timeout(12000);
    const multipart = typeof FormData !== "undefined" && body instanceof FormData;
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
      method, signal: signal ? AbortSignal.any([signal, timeout]) : timeout, cache: "no-store", credentials: "omit",
      redirect: "error", referrerPolicy: "no-referrer",
      headers: { ...(body === undefined || multipart ? {} : { "Content-Type": "application/json" }),
        ...extraHeaders,
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
  async function changeAdminAccount(path: string, method: string, body?: unknown) {
    const token = session?.accessToken;
    const result = await request<{ profile: AdminProfile; session: AuthResponse }>(path, method, body);
    if (session?.accessToken === token && session?.user.id === result.session.user.id) setSession(result.session);
    return result.profile;
  }
  return {
    platformSettings: (signal?: AbortSignal) => request<PlatformSettings>("/api/platform/settings", "GET", undefined, signal, false),
    adminSettings: (signal?: AbortSignal) => request<AdminSettings>("/api/admin/settings", "GET", undefined, signal),
    saveAdminSettings: (body: PlatformSettings & { version: string; reason: string }) => request<AdminSettings>("/api/admin/settings", "PATCH", body),
    adminProfile: (signal?: AbortSignal) => request<AdminProfile>("/api/admin/profile", "GET", undefined, signal),
    saveAdminProfile: (body: SaveAdminProfile) => changeAdminAccount("/api/admin/profile", "PATCH", body),
    changeAdminPassword: (body: { currentPassword: string; newPassword: string; confirmPassword: string }) => changeAdminAccount("/api/admin/profile/password", "POST", body),
    revokeAdminSessions: () => changeAdminAccount("/api/admin/profile/revoke-sessions", "POST"),
    uploadAdminAvatar: (file: File) => { const form = new FormData(); form.append("file", file); return request<AdminProfile>("/api/admin/profile/avatar", "POST", form); },
    removeAdminAvatar: () => request<AdminProfile>("/api/admin/profile/avatar", "DELETE"),
    adminActivity: (signal?: AbortSignal) => request<AdminActivity[]>("/api/admin/profile/activity", "GET", undefined, signal),
    adminTeam: (signal?: AbortSignal) => request<AdminTeamMember[]>("/api/admin/team", "GET", undefined, signal),
    createAdmin: (body: CreateAdmin) => request<{ id: string }>("/api/admin/team", "POST", body),
    setAdminStatus: (id: string, isActive: boolean, reason: string) => request<{ saved: boolean }>(`/api/admin/team/${encodeURIComponent(id)}`, "PATCH", { isActive, reason }),
    setAdminRole: (id: string, adminRoleId: string | null, reason: string) => request<{ saved: boolean }>(`/api/admin/team/${encodeURIComponent(id)}/role`, "PATCH", { adminRoleId, reason }),
    adminRoles: (signal?: AbortSignal) => request<AdminRoles>("/api/admin/roles", "GET", undefined, signal),
    createAdminRole: (body: SaveAdminRole) => request<{ id: string }>("/api/admin/roles", "POST", body),
    updateAdminRole: (id: string, body: SaveAdminRole) => request<{ saved: boolean }>(`/api/admin/roles/${encodeURIComponent(id)}`, "PUT", body),
    deleteAdminRole: (id: string, reason: string) => request<{ saved: boolean }>(`/api/admin/roles/${encodeURIComponent(id)}/delete`, "POST", { reason }),
    adminCreateUser: (body: CreateUser) => request<{ id: string }>("/api/admin/users", "POST", body),
    revokeAdminMemberSessions: (id: string, reason: string) => request<{ saved: boolean }>(`/api/admin/team/${encodeURIComponent(id)}/revoke-sessions`, "POST", { reason }),
    adminLogin: (email: string, password: string) => authenticate("/api/auth/admin/login", { email, password }),
    adminOverview: (signal?: AbortSignal) => request<AdminOverview>("/api/admin/overview", "GET", undefined, signal),
    adminList: (resource: AdminResource, page = 1, search = "", filter = "", signal?: AbortSignal) => request<AdminPage>(`/api/admin/${resource}?${new URLSearchParams({ page: String(page), search, filter })}`, "GET", undefined, signal),
    adminUpdate: (resource: "users" | "merchants" | "listings", id: string, body: unknown) => request<{ saved: boolean }>(`/api/admin/${resource}/${encodeURIComponent(id)}`, "PATCH", body),
    adminAction: (resource: AdminResource, id: string, action: string, reason: string) => request<{ saved: boolean }>(`/api/admin/${resource}/${encodeURIComponent(id)}/actions`, "POST", { action, reason }),
    adminCreateDriver: (body: { userId: string; vehicleType: string; vehiclePlate: string; reason: string }) => request<Driver>("/api/admin/drivers", "POST", body),
    adminBanners: async (signal?: AbortSignal) => (await request<AdminBanner[]>("/api/admin/banners", "GET", undefined, signal)).map(withImage),
    promotions: (signal?: AbortSignal) => request<Promotion[]>("/api/promotions", "GET", undefined, signal),
    adminPromotions: (signal?: AbortSignal) => request<Promotion[]>("/api/admin/promotions", "GET", undefined, signal),
    categories: (service?: CategoryService, signal?: AbortSignal) => request<ProductCategory[]>(`/api/categories${service ? `?service=${encodeURIComponent(service)}` : ""}`, "GET", undefined, signal),
    adminCategories: (signal?: AbortSignal) => request<ProductCategory[]>("/api/admin/categories", "GET", undefined, signal),
    adminSaveCategory: (body: SaveCategory, id?: string) => request<{ id?: string }>(id ? `/api/admin/categories/${encodeURIComponent(id)}` : "/api/admin/categories", id ? "PUT" : "POST", body),
    adminDeleteCategory: (id: string, reason: string) => request<{ saved: boolean }>(`/api/admin/categories/${encodeURIComponent(id)}?${new URLSearchParams({ reason })}`, "DELETE"),
    adminPromotionTargets: (signal?: AbortSignal) => request<PromotionTarget[]>("/api/admin/promotions/targets", "GET", undefined, signal),
    adminSavePromotion: (body: SavePromotion, id?: string) => request<{ id?: string }>(id ? `/api/admin/promotions/${encodeURIComponent(id)}` : "/api/admin/promotions", id ? "PUT" : "POST", body),
    adminDeletePromotion: (id: string, reason: string) => request<{ saved: boolean }>(`/api/admin/promotions/${encodeURIComponent(id)}?${new URLSearchParams({ reason })}`, "DELETE"),
    quoteOrder: (body: Pick<PlaceOrderRequest, "merchantId" | "items" | "promoCode">, signal?: AbortSignal) => request<OrderQuote>("/api/orders/quote", "POST", body, signal),
    /** Creates a banner when `id` is omitted (image required), otherwise updates it (image optional). */
    adminSaveBanner: (body: SaveAdminBanner, image: File | null, id?: string) => {
      const form = new FormData();
      Object.entries(body).forEach(([key, value]) => form.append(key, String(value)));
      if (image) form.append("image", image);
      return id ? request<{ saved: boolean }>(`/api/admin/banners/${encodeURIComponent(id)}`, "PATCH", form)
        : request<{ id: string }>("/api/admin/banners", "POST", form);
    },
    adminDeleteBanner: (id: string, reason: string) => request<{ saved: boolean }>(`/api/admin/banners/${encodeURIComponent(id)}?${new URLSearchParams({ reason })}`, "DELETE"),
    register: (body: RegisterRequest) => authenticate("/api/auth/register", body),
    accountData: async (signal?: AbortSignal) => fromAccountSnapshot(await request<AccountData>("/api/account-data", "GET", undefined, signal)),
    saveAccountData: async (body: AccountData, signal?: AbortSignal) => fromAccountSnapshot(await request<AccountData>("/api/account-data", "PATCH", toAccountSnapshot(body), signal)),
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
    merchantOffers: async (service?: MerchantServiceKind, page = 1, signal?: AbortSignal, categoryId?: string) =>
      (await request<MerchantOffer[]>(`/api/merchants/offers?page=${page}${service ? `&service=${encodeURIComponent(service)}` : ""}${categoryId ? `&categoryId=${encodeURIComponent(categoryId)}` : ""}`, "GET", undefined, signal)).map(withImage),
    merchantStorefront: async (id: string, signal?: AbortSignal) => {
      const data = await request<MerchantStorefront>(`/api/merchants/${encodeURIComponent(id)}`, "GET", undefined, signal);
      return { ...data, listings: data.listings.map(withImage) };
    },
    placeOrder: (body: PlaceOrderRequest) => request<MerchantOrder>("/api/orders", "POST", body),
    quoteGuestOrder: (body: Pick<PlaceOrderRequest, "merchantId" | "items" | "promoCode">, signal?: AbortSignal) => request<OrderQuote>("/api/orders/guest/quote", "POST", body, signal, false),
    placeGuestOrder: (body: { order: PlaceOrderRequest; contactName: string; contactPhone: string }) => request<{ order: MerchantOrder; accessToken: string }>("/api/orders/guest", "POST", body, undefined, false),
    guestOrder: (id: string, token: string, signal?: AbortSignal) => request<MerchantOrder>(`/api/orders/guest/${encodeURIComponent(id)}`, "GET", undefined, signal, false, { "X-Guest-Order-Token": token }),
    cancelGuestOrder: (id: string, token: string) => request<MerchantOrder>(`/api/orders/guest/${encodeURIComponent(id)}/cancel`, "POST", undefined, undefined, false, { "X-Guest-Order-Token": token }),
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
      const revision = profileRevision;
      const user = await request<User>("/api/auth/me", "GET", undefined, signal);
      if (revision === profileRevision && session && session.accessToken === token && session.user.id === user.id && JSON.stringify(session.user) !== JSON.stringify(user))
        setSession({ ...session, user });
      return user;
    },
    updateProfile: async (body: { fullName: string }) => {
      const token = session?.accessToken;
      profileRevision++;
      try {
        const user = await request<User>("/api/auth/me", "PATCH", body);
        // Preserve a photo saved while the name request was in flight.
        if (session && session.accessToken === token && session.user.id === user.id) setSession({ ...session, user: { ...session.user, fullName: user.fullName } });
        return user;
      } finally { profileRevision++; }
    },
    saveProfilePhoto: async (file: File | null) => {
      const token = session?.accessToken;
      const form = file ? new FormData() : undefined;
      if (file) form!.append("file", file);
      profileRevision++;
      try {
        const user = await request<User>("/api/auth/me/avatar", file ? "POST" : "DELETE", form);
        if (session && session.accessToken === token && session.user.id === user.id) setSession({ ...session, user: { ...session.user, avatarUrl: user.avatarUrl } });
        return user;
      } finally { profileRevision++; }
    },
    rides: (page = 1, signal?: AbortSignal) => request<Ride[]>(`/api/rides?page=${page}`, "GET", undefined, signal),
    myRides: (page = 1, signal?: AbortSignal) => request<Ride[]>(`/api/rides/mine?page=${page}`, "GET", undefined, signal),
    ride: (id: string, signal?: AbortSignal) => request<Ride>(`/api/rides/${encodeURIComponent(id)}`, "GET", undefined, signal),
    bookRide: (body: BookRideRequest) => request<Ride>("/api/rides", "POST", body),
    bookGuestRide: (ride: BookRideRequest, contact: GuestRideContact) => request<{ ride: Ride; accessToken: string }>("/api/rides/guest", "POST", { ride, ...contact }, undefined, false),
    guestRide: (id: string, token: string, signal?: AbortSignal) => request<Ride>(`/api/rides/guest/${encodeURIComponent(id)}`, "GET", undefined, signal, false, { "X-Guest-Ride-Token": token }),
    cancelGuestRide: (id: string, token: string) => request<Ride>(`/api/rides/guest/${encodeURIComponent(id)}/cancel`, "POST", undefined, undefined, false, { "X-Guest-Ride-Token": token }),
    updateRideStatus: (id: string, status: RideStatus) => request<Ride>(`/api/rides/${encodeURIComponent(id)}/status`, "PATCH", { status }),
    updateRideLocation: (id: string, location: RideLocation, signal?: AbortSignal) => request<Ride>(`/api/rides/${encodeURIComponent(id)}/location`, "PATCH", location, signal),
    stopRideLocation: (id: string, signal?: AbortSignal) => request<Ride>(`/api/rides/${encodeURIComponent(id)}/location`, "DELETE", undefined, signal),
    availableDrivers: () => request<Driver[]>("/api/drivers/available"),
    createDriver: (body: { userId: string; vehicleType: string; vehiclePlate: string }) => request<Driver>("/api/drivers", "POST", body),
    simulatePayment: (rideId: string) => request<Payment>("/api/payments", "POST", { rideId }),
    myPayments: (page = 1, signal?: AbortSignal) => request<Payment[]>(`/api/payments/mine?page=${page}`, "GET", undefined, signal),
    reviewRide: (rideId: string, rating: number, comment?: string) => request<Review>("/api/reviews", "POST", { rideId, rating, comment }),
    createTopUp: (amount: number, currency: Currency = "USD") => request<TopUp>("/api/wallet/topups", "POST", { amount, currency, method: "bakong_khqr" }),
    topUpStatus: (id: string, signal?: AbortSignal) => request<TopUp>(`/api/wallet/topups/${encodeURIComponent(id)}`, "GET", undefined, signal),
    cancelTopUp: (id: string) => request<TopUp>(`/api/wallet/topups/${encodeURIComponent(id)}/cancel`, "POST"),
    banners: async (signal?: AbortSignal) => (await request<Banner[]>("/api/banners", "GET", undefined, signal)).map(withImage),
    driverReviews: (id: string, page = 1) => request<Review[]>(`/api/drivers/${encodeURIComponent(id)}/reviews?page=${page}`),
  };
}
