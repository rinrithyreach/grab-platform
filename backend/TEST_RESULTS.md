# Executed verification

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
