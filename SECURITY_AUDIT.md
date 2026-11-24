# Security and reliability review — 24 November 2026

Reviewed the Next.js frontend and ASP.NET Core / SQL Server API: authentication and session changes, administrator permissions, record ownership, guest receipt tokens, checkout and pricing, wallet callbacks, uploads, input validation, routing limits, browser storage, configuration and dependencies. Changes are local; no deployment, real account edits or database migrations were performed. Integration tests created and removed isolated databases.

## Confirmed findings fixed

| Area | Finding and resulting behavior |
| --- | --- |
| Administrator authorization | Legacy `/api/rides`, `/api/deliveries/{id}` and `/api/drivers` routes checked the Admin role without the console's section permissions. Restricted administrators now need `rides.view`, `rides.manage`, `deliveries.view`, `drivers.view` or `drivers.manage` as appropriate. Ride and delivery checks run inside their services, including calls from other controllers. Role edits apply on the next request. Customer and assigned-worker access still passes its existing ownership checks. |
| Suspended driver applicants | The older driver-creation endpoint could onboard a suspended customer. The shared driver service now requires an active account, matching the console endpoint. |
| CORS | `PUT` was missing from the allowed methods, blocking direct browser edits of roles, promotions and categories. Configured origins can now preflight those endpoints; untrusted origins remain denied. This follows the [ASP.NET Core CORS method configuration](https://learn.microsoft.com/en-us/aspnet/core/security/cors?view=aspnetcore-10.0). |
| Administrator prices | Listing edits silently rounded fractional cents in SQL. Admin edits now reject prices with more than two decimal places before saving, matching merchant edits. |
| Wallet ownership | Wallet helpers accepted any nonempty user ID while reading or changing the currently selected account's wallet. They now require that the supplied ID equals the active account. Delayed calls after switching accounts or logging out cannot read or change another wallet. |
| Top-up dialog races | Responses after account changes or unmounting are ignored. A completed payment cannot regress to pending or error when older work finishes. Completion notifications run once per dialog, polling does not overlap, and payment errors show a retry state. If cancellation finds the payment already paid, the dialog credits it before closing. Each account gets a fresh dialog instance. |
| Whole-cent amounts | Floating-point multiplication rejected valid top-ups such as $1.09 and $1.10. Validation accepts every cent amount from $1 to $500 and still rejects fractional cents and out-of-range amounts. |
| Demo payment identifiers | Timestamp/random identifiers could collide and overwrite a payment created in the same millisecond. Top-ups now use `crypto.randomUUID()`. |
| Corrupt browser data | Demo top-ups validate nested amounts, currencies, statuses, dates and QR data. Inherited properties such as `constructor` are never treated as payment records. The common store rejects null or array values where an object is required. |
| Build and lint | Set the frontend's Turbopack root explicitly, removing ambiguous workspace detection caused by two lockfiles. Admin avatar components now use dimensioned, unoptimized Next images for the existing embedded image data; lint passes without warnings. |

The existing protections remain in place: JWT signature/lifetime/account-version validation, account and guest-token ownership checks, private response `no-store`, security headers, bounded request and route-response sizes, route concurrency limits, upload size/signature checks, bounded public review projection, SQL rowversions and assignment constraints, and guarded API responses after account switching. Regression tests also exercise these protections.

## Verification

- **Frontend: 190 tests passed.** Includes wallet account isolation, delayed payment responses, paid/cancel races, malformed caches, identifier collisions and all 49,901 valid whole-cent top-up amounts.
- **Backend: 80 tests passed** against SQL Server, including the four new regression tests. The new permission, CORS, suspended-applicant and fractional-cent tests all failed against the original implementation and passed after the fixes.
- `npm run lint`: passed with zero warnings or errors.
- `npm run build`: passed, including TypeScript and all 33 prerendered pages, without the workspace-root warning.
- `npm audit --json`: **zero reported vulnerabilities**, including development dependencies. The earlier review's picomatch finding is no longer reported by the current dependency tree and registry audit.
- NuGet vulnerability scans of the backend and test project, including transitive packages: **no reported vulnerable packages**.
- Production HTTP smoke check: **25 pages**, API proxy/privacy checks, redirects, not-found behavior, and six raw/optimized photos passed.
- Live API checks, directly and through the production frontend proxy: health 200; anonymous private data 401; null login JSON 400; private responses `no-store`; `nosniff` and frame denial present; server identification absent; trusted-origin PUT preflight works; untrusted-origin preflight is denied.
- Credential-pattern scan of tracked/non-ignored sources found no matching private-key blocks or common AWS/GitHub/OpenAI/Slack token formats. This did not scan Git history or external secret stores.
- `git diff --check`: passed.

The local API was rebuilt and restarted on port 5000 with these fixes. A temporary production frontend was used for HTTP checks; the existing development frontend remains on port 3000.

## Scope and remaining demo boundaries

These results do not certify the application as free of every vulnerability or bug. The wallet, sample storefront orders and optional offline rides remain demonstrations with client-editable state. Payments are simulated; no real Bakong settlement backend is implemented. They must not be used as an authoritative money ledger.

Session tokens remain accessible to same-origin JavaScript in sessionStorage. The current CSP restricts framing, objects, base URLs and form destinations, but does not provide a strict script policy. Converting authentication to secure server-managed cookies and deploying a strict CSP require a coordinated authentication/rendering change.

Production TLS, SQL certificate trust, reverse-proxy configuration, deployed infrastructure and production secret management were not validated. The checked-in SQL connection uses development Windows authentication and trusts the server certificate. Configure and verify those deployment settings before production use. Rate limits and routing concurrency limits are per application instance.

## Repeat the checks

From the repository root (set the SQL instance for the machine running the tests):

```powershell
$env:GRAB_TEST_SQL_SERVER = 'localhost\MSSQLSERVER01'
dotnet test tests/Grab.Api.Tests/Grab.Api.Tests.csproj --artifacts-path tests/TestResults/security-build
dotnet list backend/Grab.Api.csproj package --vulnerable --include-transitive
dotnet list tests/Grab.Api.Tests/Grab.Api.Tests.csproj package --vulnerable --include-transitive
cd frontend
npm test
npm run lint
npm run build
npm audit
```

The separate artifacts path lets tests build while a development API is running on Windows. With the API and a frontend server running, `npm run smoke` repeats the HTTP checks; set `SMOKE_BASE_URL` to target a temporary production server on another port.
