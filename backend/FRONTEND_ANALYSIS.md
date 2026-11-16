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
| Food menu/cart/orders/store reviews | None | Local catalogue/browser demo; backend phase required |
| Express booking/history/cancellation | None | Separate browser demo; backend phase required |
| Addresses/favourites/wallet | None | Browser demo; backend phase required |

`frontend/lib/api.ts` sends camel-case JSON with bearer authorization and preserves API status/ProblemDetails. `frontend/lib/auth.tsx` owns the shared client and tab session. Live ride history loads all 50-record pages. Food/Express must receive their own adapters and endpoints rather than being sent through ride endpoints.

The existing API includes admin driver onboarding and driver status transitions; the frontend does not yet provide driver/admin dashboards. Merchant publishing is implemented separately from driver dispatch and order fulfillment. GrabRide merchant registration requires only name, phone, password, motorcycle plate and location; Food/Express keep their business forms. The current frontend and backend build, 38 frontend tests pass, and 16 backend tests pass. Visual browser QA remains outstanding because browser control was unavailable during this audit.
