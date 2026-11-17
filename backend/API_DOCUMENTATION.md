# Grab Platform API

Base URL: `http://localhost:5000` on the API host; the frontend normally accesses it through `/backend`. Development Swagger UI: `/swagger`; OpenAPI JSON: `/swagger/v1/swagger.json`. All bodies/responses are JSON with camelCase properties and string enums. UUID identifiers and UTC ISO 8601 timestamps are used. Protected endpoints require JWT Bearer. Registration/login, public merchant offers/storefronts/images, banners, public store reviews and sync status allow anonymous reads. In Swagger click **Authorize** and paste the access token without the `Bearer` prefix. Swagger's global security display also appears on anonymous routes.

## Cross-device account data

All devices must use the same central API/database; see [shared setup](../SHARED_SETUP.md). `GET /api/sync/status` is public and returns `{ "status": "ok", "storageId": "<persistent database UUID>" }`. Compare this Storage ID and the configured API destination between PCs. A separately initialized database receives a different ID. This endpoint queries SQL; `/health` remains only a process-liveness check.

`GET /api/account-data` requires sign-in and returns `{ "version": 0, "data": {} }` for a new account. `PATCH /api/account-data` saves the full `{ version, data }` snapshot for the JWT subject and returns the incremented version. User IDs/roles in a request cannot target someone else's snapshot. All sections save in one SQL transaction; a stale/racing version returns 409. The `data` object permits only object-valued sections named `grab-shop-v1`, `grab-express-demo-v1`, `grab-wallet-v1`, `grab-profile-v1`, `grab-favorites-v1`, `grab-reviews-v1` and `grab-settings`. A serialized snapshot is limited to 1,000,000 characters, with a 2 MB HTTP request limit. Settings/review fields are additionally validated.

These sections persist the existing Food/Express/account demo state. Food/Express prices, payment simulations and delivery timelines still use the existing client logic; this is not a server-authoritative payment or fulfillment API. Live rides/merchant publishing retain their dedicated models and authorization.

`GET /api/store-reviews` is public. It projects only public review ID, store ID, display name, rating, comment and date from saved reviews; private order IDs, addresses, phone numbers and wallet data are omitted. When signed in, own reviews are excluded from this public projection because the frontend already reads them from its private snapshot.

The browser caches pending changes per account, polls every five seconds while visible, and refreshes on focus/reconnection. Independent section edits rebase against the latest server snapshot. Conflicting edits to one section pause saving until the user loads the server copy, with a device-local backup of pending state. Guest data is local and may be imported explicitly into empty account sections after sign-in. No API credentials or SQL/JWT secrets belong in frontend configuration.

## Endpoints

| Method | URL | Authorization / behavior | Success |
|---|---|---|---|
| POST | `/api/auth/register` | Anonymous; always creates Customer; phone normalized and unique | 201 AuthResponse |
| POST | `/api/auth/login` | Anonymous; generic invalid-credentials error | 200 AuthResponse |
| GET | `/api/auth/me` | Authenticated | 200 User |
| PATCH | `/api/auth/me` | Authenticated; update own display name only | 200 User |
| GET | `/api/rides?page=1` | Customer: own; Driver: assigned plus Pending queue; Admin: all | 200 Ride[] |
| GET | `/api/rides/mine?page=1` | Customer: own; Driver: assigned; Admin: all administrative history | 200 Ride[] |
| GET | `/api/rides/{id}` | Owner, assigned driver, Admin; inaccessible records return 404 | 200 Ride |
| POST | `/api/rides` | Customer only; fare generated on server | 201 Ride, Location header |
| PATCH | `/api/rides/{id}/status` | State machine below | 200 Ride |
| PATCH | `/api/rides/{id}/location` | Assigned GrabRide Merchant or Driver; Accepted/InProgress only | 200 Ride |
| DELETE | `/api/rides/{id}/location` | Assigned GrabRide Merchant or Driver; stop sharing on an active ride | 200 Ride |
| GET | `/api/drivers/available` | Authenticated; up to 100, no private contact details | 200 Driver[] |
| POST | `/api/drivers` | Admin only; dedicated Customer account with no ride history; sets Driver role | 201 Driver |
| POST | `/api/payments` | Customer owner; completed ride; one payment per ride | 201 Payment |
| GET | `/api/payments/mine?page=1` | Customer's own records only | 200 Payment[] |
| POST | `/api/reviews` | Customer owner; completed ride with driver; one review per ride | 201 Review |
| GET | `/api/drivers/{id}/reviews?page=1` | Authenticated; driver must exist | 200 Review[] |
| GET | `/health` | Anonymous; process liveness only, does not probe SQL | 200 `{ "status": "ok" }` |

Paged lists return at most 50 records per page, with an empty array at the end; page must be 1–100000. No total-count wrapper. Driver pending queue necessarily contains pickup/destination details for acceptance; other customers cannot see them.

## Requests

Register (phone number ≤30 input characters, password 12–128 characters; no name/email required):
```json
{ "phoneNumber": "012345678", "password": "use-your-own-long-password" }
```
Phone inputs default to Cambodia: local numbers with or without the leading 0 are stored as `+855…`; explicit international numbers use `+countrycode`. Spaces, dots, hyphens and parentheses are ignored. Equivalent formats identify the same account. This is password authentication; it does not send SMS or verify phone ownership. New accounts receive the display name `Customer`; existing account names/passwords are preserved.

Login:
```json
{ "phoneNumber": "012345678", "password": "use-your-own-long-password" }
```
Update your profile name (authenticated; trimmed name 2–120 characters, without control characters):
```json
{ "fullName": "Sokha Dara" }
```
`PATCH /api/auth/me` takes the account ID from the signed-in token. It updates only FullName, preserves the phone/password/role, and returns the updated User. Profile settings use this response to update the displayed account and saved browser session immediately. The navigation greeting shows the saved profile name, falling back to the phone number when no personal name is set.

Book (location labels 2–300 chars; latitudes -90…90, longitudes -180…180):
```json
{ "pickupLocation": "University", "destination": "Central Market", "pickupLatitude": 11.56, "pickupLongitude": 104.92, "destinationLatitude": 11.57, "destinationLongitude": 104.93 }
```
Status:
```json
{ "status": "Accepted" }
```
Live GPS (`PATCH /api/rides/{id}/location`; required latitude/longitude, optional nonnegative accuracy in metres):
```json
{ "latitude": 11.552, "longitude": 104.918, "accuracy": 8 }
```
The server timestamps each GPS update and returns `driverLocation: { latitude, longitude, accuracy, updatedAt }` in the existing authorized ride/detail/inbox responses. Pending, completed, cancelled and unshared rides return `driverLocation: null`. Only the assigned driver or GrabRide merchant can write or clear it; other assignments return 404 and inactive rides return 409. Cancellation and completion clear the stored coordinates. Ride rowversion checks also protect GPS updates from racing lifecycle changes. The customer polls every two seconds and labels positions older than 30 seconds as paused. These ride-specific positions are not added to public merchant-area or available-driver feeds.

Driver onboarding (user must log in again after promotion):
```json
{ "userId": "00000000-0000-0000-0000-000000000001", "vehicleType": "Car", "vehiclePlate": "DEMO-001" }
```
Payment (amount and method are server-controlled; no card data accepted):
```json
{ "rideId": "00000000-0000-0000-0000-000000000002" }
```
Review (rating 1–5, optional comment ≤1000 chars):
```json
{ "rideId": "00000000-0000-0000-0000-000000000002", "rating": 5, "comment": "Good ride" }
```

Example UUIDs are placeholders; use actual response IDs.

## Response structures

AuthResponse:
```json
{ "accessToken": "<JWT>", "expiresAt": "2026-11-13T04:00:00Z", "user": { "id": "<uuid>", "fullName": "Customer", "phoneNumber": "+85512345678", "role": "Customer" } }
```
`GET /auth/me` returns the nested User object. Password hashes are never serialized.

Ride:
```json
{ "id": "<uuid>", "customerId": "<uuid>", "driverId": null, "pickupLocation": "University", "destination": "Central Market", "pickupLatitude": 11.56, "pickupLongitude": 104.92, "destinationLatitude": 11.57, "destinationLongitude": 104.93, "fare": 5.00, "pricingMode": "DevelopmentMockFlatFareUSD", "status": "Pending", "createdAt": "2026-11-13T03:00:00Z", "completedAt": null }
```
Driver:
```json
{ "id": "<uuid>", "fullName": "Demo Driver", "vehicleType": "Car", "vehiclePlate": "DEMO-001", "isAvailable": true, "currentLatitude": null, "currentLongitude": null }
```
Payment:
```json
{ "id": "<uuid>", "rideId": "<uuid>", "amount": 5.00, "paymentMethod": "Simulated", "status": "SimulatedSucceeded", "createdAt": "2026-11-13T03:15:00Z" }
```
Review:
```json
{ "id": "<uuid>", "rideId": "<uuid>", "driverId": "<uuid>", "rating": 5, "comment": "Good ride" }
```

## Ride transitions

| From → To | Who |
|---|---|
| Pending → Accepted | Available Driver; assigned atomically by server |
| Accepted → InProgress | Assigned Driver |
| InProgress → Completed | Assigned Driver; sets completedAt and releases availability |
| Pending → Cancelled | Customer owner or Admin |
| Accepted → Cancelled | Customer owner, assigned Driver, or Admin; releases driver |
| InProgress → Cancelled | Admin; releases driver |

Completed/Cancelled are terminal. Customers cannot assign drivers or choose fares. Admins cannot impersonate drivers to accept/start/complete. A driver cannot hold two active rides. Driver and ride rowversion checks cause a competing update to fail atomically rather than overwrite the winner.

## Errors

- 400: malformed JSON, invalid phone/coordinates/rating, missing/oversize fields, unsupported enum, invalid page.
- 401: missing, expired, tampered JWT; wrong credentials; account removed/role changed (sign in again).
- 403: role denied; unassigned driver tries to update ride.
- 404: missing or inaccessible private record.
- 409: duplicate phone/plate/payment/review, stale concurrent update, invalid lifecycle transition, account ineligible for driver onboarding.
- 429: auth endpoint rate limit (30 requests/minute per connecting IP).
- 500: sanitized unexpected server failure; consult server log using traceId.

Validation uses ASP.NET ValidationProblemDetails with `errors: { field: [messages] }`. Service failures return ProblemDetails with `status`, `title`, `detail`, and `traceId`. Framework 401/403/429 responses may have empty bodies; the frontend handles these too. Example:
```json
{ "status": 409, "title": "Request rejected", "detail": "Ride already paid.", "traceId": "<trace>" }
```

JWTs are short lived (30 minutes by default), issuer/audience/signature/lifetime/algorithm validated. Database role checks invalidate stale role tokens. Logout removes the browser's in-memory token; there is no server revocation list or refresh-token endpoint. Use HTTPS outside local development. CORS permits only configured origins; no cookie credentials are used.

## Merchant profiles and publishing

The merchant service is fixed at registration. `PATCH /api/merchants/me` must include the registered `service`; attempting to change it returns 400 without changing the profile. Accounts manage only their registered service.

Merchants register for one service: `GrabRide`, `GrabFood` or `GrabExpress`. Each merchant account has the `Merchant` role and one business profile. A sign-in phone must be unique across all account types. Customer registration still assigns Customer; the dedicated merchant endpoint assigns only Merchant, never Driver/Admin.

**GrabRide** registration needs only the rider's name, phone number, password, motorcycle license plate and location. Send `phoneNumber` and `password` at the top level, and `profile: { "service": "GrabRide", "ownerName": "Dara Sok", "motorcycleLicensePlate": "1AB-1234", "address": "Phnom Penh" }`. Other profile fields may be omitted. The server uses the name as the public display name and the sign-in phone as the public contact phone at registration. The private dashboard returns `motorcycleLicensePlate`; public profile/offer/banner DTOs omit it. Plate values are trimmed, converted to uppercase and must contain 2–30 characters without control characters. Ride location accepts 2–300 characters. For GrabRide profile PATCH, provide `service`, `ownerName`, `contactPhone`, `address` and `motorcycleLicensePlate`; the store fields remain unnecessary.

The frontend's location picker fills this same `address` field with either `Sangkat name, Khan District name, Phnom Penh` or `GPS: latitude, longitude` (six decimal places). District and sangkat choices use the bundled NCDD reference; selecting Use current location immediately requests device coordinates from the browser, with a retry button only after failure. There are no new API fields, external reverse-geocoding calls or database migrations for these two location modes. Existing saved textual locations remain readable.

GrabRide registration and profile PATCH also accept `openingHours` for the weekly work schedule, for example `"Mon 08:00-17:00; Fri 09:00-18:00; Sun 18:00-02:00"`. Days are `Mon`, `Tue`, `Wed`, `Thu`, `Fri`, `Sat`, `Sun`; each may appear once, with distinct valid `HH:mm` start/end times. The API normalizes entries into Monday–Sunday order. Omitted days are off, and an empty or omitted schedule means no working days. Times use Cambodia time (UTC+7); an earlier end time means the next day. Invalid or duplicate shifts return 400. Hours use the existing database column. GrabRide accounts manage schedules instead of listings: image uploads and listing writes return 400, `GET /api/merchants/me` returns `listings: []`, and public offers/banners exclude GrabRide listings. GrabRide storefront requests return 404. GrabFood/GrabExpress listing behavior is unchanged.

| Method and route | Access | Result |
|---|---|---|
| `POST /api/merchants/register` | Public, auth rate limit | 201 AuthResponse, hashed password and SQL-backed profile |
| `POST /api/merchants/login` | Public, auth rate limit | AuthResponse; phone/password body; non-merchant account returns 403 |
| `GET /api/merchants/me` | Merchant | `{ profile, listings }`, including own drafts |
| `PATCH /api/merchants/me` | Merchant | Save the full business profile; other accounts cannot target a profile ID |
| `GET /api/merchants/ride-requests` | GrabRide Merchant | `{ requests: [{ ride, customerName }], activeRide: { ride, customerName } \| null }`. Returns at most 25 pending, unclaimed requests that this merchant has not declined; an assigned active ride takes priority. Other merchant services return 403. |
| `POST /api/merchants/ride-requests/{id}/response` | GrabRide Merchant | Required body `{ "accept": true }` or `{ "accept": false }`; returns the updated inbox. Accept assigns the merchant and changes the ride to Accepted. Decline persists only for that merchant and keeps the customer ride Pending. Unavailable requests or a second active assignment return 409. Repeating the same recorded response is idempotent. |
| `POST /api/merchants/images` | Merchant | Multipart form field `file`; returns `{ id, imageUrl }` |
| `POST /api/merchants/listings` | Merchant | 201 listing; requires an image owned by this merchant |
| `PATCH /api/merchants/listings/{id}` | Owning merchant | Updated listing; another merchant's ID returns 404 |
| `GET /api/merchants/offers?service=GrabFood&page=1` | Public | Published offers, 24 per page; optional service filter |
| `GET /api/merchants/ride-areas?page=1` | Public | Registered GrabRide merchant map fields: `id`, public display `name`, saved `address`, `openingHours`; 100 per page, including accounts without listings. Other services and accounts no longer in the Merchant role are excluded. No account user ID, phone, email, password or motorcycle plate is returned. These are registration locations, not live positions or availability. |
| `GET /api/merchants/{id}` | Public | `{ merchant, listings }`; 404 if there are no published listings |
| `GET /api/banners` | Public | Latest 12 updated published listings with `showInSlideshow: true` |
| `GET /api/merchant-images/{id}` | Public | Stored image bytes with detected MIME type and `nosniff` |

GrabFood/GrabExpress merchant registration body (replace placeholders locally):

```json
{
  "phoneNumber": "<unique merchant sign-in phone>",
  "password": "<12–128 character password>",
  "profile": {
    "service": "GrabFood",
    "businessName": "Dara Kitchen",
    "ownerName": "Dara Sok",
    "contactPhone": "012345678",
    "email": null,
    "address": "House 12, Street 271",
    "city": "Phnom Penh",
    "category": "Khmer food",
    "description": "Fresh Khmer meals cooked daily.",
    "openingHours": "Mon–Sat, 7 AM–8 PM"
  }
}
```

Profile PATCH uses the same fields inside `profile` as its top-level body. Business/owner names: 2–120 characters; address: 5–300; city/category: 2–100; description: 10–1500; opening hours: 3–200. Contact phone is normalized. Email is optional and validated when present. Invalid/whitespace-only required data is rejected.

Upload JPG, PNG or WebP files up to 2 MB. MIME types are inferred from file signatures; SVG and arbitrary files are rejected. Image URLs are API-relative, and the frontend resolves them against `NEXT_PUBLIC_API_URL`. Uploaded photos are publicly accessible even while a listing is a draft. There are at most 200 images and 100 listings per merchant.

Create/update listing body:

```json
{
  "title": "Khmer lunch set",
  "description": "Rice, grilled chicken and fresh vegetables.",
  "price": 4.50,
  "imageId": "<id returned by photo upload>",
  "isPublished": true,
  "showInSlideshow": true
}
```

Prices are USD, 0.01–999999.99 with at most two decimal places. Clear `isPublished` to hide a listing from public feeds, storefronts and banners while retaining it in the dashboard. Clear `showInSlideshow` to keep a published listing on service pages without featuring it in the homepage slideshow. Banner links point to `/partners/{merchantId}`. Public profiles omit owner name, user ID, sign-in phone and password/hash; they include only the explicit public business contact details. These offers support direct merchant enquiries, separate from the existing demo food checkout and ride/Express booking flows.
