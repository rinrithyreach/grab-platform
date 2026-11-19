# Frontend-to-backend mapping

Updated 16 November 2026. The frontend is now a customer application for **Ride, Food and Express**; it is no longer the create-next-app starter. This document supersedes the earlier starter-page analysis.

See [frontend audit](../frontend/AUDIT.md) for the route inventory, changes, verification and limits. See [implementation plan](IMPLEMENTATION_PLAN.md) for proposed Food/Express/account endpoints and EF entities.

## Existing integration

| Frontend | Existing API | State |
|---|---|---|
| Phone/password login/register, profile name, AuthProvider | `POST /api/auth/login`, `POST /api/auth/register`, `GET/PATCH /api/auth/me` | Connected; greeting uses saved name or phone fallback, name editable in profile settings |
| Ride booking | `POST /api/rides` | Connected; current API has a flat development fare and no vehicle selection |
| My rides | `GET /api/rides/mine`, `PATCH /api/rides/{id}/status` | Connected; cancellation exposed to customers |
| Ride payments/reviews | `GET /api/payments/mine`, `POST /api/payments`, `POST /api/reviews` | Connected; payments simulated; durable reviewed flag missing from RideDto |
| Merchant portal and registration | `POST /api/merchants/register`, `POST /api/merchants/login`, `GET/PATCH /api/merchants/me`, image/listing endpoints | SQL-backed merchant profiles, photo upload, drafts, publishing and editing for all three services |
| Merchant customer listings/storefronts | `GET /api/merchants/offers`, `GET /api/merchants/{id}` | Published offers on the home/service pages and `/partners/{id}`; contact merchant directly |
| Home carousel | `GET /api/banners` | SQL-backed latest 12 published featured merchant listings; service slides are the fallback |
| Food cart/orders | `GET/PATCH /api/account-data` | Signed-in demo records persist in SQL; prices/fulfillment remain simulated |
| Store reviews | Account snapshot plus `GET /api/store-reviews` | Own reviews private snapshot; safe public projection for other customers |
| Express booking/history/cancellation | `GET/PATCH /api/account-data` | Signed-in demo records persist in SQL; timeline/quotes remain simulated |
| Addresses/favourites/wallet/settings | `GET/PATCH /api/account-data` | Per-account SQL snapshot, browser retry cache, five-second visible polling and conflict protection |
| Shared deployment check | `GET /api/sync/status` | Public Storage ID identifies the configured initialized database; see shared setup |

`frontend/lib/api.ts` sends camel-case JSON with bearer authorization and preserves API status/ProblemDetails. `frontend/lib/auth.tsx` owns the shared client and tab session. Live ride history loads all 50-record pages. Food/Express must receive their own adapters and endpoints rather than being sent through ride endpoints.

The existing API includes admin driver onboarding and driver status transitions; the frontend does not yet provide driver/admin dashboards. Merchant publishing is implemented separately from driver dispatch and order fulfillment. GrabRide merchant registration requires only name, phone, password, motorcycle plate and location; Food/Express keep their business forms. The current frontend/backend build, 50 frontend tests and 19 SQL-backed backend tests pass. Shared browser-origin proxy requests use `/backend` and `API_PROXY_URL`; clones must target one central API. Visual browser QA and an actual second physical device remain unverified; automated tests exercise two client stores, separate HTTP clients, offline retry, ownership and concurrency.
