# Frontend audit — 16 November 2026

Scope: application pages, shared components, browser stores, pricing, translations, assets, API contracts, dependencies, production build, and the existing ASP.NET Core API. Service scope is **GrabRide, GrabFood, and GrabExpress**. Express replaces Mart at the user's request.

Update, 18 November 2026: the backend now has the additive `ParcelDeliveries` migration and server-priced quote, booking, history, ownership, cancellation and courier lifecycle endpoints. The Express pages in this audit still run their explicit local simulation; API adapter, maps and live tracking remain later phases. Legacy snapshots have not been migrated or removed.

## Result

Cross-device update: signed-in Food/Express/account state now persists through the API into SQL Server with a per-account browser cache/retry queue. Public merchant views/reviews and account snapshots refresh automatically. Guest data remains local until explicit import. Offline ride simulation is opt-in, so a failed API no longer silently creates isolated bookings. See [shared setup](../SHARED_SETUP.md) for the single central API/database requirement and Storage ID verification. Latest checks: 50 frontend tests, 19 SQL-backed backend tests, lint and production build pass.

GrabRide merchant location now has device detection and a Phnom Penh district/sangkat picker, shared by registration and profile editing. The offline reference includes all 14 districts and 105 sangkats from the [NCDD gazetteer](https://db.ncdd.gov.kh/gazetteer/view/province.castle?pv=12), checked 16 November 2026. Eight additional automated checks cover geography integrity, parent/child selection, saved-location restoration, coordinate validation and geolocation success/failure cases. All 46 frontend tests, lint and production build/TypeScript pass. Geolocation is tested with a supplied provider; the actual browser permission dialog/device sensor and interactive layout have not been verified in a browser.

The frontend compiles and its automated checks pass. It is a working university demo. Merchant publishing and signed-in demo Food/Express/account records now persist in SQL Server; browser storage is a retry cache for signed-in users and local storage for guests. Existing price, payment and fulfillment simulations remain demo behavior.

Browser control was unavailable in this session. No desktop/mobile screenshot review or browser interaction test was completed. Build, HTTP, and logic checks cannot establish that every responsive layout and keyboard interaction works visually.

## Page and data inventory

| Routes | Current behavior | Data source |
|---|---|---|
| `/` | Service cards, search, favourites, featured restaurants, merchant offers, carousel | Local food catalogue; SQL-backed merchant offers and `GET /api/banners`, with service slides when no featured offers exist |
| `/merchant`, `/merchant/register` | Merchant phone/password sign-in, registration, business profile, photo uploads, listing editor with customer preview, draft/publish controls | SQL-backed API with Merchant role and ownership checks |
| `/partners/[id]` | Public business information, hours, contact details, published offers | SQL-backed public merchant API; owner/sign-in details omitted |
| `/food`, `/store/[id]` | Search/filter/sort, menus, item options, cart, reviews | Static demo catalogue; signed-in cart/reviews in SQL; public reviews refresh through the API |
| `/cart`, `/orders` | Promos, tips, address validation, demo payment, receipts, reorder, simulated tracking | Signed-in SQL account snapshot with a browser retry cache; guests local |
| `/express` | Sender/recipient contacts, street addresses, pickup/drop-off areas, parcel size/weight, estimate, confirmation | Signed-in SQL account snapshot; quote/timeline still simulated; guests local |
| `/deliveries` | Parcel history, simulated statuses, map, cancellation before collection | Signed-in SQL account snapshot; guests local |
| `/ride`, `/rides` | Booking, tracking, cancellation, simulated payment, review | Existing ride API by default; isolated offline simulation requires explicit opt-in |
| `/login`, `/register` | Real customer authentication | Existing API; no fake offline account creation |
| `/profile`, `/wallet` | Account display, addresses, preferences, demo balance/top-ups/history | API user plus signed-in SQL account snapshot; guests local |
| `/credits`, unknown URLs | Attributions and not-found UI | Static |
| `/mart` | Redirects to `/express` | Compatibility route |

Legacy Mart catalogue records remain only to read historical receipts and preserve existing pricing fixtures. They are excluded from home/search/navigation, their store pages redirect to Express, and new Mart checkout is blocked. Existing saved data is not deleted.

## Findings addressed

- Installed dependencies did not match the lockfile: Leaflet was missing and the initial build failed. `npm ci` restored the committed dependencies; the build then passed.
- Added an actual Express booking/tracking flow instead of renaming a grocery storefront. Food orders and parcel deliveries have separate storage and types.
- Updated home, navigation, footer, search, profile links, metadata, social preview, English and Khmer service descriptions.
- Replaced developer-facing empty banner slides with useful Food/Express service slides.
- Replaced the opaque `no-cors` availability probe with a readable successful `/health` response. Wrong services and error responses no longer force rides into live mode.
- Added request timeouts, invalid-session validation, and session change notifications. Expiry/401 now clears the user displayed by the provider and the saved tab session. Successful login switches the ride service to live mode.
- Removed the unsupported vehicle selector from live booking. The current backend ignores vehicle selection and sets a flat development fare; the selector remains functional in demo mode.
- Restricted live customer-only booking/payment/review controls, load all 50-record API pages, abort stale history loads, reset history on account changes, and prevent duplicate actions while a request is running.
- Fixed map stacking over navigation, bounded map tile loading/fallback, and handled failed dynamic map imports.
- Improved dropdown keyboard support, search labels, selected filter state, and mobile drawer focus/resize behavior.
- Consolidated cart persistence with the shared store; added corrupt-data guards and cross-tab notifications. Guarded invalid wallet amounts/cart quantities and closed-store form submission. Matched registration length limits to API DTOs.

## Verification

- `npm run lint`: passed.
- `npm test`: 28 tests passed, including API/session regressions, Express validation/pricing/statuses, food checkout/wallet persistence, invalid amounts, cross-tab storage, cancellation and refresh.
- `npm run build`: production compilation, TypeScript validation, and prerendering passed.
- `npm run smoke`: 19 pages and all six raw/optimized restaurant photos served; retired Mart URLs redirected with 307 and a Location header; unknown paths rendered not-found responses. A streamed Next.js not-found response may initially have status 200 with `noindex`, then 404 once cached, per the bundled framework documentation.
- Existing backend `dotnet build backend --no-restore`: passed, zero warnings/errors.
- Existing `dotnet test tests/Grab.Api.Tests --no-restore`: 4 tests passed against isolated SQL Server databases, including authentication, ride lifecycle, payment/review and ownership checks. These tests delete only their own generated test databases.
- Running API: `/health` returned 200; the shipped frontend client reported online; allowed-origin CORS headers and ride POST preflight passed; anonymous `/api/auth/me` returned 401. `/api/banners` returned 404 as expected for the current backend.
- `npm audit --omit=dev`: zero reported production vulnerabilities. Full audit reports seven moderate development-tool dependency findings through `typescript-eslint`/`minimatch`; `npm audit fix` did not resolve that dependency tree. No forced major upgrade was applied.

## Remaining work before full API integration

1. Implement Food and Express entities, DTOs, endpoints, and EF migrations; then replace the browser adapters. See [backend implementation plan](../backend/IMPLEMENTATION_PLAN.md).
2. Make prices, promos, availability, payments, status transitions, and ownership server-authoritative. Browser/demo values must not be accepted as trusted amounts.
3. Add backend fields/endpoints for vehicle choice, durable review state, addresses, wallet and favourites. A successful live ride review is currently remembered on the current page; the ride DTO does not report whether an earlier review exists after refresh.
4. Add driver dispatch and merchant order fulfillment if required by the assignment. Merchants can publish their businesses and offers, while customer enquiries use phone/email; listings do not yet enter the demo food cart or assign ride/Express bookings.
5. Perform browser QA at 360/390/768/1280 px: check menu focus/Escape, dropdown scrolling, both languages, themes, item-options dialogs, failed maps, checkout, Express validation/booking/cancellation, login refresh/expiry and real API error states.

Maps use straight lines and selected landmark areas. Food delivery pins are simulated from address text; Express does not geocode street addresses. These displays and delivery timings are explicitly demonstrations, not real courier/GPS tracking. All payment methods are simulated.

## Phone-only authentication update — 16 November 2026

Sign-in and account creation now ask only for phone number and password, with phone-keypad/autofill support, format validation and password visibility controls in English/Khmer. Success returns home; sign-out remains one click. The matching API normalizes equivalent Cambodian/international formats, enforces phone uniqueness and preserves existing passwords/accounts. Email is a nullable legacy database field and is omitted from user JSON.

The committed PhoneNumberAuthentication migration is applied on `DESKTOP-DCDNJIN\MSSQLSERVER01`. Verification: 31 frontend tests, 10 backend tests (including existing-account migration and duplicate rollback), lint and production build passed. HTTP smoke checks verify both auth pages render only phone/password inputs. Browser visual/interaction QA remains outstanding as described above.

## Phone greeting and editable profile name — 16 November 2026

Desktop/mobile navigation greets the saved profile name, falling back to the signed-in phone number when no personal name is set. Profile → Settings has a name editor backed by authenticated `PATCH /api/auth/me`. Saving updates the SQL account and the provider/session immediately; the greeting updates to the saved name. The existing FullName column is reused without a migration.

Build and lint passed, with 33 frontend and 11 backend tests. Added checks cover profile persistence across sign-in, trimmed Unicode names, validation/authorization, preservation of phone/password/role, browser-session updates and a pending save after sign-out.
