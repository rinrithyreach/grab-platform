# Super-admin console

Open **http://localhost:3000/admin/login** and sign in with the administrator email and password provisioned on this computer. The customer login page also links to administrator sign-in. Successful admin sign-in opens `/admin`.

Public registration cannot create administrators. Every `/api/admin/*` endpoint requires an active Admin account **and** the matching permission from that administrator's role; changing an account's role or suspending it rejects its existing tokens on the next request.

## Roles & permissions

Each console section has a **view** permission and, where it has controls, a **manage** permission (manage includes view): `overview`, `users`, `merchants`, `listings`, `rides`, `orders`, `deliveries`, `drivers`, `payments`, `reviews`, `audit`, `settings`, `team` (administrators) and `roles`. Permissions are defined in code because every one is enforced by the API. My profile is always available.

Administrators combine permissions into **roles** on the Roles & permissions page and assign them on the Administrators page. The built-in **Super administrator** role has every permission and cannot be edited; existing administrators keep it after the migration, so nobody loses access. Role changes apply on the administrator's next request. The dashboard hides sections and buttons the role does not allow, and the API returns 403 if they are called anyway.

Escalation is blocked: an administrator can only create or edit roles, assign roles, or manage other administrators within the permissions their own role holds. Only super administrators can grant Super administrator or promote/demote accounts through Users & access. The last active super administrator cannot be demoted or suspended, administrators cannot change their own role, and a role cannot be deleted while administrators are assigned to it.

## Controls

| Section | Available controls |
| --- | --- |
| Overview | Live account, merchant, listing and booking totals; seven-day activity; operation queues; simulated transaction totals; recent admin activity |
| Users & access | Search accounts; **create users** (customer accounts with phone sign-in, or administrators with a role); edit names, suspend/reactivate, promote/demote Customer/Admin accounts (super administrators only); own-account and last-super-admin protections |
| Merchants | Edit the existing service's business/partner profile, contact, address and opening/work schedule |
| Listings & banners | Upload, edit, reorder, hide and delete homepage hero banners (shown before merchant-featured listings); edit listing content and price, publish/unpublish, choose homepage slideshow placement |
| Rides | Inspect all rides and cancel active rides, releasing assigned drivers/merchants |
| Orders | Inspect order items and advance Pending → Accepted → OnTheWay → Delivered, or reject/cancel before delivery |
| Deliveries | Inspect courier assignments and stops, cancel before pickup, mark in-transit exceptions failed without inventing delivery/COD collection |
| Drivers | Onboard a dedicated customer account without booking history and set availability when it has no active ride |
| Payments | Inspect simulated ride payment records; no real charges, refunds or transfers |
| Reviews | Hide and restore public driver reviews |
| Activity log | Inspect administrator, target, action, reason and time for console changes (filterable by section, including settings, administrators and profiles) |
| Settings | Support details shown in the customer footer; GrabRide/GrabFood/GrabExpress booking switches; customer/merchant registration switches; customer announcement banner with preview; maintenance mode with customer message. Saves require a reason and are rejected if another admin saved first |
| Administrators | Directory of every administrator profile and role (filter by role/status); add an email administrator with a role and a temporary password; change another administrator's role; suspend/reactivate; sign out all of their sessions. You cannot act on your own account here |
| Roles & permissions | Built-in Super administrator plus custom roles; create/edit a role with a view/manage permission matrix; delete unused roles |
| My profile | Personal details and photo; sign-in email change (requires current password); password change; sign out other sessions; overview refresh interval and compact tables; your 25 most recent console changes |

Tables support server-side search, relevant filters, 20-record pagination, detail/edit dialogs and CSV export of the displayed page. Overview data refreshes on the interval chosen in My profile → Preferences (30 seconds by default). Record tables reload after saves or with Refresh. Timestamps use Cambodia time; amounts are USD. The admin interface is currently in English.

All console changes require a reason. Activity records are committed with each successful change; rejected operations are not reported as successful changes. Account suspension hides merchant offers, banners, storefronts and ride-area markers and prevents new orders from that merchant. An assigned active ride/delivery must be resolved before suspending its driver/courier.

The console manages the SQL-backed platform records. Existing browser/account demo carts, wallets and sample storefront catalog data remain in their existing flows. Payment values are simulated. There are no permanent-delete or real-money controls.

## Upload homepage banners

Open **Listings & banners → Homepage banners → Upload banner**, or select **Manage homepage banners** on the dashboard overview. Choose a JPG, PNG or WebP image up to 2 MB (about 1600 × 480 px), optionally enter overlay text and a destination link, set the position, enter a reason, and leave **Show on the homepage** checked. Smaller positions appear first. The customer homepage refreshes within five seconds; uploaded banners replace the built-in promotions and appear before merchant-featured listings. Keep important content centred because phones crop the sides.

Edit a banner to replace its image, change its order, or hide it without deleting it. Hidden uploads remain in the dashboard. Banner images and settings are stored through the API in SQL Server, so they persist after refresh and across devices using the same API. Apply the additive `HomeBanners` migration when setting up an older database. Uploads require `listings.manage`; read-only administrators with `listings.view` can inspect banners.

## Local setup on another computer

Run the existing frontend/API setup, then apply the additive migration:

```powershell
dotnet ef database update --project backend
dotnet run --project backend --launch-profile http
```

`SuperAdminConsole` adds `Users.IsActive` (existing users stay active), `Reviews.IsHidden` (existing reviews stay visible), and the `AdminAudits` table. `AdminRolesAndPermissions` adds the `AdminRoles` table and `AdminProfiles.AdminRoleId` (existing administrators stay Super administrators). `AdminSettingsAndProfiles` adds the `PlatformSettings` and `AdminProfiles` tables plus `Users.SecurityVersion` (session revocation, starts at 0) and `Users.LastLoginAt`. Neither migration deletes or resets existing data. Restart the API after updating the database.

To provision a local email administrator, stop the API and run the following. Credentials are prompted locally and sent to the application over standard input; do not commit credentials or put them into frontend code.

```powershell
$adminEmail = Read-Host 'Administrator email'
$adminPassword = [System.Net.NetworkCredential]::new('', (Read-Host 'Password (12-128 characters)' -AsSecureString)).Password
try {
    @{ email = $adminEmail; password = $adminPassword } | ConvertTo-Json -Compress |
        dotnet run --no-build --project backend --launch-profile http -- --provision-admin-stdin
} finally {
    Remove-Variable adminEmail, adminPassword
}
dotnet run --no-build --project backend --launch-profile http
```

Provisioning is available only in Development and uses the existing password hasher. It creates a dedicated administrator. If the email already exists, it verifies the existing active Admin credentials and refuses to overwrite or promote a different account. The application never seeds a default password on startup.

## API

- `POST /api/auth/admin/login`: `{ email, password }`, rate-limited; returns the existing bearer-session shape.
- `GET /api/admin/overview`: dashboard totals and activity.
- `GET /api/admin/{resource}?page=1&search=&filter=`: paginated records for users, merchants, listings, rides, orders, deliveries, drivers, payments, reviews or audit.
- `PATCH /api/admin/users/{id}`: `{ fullName, role, isActive, reason }`.
- `PATCH /api/admin/merchants/{id}`: `{ profile: MerchantProfileRequest, reason }`.
- `PATCH /api/admin/listings/{id}`: `{ title, description, price, isPublished, showInSlideshow, reason }`.
- `POST /api/admin/drivers`: `{ userId, vehicleType, vehiclePlate, reason }`.
- `POST /api/admin/{resource}/{id}/actions`: `{ action, reason }`; supported actions are defined by the current record lifecycle.
- `GET|PATCH /api/admin/settings`: platform settings; PATCH takes all fields plus `{ version, reason }` and returns 409 if the version is stale. `GET /api/platform/settings` is the public, anonymous subset.
- `GET|PATCH /api/admin/profile`, `POST /api/admin/profile/password`, `POST /api/admin/profile/revoke-sessions`, `POST|DELETE /api/admin/profile/avatar`, `GET /api/admin/profile/activity`: the signed-in administrator's own account.
- `GET /api/admin/team`: every administrator profile. `POST /api/admin/team`: `{ fullName, email, jobTitle, temporaryPassword, reason }` (rate-limited). `PATCH /api/admin/team/{id}`: `{ isActive, reason }`. `POST /api/admin/team/{id}/revoke-sessions`: `{ reason }`.
- `PATCH /api/admin/team/{id}/role`: `{ adminRoleId, reason }` (null = Super administrator).
- `GET /api/admin/roles`: roles, active super-administrator count and the permission catalog. `POST /api/admin/roles` / `PUT /api/admin/roles/{id}`: `{ name, description, permissions, version?, reason }`. `POST /api/admin/roles/{id}/delete`: `{ reason }`.
- `POST /api/admin/users`: `{ fullName, phoneNumber, email?, password, reason }` creates a customer account. `POST /api/admin/team` also accepts `adminRoleId`.

Credentials and password hashes are never returned by admin record endpoints. These endpoints use the existing no-store response headers.

## Verification

The frontend production build and TypeScript checks pass, along with all 112 frontend tests and all 55 backend tests. The frontend suite includes administrator session, action availability and CSV escaping tests. SQL integration tests in `tests/Grab.Api.Tests/AdminTests.cs` cover authorization, queries, pagination, suspension/session revocation, self protection, audited changes, listing visibility, order fulfillment, driver onboarding, ride cancellation, review moderation and parcel exceptions; `AdminTeamTests.cs` covers settings/profile persistence with concurrency checks and the administrator team lifecycle (onboarding, sign-in, session revocation, suspension, self protection and audit); `AdminRoleTests.cs` covers per-section enforcement, escalation blocking, role validation/concurrency/deletion, role changes and admin-created customer accounts. Integration fixtures use isolated temporary databases. Legacy-schema tests insert only historical columns and verify existing accounts remain active after migration.

Browser visual verification was unavailable in this tool session. The running local admin routes, proxy, requested account sign-in, and all dashboard API sections were checked over HTTP.
