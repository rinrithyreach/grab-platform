# Shared data on multiple PCs and phones

Every device must use **one shared API and one shared SQL Server database**. Git contains application code and migrations, not database rows. Starting a separate API/database on each cloned PC creates separate data.

The frontend now sends requests to `/backend` on its own web origin. Its Next.js server forwards them to `API_PROXY_URL`. This also lets phones use the API without trying to contact `localhost` on the phone.

## Run the central project once

On the server/PC that owns the shared data:

1. Configure the backend SQL connection and JWT key using [backend setup](backend/README.md). Keep SQL credentials and JWT keys on this server.
2. Apply the committed migrations: `dotnet ef database update --project backend`.
3. Run `dotnet run --project backend --launch-profile http`. Its API remains at `http://localhost:5000` on this machine.
4. In `frontend`, run `npm ci`, copy `.env.example` to `.env.local` if no local configuration exists, and keep `API_PROXY_URL=http://localhost:5000`. Leave `NEXT_PUBLIC_API_URL` unset.
5. For a LAN demonstration, run `npm run build`, then `npm run start -- --hostname 0.0.0.0 --port 3000`.

Other devices on the same network can open `http://MAIN_PC_IP:3000`, using this PC's actual LAN IPv4 address. The central API is available through `http://MAIN_PC_IP:3000/backend`; port 5000 and SQL Server do not need to be exposed to client PCs. The host must remain running and its network/firewall must permit the website port. Use an HTTPS deployment for access from other networks and automatic browser location on phones. No public deployment, firewall changes or hosting account is created automatically by cloning.

## Run a frontend clone on another PC

The other PC needs Node.js 24; it does not need its own SQL database or JWT key.

```powershell
cd frontend
npm ci
Copy-Item .env.shared.example .env.local
```

Edit `.env.local` to use the central API. LAN example (replace the example address):

```dotenv
API_PROXY_URL=http://192.168.1.10:3000/backend
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_ENABLE_DEMO_RIDES=false
```

For a hosted central project, use `API_PROXY_URL=https://YOUR_SHARED_SITE/backend`. If the API is hosted separately, use its actual HTTPS base URL instead. Every frontend clone must target the same central API. Leave `NEXT_PUBLIC_API_URL` unset so browsers use their frontend's proxy.

Run `npm run dev`, or run `npm run build` followed by `npm run start`. Set the API URL **before building**; changing Next.js rewrite configuration requires restarting development or rebuilding production. Phones can simply browse the central website without cloning or installing anything.

## Verify that PCs really use the same database

From each configured frontend clone:

```powershell
npm run check:shared-api
```

The command checks database readiness, the merchant catalogue and private-data authorization. Compare the **Storage ID** printed on each PC. The IDs must match. Different IDs mean separate databases, even if both URLs return a healthy API. The ID is generated once per database by migration and contains no connection details or credentials.

## What syncs

- Accounts, profile names, live rides, ride payments/reviews, merchant profiles, photos and listings use their existing API tables.
- Signed-in carts, demo Food orders, Express deliveries/cancellations, demo wallet transactions, favourites, saved addresses, store reviews and language/theme now use the API's SQL-backed account snapshot. Their existing prices, delivery timelines and payment simulations remain demo behavior.
- Public merchant lists, banners, storefronts and store reviews refresh every five seconds while the page is visible. Private account data also refreshes every five seconds and on focus/reconnection. Profile names refresh every fifteen seconds.
- Public listings/reviews are shared with customers. Private orders, wallet and addresses sync only when signed into **the same account** on the other device; they are not exposed to everyone.
- Guests keep device-local data. Sign in to sync. Existing browser records are preserved and can be imported explicitly with **Import device data into empty account sections**. Import does not overwrite existing account sections.
- The status bar reports loading, saving, synced, offline and conflicting changes. Wait for **Account data synced** before closing the page if the latest change must already be available on another device. Pending changes are cached per account and retried after reconnection/login.
- Independent section edits merge. Conflicting edits to the same section do not silently overwrite one another: **Load server copy** retains a local backup of pending changes before loading the current server version.
- Offline ride simulation is disabled by default. An unavailable API does not silently create a different set of fake bookings. Explicit `NEXT_PUBLIC_ENABLE_DEMO_RIDES=true` remains available for a separate local demo.

The local example points to localhost for single-PC development. A real shared host URL must be supplied before another PC can access the same data; this repository does not include a hosted server address.
