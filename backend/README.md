# MaxSpace API — Backend

The REST API that powers the [MaxSpace Digital Battery Passport system](../README.md).
It serves all three panels: the **customer app**, the **admin panel**, and the
**battery technician portal** — with role‑based access control between them.

---

## 1. Quick start

```bash
cd backend
npm install

# Option A — run WITHOUT a database (mock mode, seeded demo data, default)
cp .env.example .env          # DATA_SOURCE stays "mock"
node index.js                 # -> http://localhost:5000

# Option B — run against the production PostgreSQL database (maxvolt_prod)
#   edit backend/.env   ->   DATA_SOURCE=postgres
#                          DATABASE_URL=postgresql://user:pass@localhost:5432/maxvolt_prod
node scripts/migrate.js       # apply the schema-adaptation migrations (idempotent)
node index.js                 # -> expect: "Using PostgreSQL repository."
```

### Demo accounts (mock mode)

| Role            | Email                            | Password      |
| --------------- | -------------------------------- | ------------- |
| Admin           | admin@maxspace.com               | admin123      |
| Customer        | alex.rivera@maxspace-energy.com  | password123   |
| Technician      | markus.vance@maxspace.com        | employee123   |

> In **postgres mode** the same endpoints work against your real data. On the
> bundled `maxvolt_prod` test DB: `integrator@maxspace.local` / `admin123`
> (ADMIN) and `test@gmail.com` / `Test@12345` (USER).

---

## 2. Configuration (backend/.env)

| Variable           | Default                  | Purpose                                                                |
| ------------------ | ------------------------ | ---------------------------------------------------------------------- |
| `PORT`             | 5000                     | HTTP port                                                              |
| `DATA_SOURCE`      | `mock`                   | `mock` (in‑memory seeds) or `postgres` (real DB)                        |
| `DATABASE_URL`     | —                        | PostgreSQL connection string (required when `DATA_SOURCE=postgres`)    |
| `JWT_SECRET`       | —                        | Signs all access tokens — **must be changed in production**            |
| `JWT_EXPIRES_IN`   | 7d                       | Token lifetime (`7d`, `2h`, `30m`, …)                                  |
| `FRONTEND_URL`     | localhost:5173           | Allowed CORS origin(s), comma‑separated                                |
| `CLIENT_URL`       | same as FRONTEND_URL     | Legacy alias for the frontend origin                                   |
| `GOOGLE_CLIENT_ID` | —                        | Google Sign‑In client ID (optional; enables "Continue with Google")    |
| `ALLOW_DB_RESET`   | `false`                  | **Stay `false` in production.** Enables `POST /api/data/reset` (TRUNCATE) |

No plaintext secrets are read from the environment beyond these — the reference
values live in `.env` (git‑ignored). Copy from `.env.example` and fill in.

---

## 3. Project structure

```
backend/
├── index.js                 # Express app: middleware, route mounting, server
├── config/app.js            # Loads + validates environment/config
├── routes/                  # One router per resource (auth, admin, batteries, …)
├── controllers/             # Request handlers (validation, auth, response shape)
├── middleware/
│   ├── auth.js              # protect / requireAdmin / requireEmployee / optionalProtect
│   ├── errorMiddleware.js   # notFound + global errorHandler (standard envelope)
│   └── validate.js          # Request body validators
├── data/
│   ├── index.js             # Store factory: picks mock or postgres repository
│   ├── store.js             # In-memory seeded store (mock mode)
│   ├── postgres/index.js    # PostgreSQL repository (maxvolt_prod)
│   └── seed.js              # Demo data used by mock mode
├── scripts/
│   ├── migrate.js           # Idempotent schema-adaptation migrations
│   └── audit.js             # Security/consistency audit (disposable DB only!)
├── utils/
│   ├── jwt.js               # signToken / verifyToken
│   ├── password.js          # bcrypt hash / match
│   ├── sanitize.js          # strips password_hash, google_id from user objects
│   └── pagination.js        # page/limit parsing + standard pagination envelope
└── tests/                   # Backend unit/integration tests (node:test)
```

---

## 4. Response conventions (read this first)

All JSON. Three envelopes are used everywhere — a client only needs to know these.

### 4.1 Success (single resource)

```json
{ "token": "eyJhbGciOiJ...", "user": { "id": 7, "name": "Alex Rivera", "role": "USER", "email": "alex@...", "username": "alex.rivera", "fullName": "Alex Rivera" } }
```

### 4.2 Success (list) — the paginated envelope

Every list endpoint accepts `?page=1&limit=20` (plus resource‑specific filters
like `search`, `status`, `sort`, `order`) and answers with:

```json
{
  "success": true,
  "data": [ { "...": "one item" } ],
  "pagination": {
    "page": 1, "limit": 20, "total": 1215, "totalPages": 61,
    "hasNextPage": true, "hasPreviousPage": false,
    "nextPage": 2, "previousPage": null
  }
}
```
(pagination caps at `limit = 100`; a few legacy routes return a plain array when
no `page`/`limit` params are sent — see the route notes.)

### 4.3 Error

```json
{ "success": false, "status": 404, "message": "Battery not found" }
```
| Status | Meaning                                                    |
| ------ | ---------------------------------------------------------- |
| 400    | Bad request / validation failed (message tells you which)  |
| 401    | Missing/invalid/expired token, or wrong credentials        |
| 403    | Valid token, but wrong role (e.g. USER caling an admin route) |
| 404    | Route not found or resource not found                      |
| 429    | Rate limit hit (repeated failed logins / requests)         |
| 500    | Server error (message scrubbed in production)              |

### 4.4 User object (sanitized)

Never contains `password_hash` or `google_id`. The public form is:

```json
{
  "id": 7, "email": "alex@example.com", "role": "USER",
  "name": "Alex Rivera", "username": "alex.rivera", "fullName": "Alex Rivera",
  "phone": "+91 98...", "avatarColor": "#3b82f6",
  "emailVerified": true, "isActive": true, "createdAt": "2026-01-04T10:00:00.000Z"
}
```

---

## 5. Roles & authorization

| Role       | User type                                   | Entry panel                | Guard middleware      |
| ---------- | ------------------------------------------- | -------------------------- | --------------------- |
| `USER`     | Registered customer (sign‑up or Google)     | Customer app               | `protect`             |
| `ADMIN`    | Administrator (seed / managed in DB)        | Admin panel                | `protect + requireAdmin` |
| `EMPLOYEE` | Battery technician (created by an admin)    | Technician portal          | `protect + requireEmployee` |

Rules of thumb:
- `protect` → a valid `Authorization: Bearer <token>` header is required.
- `optionalProtect` → works with **or** without a token (public battery lookup).
- `requireAdmin` / `requireEmployee` → the token's role must match.
- Sign‑up always creates a `USER`; technicians are created only by admins
  (which also inserts the linked `service_persons` row).

---

## 6. API reference

> Base URL: `http://localhost:5000/api` (dev). All routes below are relative to that.

### 6.0 Home / health

| Method | Path       | Auth | Description                          |
| ------ | ---------- | ---- | ------------------------------------ |
| GET    | `/api/health` | — | Liveness + data-source + DB status |

```json
{ "message": "MaxSpace API is running", "version": "1.0.0",
  "dataSource": "postgres", "databaseConfigured": true, "databaseConnected": true,
  "endpoints": { "auth": "/api/auth", "admin": "/api/admin", "batteries": "/api/batteries", "services": "/api/services", "profile": "/api/profile", "analytics": "/api/analytics", "batteryTechnician": "/api/battery-technician" } }
```

---

### 6.1 Auth — `/api/auth`

| Method | Path                  | Auth  | Description                                            |
| ------ | --------------------- | ----- | ------------------------------------------------------ |
| POST   | `/auth/signup`        | —     | Register a customer → role `USER`. Returns `{ token, user }` (201) |
| POST   | `/auth/signin`        | —     | Log in with email + password → `{ token, user }`       |
| POST   | `/auth/google`        | —     | Verify a Google ID‑token `{ credential }` → new or linked `{ token, user }` |
| POST   | `/auth/forgot-password` | —   | `{ email }` → sends a reset link/token (returns message) |
| POST   | `/auth/reset-password`  | —   | `{ token, password }` → sets the new password           |
| POST   | `/auth/logout`        | protect | Invalidates the current token (message only)         |
| GET    | `/auth/me`            | protect | Returns the current user. Wrapped: `{ user }`           |

**Sign-up request:**
```json
{ "name": "Jane Doe", "email": "jane@example.com", "password": "StrongPass1!", "phone": "+91 90000 00000" }
```
**Sign-up / sign-in response (201 / 200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { "id": 12, "name": "Jane Doe", "email": "jane@example.com", "role": "USER",
            "username": "jane.doe", "fullName": "Jane Doe",
            "phone": "+91 90000 00000", "avatarColor": "#22c55e",
            "emailVerified": true, "isActive": true, "createdAt": "2026-09-21T09:15:00.000Z" }
}
```

> **Real DB note:** role is always `USER` here because sign‑up is the customer
> path. Admin accounts are provisioned in the database; technicians are created
> via `POST /admin/technicians`.

---

### 6.2 Batteries — `/api/batteries`

Access: all routes require a **USER** token, except the three `optionalProtect`
routes that also work without one (public passport lookup).

| Method | Path                        | Auth            | Description |
| ------ | --------------------------- | --------------- | ----------- |
| GET    | `/batteries`                | protect         | This user's fleet (paginated envelope) |
| POST   | `/batteries`                | protect         | Register a new battery → created entity (201) |
| GET    | `/batteries/lookup`         | optionalProtect | Find by barcode/serial `?q=` (returns matched battery) |
| GET    | `/batteries/:id`            | optionalProtect | Full battery record |
| GET    | `/batteries/:id/passport`   | optionalProtect | **Digital Battery Passport** (identity + health + compliance view) |
| GET    | `/batteries/:id/health-history` | optionalProtect | SoH/health timeline array |
| POST   | `/batteries/:id/claim`      | protect         | Link an unowned battery to the current user |
| PUT    | `/batteries/:id`            | protect         | Update the battery (owner only) |
| DELETE | `/batteries/:id`            | protect         | Remove the battery (owner only) |

**Create battery request (minimal):**
```json
{ "batteryName": "Model S4 Pack", "batteryModel": "maxvolt_s4", "serialNumber": "SN-2026-0001",
  "capacityAh": 120, "nominalVoltage": 48, "manufactureDate": "2026-05-01" }
```
**Passport response (representative shape):**
```json
{
  "success": true,
  "data": {
    "battery": { "batteryId": "BAT-2026-000123", "batteryName": "Model S4 Pack",
      "modelName": "MAXVOLT S4 120Ah", "serialNumber": "SN-2026-0001",
      "capacityAh": 120, "nominalVoltage": 48, "manufactureDate": "2026-05-01",
      "status": "Active", "stateOfHealth": 98.4, "cycleCount": 212,
      "warranty": { "type": "Limited 5-Year", "expiryDate": "2031-05-01" },
      "recycledContent": 14, "carbonFootprint": 62.5, "complianceStandards": ["UN38.3", "IEC 62619"],
      "owner": { "name": "Alex Rivera", "email": "alex@example.com" } },
    "recycling": "...", "healthHistory": [ { "recordedAt": "2026-08-01", "soc": 95, "soh": 99.1 } ]
  }
}
```
(Exact fields vary by store; what matters is the shape above.)

---

### 6.3 Services — `/api/services`

Access: **USER** token (the customer's own service requests).

| Method | Path                              | Description |
| ------ | --------------------------------- | ----------- |
| GET    | `/services`                       | My service requests (paginated) |
| POST   | `/services`                       | Create a service request     |
| GET    | `/services/:id`                   | One request (owner only)     |
| GET    | `/services/battery/:batteryId/status` | Latest service status for a battery |
| PATCH  | `/services/:id`                   | Update a request (owner only) |
| DELETE | `/services/:id`                   | Cancel/delete a request (owner only) |

**Create request:** `{ "batteryId": 7, "serviceType": "Repair", "description": "Battery not charging past 60%", "priority": "High" }`
**Service status values:** `Pending`, `Accepted`, `Assigned`, `In Progress`, `Completed`, `Approved`, `Rejected`, `Cancelled`, `Maintenance Done`.

---

### 6.4 Profile — `/api/profile`

Access: **USER** token. Responses wrap the payload as `{ user }` / `{ profile }`.

| Method | Path                        | Description |
| ------ | --------------------------- | ----------- |
| GET    | `/profile/`                 | My profile (`{ profile: <user> }`) |
| PUT    | `/profile/`                 | Update name/phone/notification prefs (returns updated `{ user }`) |
| PUT    | `/profile/notifications`    | Toggle notification channels (`phone`, `email`) |
| POST   | `/profile/password`         | Change password — `{ currentPassword, newPassword }` |
| GET    | `/profile/activity`         | My activity-log entries |
| GET    | `/profile/export`           | Full personal-data export (GDPR-style) |

---

### 6.5 Analytics — `/api/analytics`

Access: **USER** token.

| Method | Path                               | Description |
| ------ | ---------------------------------- | ----------- |
| GET    | `/analytics/`                      | Rolled-up analytics for the current user |
| GET    | `/analytics/fleet-stats`           | Fleet health/lifespan aggregates       |
| GET    | `/analytics/services`              | Service request statistics             |
| GET    | `/analytics/batteries/performance` | Per-battery performance metrics        |

---

### 6.6 Data (utility) — `/api/data`

Access: **ADMIN** only.

| Method | Path         | Description                                                          |
| ------ | ------------ | ------------------------------------------------------------------- |
| POST   | `/data/reset` | TRUNCATEs app tables — **gated by `ALLOW_DB_RESET=true`, never enable on production** |

---

### 6.7 Admin — `/api/admin`

Access: **ADMIN** token (all except `/login`). This is the full back-office surface.

**Auth:**
| Method | Path            | Description |
| ------ | --------------- | ----------- |
| POST   | `/admin/login`  | `{ email, password }` → `{ token, user }` (rate-limited: 20 failed / 15 min) |
| GET    | `/admin/me`     | Current admin → `{ user }` |
| POST   | `/admin/logout` | Invalidate token |

**Service management:**
| Method | Path                        | Description |
| ------ | --------------------------- | ----------- |
| GET    | `/admin/services`           | All service requests (paginated; filters `status`, `search`) |
| GET    | `/admin/services/:id`       | One service with full detail (customer, battery, technician) |
| PATCH  | `/admin/services/:id/accept`  | Accept a request |
| PATCH  | `/admin/services/:id/assign`  | Assign a technician — `{ technicianId }` |
| PATCH  | `/admin/services/:id/status`  | Update status — `{ status }` |
| PATCH  | `/admin/services/:id/approve` | Approve completion |

**Technicians & service persons:**
| Method | Path                                       | Description |
| ------ | ------------------------------------------ | ----------- |
| GET    | `/admin/service-persons`                   | List service-person records |
| POST   | `/admin/service-persons`                   | Create a service-person record |
| PATCH  | `/admin/service-persons/:id`               | Update a service-person record |
| GET    | `/admin/technicians`                       | List technicians (paginated) |
| GET    | `/admin/technicians/:id`                   | One technician |
| POST   | `/admin/technicians`                       | Create a technician → **creates EMPLOYEE user + service_persons row** |
| PATCH  | `/admin/technicians/:id`                   | Update technician + linked user |
| PATCH  | `/admin/technicians/:id/reset-password`    | Reset the technician's password |

**Registries (read-only views for the admin panel):**
| Method | Path                | Description |
| ------ | ------------------- | ----------- |
| GET    | `/admin/customers`  | All customer accounts (paginated, `search`) |
| GET    | `/admin/users`      | **All accounts** (ADMIN/USER/EMPLOYEE) — sanitized, with username/fullName + linked technician (paginated, `search`) |
| GET    | `/admin/batteries`  | **Full fleet registry** — every battery field + owner name/email (paginated, `search`) |
| GET    | `/admin/analytics`  | Back-office analytics summary |

`GET /admin/batteries?page=1&limit=5` response (representative item):
```json
{
  "success": true,
  "data": [
    { "batteryId": "BAT-2026-000123", "batteryName": "Model S4 Pack", "serialNumber": "SN-2026-0001",
      "batteryModel": "maxvolt_s4", "capacityAh": 120, "nominalVoltage": 48,
      "manufactureDate": "2026-05-01", "stateOfHealth": 98.4, "cycleCount": 212,
      "createdAt": "2026-05-02T08:00:00.000Z", "status": "Active",
      "ownerName": "Alex Rivera", "ownerEmail": "alex@example.com" }
  ],
  "pagination": { "page": 1, "limit": 5, "total": 1215, "totalPages": 243,
    "hasNextPage": true, "hasPreviousPage": false, "nextPage": 2, "previousPage": null }
}
```

**Scheduling & technician availability (P2.1):**
| Method | Path                                   | Description |
| ------ | -------------------------------------- | ----------- |
| GET    | `/admin/schedules`                     | List schedules |
| POST   | `/admin/schedules`                     | Create a schedule |
| PATCH  | `/admin/schedules/:id`                 | Update a schedule |
| DELETE | `/admin/schedules/:id`                 | Delete a schedule |
| GET    | `/admin/schedules/available`           | Available technicians for a window |
| POST   | `/admin/schedules/sync`                | Rebuild schedules from services |
| POST   | `/admin/schedules/upsert-service`      | Upsert a schedule row from a service |
| GET    | `/admin/technician-availability`       | List availability blocks |
| POST   | `/admin/technician-availability`       | Create availability |
| PATCH  | `/admin/technician-availability/:id`   | Update availability |
| DELETE | `/admin/technician-availability/:id`   | Delete availability |

---

### 6.8 Battery Technician — `/api/battery-technician`

Access: **EMPLOYEE** token (all except `/login`).

| Method | Path                              | Description |
| ------ | --------------------------------- | ----------- |
| POST   | `/battery-technician/login`       | `{ email, password }` → `{ token, user }` (rate-limited) |
| GET    | `/battery-technician/me`          | Current technician `{ user }` (includes `servicePerson` link) |
| POST   | `/battery-technician/logout`      | Invalidate token |
| GET    | `/battery-technician/services`    | My assigned services (paginated) |
| GET    | `/battery-technician/services/:id`| Assigned service detail |
| PATCH  | `/battery-technician/services/:id/status` | Update status — `{ status }` |

> Backward-compatible alias: the same routes are also served under `/api/service-man`.

---

## 7. Database

- **Mock mode (`DATA_SOURCE=mock`)**: in-memory store seeded with demo data. Use
  for dev/tests — nothing persists across restarts.
- **Postgres mode (`DATA_SOURCE=postgres`)**: the repository lives in
  `data/postgres/index.js` and talks to the existing **maxvolt_prod**
  production database. Run `node scripts/migrate.js` first — it applies the
  schema-adaptation migrations (`000_*`) idempotently (safe to re-run).
- **Users table:** `password_hash` is always bcrypt (`$2…`, 60 chars — never
  plaintext), plus new `username` / `full_name` columns that mirror the UI's
  display name.
- **Orphans:** batteries reference `owner_id` and technicians reference
  `service_person_id`; deletions are blocked while references still exist.

Quick integrity check:
```bash
node scripts/audit.js   # ⚠ only run against a DISPOSABLE dev database
```

---

## 8. Tests & QA

```bash
npm test                  # 14 unit/integration tests (node:test)
npm run audit             # security/consistency audit (dev DB only)
node --check <file.js>    # syntax check any changed file
```

The audit suite covers: plaintext-password scan, orphan FKs, CORS behavior,
unified 401s, sanitized payloads, role access control, and pagination — run it
against a throwaway DB, never against `maxvolt_prod`.