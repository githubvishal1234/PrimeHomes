# PrimeHomes

Real-estate marketplace: buyers search and contact owners, owners list properties, admins moderate listings.
See [PLAN.md](PLAN.md) for roles, end-to-end flows and the upgrade roadmap.

```text
PrimeHome.UI/            Angular 22 frontend (dev server proxies /api and /uploads to the API)
PrimeHomes.API/
  PrimeHomes.API/        ASP.NET Core 8 Web API + EF Core (SQL Server)
database/
  PrimeHomesDB.sql       Full schema + demo data (users, listings, photos, inquiries, visits)
PLAN.md                  Roles, flows, roadmap
SQLQuery3.sql            Historical hand-written SQL (not needed for setup)
```

## Demo quick start (about 5 minutes)

1. **Database:** run `database/PrimeHomesDB.sql` in SSMS, or:
   `sqlcmd -S localhost\SQLEXPRESS -E -C -i database\PrimeHomesDB.sql`
2. **API** (needs .NET 8):
   ```powershell
   cd PrimeHomes.API\PrimeHomes.API
   dotnet user-secrets set "Jwt:SigningKey" "<any random text of 32+ characters>"
   dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Server=localhost\SQLEXPRESS;Database=PrimeHomesDB;Trusted_Connection=True;TrustServerCertificate=True;"
   dotnet run --launch-profile https
   ```
3. **UI** (needs Node 20+): `cd PrimeHome.UI`, `npm ci`, `npm start`, then open http://localhost:4200
4. Sign in with any account in the table below (Admin, Owner or Buyer).

Photo credits: `PrimeHome.UI/public/images/PHOTO-CREDITS.txt` (Unsplash licence, free for commercial use).

## Requirements

- .NET 8 runtime + any .NET SDK ≥ 8
- Node.js 20+ and npm
- SQL Server (Express or LocalDB is fine)

## 1. Backend setup (once per machine)

Secrets live in **user-secrets**, outside the repository:

```powershell
cd PrimeHomes.API\PrimeHomes.API

# JWT signing key: any random string of 32+ bytes
dotnet user-secrets set "Jwt:SigningKey" "<random-secret-at-least-32-bytes>"

# Only if your SQL Server is not the default instance on localhost, e.g. SQL Express:
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Server=localhost\SQLEXPRESS;Database=PrimeHomesDB;Trusted_Connection=True;TrustServerCertificate=True;"
```

## 2. Run

```powershell
# Terminal 1: API (https://localhost:7299, Swagger at /swagger)
cd PrimeHomes.API\PrimeHomes.API
dotnet run --launch-profile https

# Terminal 2: UI (http://localhost:4200)
cd PrimeHome.UI
npm ci
npm start
```

In **Development**, the API applies all EF migrations on startup and, if the database has no users, seeds the test accounts below.
No certificate trust is needed: the browser only talks to `localhost:4200`, which proxies to the API.

### Test accounts (development only)

| Role | Email | Password |
|---|---|---|
| Admin | admin@primehomes.com | Admin@123 |
| Owner | ravi@primehomes.com | Ravi@123 |
| Owner | suresh@primehomes.com | Suresh@123 |
| Owner | anusha@primehomes.com | anusha@123 |
| Buyer | venkat@primehomes.com | Venkat@123 |
| Buyer | shareef@gmail.com | shareef@123 |

Passwords are stored hashed. Accounts from older databases that still hold plain-text passwords are re-hashed automatically on their next successful login.

## Tests and build

```powershell
cd PrimeHome.UI
npm test -- --watch=false
npm run build
```

```powershell
cd PrimeHomes.API
dotnet test PrimeHomes.API.slnx
```

## Emails in development

Without `Email:Smtp:Host`, emails are written to the API console log ("EMAIL (dev log, SMTP not configured)"),
so verification and password-reset links can be copied from there.

## Role flows

- **Guest**: browses and searches all live listings; contacting an owner or saving a favourite asks them to sign in and returns them to the same page.
- **Buyer**: verifies email, sends inquiries, books site visits (hourly slots 9:00–18:00 IST), accepts rescheduled times, sees owner replies. The owner's phone number is shown once a visit is confirmed.
- **Owner**: replies to inquiries, confirms, reschedules, cancels or completes visits; gets in-app and email notifications for new inquiries, visit requests and listing decisions.
- **Admin**: reviews the pending queue and is notified of new listings and contact requests.
- Visit reminders go to both sides 24 hours ahead (background job, hourly).

## Alerts, analytics and SEO

- **Saved searches**: buyers save the current filters from the results page. When a listing that matches goes live, they get an in-app notification and an email.
- **Price drops**: buyers who shortlisted a home are notified when it is re-approved at a lower price.
- **Owner analytics**: daily views (counted per UTC day), inquiries and visit requests for 7, 30 or 90 days on the owner dashboard.
- **Price insights**: each live listing shows its price per sq ft against the locality average (or the city's, when the locality has fewer than 2 listings): Below market, Fair price (within 10%) or Above market.
- **SEO**: readable property URLs (`/properties/3/spacious-3-bhk-...-hyderabad`), page titles, descriptions, Open Graph tags and canonical links, plus `/sitemap.xml` and `/robots.txt` served by the API. In production, route `/api`, `/uploads`, `/sitemap.xml` and `/robots.txt` to the API from the same host as the UI.
- Not done: server-side rendering. Search engines that run JavaScript (Google, Bing) see the titles and content; others see only the sitemap.

## Listing lifecycle

`Draft → Pending → Approved (live) → Sold / Rented`. Admins can reject a pending or live listing with a reason; the owner edits and resubmits.
Any owner edit to a non-draft listing sends it back to review. Live listings with no update for 90 days become `Expired` (checked hourly) until the owner renews them.

Search: `GET /api/Properties/search?city=&listingType=&propertyTypes=&bhk=2,3&minPrice=&maxPrice=&furnishing=&amenities=&verifiedOnly=&sort=&page=&pageSize=`
(sort: `relevance`, `newest`, `price_asc`, `price_desc`, `price_per_sqft`, `area_desc`).

## Security notes

- Public registration can create **Buyer** or **Owner** accounts only; admins are seeded or created directly in the database.
- **Sessions** use HttpOnly, Secure, SameSite=Strict cookies, so page scripts can never read them (no token in localStorage). The access cookie lasts 15 minutes; a 14-day refresh cookie (sent only to `/api/Auth`) is rotated on every use. Reusing an old refresh token signs the user out everywhere, as does a password reset. The UI refreshes automatically and retries the request.
- API clients and Swagger can still send `Authorization: Bearer <token>`.
- Login and registration are rate limited (10 requests per minute per IP).
- Uploads: Owners only (profile images: any signed-in user), JPG/PNG/WEBP/AVIF, max 5 MB, file signature checked.
- Pending and rejected listings are visible only to their owner and admins.

## Run with Docker

```powershell
copy .env.example .env    # then set DB_PASSWORD and JWT_SIGNING_KEY
docker compose up --build
```

Opens on http://localhost:8080. The stack runs SQL Server, the API and nginx (serving the UI and proxying `/api`, `/uploads`, `/health`, `/sitemap.xml` and `/robots.txt` to the API). The API applies migrations on startup in this setup. Photos and the database are kept in Docker volumes. Session cookies are `Secure`, so a real domain needs HTTPS in front of port 8080.

## Operations

- `GET /health/live`: process is up. `GET /health/ready`: database reachable. Use them for load balancer and orchestrator probes.
- One log line per request (method, path, status, duration, user, request id). Production logs are JSON. Every response has an `X-Request-Id` header to match a user's report with the log.
- Background job (hourly): expires stale listings, sends visit reminders, deletes old one-time and refresh tokens.
- Admin dashboard: platform stats and "possible duplicate" warnings on pending listings (same photo, or same locality, BHK, size and price within 5%).

## CI

`.github/workflows/ci.yml` runs on every push and pull request: API build, 49 tests and a check that migrations match the model; UI unit tests and production build (fails if the first-load bundle exceeds 550 kB); then both Docker images build.

The bundle limit is 550 kB rather than Angular's default 500 kB because Angular itself (core, router, common) is about 340 kB of it; the app's own first-load code is about 30 kB, and Bootstrap is compiled with only the parts in use. Transferred size is about 115 kB gzipped.

## Production configuration

Set via environment variables (double underscore = section separator):

| Variable | Purpose |
|---|---|
| `Jwt__SigningKey` | JWT signing secret (required, 32+ bytes) |
| `Database__MigrateOnStartup` | `true` to apply migrations when the API starts (used by docker-compose) |
| `Proxy__TrustAll` | `true` only when the API is reachable solely through your reverse proxy |
| `ConnectionStrings__DefaultConnection` | SQL Server connection string |
| `Cors__Origins__0` | Allowed UI origin, if UI and API are on different hosts |
| `App__BaseUrl` | Public UI address used in email links (default `http://localhost:4200`) |
| `Email__Smtp__Host`, `Email__Smtp__Port`, `Email__Smtp__User`, `Email__Smtp__Password`, `Email__From` | SMTP for notification, verification and password-reset emails |

Apply migrations as a deployment step (`dotnet ef database update` or a migration bundle); automatic migration and seeding run in Development only.
