# Executed verification

## Shared API/database synchronization — 16 November 2026

- Frontend: 50 tests passed; lint and production build/TypeScript passed. New tests exercise separate device stores through a shared transport, offline retry, guest-data import, account isolation, delayed responses after switching accounts, independent-section merging and conflicting-edit protection.
- Backend: 19 SQL-backed tests passed, 0 failed/skipped. Additional integration scenarios cover separate authenticated clients reading the same snapshot, other-account/anonymous isolation, SQL persistence, stale/simultaneous write rejection, supported-section validation, public review privacy, matching Storage IDs on one database and different IDs on independently migrated databases.
- Applied additive SharedAccountData and SharedStorageIdentity migrations to the selected local SQL instance. Existing account, ride and merchant tables/records are retained.
- Running frontend/API verification passed: 22 production page routes, existing redirects/not-found checks and six raw/optimized photos; `/backend/api/sync/status` reached SQL through the frontend proxy, and private snapshots returned 401 anonymously. Direct and proxied requests returned the same Storage ID. `npm run check:shared-api` passed.
- No development test accounts/reviews/orders were added. Tests use isolated disposable databases. No public hosting, firewall modifications or actual second physical device/browser verification was performed. Cross-device access still requires configuring a reachable central API URL; cloning does not create that host.

## Simplified GrabRide registration — 16 November 2026

- GrabRide registration renders exactly five data inputs: name, phone number, password, motorcycle license plate and location. Render checks confirm no extra business fields or password confirmation; Food/Express retain their business forms.
- Frontend: 38 tests passed; lint and production build/TypeScript passed.
- Backend: 16 SQL-backed integration tests passed. The additional test registers using only the five requested values, validates missing/invalid plates, updates and reloads rider details, verifies SQL persistence and confirms plates are omitted from public listings. Food/Express still reject incomplete business profiles.
- Applied `20261116135523_RideMerchantDetails` to the selected local SQL instance. It adds a nullable plate column and preserves existing accounts.

## Merchant publishing verification — 16 November 2026

- `dotnet build backend`: passed with zero warnings/errors (.NET SDK 10.0.404).
- Generated and applied `20261116133813_MerchantPublishing` on the selected `DESKTOP-DCDNJIN\MSSQLSERVER01` / GrabPlatformDB instance. The migration adds merchant profiles, images and listings.
- `GRAB_TEST_SQL_SERVER=DESKTOP-DCDNJIN\MSSQLSERVER01 dotnet test tests/Grab.Api.Tests`: 15 passed, 0 failed/skipped, using isolated SQL databases. New cases cover registration for all three services, merchant login and role restrictions, profile validation, hashed passwords, image signatures/size, USD price validation, image/listing ownership, persistence across login, draft/published visibility, filtering after service changes, slideshow links, public-data privacy, unpublishing and Swagger generation.
- Frontend: 35 tests passed; production build/TypeScript and lint passed. New client tests cover merchant sessions, multipart/bearer uploads, listing updates and API-relative image URLs.
- Production HTTP smoke verification: 22 pages, including merchant registration/portal and a runtime partner route; existing redirects/not-found handling and six raw/optimized store photos passed.
- No browser surface was connected, so no interactive or visual browser QA was performed. No sample merchant accounts/listings were added to the development database; integration fixtures create and remove their own databases.

The earlier baseline results below describe the original API verification before the subsequent phone-authentication and merchant updates.

Date: 13 November 2026 (Asia/Bangkok).

Environment: Windows, .NET SDK 10.0.403, net10.0, EF Core/JWT packages 10.0.15, SQL Server Developer Edition at localhost with Windows Authentication, Next.js 16.4.6.

| Check | Result |
|---|---|
| `dotnet build backend` | Passed; zero warnings/errors |
| `dotnet ef migrations add InitialCreate --project backend` | Generated migration + model snapshot |
| `dotnet ef database update --project backend` | Passed; created GrabPlatformDB and applied InitialCreate |
| `dotnet test tests/Grab.Api.Tests --nologo` | 4 passed, 0 failed, 0 skipped; real isolated SQL Server databases |
| `npm test` in frontend | 3 passed; TypeScript API client exercised with mocked fetch |
| `npm run lint` in frontend | Passed |
| `npm run build` in frontend | Passed, including TypeScript |
| Live `GET http://localhost:5000/health` | `{ "status": "ok" }` |
| Live `GET /swagger/v1/swagger.json` | HTTP 200 |
| Live browser-origin CORS preflight | localhost:3000 allowed; untrusted origin receives no permission header |
| SSMS-equivalent read-only SQL inspection | Users, Drivers, Rides, Payments, Reviews, __EFMigrationsHistory exist |
| Test database cleanup inspection | No GrabPlatformTest_UUID databases remained |

## API scenarios asserted

1. Customer registration, login, JWT profile retrieval, driver availability, booking, direct SQL persistence verification, own ride history, assigned-driver acceptance/start/completion, simulated payment, own payment history, review creation/retrieval.
2. Reject duplicate email ignoring case; incorrect credentials; anonymous and tampered JWT access; non-admin driver onboarding; invalid coordinates, missing coordinates, invalid page and enum; customer accepting a ride; repeated/terminal cancellation.
3. Reject cross-customer ride details; hide other customers' ride lists/payment histories; reject another customer's payment; reject payment/review before completion and duplicates afterward.
4. Two drivers race to accept one ride: exactly one succeeds. Losing/unassigned driver cannot progress it. Customer cancellation releases availability.
5. One driver races to accept two rides: exactly one succeeds; the other conflicts.

Each API test provisions a fresh database, migrates it, generates credentials, uses the real JWT middleware/controllers/services and SQL provider, then deletes only that fixture's database. Client tests separately verify bearer headers/in-memory logout, field errors, and 401 clearing. Client mocked-fetch tests are not a browser end-to-end test.

## Not claimed as tested

No existing browser registration/booking UI exists and no new page was authorized. No browser end-to-end booking was performed. No Express instance is installed here; SQL validation ran against Developer Edition using the same SQL Server provider. No real payments, map routing, SMS/email, production deployment, load test, manual SSMS UI operation, or bootstrap-admin CLI execution was performed. Admin-only onboarding was exercised using a test-seeded administrator; the local development database has no seeded passwords or accounts.
