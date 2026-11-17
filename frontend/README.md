# Grab frontend

Next.js customer demo for GrabRide, GrabFood and GrabExpress. Express replaces Mart. See [the audit](AUDIT.md) for completed checks and remaining limits, and [the backend plan](../backend/IMPLEMENTATION_PLAN.md) for the next implementation phase.

For another PC or phone, follow [shared setup](../SHARED_SETUP.md). Every device must use one central API/database. Cloning code and starting separate databases does not synchronize data. `npm run check:shared-api` checks the configured API and prints a Storage ID to compare between PCs.

## Start locally

From the repository root:

```powershell
cd frontend
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Only copy the example on first setup; keep an existing `.env.local` if already configured. Open `http://localhost:3000`.

```dotenv
API_PROXY_URL=http://localhost:5000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

In another terminal at the repository root:

```powershell
dotnet run --project backend --launch-profile http
```

See [backend setup](../backend/README.md) for SQL Server, User Secrets and migrations. API documentation is at `http://localhost:5000/swagger`.

## What is connected

### Maps without an API key

All embedded customer and merchant maps use the open-source [Leaflet](https://leafletjs.com/) library with [OpenStreetMap standard tiles](https://operations.osmfoundation.org/policies/tiles/). No map API key or billing account is required. Street tiles need internet access and retain visible attribution and normal browser caching. Live road geometry uses the open-source OSRM router described below. Public tile/routing servers provide best-effort service; use a dedicated or self-hosted provider for large deployments.

If an older version shows **API KEY REQUIRED** on a blank map, it is loading CARTO's key-required tiles. That source has been removed from both the main map and its fallback. Refresh the page after updating/rebuilding the frontend to load the OpenStreetMap version. Connection failures show a retry button.

### Test GrabRide requests with two tabs

1. Sign in to a GrabRide merchant account at `/merchant` and keep the dashboard open.
2. Open a fresh browser tab and navigate to `/ride`. Sign in or register as a customer using a different phone number. The login/signup links return to `/ride`.
3. Request a ride in the customer tab. A popup with the customer, pickup, destination and fare appears on the merchant dashboard within the next two-second refresh. Choose **Accept ride** or **Decline**.
4. Acceptance assigns that merchant and updates the customer's confirmation and `/rides` status. Go to the customer first, then select **Customer picked up · Start ride** once the customer is on board. Drive to their destination and select **Complete ride** on arrival. Declining dismisses only that merchant's request and persists across refresh; other merchants can still accept it.

After accepting, the merchant dashboard shows two steps: **Pick up the customer**, then **Drive to the destination**. The map and **Directions to pickup** target the customer first. Before GPS is available, the map centers on the pickup pin and waits to draw the approach route. **Customer picked up · Start ride** changes both customer and merchant maps to the destination leg and switches the link to **Directions to destination**. Reaching the pickup by GPS alone does not start the ride. Directions open Google Maps using the device's current location as the origin when available. Both maps use a green suggested road route, a blue pickup beacon and a white vehicle that moves and turns smoothly between reported GPS fixes. **Follow driver** enables camera following; dragging the map releases it, and **Show full route** restores the overview. The current step restores after refresh, and the map closes when the ride completes or is cancelled.

For live tracking, the assigned merchant selects **Share live location** and allows browser location access. Keep the dashboard open while approaching the customer. The customer immediately sees a map after booking and on **My rides**; it polls the ride every two seconds and moves the vehicle marker to the shared GPS position. A last-update time and GPS accuracy circle accompany the marker. Updates older than 30 seconds are labelled paused. **Stop sharing**, cancellation and completion remove the shared position; closing the driver page stops GPS updates. GPS requires HTTPS on phones, or localhost for local testing. Registration-area markers and offline demo rides do not supply live GPS. The proximity text below the map is straight-line distance.

The merchant map consumes local GPS immediately instead of waiting for a server round trip. Animation retargets from the displayed position, ignores older observations, stops at the last reported fix, and respects reduced motion. Road geometry comes through `POST /api/ride-route` using the [OSRM route API](https://github.com/Project-OSRM/osrm-backend/blob/master/docs/http.md#route-service). The default public demo router receives endpoint coordinates, without account tokens, names or ride IDs; configure the server-only `RIDE_ROUTER_URL` for a dedicated/self-hosted OSRM service. Requests/responses are uncached, moved origins refresh at most every ten seconds, and failures fall back to a labelled dashed direct line. Route distance and drive time exclude live traffic; proximity text below the map remains straight-line distance. No future vehicle movement is simulated.

Sign-ins remain separate because sessions are stored per tab. Pending requests are offered to open GrabRide dashboards; published work schedules remain informational. One ride can have one accepting merchant, and a merchant can hold one active ride. Customer cancellation releases the merchant's active slot. Food/Express merchant accounts cannot receive these requests. The explicit offline demo does not send requests to the API.

Apply the additive `MerchantRideDispatch` and `RideLiveLocation` migrations before using this flow on another database: `dotnet ef database update --project backend` from the repository root. Both have been applied to the current local database.

### Account and service behavior

Each merchant account keeps the service selected at registration. The signed-in profile shows that service's fields without choices to switch to other services; GrabRide accounts manage rider details, working hours and customer ride requests.

For **Merchant → Create merchant account → GrabRide**, enter **name, phone number, password, motorcycle license plate and location**, then check working days from Monday through Sunday and choose start/end times for each selected day. The signed-in GrabRide dashboard manages this schedule and rider details instead of listings, photos, prices or publishing. Unchecked days are days off; overnight shifts end the following day, using Cambodia time (UTC+7). Hours persist through the existing `openingHours` profile field, so no database migration is needed. Motorcycle plates stay private. GrabFood and GrabExpress retain the business form and listing tools described below.

GrabRide location offers **Use current location** (selecting it immediately detects the device location and asks for browser permission if needed) or **Choose in Phnom Penh** (Phnom Penh → district/Khan → sangkat). No separate Detect button is needed; a retry button appears if detection fails. Choosing a sangkat completes the manual location immediately. Changing districts resets the sangkat. All 14 districts and 105 sangkats are bundled in English/Khmer from the [official NCDD gazetteer](https://db.ncdd.gov.kh/gazetteer/view/province.castle?pv=12), checked on 16 November 2026. Manual selection works without a live geography service. Device detection requires HTTPS or localhost, handles denied/unavailable/timed-out requests, and saves coordinates as `GPS: latitude, longitude` with a map link in the picker. Both choices use the existing API address field and restore after profile reload; no database migration is needed. Refresh the reference list with `node scripts/update-phnom-penh.mjs`.

- **Merchant** in the desktop navbar and mobile menu opens `/merchant`. GrabFood and GrabExpress merchants register with a business/store name, owner name, public contact phone, optional email, selling address, city, specialty, description, opening hours and separate phone/password sign-in details. Existing customer phone numbers cannot be reused for merchant registration. The dashboard saves profiles, JPG/PNG/WebP photos (up to 2 MB), USD prices and draft/published listings in SQL Server through the API. Published listings appear on the homepage and matching service page, with a public `/partners/{id}` business page. Selecting **Feature in homepage slideshow** includes published listings among the 12 most recently updated homepage slides. Edit a listing and clear **Publish to customers** to hide it. Customer enquiries use the business's contact phone/email; these listings do not connect to the demo cart or assign ride/Express bookings to that merchant.
- Login and registration use only a phone number and password, with optional password visibility. Email/name are not required. Cambodian local/international forms are normalized; successful sign-in or registration returns home. Sign-out is one click. The greeting uses your saved name, falling back to your phone number; edit your optional name in Profile → Settings → Name → Save. Names are saved through the API to SQL Server and stay updated after refresh/sign-in. These forms and live rides use the ASP.NET Core API. AuthProvider holds one API client per browser tab, saves the login in sessionStorage, and clears it on logout/expiry/401.
- Ride pages use the API by default and display failures instead of silently creating local bookings. Explicit `NEXT_PUBLIC_ENABLE_DEMO_RIDES=true` enables a separate labelled offline demo. The server determines the development fare; the current live API has no vehicle-choice contract.
- On `/ride`, **Use my location** detects the customer's pickup after a click and browser permission. The detected coordinates update the map, distance, trip summary and booking request; swapping pickup/destination also supports this point. Detection requires HTTPS or localhost. Permission denial, timeouts, unsupported browsers and unavailable locations show a message while manual place selection remains available. A late detection result cannot overwrite a manually selected pickup.
- The ride map shows registered **GrabRide merchant areas** as blue markers, without requiring listings. Select a marker to see the public display name, saved area and working hours. Merchants sharing a location are grouped into one marker. The map fits the trip and registered areas, and refreshes every five seconds or on window focus. These are saved registration locations, not live driver tracking or availability. GPS registrations use their saved coordinates. Manual Phnom Penh selections use approximate area centres derived from the [MEF/OCHA commune boundary dataset](https://data.mef.gov.kh/datasets/pd_66c2f89949eb6c00013c1385); the source geometry is from 2018, so newer sangkats without a matching boundary use their district centre. All 105 bundled sangkats are supported. Unrecognized legacy addresses remain in the merchant list and show an unmapped-location notice. Refresh reference centres with `node scripts/update-merchant-area-centres.mjs`.
- Signed-in cart/Food orders, Express bookings, wallet, addresses, favourites, store reviews and language/theme now synchronize through `GET/PATCH /api/account-data` into SQL Server. Browser storage is a per-account cache/offline queue. The existing prices, payments, couriers and delivery tracking remain simulated; these are persisted demo records, not a production fulfillment/payment integration. Public store reviews have a separate read endpoint that omits private order/address/wallet data.
- The sync bar shows saving/synced/offline/conflict status. Existing guest data stays local until explicitly imported into empty account sections after sign-in. Different users' private data remains separate. Shared public views and signed-in account data refresh every five seconds while visible, plus on focus/reconnection. Conflicting simultaneous edits to the same section require loading the server copy, retaining a device backup of pending changes.
- `/express` books parcels; `/deliveries` shows history and cancellation before collection. `/mart` redirects to `/express`. Legacy Mart data is retained only for historical receipts and pricing fixtures.
- English/Khmer and light/dark/system preferences are available through Settings.

The default browser API path is `/backend`, proxied by Next.js to `API_PROXY_URL`; phones therefore use the frontend host instead of the phone's localhost. For cloned frontends, use the same central API URL in `.env.shared.example`/`.env.local` before starting/building. Keep SQL credentials and JWT keys only on the API server. If explicitly setting `NEXT_PUBLIC_API_URL` for direct browser requests, that API must allow the frontend's exact origin in `Cors:Origins`.

## Checks

```powershell
npm run lint
npm test
npm run build
npm run start
```

With the production server running, a second terminal can run:

```powershell
npm run smoke
```

Tests cover API/session behavior, cart/discount calculations, checkout and wallet persistence, search/hours, Express validation/pricing/status/cancellation, and shared browser storage. HTTP smoke checks validate routes/redirects/photos, not browser layout or interactions. Complete the browser QA list in [AUDIT.md](AUDIT.md) before declaring the frontend fully ready.
