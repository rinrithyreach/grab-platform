# Grab Platform

- `frontend/`: existing Next.js app; pages preserved, typed API client added.
- `backend/`: ASP.NET Core 10 API and EF Core SQL Server migrations.
- `tests/Grab.Api.Tests/`: HTTP integration tests against real isolated SQL Server databases.

Start with [backend setup and demonstration instructions](backend/README.md), [frontend/API mapping](backend/FRONTEND_ANALYSIS.md), [API documentation](backend/API_DOCUMENTATION.md), and [database ERD](backend/DATABASE_ERD.md).

The frontend currently displays its original starter page. As requested, no forms or demo pages were added; use Swagger to exercise the backend.
