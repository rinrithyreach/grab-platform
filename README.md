# Grab Platform

University group project (Group 6). We research the Grab super-app and build a small working demo of it: a Next.js front end that talks to a back-end API.

Services: **GrabRide, GrabFood and GrabExpress** (Express replaces Mart).

**Running a team clone?** With Node.js 24 installed, run the following from your clone:

```powershell
cd frontend
npm ci
npm run dev:team
```

Open the local website address printed by Next.js. Team mode connects to the project’s central SQL-backed API and checks its database identity before starting. Keep the central host online. For other networks, an alternative host address, or running the central PC itself, see [shared setup](SHARED_SETUP.md).

- [Run the frontend](frontend/README.md)
- [Super-admin dashboard and setup](ADMIN_DASHBOARD.md)
- [Frontend audit and verification](frontend/AUDIT.md)
- [Security review, fixes and remaining limitations](SECURITY_AUDIT.md)
- [Run the ASP.NET Core / Entity Framework API](backend/README.md)
- [Next backend integration phase](backend/IMPLEMENTATION_PLAN.md)

## Research outline

The book and the slides follow these twelve sections:

1. Introduction
2. Background
3. Their business platform
4. Challenges and opportunities
5. Functionalities and features
6. Customer/user experience
7. UX/UI design
8. System design (logical and physical design)
9. Back-end API endpoints specification
10. Technologies
11. Summary
12. References
