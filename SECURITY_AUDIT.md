# Security and reliability review — 18 November 2026

Reviewed the local Next.js frontend and ASP.NET Core/SQL Server backend, including existing uncommitted merchant-order work. Existing work was preserved. No deployment or changes to real account records were made. SQL integration tests create and delete isolated test databases.

## Fixes

| Area | Finding and change |
| --- | --- |
| Session handling | Late login responses could restore a session after logout or overwrite a newer login. Sign-in attempts now have cancellation/version guards. Failed login attempts do not send or invalidate the current account's token. |
| Private responses | Successful requests from an earlier account could return private data after account switching. The client now rejects these responses. Restored profile updates also refresh the saved session consistently. |
| API caching and headers | Private API responses, token responses and API errors now use `Cache-Control: no-store`. Added `nosniff`, frame denial, referrer policy, production HSTS and removal of the Kestrel server header. Public merchant images retain their existing cache behavior. |
| Frontend headers | Added frame denial, `nosniff`, referrer policy, camera/microphone restrictions and same-origin geolocation. CSP restricts frames, embedded objects, base URLs and form destinations. Removed `X-Powered-By`. This is a baseline CSP, not a strict script policy. |
| Request resource limits | Kestrel limits request bodies to 2,200,000 bytes; existing narrower endpoint limits still apply. Invalid/oversized HTTP requests preserve their client-error status. |
| Road routing | The previous size check ran after buffering the entire body. Requests now have a streamed 512-byte limit, upstream responses a 2,000,000-byte limit, and reading/fetching share a six-second deadline. Redirects are rejected; at most 16 route requests run concurrently per process. |
| Public reviews | Anonymous reads previously loaded every matching full account snapshot into API memory. SQL now projects only public review fields and returns at most 1,000 rows. Sorting uses actual timestamps, including time-zone offsets. |
| Checkout | Null order lines and empty product IDs return 400 instead of causing errors. A completed checkout or late unavailable-store response cannot erase a newer cart. Non-finite product prices are rejected locally. |
| Ride validation | The server rejects invalid GPS coordinates and identical pickup/destination coordinates, independently of browser validation. |
| Driver onboarding | Accounts with merchant orders cannot be converted into driver accounts, which would remove access to their customer-only order endpoints. |
| Persisted data | Malformed nested addresses, reviews and wallet transactions recover to defaults instead of crashing screens. Wallet operations reject numerical overflow and amounts that round to zero. |
| Dependencies | Updated the TypeScript ESLint dependency family to 8.73.0, bringing in minimatch 11.0.9 and removing its reported denial-of-service vulnerability. |

The cache policy follows [ASP.NET Core response caching guidance](https://learn.microsoft.com/en-us/aspnet/core/performance/caching/response?view=aspnetcore-10.0). The minimatch fix is described in [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249).

## Verification

- Frontend: 97 tests passed, including session races, response isolation, chunked size limits, route concurrency, malformed storage, checkout/cart races, vehicle selection and registered-merchant availability.
- Backend: 39 tests passed in the complete SQL-backed suite, including public-review limits and vehicle-specific ride dispatch.
- `npm run lint`: passed.
- `npm run build`: passed, including TypeScript and prerendering. Build output was restored to the project's normal environment after the isolated API checks.
- `npm audit --omit=dev --json`: zero reported production dependency vulnerabilities.
- `dotnet list backend/Grab.Api.csproj package --vulnerable --include-transitive --format json`: no reported vulnerable packages.
- Live loopback API checks: protected endpoints reject anonymous requests; security/cache headers are present; no server header; null login JSON returns 400; an oversized login body returns 413; an untrusted CORS origin receives no allow-origin header.
- Credential-pattern scan across tracked and non-ignored source files: no matching private-key blocks or common AWS/GitHub/OpenAI/Slack token formats. This was a pattern scan, not a full Git-history or external secret-store audit.
- `npm run smoke`: passed against the running frontend and API: 22 pages, proxy/privacy checks, redirects, not-found handling and six raw/optimized photos.
- `git diff --check`: passed.

The frontend was already running on port 3000 for the final HTTP smoke check. The backend was restarted on port 5000 after verification, and its `/health` endpoint returned 200.

## Remaining dependency issue and scope

The complete npm audit still reports **14 high-severity affected dependency entries**, all tracing to **one picomatch advisory** in development tooling. The installed/latest picomatch release (4.0.7) is affected, and [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) lists no patched release as of this review. No forced framework downgrade, dependency deletion or audit suppression was applied. Avoid accepting untrusted glob patterns in build/lint tooling and recheck the advisory when an upstream fix is released.

This review does not certify the application as vulnerability-free. The project remains a university demo: wallet balances and demo snapshots are client-editable, payments are simulated, and session tokens remain accessible to same-origin JavaScript in sessionStorage. The added CSP does not prevent arbitrary inline script execution. Deployment TLS, SQL certificates, proxy trust, infrastructure limits and production secrets were not audited against a deployed environment. The in-process route concurrency cap is not a distributed rate limiter.

To repeat the checks from the repository root:

```powershell
dotnet test tests/Grab.Api.Tests/Grab.Api.Tests.csproj
dotnet list backend/Grab.Api.csproj package --vulnerable --include-transitive
cd frontend
npm test
npm run lint
npm run build
npm audit --omit=dev
npm audit
```

With the configured API and a local frontend server running, `npm run smoke` repeats the HTTP page/proxy/image checks.
