# Grab Platform API

Base URL: `http://localhost:5000`. Development Swagger UI: `/swagger`; OpenAPI JSON: `/swagger/v1/swagger.json`. All bodies/responses are JSON with camelCase properties and string enums. UUID identifiers and UTC ISO 8601 timestamps are used. JWT Bearer applies to every `/api` route except register/login. In Swagger click **Authorize** and paste the access token without the `Bearer` prefix. Swagger's global security display also appears on anonymous auth routes; they do not require authentication.

## Endpoints

| Method | URL | Authorization / behavior | Success |
|---|---|---|---|
| POST | `/api/auth/register` | Anonymous; always creates Customer; email normalized and unique | 201 AuthResponse |
| POST | `/api/auth/login` | Anonymous; generic invalid-credentials error | 200 AuthResponse |
| GET | `/api/auth/me` | Authenticated | 200 User |
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

Register (fullName 2–120 chars, email ≤254, password 12–128, valid phone ≤30):
```json
{ "fullName": "Demo Customer", "email": "customer@example.test", "password": "use-your-own-long-password", "phoneNumber": "+85512345678" }
```
Login:
```json
{ "email": "customer@example.test", "password": "use-your-own-long-password" }
```
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
{ "accessToken": "<JWT>", "expiresAt": "2026-11-13T04:00:00Z", "user": { "id": "<uuid>", "fullName": "Demo Customer", "email": "customer@example.test", "phoneNumber": "+85512345678", "role": "Customer" } }
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

- 400: malformed JSON, invalid email/coordinates/rating, missing/oversize fields, unsupported enum, invalid page.
- 401: missing, expired, tampered JWT; wrong credentials; account removed/role changed (sign in again).
- 403: role denied; unassigned driver tries to update ride.
- 404: missing or inaccessible private record.
- 409: duplicate email/plate/payment/review, stale concurrent update, invalid lifecycle transition, account ineligible for driver onboarding.
- 429: auth endpoint rate limit (30 requests/minute per connecting IP).
- 500: sanitized unexpected server failure; consult server log using traceId.

Validation uses ASP.NET ValidationProblemDetails with `errors: { field: [messages] }`. Service failures return ProblemDetails with `status`, `title`, `detail`, and `traceId`. Framework 401/403/429 responses may have empty bodies; the frontend handles these too. Example:
```json
{ "status": 409, "title": "Request rejected", "detail": "Ride already paid.", "traceId": "<trace>" }
```

JWTs are short lived (30 minutes by default), issuer/audience/signature/lifetime/algorithm validated. Database role checks invalidate stale role tokens. Logout removes the browser's in-memory token; there is no server revocation list or refresh-token endpoint. Use HTTPS outside local development. CORS permits only configured origins; no cookie credentials are used.
