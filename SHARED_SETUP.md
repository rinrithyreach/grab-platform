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

## Start a teammate's clone

Install Node.js 24. From the repository root run:

```powershell
cd frontend
npm ci
npm run dev:team
```

Keep this terminal open and open the local URL it prints. Team mode uses the API URL and Storage ID in [team-api.json](frontend/team-api.json). Every save goes through the clone's own `/backend` proxy. If the central database cannot be verified, startup stops before login. SQL credentials stay on the host.

The initial LAN address is `http://192.168.110.118:3000`. Private LAN addresses work on the host network. From another network, use an HTTPS address that forwards to the same project. Supply the website's `/backend` URL, or the base URL of a separately hosted API:

```powershell
npm run dev:team -- https://YOUR_SHARED_SITE/backend
```

To make an address the default for all clones, verify it with `npm run check:shared-api -- --team https://YOUR_SHARED_SITE/backend` and update `apiUrl` in the team configuration. Wi-Fi addresses can change. If LAN access times out, check that both devices can reach each other and that the host firewall permits inbound website traffic on TCP 3000 from that subnet. An existing Node.js inbound block rule takes precedence over an allow rule. An HTTPS host reachable by both devices works on either network.

### Production builds and manual configuration

To configure a clone persistently, copy `.env.shared.example` to `.env.local` in `frontend` and set the verified API base before building:

```dotenv
API_PROXY_URL=http://192.168.1.10:3000/backend
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_ENABLE_DEMO_RIDES=false
```

For a hosted central project, use `API_PROXY_URL=https://YOUR_SHARED_SITE/backend`. If the API is hosted separately, use its actual HTTPS base URL instead. Every frontend clone must target the same central API. Leave `NEXT_PUBLIC_API_URL` unset so browsers use their frontend's proxy.

Run `npm run dev`, or run `npm run build` followed by `npm run start`. Set the API URL **before building**; changing Next.js rewrite configuration requires restarting development or rebuilding production. Phones can simply browse the central website without cloning or installing anything.

## Verify that PCs really use the same database

For team mode, run the check without starting Next.js:

```powershell
npm run check:shared-api -- --team
```

The command checks database readiness, the merchant catalogue and private-data authorization. It compares the **Storage ID** to the one recorded by the central host. For a manually configured `.env.local`, run `npm run check:shared-api` and compare its printed ID with the host. The ID is generated once per database by migration and contains no connection details or credentials.

## What syncs

- Accounts, profile names, live rides, ride payments/reviews, merchant profiles, photos and listings use their existing API tables.
- Signed-in carts, demo Food orders, Express deliveries/cancellations, demo wallet transactions, favourites, saved addresses, store reviews and language/theme now use the API's SQL-backed account snapshot. Their existing prices, delivery timelines and payment simulations remain demo behavior.
- Public merchant lists, banners, storefronts, product details and store reviews refresh every five seconds while visible. Admin record lists, banners, categories, promotions, team members and roles refresh automatically too. Private account data refreshes every five seconds and on focus/reconnection. Profile names refresh every fifteen seconds, and active rides normally update every two seconds.
- Public listings/reviews are shared with customers. Private orders, wallet and addresses sync only when signed into **the same account** on the other device; they are not exposed to everyone.
- Signed-in partner carts follow the account. After sign-in, **Import device data into empty account sections** can bring over an older device cart. Guest draft carts, guest receipt links and browser notification history stay on that device. Submitted guest bookings and merchant orders are saved by the API.
- Let the saving indicator clear before closing the tab if another device needs the latest change. An offline or conflict notice means a write is still pending. Pending changes are cached per account and retried after reconnection/login.
- Independent section edits merge. Conflicting edits to the same section do not silently overwrite one another: **Load server copy** retains a local backup of pending changes before loading the current server version.
- Offline ride simulation is disabled by default. An unavailable API does not silently create a different set of fake bookings. Explicit `NEXT_PUBLIC_ENABLE_DEMO_RIDES=true` remains available for a separate local demo.

For a quick check, sign in to the same customer account on two devices, keep Favorites open on one, and favorite a store on the other. The open list should update within five seconds. To check across roles, publish a merchant product and look for it on a separate customer's storefront.
