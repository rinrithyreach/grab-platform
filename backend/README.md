# Grab Platform backend

.NET 10 controller API with EF Core SQL Server, Windows Authentication, PasswordHasher, JWT roles, Swagger, and SQL-backed integration tests. Read [frontend analysis/API mapping](FRONTEND_ANALYSIS.md), [API contracts](API_DOCUMENTATION.md), and [database ERD](DATABASE_ERD.md).

The frontend provides Ride, Food and Express customer pages (Express replaces Mart). Authentication, live rides and merchant publishing use dedicated API tables. Signed-in Food/Express demo records and account extras now persist in the API's AccountData table with optimistic concurrency. See [shared setup](../SHARED_SETUP.md) for multiple PCs/phones, the [frontend audit](../frontend/AUDIT.md), and [implementation plan](IMPLEMENTATION_PLAN.md) for normalized fulfillment endpoints that remain future work.

## Local setup in Windows PowerShell

Run commands from the repository root. This API host uses the SQL Server named instance **DESKTOP-DCDNJIN\MSSQLSERVER01** with Windows Authentication and the database **GrabPlatformDB**. The steps below are for the central API host or an isolated development installation. Frontend clones that should share data must connect to this central API; they do not need their own SQL Server or JWT key. Install the .NET 10 SDK, SQL Server Database Engine and SSMS when creating another independent API host. The JWT signing key stays in User Secrets; no credentials/signing keys are committed.

Restore the committed dependency versions and EF tool:
```powershell
dotnet restore backend
dotnet tool restore
dotnet build backend
```
The existing csproj contains the NuGet dependencies. To add them when recreating the API manually:
```powershell
dotnet add backend package Microsoft.EntityFrameworkCore.SqlServer --version 10.0.15
dotnet add backend package Microsoft.EntityFrameworkCore.Design --version 10.0.15
dotnet add backend package Microsoft.AspNetCore.Authentication.JwtBearer --version 10.0.15
dotnet add backend package Swashbuckle.AspNetCore --version 11.0.1
```
For a fresh computer, generate a local key (compatible with Windows PowerShell 5.1) and set a Windows-authenticated connection:
```powershell
$keyBytes = New-Object byte[] 48
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($keyBytes)
$rng.Dispose()
dotnet user-secrets set 'Jwt:SigningKey' ([Convert]::ToBase64String($keyBytes)) --project backend
dotnet user-secrets set 'ConnectionStrings:DefaultConnection' 'Server=DESKTOP-DCDNJIN\MSSQLSERVER01;Database=GrabPlatformDB;Trusted_Connection=True;TrustServerCertificate=True' --project backend
```
On another computer, change the `Server` value to the SQL Server instance shown in that computer's SSMS connection.
`UserSecretsId` is already initialized in the csproj. Changing the signing key invalidates existing tokens. User Secrets are for local development; deployed environments should provide `Jwt__SigningKey` and `ConnectionStrings__DefaultConnection` through a secret store/environment. Production must use a trusted SQL certificate, HTTPS, an appropriate AllowedHosts value, and explicit frontend CORS origins.

Apply the **committed** initial migration (creates the database if absent):
```powershell
dotnet ef database update --project backend
```
Only after future model changes, create an additional migration:
```powershell
dotnet ef migrations add DescribeYourChange --project backend
dotnet ef database update --project backend
```
Do not regenerate InitialCreate on an already initialized project. SQL failures: confirm the Database Engine service is running, instance name is correct, and your Windows account has create-database/schema permissions. Application startup never silently migrates or resets a database.

Run API:
```powershell
dotnet run --project backend --launch-profile http
```
Open `http://localhost:5000/swagger`. During development, opening `http://localhost:5000` redirects to Swagger. The customer website runs separately at `http://localhost:3000`. Keep the API terminal running; closing it stops the backend. `/health` checks process liveness only.

Run only one backend instance at a time. Stop the existing API with **Ctrl+C in its terminal** before running `dotnet run` again. An `MSB3021`/`MSB3027` error saying `Grab.Api.exe` is locked by `Grab.Api` means another copy is still running; it is not a database migration error. If that terminal was closed while the process stayed alive, stop the specific `Grab.Api` process for this project in Task Manager, then run the command again.

In another terminal, run the existing frontend:
```powershell
cd frontend
Copy-Item .env.example .env.local
npm ci
npm run dev
```
Open `http://localhost:3000` for the customer application. NEXT_PUBLIC_API_URL is a public URL, never a secret.

## Merchant publishing

Live GrabRide tracking uses the additive `RideLiveLocation` migration (`dotnet ef database update --project backend`), applied to the current local database. After accepting, the merchant selects **Share live location** and grants browser GPS access. Customers see the approaching driver on the confirmation and My rides maps. GPS requires HTTPS or localhost and an open driver dashboard; stale positions are labelled paused. Only an assigned merchant/driver can update or stop sharing, and completion/cancellation clears the coordinates. See [API contracts](API_DOCUMENTATION.md) for the GPS endpoints.

Each merchant account is limited to the service chosen at registration. Profile editing does not offer other services, and the API rejects attempts to change the registered service.

The customer ride map reads `GET /api/merchants/ride-areas?page=1` to display registered GrabRide merchant areas without listings. The endpoint returns 100 public display names, saved addresses, vehicle types and work schedules per page; user IDs, account contact details, passwords and license plates are omitted. Saved GPS points and approximate administrative-area centres are resolved by the frontend. This does not report live driver positions, availability or assignment. Profile edits are visible on the map's next refresh. Apply the `RideVehicleTypes` migration before using vehicle-specific booking and dispatch; existing rides and GrabRide partners default to Motorcycle.

The navbar's **Merchant** link opens `http://localhost:3000/merchant`. Choose **GrabRide** to register with name, phone number, password, vehicle type (Motorcycle, Rickshaw or Classic), license plate, location and a weekly work schedule. Monday–Sunday checkboxes enable start/end time inputs; unchecked days are days off. Hours use Cambodia time (UTC+7), and an end time earlier than the start ends the following day. The dashboard edits the schedule and rider details. Schedules persist in the existing `OpeningHours` column. GrabRide image uploads and listing writes return 400, its dashboard returns an empty listing list, and legacy GrabRide listings are excluded from public feeds, storefronts and banners. License plates remain private. Store name, email, city, category, description and password confirmation are unnecessary for GrabRide.

GrabFood/GrabExpress registration collects the business name, private owner name, public contact phone, optional business email, selling address, city, specialty, description, opening hours, sign-in phone and password. A separate phone is required if already registered as a customer. Merchant registration always assigns the Merchant role; customer registration still always assigns Customer. Merchants cannot use customer-only live ride endpoints.

Apply the committed `MerchantPublishing` migration with `dotnet ef database update --project backend` on another computer. It adds Merchants, MerchantImages and MerchantListings without modifying existing accounts/bookings. This migration has been applied to this computer's selected SQL instance.

The subsequent `RideMerchantDetails` migration adds a nullable `MotorcycleLicensePlate` column without altering existing records. It has also been applied here. New GrabRide registrations and profile saves require a 2–30 character motorcycle plate; existing accounts can add it when editing their profile.

Merchant profiles, photos and listings persist in SQL Server. Photos accept JPG/PNG/WebP up to 2 MB, with content types inferred from file signatures. Ownership is checked on profile/listing updates and image attachment. The dashboard supports creating/editing listings, drafts, publishing and selecting homepage slideshow placement. Public feeds and business pages include published listings only; private owner/sign-in/password information is omitted. Uploaded image URLs are public, including draft images, so photos should be suitable for public viewing. Limits: 100 listings and 200 uploaded images per merchant, 24 offers per public feed page, and the 12 latest updated featured listings in the homepage slideshow.

Published offers appear in the matching customer service section and `/partners/{id}`; selected offers also populate `GET /api/banners`. Customers contact merchants directly. Merchant listings do not enter the existing local food cart or assign live ride/Express bookings. Merchant role does not grant Driver/Admin permissions. See [API contracts](API_DOCUMENTATION.md#merchant-profiles-and-publishing).

## Customer phone sign-in

Both customer sign-in and account creation require only a phone number and password. Email and full name are not requested. Passwords remain 12–128 characters and are hashed; sign-out clears the browser tab session in one click.

The navigation greeting uses the saved profile name on desktop and mobile, falling back to the phone number for accounts with no personal name. An optional name can be edited under **Profile → Settings → Name → Save**. `PATCH /api/auth/me` persists the name to SQL Server and updates the browser session; the greeting updates to the saved name immediately. No additional database migration is needed for profile names.

Cambodian numbers can be entered as `012345678`, `12345678`, or `+85512345678`; the server stores a canonical unique number. Explicit international numbers are accepted with a country code. The `PhoneNumberAuthentication` migration preserves existing account IDs, names, password hashes and relationships, normalizes phone numbers and adds a unique phone index. It stops and rolls back if legacy phones are invalid or collide. The legacy Email column remains nullable so existing email values are preserved; it is no longer used to sign in or returned in user JSON.

Apply the committed migration with `dotnet ef database update --project backend` before running the updated API. This update has already been applied on this computer's selected `DESKTOP-DCDNJIN\MSSQLSERVER01` instance.

## Provision the first Admin and a Driver

Authentication uses a phone number and password. Before starting the API, choose initial admin credentials through local prompts:
```powershell
dotnet user-secrets set 'Bootstrap:PhoneNumber' (Read-Host 'Admin phone number') --project backend
$adminPassword = [System.Net.NetworkCredential]::new('', (Read-Host 'Admin password (12+ chars)' -AsSecureString)).Password
dotnet user-secrets set 'Bootstrap:Password' $adminPassword --project backend
Remove-Variable adminPassword
dotnet run --project backend --launch-profile http -- --bootstrap-admin
dotnet user-secrets remove 'Bootstrap:Password' --project backend
dotnet user-secrets remove 'Bootstrap:PhoneNumber' --project backend
```
Bootstrap creates a new Admin and exits. It refuses to run if any Admin already exists. It does not promote an existing customer. Public registration always assigns Customer; a supplied role cannot elevate privileges.

In Swagger or Postman:
1. Register a customer and a separate driver candidate using POST /api/auth/register. Save IDs and tokens.
2. Log in as Admin, authorize its JWT, and POST /api/drivers with the candidate userId and vehicle details. Admin-only onboarding makes the candidate a Driver.
3. Log in again as that driver to get the new role token. Old role tokens are rejected.
4. Authorize as Customer; POST /api/rides; GET /api/rides/mine confirms persistence.
5. Authorize as Driver; GET /api/rides shows pending work; PATCH status Accepted, then InProgress, then Completed. Only the assigned driver can progress it.
6. Authorize as Customer; POST /api/payments then POST /api/reviews. Try a duplicate payment or another customer's record to demonstrate rejection.

Postman uses Authorization → Bearer Token. See API_DOCUMENTATION.md for exact bodies and error examples.

## Frontend integration strategy

### GrabRide merchant dispatch

GrabRide merchants retain the Merchant role and can receive customer requests through `GET /api/merchants/ride-requests`. `POST /api/merchants/ride-requests/{rideId}/response` records an explicit `{ "accept": true/false }` decision. Acceptance assigns `Rides.MerchantId` and changes status to Accepted. Declines persist per merchant and leave the ride available to others. Accepted merchants use the existing ride status endpoint to start, complete or cancel their own assignment. Customers see `merchantId` and the public `merchantName` in their own ride responses. Merchant ride list/detail endpoints are scoped to that merchant's assignments; Food/Express accounts cannot access dispatch.

The `MerchantRideDispatch` migration adds a nullable merchant assignment and a response table without deleting existing bookings. The ride rowversion plus filtered unique indexes prevent two merchants claiming one ride or one merchant holding two active rides. Completion and cancellation release the active slot. Run `dotnet ef database update --project backend` before deploying this flow to another database; it has been applied locally. This grants no Driver/Admin role or admin onboarding privileges. The existing customer payment simulation works for completed merchant rides; driver reviews still require a Driver assignment.

The frontend polls merchant inboxes and customer booking status every two seconds, plus on window focus. `/merchant` provides ride request and active ride controls. For manual testing, open `/ride` in a fresh browser tab and sign in with a separate customer account; sessions are stored per tab. Pending requests are broadcast to open GrabRide dashboards. Published work schedules are informational; they do not automatically gate receipt of requests.

### Merchant product orders (shopping flow)

Customers can now buy published GrabFood/GrabExpress listings: **storefront → Add to cart → `/cart` checkout → `/orders` live status**. The merchant receives the order on the **Orders** tab of `/merchant` and moves it Pending → Accepted → On the way → Delivered (or Rejects a new order / Cancels one it already accepted, any time before delivery). Customers may cancel while it is still Pending. Both sides refresh every five seconds. Prices are recalculated by the API from the database; see [API contracts](API_DOCUMENTATION.md#merchant-product-orders).

The additive `MerchantOrders` migration creates `MerchantOrders` and `MerchantOrderItems` without changing existing data. Run `dotnet ef database update --project backend` on any other database; it has been applied to this computer's local instance. Restart the API after pulling so the new endpoints load.

Manual test: register a GrabFood merchant, publish a listing, then in a **separate browser tab** register/sign in as a customer, open the merchant's page, add products, check out, and watch the status change as the merchant accepts it.

### Browser sessions

The frontend already creates one `createApiClient()` inside `AuthProvider`. Login/register send only `phoneNumber` and `password` as JSON and establish a bearer session; the provider persists that session in sessionStorage so refresh keeps the login, while closing the tab ends it. Logout, expiry and a 401 clear both the client and displayed user. Do not share an authenticated client as a server-side global. Session storage is a demo trade-off; production session hardening is separate work. There is no refresh-token flow or remote logout revocation.

The client throws ApiError with status and validation details, aborts requests after a timeout, and checks a readable `/health` response. Signed-in Food/Express/wallet/account demo state now persists through the account-data endpoint; the browser retains a per-account retry cache. `GET /api/sync/status` checks the database and returns its persistent public Storage ID. See [shared setup](../SHARED_SETUP.md), [current API mapping](FRONTEND_ANALYSIS.md) and [implementation plan](IMPLEMENTATION_PLAN.md).

## Tests

Tests require a real SQL Server reachable with Windows Authentication and permission to create/drop isolated test databases:
```powershell
$env:GRAB_TEST_SQL_SERVER = 'DESKTOP-DCDNJIN\MSSQLSERVER01'
dotnet test tests/Grab.Api.Tests --nologo
cd frontend
npm test
npm run lint
npm run build
```
Each API test creates/migrates a unique GrabPlatformTest_UUID database, exercises real HTTP controllers, JWT, services, and SQL, then deletes only its own database. It never drops GrabPlatformDB. Tests generate credentials at runtime. See TEST_RESULTS.md for executed results and limits.

## SSMS inspection

Connect using **Database Engine → Server name: `DESKTOP-DCDNJIN\MSSQLSERVER01` → Windows Authentication**. Refresh **Databases → GrabPlatformDB → Tables**. The same instance can also be reached as `localhost\MSSQLSERVER01`.

Inspect dbo.Users, Drivers, Rides, Payments, Reviews and __EFMigrationsHistory. Do not publish PasswordHash values. Use Select Top 1000 Rows on Rides/Payments to show persisted bookings and simulated transactions.

On 16 November 2026, the project connection was switched from the default local SQL instance to this named instance at the user's request. The previous database had no application records. The existing initial EF migration creates the schema on the selected instance; the old database remains on the default instance. Application accounts and bookings created from now on are stored in the selected named instance.

## Completion and limits

Implemented: secure customer authentication, admin-only driver onboarding, scoped ride lists/details, acceptance/start/completion/cancellation, driver availability, ownership checks, database constraints/concurrency, migrations, OpenAPI, typed client and tests.

Mocked deliberately: configurable flat USD development fare (default $5); no real route distance, geocoding, ETA, or transport pricing. Payments immediately create SimulatedSucceeded records; no money moves and no card details are collected.

Not implemented: normalized Food/Express fulfillment/dispatch, server-computed Food/Express totals, real wallet/payment processing, durable ride reviewed state in the ride DTO, vehicle-based live pricing, real routing, GPS tracking, password reset, refresh tokens/revocation and production deployment. Merchant publishing and signed-in demo Food/Express/account state are SQL-backed; existing simulations remain simulations. Guest data remains device-local. Cross-device access requires a reachable shared API host, which cloning does not provision automatically.

Implementation references: [Microsoft JWT validation](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/configure-jwt-bearer-authentication?view=aspnetcore-10.0), [EF concurrency](https://learn.microsoft.com/en-us/ef/core/saving/concurrency), [EF migrations](https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/applying).
