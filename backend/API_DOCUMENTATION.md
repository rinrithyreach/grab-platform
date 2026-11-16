# Grab Platform API

Base URL: `http://localhost:5000`. Development Swagger UI: `/swagger`; OpenAPI JSON: `/swagger/v1/swagger.json`. All bodies/responses are JSON with camelCase properties and string enums. UUID identifiers and UTC ISO 8601 timestamps are used. JWT Bearer applies to every `/api` route except register/login. In Swagger click **Authorize** and paste the access token without the `Bearer` prefix. Swagger's global security display also appears on anonymous auth routes; they do not require authentication.

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

Merchants register for one service: `GrabRide`, `GrabFood` or `GrabExpress`. Each merchant account has the `Merchant` role and one business profile. A sign-in phone must be unique across all account types. Customer registration still assigns Customer; the dedicated merchant endpoint assigns only Merchant, never Driver/Admin.

**GrabRide** registration needs only the rider's name, phone number, password, motorcycle license plate and location. Send `phoneNumber` and `password` at the top level, and `profile: { "service": "GrabRide", "ownerName": "Dara Sok", "motorcycleLicensePlate": "1AB-1234", "address": "Phnom Penh" }`. Other profile fields may be omitted. The server uses the name as the public display name and the sign-in phone as the public contact phone at registration. The private dashboard returns `motorcycleLicensePlate`; public profile/offer/banner DTOs omit it. Plate values are trimmed, converted to uppercase and must contain 2–30 characters without control characters. Ride location accepts 2–300 characters. For GrabRide profile PATCH, provide `service`, `ownerName`, `contactPhone`, `address` and `motorcycleLicensePlate`; the store fields remain unnecessary.

The frontend's location picker fills this same `address` field with either `Sangkat name, Khan District name, Phnom Penh` or `GPS: latitude, longitude` (six decimal places). District and sangkat choices use the bundled NCDD reference; selecting Use current location immediately requests device coordinates from the browser, with a retry button only after failure. There are no new API fields, external reverse-geocoding calls or database migrations for these two location modes. Existing saved textual locations remain readable.

| Method and route | Access | Result |
|---|---|---|
| `POST /api/merchants/register` | Public, auth rate limit | 201 AuthResponse, hashed password and SQL-backed profile |
| `POST /api/merchants/login` | Public, auth rate limit | AuthResponse; phone/password body; non-merchant account returns 403 |
| `GET /api/merchants/me` | Merchant | `{ profile, listings }`, including own drafts |
| `PATCH /api/merchants/me` | Merchant | Save the full business profile; other accounts cannot target a profile ID |
| `POST /api/merchants/images` | Merchant | Multipart form field `file`; returns `{ id, imageUrl }` |
| `POST /api/merchants/listings` | Merchant | 201 listing; requires an image owned by this merchant |
| `PATCH /api/merchants/listings/{id}` | Owning merchant | Updated listing; another merchant's ID returns 404 |
| `GET /api/merchants/offers?service=GrabFood&page=1` | Public | Published offers, 24 per page; optional service filter |
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
