# Grab Platform backend

.NET 10 controller API with EF Core SQL Server, Windows Authentication, PasswordHasher, JWT roles, Swagger, and SQL-backed integration tests. Read [frontend analysis/API mapping](FRONTEND_ANALYSIS.md), [API contracts](API_DOCUMENTATION.md), and [database ERD](DATABASE_ERD.md).

The existing frontend contains only the Next.js starter page. Per the user's instruction, all pages/layouts/styles remain unchanged. `frontend/lib/api.ts` supplies typed API functions; there are no browser login/booking controls. Use Swagger for the university demonstration.

## Local setup in Windows PowerShell

Run commands from the repository root. Install .NET 10 SDK and SQL Server Express (Database Engine Services, named instance SQLEXPRESS) plus SSMS if setting up another computer. This computer already has .NET 10.0.403 and SQL Server **Developer Edition at localhost**, not SQLEXPRESS. A Windows-authenticated connection override and random JWT key have already been stored locally in .NET User Secrets, and GrabPlatformDB has been migrated on localhost. No credentials/signing keys are committed.

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
dotnet user-secrets set 'ConnectionStrings:DefaultConnection' 'Server=.\SQLEXPRESS;Database=GrabPlatformDB;Trusted_Connection=True;TrustServerCertificate=True' --project backend
```
For **this computer's installed instance**, use instead:
```powershell
dotnet user-secrets set 'ConnectionStrings:DefaultConnection' 'Server=localhost;Database=GrabPlatformDB;Trusted_Connection=True;TrustServerCertificate=True' --project backend
```
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
Open `http://localhost:5000/swagger`. `/health` checks process liveness only.

In another terminal, run the existing frontend:
```powershell
cd frontend
Copy-Item .env.example .env.local
npm ci
npm run dev
```
Open `http://localhost:3000`. The unchanged welcome page is expected. NEXT_PUBLIC_API_URL is a public URL, never a secret.

## Provision the first Admin and a Driver

Before starting the API, choose initial admin credentials through local prompts:
```powershell
dotnet user-secrets set 'Bootstrap:Email' (Read-Host 'Admin email') --project backend
$adminPassword = [System.Net.NetworkCredential]::new('', (Read-Host 'Admin password (12+ chars)' -AsSecureString)).Password
dotnet user-secrets set 'Bootstrap:Password' $adminPassword --project backend
Remove-Variable adminPassword
dotnet run --project backend --launch-profile http -- --bootstrap-admin
dotnet user-secrets remove 'Bootstrap:Password' --project backend
dotnet user-secrets remove 'Bootstrap:Email' --project backend
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

Create one client instance in a future client-side provider/component using `createApiClient()` from `@/lib/api`. Keep that instance across renders (for example, useState initializer). Do **not** share an authenticated client as a server-side global between users. Login/register establish an in-memory session; every request uses the Authorization Bearer header. The token is never written to localStorage, sessionStorage, URLs, or cookies. Reload requires login; logout clears memory. A 401 clears the token. This avoids persistent browser token storage and ambient-cookie CSRF. It does not remove the need to prevent XSS. There is no refresh-token flow or remote logout revocation.

Methods throw ApiError with status and validation fields; network/abort failures retain native fetch errors. Paged methods return [] when empty. Future components should set loading before await, display success/empty/error states, and clear loading in finally; they are intentionally not added to the existing UI.

## Tests

Tests require a real SQL Server reachable with Windows Authentication and permission to create/drop isolated test databases:
```powershell
$env:GRAB_TEST_SQL_SERVER = 'localhost' # or '.\SQLEXPRESS'
dotnet test tests/Grab.Api.Tests --nologo
cd frontend
npm test
npm run lint
npm run build
```
Each API test creates/migrates a unique GrabPlatformTest_UUID database, exercises real HTTP controllers, JWT, services, and SQL, then deletes only its own database. It never drops GrabPlatformDB. Tests generate credentials at runtime. See TEST_RESULTS.md for executed results and limits.

## SSMS inspection

Connect using Database Engine → `localhost` on this computer (or `.\SQLEXPRESS` on Express) → Windows Authentication; trust the local server certificate if prompted. Refresh Databases → GrabPlatformDB → Tables. Inspect dbo.Users, Drivers, Rides, Payments, Reviews and __EFMigrationsHistory. Do not publish PasswordHash values. Use Select Top 1000 Rows on Rides/Payments to show persisted bookings and simulated transactions.

## Completion and limits

Implemented: secure customer authentication, admin-only driver onboarding, scoped ride lists/details, acceptance/start/completion/cancellation, driver availability, ownership checks, database constraints/concurrency, migrations, OpenAPI, typed client and tests.

Mocked deliberately: configurable flat USD development fare (default $5); no real route distance, geocoding, ETA, or transport pricing. Payments immediately create SimulatedSucceeded records; no money moves and no card details are collected.

Not implemented: frontend forms/pages (explicit user preference), real payment/maps providers, live driver GPS updates, password reset/email verification, refresh tokens/revocation, production deployment. Existing UI offers no domain functionality to preserve or connect beyond the supplied API functions.

Implementation references: [Microsoft JWT validation](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/configure-jwt-bearer-authentication?view=aspnetcore-10.0), [EF concurrency](https://learn.microsoft.com/en-us/ef/core/saving/concurrency), [EF migrations](https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/applying).
