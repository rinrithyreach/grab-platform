# Grab frontend

Next.js customer demo for GrabRide, GrabFood and GrabExpress. Express replaces Mart. See [the audit](AUDIT.md) for completed checks and remaining limits, and [the backend plan](../backend/IMPLEMENTATION_PLAN.md) for the next implementation phase.

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
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

In another terminal at the repository root:

```powershell
dotnet run --project backend --launch-profile http
```

See [backend setup](../backend/README.md) for SQL Server, User Secrets and migrations. API documentation is at `http://localhost:5000/swagger`.

## What is connected

For **Merchant → Create merchant account → GrabRide**, the form asks only for **name, phone number, password, motorcycle license plate and location**. The phone is used for sign-in and customer contact at registration; the name is shown on published offers. Motorcycle plates stay private. GrabRide profile editing uses the same shorter profile fields; GrabFood and GrabExpress retain the business form described below.

GrabRide location offers **Use current location** (selecting it immediately detects the device location and asks for browser permission if needed) or **Choose in Phnom Penh** (Phnom Penh → district/Khan → sangkat). No separate Detect button is needed; a retry button appears if detection fails. Choosing a sangkat completes the manual location immediately. Changing districts resets the sangkat. All 14 districts and 105 sangkats are bundled in English/Khmer from the [official NCDD gazetteer](https://db.ncdd.gov.kh/gazetteer/view/province.castle?pv=12), checked on 16 November 2026. Manual selection works without a live geography service. Device detection requires HTTPS or localhost, handles denied/unavailable/timed-out requests, and saves coordinates as `GPS: latitude, longitude` with a map link in the picker. Both choices use the existing API address field and restore after profile reload; no database migration is needed. Refresh the reference list with `node scripts/update-phnom-penh.mjs`.

- **Merchant** in the desktop navbar and mobile menu opens `/merchant`. GrabFood and GrabExpress merchants register with a business/store name, owner name, public contact phone, optional email, selling address, city, specialty, description, opening hours and separate phone/password sign-in details. Existing customer phone numbers cannot be reused for merchant registration. The dashboard saves profiles, JPG/PNG/WebP photos (up to 2 MB), USD prices and draft/published listings in SQL Server through the API. Published listings appear on the homepage and matching service page, with a public `/partners/{id}` business page. Selecting **Feature in homepage slideshow** includes published listings among the 12 most recently updated homepage slides. Edit a listing and clear **Publish to customers** to hide it. Customer enquiries use the business's contact phone/email; these listings do not connect to the demo cart or assign ride/Express bookings to that merchant.
- Login and registration use only a phone number and password, with optional password visibility. Email/name are not required. Cambodian local/international forms are normalized; successful sign-in or registration returns home. Sign-out is one click. The greeting uses your saved name, falling back to your phone number; edit your optional name in Profile → Settings → Name → Save. Names are saved through the API to SQL Server and stay updated after refresh/sign-in. These forms and live rides use the ASP.NET Core API. AuthProvider holds one API client per browser tab, saves the login in sessionStorage, and clears it on logout/expiry/401.
- Ride pages use a labelled local demo when the API health probe fails. In live mode, customer login is required and the server determines the development fare. Bike/TukTuk/Car choices are available in the demo; the current API has no vehicle-choice contract.
- Food catalogue/cart/orders, Express bookings, wallet, addresses, favourites and store reviews currently use browser storage. Payments, couriers and delivery tracking are simulated. They do not create SQL-backed Food/Express records yet.
- `/express` books parcels; `/deliveries` shows history and cancellation before collection. `/mart` redirects to `/express`. Legacy Mart data is retained only for historical receipts and pricing fixtures.
- English/Khmer and light/dark/system preferences are available through Settings.

Use `localhost:3000` for both browsing and CORS. If you choose a different host/port, add that exact origin to backend `Cors:Origins`.

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
