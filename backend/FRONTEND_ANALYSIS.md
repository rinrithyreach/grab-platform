# Frontend analysis and implementation scope

Inspected all application source, configuration, manifests, and public assets before backend implementation on 13 November 2026.

The existing frontend is the create-next-app starter. `app/page.tsx` renders static Next.js and Vercel links/images. `app/layout.tsx` provides fonts and metadata; `app/globals.css` provides Tailwind and theme styles. There are no login/register/booking forms, domain components, API routes, application interfaces, mock API responses, ride records, or payment screens. Static starter text is not domain mock data.

The user explicitly chose to keep **all pages unchanged** and receive API integration functions only. Therefore there is no browser booking flow to wire up. The typed `frontend/lib/api.ts` client implements the assignment's requested API contracts for future components; Swagger demonstrates the backend now. Payment/review APIs are assignment scaffolding, not evidence of existing UI functionality.

## Frontend-to-backend mapping

All routes below are on `http://localhost:5000`. C = Customer, D = Driver, A = Admin. None = anonymous. Definitions and examples are in API_DOCUMENTATION.md. P1 = auth/core, P2 = ride lifecycle, P3 = simulated commerce.

| Existing page/component or integration function | Functionality | Method | Endpoint | Request body | Response | Auth | Priority |
|---|---|---|---|---|---|---|---|
| `app/page.tsx` | Static starter links | — | No backend needed | — | — | None | Preserve |
| `api.register` (no form exists) | Create customer | POST | `/api/auth/register` | fullName, email, password, phoneNumber | AuthResponse | None | P1 |
| `api.login` (no form exists) | Sign in | POST | `/api/auth/login` | email, password | AuthResponse | None | P1 |
| `api.me` | Profile | GET | `/api/auth/me` | — | User | C/D/A | P1 |
| `api.bookRide` (no form exists) | Persist booking | POST | `/api/rides` | locations and coordinates | Ride | C | P2 |
| `api.rides` | Scoped rides / driver pending queue | GET | `/api/rides?page=1` | — | Ride[] | C/D/A | P2 |
| `api.myRides` | Own history | GET | `/api/rides/mine?page=1` | — | Ride[] | C/D/A | P2 |
| `api.ride` | Own/assigned ride | GET | `/api/rides/{id}` | — | Ride | Owner/assigned D/A | P2 |
| `api.updateRideStatus` | Accept/start/complete/cancel | PATCH | `/api/rides/{id}/status` | status | Ride | Rules per API docs | P2 |
| `api.availableDrivers` | Available driver profiles | GET | `/api/drivers/available` | — | Driver[] | C/D/A | P2 |
| `api.createDriver` | Onboard dedicated account | POST | `/api/drivers` | userId, vehicleType, vehiclePlate | Driver | A | P2 |
| `api.simulatePayment` | Simulate completed ride payment | POST | `/api/payments` | rideId | Payment | Owner C | P3 |
| `api.myPayments` | Own payments | GET | `/api/payments/mine?page=1` | — | Payment[] | C | P3 |
| `api.reviewRide` | Review completed own ride | POST | `/api/reviews` | rideId, rating, comment? | Review | Owner C | P3 |
| `api.driverReviews` | Driver reviews | GET | `/api/drivers/{id}/reviews?page=1` | — | Review[] | C/D/A | P3 |

## Database and implementation plan

Users have unique normalized emails, hashed passwords, and server-controlled roles. Drivers have a unique UserId and vehicle plate. Rides reference a customer and an optional driver; payments and reviews each have a unique RideId. Explicit restricted deletes avoid SQL Server multiple cascade paths. Ride/driver SQL rowversions protect acceptance and availability updates in the same SaveChanges transaction. Reviews enforce rating 1–5 in SQL.

Implementation order: audit frontend → define DTO/entity contracts → configure SQL/JWT/CORS → implement Controller → Service → EF architecture → generate/apply migrations → add typed client without page edits → run SQL-backed API and client tests → document setup and limitations.

Folder structure: Controllers, Models, DTOs, Data, Services, Interfaces, Middleware, Migrations, Configuration, Properties; Program.cs composes dependencies. Tests live in `tests/Grab.Api.Tests` outside the API project.
