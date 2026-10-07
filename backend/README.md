# MaxSpace API — Backend

The REST API that powers the [MaxSpace Digital Battery Passport system](../README.md).
It serves four panels: the **customer app**, the **admin panel**, the **battery
technician portal** and the **EPR partner portal** — with role‑based access
control between them.

PostgreSQL is the only data source. There is no in‑memory mock store and no
demo seed: if `DATABASE_URL` is missing or unreachable the process refuses to
start rather than serve fabricated data.

---

## 1. Quick start

```bash
cd backend
npm install
cp .env.example .env      # then set DATABASE_URL and JWT_SECRET
npm run db:migrate -- --check   # dry run: applies the schema in a rolled-back txn
npm run db:migrate              # apply it for real (idempotent, safe to re-run)
node index.js              # -> http://localhost:5000
```

`node index.js` expects the database to be up. If it is not you will see
`[data] PostgreSQL repository unavailable: … ECONNREFUSED` and the process exits.

### Accounts

There is no seeded demo account any more — accounts exist in the database only.

| Role            | How it is created                                            |
| --------------- | ------------------------------------------------------------ |
| `ADMIN`         | Provisioned directly in the database                         |
| `USER`          | Sign‑up (`POST /api/auth/signup`)                            |
| `EMPLOYEE`      | `POST /api/admin/technicians` (also creates the `service_persons` row) |
| `PARTNER`       | `POST /api/admin/partner-accounts` — requires an existing EPR producer registration |

---

## 2. Configuration (backend/.env)

| Variable           | Default                  | Purpose                                                                |
| ------------------ | ------------------------ | ---------------------------------------------------------------------- |
| `PORT`             | 5000                     | HTTP port                                                              |
| `DATABASE_URL`     | —                        | PostgreSQL connection string. **Required** — the process will not start without it |
| `JWT_SECRET`       | —                        | Signs all access tokens — **must be changed in production**            |
| `JWT_EXPIRES_IN`   | 7d                       | Token lifetime (`7d`, `2h`, `30m`, …)                                  |
| `FRONTEND_URL`     | localhost:5173           | Allowed CORS origin(s), comma‑separated                                |
| `CLIENT_URL`       | same as FRONTEND_URL     | Legacy alias for the frontend origin                                   |
| `IOT_DEVICE_KEY`   | — (empty)                | Enables device-key telemetry ingest. **Empty = ingest is ADMIN‑JWT only** |
| `GOOGLE_CLIENT_ID` | —                        | Google Sign‑In client ID (optional; enables "Continue with Google")    |
| `RESEND_API_KEY`   | — (empty)                | Resend API key for auth e‑mail. **Backend only — never `VITE_`‑prefixed.** Empty in dev = links are written to `%TEMP%/maxspace-auth-links.log` instead of sent; empty in production = sending is refused |
| `RESEND_FROM_EMAIL`| onboarding@resend.dev (dev) | Sender address. Dev/local defaults to `onboarding@resend.dev` (no domain verification needed); production uses `no-reply@maxvoltreearth.com`. Empty/placeholder values are never sent — the environment's sender is substituted with a logged warning |
| `RESEND_FROM_NAME` | MaxSpace                 | Display name on outgoing mail                                          |
| `APP_BASE_URL`     | http://localhost:5000    | Public base URL of **this API**, used to build the e‑mail verification link |

### Transactional e‑mail (Resend)

Account verification and password‑reset mail is sent through
[Resend](https://resend.com) from the backend only. To enable real delivery:

1. Create an API key at <https://resend.com/api-keys> and set `RESEND_API_KEY`.
2. Set `RESEND_FROM_EMAIL` for the environment: `onboarding@resend.dev` for
   development/local (built into Resend, works without DNS setup), or a
   verified-domain address such as `no-reply@maxvoltreearth.com` for
   production.
3. Set `APP_BASE_URL` to the public URL of this API (not the React app); the
   verification link points at `GET /api/auth/verify-email?token=…`.

Without a key the flows stay testable in development: the message is not sent,
but its link is appended to `%TEMP%/maxspace-auth-links.log` and the API reports
`emailSent: true`. In production the server refuses to send and answers `503
EMAIL_DELIVERY_FAILED`; a token is never written to disk. The API key is never
logged and provider errors are never surfaced to clients.

`DATA_SOURCE` and `LEGACY_SCHEMA` are **no longer read**. The v2 schema is
authoritative and lives entirely in `public`.

`ALLOW_DB_RESET` and `POST /api/data/reset` no longer exist — there is no
TRUNCATE endpoint to accidentally enable.

No plaintext secrets are read from the environment beyond these — the reference
values live in `.env` (git‑ignored). Copy from `.env.example` and fill in.

The database user needs `CREATE DATABASE` rights for the test suite, which
builds and drops its own throwaway database per file.

---

## 3. Project structure

```
backend/
├── index.js                 # Express app: middleware, route mounting, server
├── config/app.js            # Loads + validates environment/config
├── constants/               # BWMR 2022 / CPCB EPR and map vocabularies
├── routes/                  # One router per surface (auth, admin, batteries, partner, …)
├── controllers/             # Request handlers (validation, auth, response shape)
├── middleware/
│   ├── auth.js              # protect / optionalProtect / requireAdmin /
│   │                        #   requireEmployee / requireOperator / requirePartner /
│   │                        #   iotDeviceOrAdmin
│   ├── errorMiddleware.js   # notFound + global errorHandler (standard envelope)
│   └── validate.js          # Request body validators
├── data/
│   ├── index.js             # Loads the PostgreSQL store; refuses to start if it is down
│   ├── dbDiagnostics.js     # Connection diagnostics for /api/health
│   ├── postgres/index.js    # PostgreSQL repository (users, batteries, services, compliance…)
│   ├── postgres/lifecycle.js# Passport lifecycle: ledger, ownership, provenance, EOL
│   └── compliance/postgres.js # Compliance management (producers, obligations, credits)
├── scripts/
│   ├── migrate.js           # Applies sql/schema.sql — `up | --status | --check`
│   ├── backfillPassport.js  # One-time legacy passport/provenance classification
│   └── audit.js             # Security/consistency audit (disposable DB only!)
├── sql/schema.sql           # THE authoritative schema (re-runnable, additive)
├── services/                # Domain logic (telemetry validation, scheduling, …)
├── utils/
│   ├── lifecycleLedger.js   # Lifecycle stages/events/transitions, hashing, provenance rules
│   ├── partnerAccess.js     # What an external EPR partner may reach, and why
│   ├── organizationAccess.js# Facility-network visibility matrix (policy, no store import)
│   ├── complianceValidation.js # Throwing validators; partial-PATCH semantics
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

| Role       | User type                                                | Entry panel   | Guard middleware      |
| ---------- | -------------------------------------------------------- | ------------- | --------------------- |
| `USER`     | Registered customer (sign‑up or Google)                  | Customer app  | `protect`             |
| `ADMIN`    | Administrator (seed / managed in DB)                     | Admin panel   | `protect + requireAdmin` |
| `EMPLOYEE` | Battery technician (created by an admin)                 | Technician portal | `protect + requireEmployee` |
| `PARTNER`  | External EPR body — recycler / collection centre / refurbisher / auditor | Partner portal | `protect + requirePartner` |

Guards:
- `protect` → a valid `Authorization: Bearer <token>` header is required.
- `optionalProtect` → works with **or** without a token (public battery lookup).
- `requireAdmin` / `requireEmployee` → the token's role must match exactly.
- `requireOperator` → ADMIN **or** EMPLOYEE. Used by the passport lifecycle
  writes an admin performs and a technician performs on assigned work.
- `requirePartner` → PARTNER only.
- Sign‑up always creates a `USER`; technicians and partner accounts are created
  only by admins.

Three scoping rules are worth knowing before adding an endpoint:

1. **`ownerScopeFor` fails closed.** A `USER` is restricted to their own
   batteries; ADMIN/EMPLOYEE get the whole fleet; a **PARTNER matches nothing**
   there. `null` means "no owner filter", so a partner must never resolve to it.
2. **A `PARTNER` token is not a fleet credential.** Partners reach batteries only
   through `/api/partner`, gated on an active, unexpired `battery_eol_assignments`
   row for that specific battery. A partner with no linked EPR registration is
   refused outright rather than defaulted to fleet access.
3. **A partner sees no facility network.** The org/facility map matrix in
   `utils/organizationAccess.js` returns an empty list for `PARTNER` and for any
   role it does not recognise — an unlisted role must never inherit ADMIN's reach.

Public barcode/passport scans are deliberately narrower than the owner's view:
ownership, event actors, notes, previous owners, assessor identity and
`ownerOrganizationId` are withheld from anonymous callers.

---

## 6. API reference

> Base URL: `http://localhost:5000/api` (dev). All routes below are relative to that.

### 6.0 Home / health

| Method | Path       | Auth | Description                          |
| ------ | ---------- | ---- | ------------------------------------ |
| GET    | `/api/health` | — | Liveness + database status |

```json
{ "message": "MaxSpace API is running", "version": "1.0.0",
  "dataSource": "postgres", "databaseConfigured": true, "databaseConnected": true,
  "endpoints": { "auth": "/api/auth", "admin": "/api/admin", "batteries": "/api/batteries", "services": "/api/services", "profile": "/api/profile", "analytics": "/api/analytics", "batteryTechnician": "/api/battery-technician", "partner": "/api/partner", "compliance": "/api/admin/compliance*", "map": "/api/map" } }
```

---

### 6.1 Auth — `/api/auth`

| Method | Path                  | Auth  | Description                                            |
| ------ | --------------------- | ----- | ------------------------------------------------------ |
| POST   | `/auth/signup`        | —     | Register a customer → role `USER`. Creates an **unverified** account and e‑mails a link; returns `{ success, requiresVerification, emailSent, message, user }` (201) — **no token** |
| POST   | `/auth/signin`        | —     | Log in with email + password → `{ token, user }`. An unverified account is refused with `403 EMAIL_NOT_VERIFIED` |
| POST   | `/auth/google`        | —     | Verify a Google ID‑token `{ credential }` → new or linked `{ token, user }` |
| GET    | `/auth/verify-email`  | —     | Link in the e‑mail (`?token=…`). Validates server‑side, then `302`s to `<frontend>/verify-email?status=verified\|expired\|already-verified\|invalid` |
| POST   | `/auth/resend-verification` | — | `{ email }` → non‑enumerating generic `200`; rate‑limited to 5 / 15 min per IP |
| POST   | `/auth/forgot-password` | —   | `{ email }` → non‑enumerating generic `200`; rate‑limited to 5 / 15 min per IP |
| POST   | `/auth/reset-password`  | —   | `{ token, password, confirmPassword? }` → sets the new password. Errors carry `RESET_TOKEN_INVALID` / `RESET_TOKEN_USED` / `RESET_TOKEN_EXPIRED` |
| POST   | `/auth/logout`        | protect | Invalidates the current token (message only)         |
| GET    | `/auth/me`            | protect | Returns the current user. Wrapped: `{ user }`           |

**Sign-up request:**
```json
{ "name": "Jane Doe", "email": "jane@example.com", "password": "StrongPass1!", "confirmPassword": "StrongPass1!" }
```
**Sign-up response (201)** — the account exists but no session is issued until the
e‑mail is verified:
```json
{
  "success": true,
  "requiresVerification": true,
  "emailSent": true,
  "message": "Account created. Please check your email to verify your account.",
  "user": { "id": 12, "name": "Jane Doe", "email": "jane@example.com", "role": "USER",
            "username": "jane.doe", "fullName": "Jane Doe", "emailVerified": false,
            "isActive": true, "createdAt": "2026-09-21T09:15:00.000Z" }
}
```
**Sign-in to an unverified account (403):**
```json
{ "success": false, "status": 403,
  "message": "Your email address has not been verified. Please check your inbox for the verification link, or resend it.",
  "code": "EMAIL_NOT_VERIFIED" }
```

> **Verification flow:** tokens are single‑use, expire after 24 h, and only their
> SHA‑256 is stored. `GET /auth/verify-email` marks the account verified and keeps
> the hash so a replay reports `already-verified` rather than an error. Existing,
> admin‑created and Google‑linked accounts are created verified and are unaffected.
> Password‑reset tokens expire after 30 min and record their use (`RESET_TOKEN_USED`
> on replay).

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
| GET    | `/batteries/:id/passport`   | optionalProtect | **Digital Battery Passport** (identity + health + compliance + lifecycle) |
| GET    | `/batteries/:id/health-history` | optionalProtect | SoH/health timeline array |
| POST   | `/batteries/:id/claim`      | protect         | Link an unowned battery to the current user |
| PUT    | `/batteries/:id`            | protect         | Update the battery (owner only; manufacturer fields are refused — see 6.10) |
| DELETE | `/batteries/:id`            | protect         | Remove the battery (owner only) |

The passport response includes a `lifecycle` block. Anonymous callers get the
summary plus chain integrity and a reduced second‑life assessment; the owner and
fleet operators additionally get the full event list, custody chain, provenance,
firmware history and assignments.

The full lifecycle surface is documented in **6.10**.

**Battery telemetry (IoT / BMS readings):**

| Method | Path                                  | Auth            | Description |
| ------ | ------------------------------------- | --------------- | ----------- |
| GET    | `/batteries/:id/telemetry/latest`     | optionalProtect | Most recent device reading, or `{ data: null, available: false }` when no source is connected |
| GET    | `/batteries/:id/telemetry/history`    | optionalProtect | Time series (oldest→newest); query `?limit=&from=&to=` |
| POST   | `/batteries/:id/telemetry`            | admin or device | Ingest a reading (**rate-limited**; see section 6.2.1) |

Telemetry is append-only and read-only for customers. Ingest requires either an
**ADMIN** JWT (manual/testing) or a device key in the `X-IoT-Device-Key` header
matching `IOT_DEVICE_KEY` from the environment. When `IOT_DEVICE_KEY` is unset
the device path is disabled entirely — see the root `README.md` section
*Future BMS / IoT Integration* for the full design.

**Ingest request (representative):**
```json
{ "voltage": 48.2, "current": -3.5, "temperatureC": 28.4,
  "soc": 87, "soh": 95.2, "cycleCount": 212,
  "chargingStatus": "discharging", "faultStatus": null,
  "source": "mqtt", "recordedAt": "2026-09-23T10:30:00Z" }
```
Validation: numeric range checks (voltage 0–2000 V, current ±5000 A,
temperature −100–300 °C, SoC/SoH 0–100, integer cycle count ≥ 0), charging
status must be one of `charging|discharging|idle|standby|unknown`, `source`
must be one of `api|bms|mqtt|can-bus|rs485|bluetooth|manual|other`, and
`recordedAt` must be ISO-8601 or epoch ms (not more than 30 s in the future).
Any field may be omitted/`null`; `batteryId` is always inherited from the URL.

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

**EPR partner accounts:**
| Method | Path                          | Description |
| ------ | ----------------------------- | ----------- |
| POST   | `/admin/partner-accounts`     | Create a `PARTNER` login bound to an existing EPR producer registration |
| PATCH  | `/admin/partner-accounts/:id`         | Re-link the registration, reset the password, or deactivate |

See **6.11** for what a partner account can then reach.

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

### 6.9 India Compliance (BWMR 2022 / CPCB EPR)

Framework: **Battery Waste Management Rules, 2022** with CPCB EPR vocabulary
(defined once in `backend/constants/compliance.js` and mirrored in the admin
UI — the database has no compliance CHECKs, so recorded values always come from
the app, never fabricated).

**Customer view (on the battery passport):**

| Method | Path                     | Auth            | Description |
| ------ | ------------------------ | --------------- | ----------- |
| GET    | `/batteries/:id/compliance` | optionalProtect | The battery's compliance record + producer + documents + recent audit events |

```json
{ "success": true, "data": null, "available": false }
```
When no record exists the payload is empty with `available:false` (honest "not
yet tracked"). With a token the lookup is owner-scoped.

**Admin surface — `/admin/compliance*` (all require `protect + requireAdmin`):**

| Method | Path                                  | Description |
| ------ | ------------------------------------- | ----------- |
| GET    | `/admin/compliance/overview`          | Counts: producers, batteries tracked, obligations/credits |
| GET    | `/admin/compliance/events`            | Audit log (newest-first) |
| GET/POST      | `/admin/compliance/producers`         | List / create CPCB producers |
| GET/PATCH/DELETE | `/admin/compliance/producers/:id`   | One producer (delete cascades its obligations + credits) |
| GET/POST      | `/admin/compliance/batteries`         | List / attach a compliance record to a battery |
| GET/PATCH     | `/admin/compliance/batteries/:batteryId` | One record (verified-in-MaxSpace) |
| GET/POST      | `/admin/compliance/obligations`       | List / create EPR obligations |
| GET/PATCH/DELETE | `/admin/compliance/obligations/:id` | One obligation |
| GET/POST      | `/admin/compliance/credits`           | List / create EPR credits / certificates |
| GET/PATCH/DELETE | `/admin/compliance/credits/:id`     | One credit |
| GET/POST      | `/admin/compliance/documents`         | List / create document references |
| GET/PATCH/DELETE | `/admin/compliance/documents/:id`   | One document |

Field notes:

- **Battery records** have no DELETE route — untracking a battery is out of
  scope; deleting the battery itself cascades the compliance record via FK.
- `verifiedAt` is **stamped/cleared by the server** when `verifiedInApp` toggles
  (`true` → `now()`, `false` → `NULL`); client-supplied `verifiedAt` is ignored.
- Obligations use `obligationKg` / `achievedKg` (not `targetQuantityKg`);
  credits require `obligationId` + unique `certificateNumber` (JSON 409 on dup).
- All list endpoints use the standard pagination envelope (`page`/`limit`,
  `search`, `status`, `sort`, `order`); `limit` caps at 100.

---

### 6.10 Battery Passport Lifecycle — `/api/batteries/:id/…`

The passport's history: an **append-only event ledger with a SHA‑256 hash
chain**, ownership transfers, per‑field data provenance, derived telemetry
events, firmware history, EPR partner assignments and second‑life assessments.

The vocabulary (stages, event codes, legal transitions, provenance strength) is
defined once in `utils/lifecycleLedger.js` and served from
`GET /batteries/lifecycle/vocabulary`, so the client cannot offer an action the
API would reject.

Reads are owner‑scoped; writes are operator‑only, and each write re‑checks the
role inside the controller so mounting a handler elsewhere cannot bypass it.

| Method | Path                                       | Auth            | Description |
| ------ | ------------------------------------------ | --------------- | ----------- |
| GET    | `/batteries/lifecycle/vocabulary`          | protect         | Stages, event codes, transitions, defaults |
| GET    | `/batteries/:id/lifecycle`                 | optionalProtect | Summary + events + custody + provenance + firmware + assignments + assessments |
| GET    | `/batteries/:id/lifecycle/verify`          | optionalProtect | Re-walk the hash chain → `{ valid, eventsChecked, brokenAt, reason }` |
| GET    | `/batteries/:id/lifecycle/events`          | optionalProtect | Event rows (`?limit=`) |
| POST   | `/batteries/:id/lifecycle/events`          | requireOperator | Append one event — `{ eventCode, newValue, occurredAt, notes, metadata }` |
| POST   | `/batteries/:id/lifecycle/backfill`        | requireAdmin    | Seed the ledger from the existing manufacturing record (idempotent) |
| GET    | `/batteries/:id/ownership-history`         | optionalProtect | Custody periods |
| POST   | `/batteries/:id/transfer-ownership`        | requireAdmin    | `{ newOwnerId, ownershipType, transferReference, notes }` |
| GET    | `/batteries/:id/provenance`                | optionalProtect | Per‑field provenance assertions |
| POST   | `/batteries/:id/provenance`                | requireOperator | Assert a field's value/source/strength (weaker assertions are refused) |
| GET    | `/batteries/:id/telemetry-events`          | optionalProtect | Derived events (charge session, excursion, …) |
| POST   | `/batteries/:id/telemetry-events/detect`   | requireOperator | Derive events from stored readings (`{ thresholds, from, to }`) |
| GET    | `/batteries/:id/firmware`                  | optionalProtect | Firmware install history |
| POST   | `/batteries/:id/firmware`                  | requireOperator | `{ firmwareVersion, previousVersion, result }` |
| GET    | `/batteries/:id/eol-assignments`           | optionalProtect | EPR partner authorisations |
| POST   | `/batteries/:id/eol-assignments`           | requireAdmin    | `{ partnerId, partnerRole, accessExpiresAt, collectionAddress }` |
| POST   | `/batteries/:id/eol-assignments/:assignmentId/complete` | requireAdmin  | Close an assignment as completed |
| POST   | `/batteries/:id/eol-assignments/:assignmentId/revoke`  | requireAdmin  | Revoke an assignment |
| GET    | `/batteries/:id/second-life`               | optionalProtect | Grading history |
| POST   | `/batteries/:id/second-life`               | requireAdmin    | `{ grade, decision, healthPercent, capacityPercent, decisionNotes }` |
| PATCH  | `/batteries/:id/manufacturer-correction`   | requireAdmin    | Audited correction of a locked manufacturer field — **`reason` is mandatory** |

Lifecycle stages: `Unknown`, `Manufactured`, `Commissioned`, `InService`,
`OwnershipTransferred`, `Serviced`, `Retired`, `Collected`, `UnderAssessment`,
`Refurbished`, `SecondLife`, `Recycled`, `FinalEvidenceRecorded`.

#### What is recorded automatically

A passport is only trustworthy if its history is complete without anyone
remembering to write it by hand, so ordinary operations project themselves into
the ledger:

| Operation | Event written | Source |
| --------- | ------------- | ------ |
| Customer registers a battery (`POST /batteries`) | `first_owner_registered` | `user` |
| Customer claims a battery with no recorded owner | `first_owner_registered` | `user` |
| Customer claims a battery the ledger already attributes to someone | `ownership_transferred` | `user` |
| Service → `Confirmed` | `service_scheduled` | `user` |
| Service → `In Progress` | `service_started` | `service_technician` / `admin` |
| Service → `Completed` | `service_completed` | `service_technician` / `admin` |
| Service → `Cancelled` | `service_cancelled` | `user` / `admin` |

`Accepted`, `Assigned`, `On The Way` and `Waiting for Admin Approval` are
deliberately **silent**: they are workflow bookkeeping about who is doing what,
not changes in the battery's life, and an event per status change would bury
the ones that matter.

Claiming is classified by asking the **ledger**, not the batteries row, whether
the unit already has a prior owner. A battery with a manufacturing record but
no owner is still getting its first owner — and `Manufactured →
OwnershipTransferred` is not a legal stage move anyway. The `user-maxvolt`
production-fleet placeholder is never counted as custody.

Automatic events are ordinary ledger rows: chain-verified, immutable, and
carrying `metadata.automatic = true`. They are written by
`utils/serviceLifecycle.js` and `utils/batteryLifecycleBridge.js`.

Neither helper throws. The authoritative write has already committed by the time
they run, so failing the HTTP request afterwards would misreport a success and
invite a duplicate retry. A rejected append is logged as
`[lifecycle] … failed to append` and recorded as a `Lifecycle ledger gap` entry
in the service history, where an operator can see it.

Design rules enforced by the schema, not only the app:

- The **ledger is append‑only**. Events cannot be updated; they cannot be
  deleted while the battery exists. There is no endpoint to edit or delete an
  event, by design.
- Each event's `event_hash` covers the canonicalised previous event plus its own
  payload, so a removed or rewritten row breaks `verify`.
- **Identity is immutable**: `battery_id`, `barcode`, `serial_number`,
  `modal_id`, `qr_code`, `model_id` and `manufacture_date` cannot be changed by
  any request. `registration_origin` may only be filled in once, from
  unclassified to `legacy_import`.
- **A battery minted here records `registration_origin = 'digital_passport'`.**
  Left NULL it could later be classified `legacy_import` by the backfill, which
  would be a false claim about where the record came from.
- **Measured fields are not owner‑editable.** An owner editing
  `stateOfHealth`/`stateOfCharge`/`cycleCount`/`internalResistance` is refused
  unless they already hold an authoritative/measured assertion.
- **Derived telemetry events are reproducible**: every row stores the reading it
  came from and the threshold it was compared against, and `dedupe_key` makes
  re-running detection idempotent.
- **Second‑life suitability is never inferred.** A grade, decision, assessor and
  evidence are required.

---

### 6.11 EPR Partners — `/api/partner`

Mounted as its own surface rather than as extra battery routes, because a
partner's authorised view is per‑battery and narrower than a customer's passport.
Every route is `protect + requirePartner`, and every handler re‑verifies that the
battery has an **active, unexpired** assignment for the caller's linked EPR
registration.

| Method | Path                                   | Description |
| ------ | -------------------------------------- | ----------- |
| GET    | `/partner/assignments`                 | Batteries this partner is assigned to |
| GET    | `/partner/assignments/:id/battery`     | One assigned battery |
| GET    | `/partner/batteries/:id`               | Narrow partner passport view (no owner identity, no service history) |
| POST   | `/partner/batteries/:id/eol-action`    | Record collection / recycling / second‑life actions |
| POST   | `/partner/batteries/:id/second-life`   | Record a graded assessment |

A battery the partner has no assignment for returns **404, not 403** — reporting
"forbidden" would confirm the battery exists, which is itself a disclosure.

Accounts are created by an admin against an existing EPR registration:

| Method | Path                                  | Auth | Description |
| ------ | ------------------------------------- | ---- | ----------- |
| POST   | `/admin/partner-accounts`             | requireAdmin | `{ name, email, password, partnerId }` → a `PARTNER` user linked to that registration |
| PATCH  | `/admin/partner-accounts/:id`         | requireAdmin | Re‑link, reset password, or deactivate |

The role is fixed to `PARTNER` by the endpoint and never read from the request
body. A partner account with no `partner_id` cannot use the API at all — that is
deliberate, and it is what stops an unlinked partner widening its own scope.

---

### 6.12 Fleet Map — `/api/map`

The Global Battery & Compliance Map surface. Vocabulary is defined once in
`backend/constants/mapConfig.js` (health/lifecycle/compliance/service buckets)
and validated by `backend/utils/mapValidation.js` — the database has no map
CHECKs, so every marker fact is derived from the real stored battery, service,
compliance and location data. Nothing is fabricated.

**Role matrix (markers are role-scoped by the backend):**

| Role     | Batteries shown                                              | Owner included |
| -------- | ------------------------------------------------------------ | -------------- |
| ADMIN    | Whole fleet                                                  | yes            |
| USER     | Only batteries owned by the account (`owner_id` isolation)   | no             |
| EMPLOYEE | Only batteries with a service assigned to the technician     | no             |

Batteries with no recorded location row are never on the map. A battery with no
compliance record is reported as **"Not Tracked"** — never as compliant.

| Method | Path                       | Auth     | Description |
| ------ | -------------------------- | -------- | ----------- |
| GET    | `/map/batteries`           | protect  | Markers + summary for the caller's role scope |
| GET    | `/map/locations`           | protect + requireAdmin | Registry of recorded locations (paginated) |
| GET    | `/map/locations/:batteryId` | protect + requireAdmin | One battery's location + movement history |
| PUT    | `/map/locations/:batteryId` | protect + requireAdmin | Record / update a battery's real location |
| DELETE | `/map/locations/:batteryId` | protect + requireAdmin | Untrack a battery (removes its location rows) |
| GET    | `/map/locations/:batteryId/history` | protect + requireAdmin | Append-only movement log |

**Query params for `GET /map/batteries`:** `search` (battery ID / site / city /
producer / owner), `healthStatus` (`healthy`/`warning`/`critical`),
`batteryStatus` (`in_service`/`fg_pending`/`defect_hold`), `complianceStatus`
(`compliant`/`pending`/`under_review`/`non_compliant`/`not_applicable`),
`serviceStatus` (`active`/`completed`/`none`), `bbox` (`minLng,minLat,maxLng,maxLat`),
`page`/`limit` (default limit `2000` — the map fetches the whole matched set and
clusters client-side; page region-by-region via `bbox` for very large fleets).

**Marker shape (abridged):**
```json
{ "batteryId": "MVAE0014036", "name": null, "model": null,
  "overallStatus": "FG PENDING", "hangStatus": false,
  "lifecycle": { "key": "fg_pending", "label": "FG Pending", "tone": "neutral" },
  "stateOfHealth": 94.2, "health": { "key": "healthy", "label": "Healthy", "tone": "success" },
  "compliance": { "status": null, "verifiedInApp": false, "producerName": null,
                  "bucket": { "key": "not_tracked", "label": "Not Tracked", "tone": "neutral" } },
  "service": null,
  "location": { "siteName": null, "locationType": "Warehouse", "address": null, "city": "Bengaluru",
                "state": "Karnataka", "country": "India", "latitude": 12.9716, "longitude": 77.5946 },
  "owner": null, "updatedAt": "2026-09-24T09:15:00.000Z" }
```

**Summary (server-side, over the full filtered set — never just the page):**
`total`, `plotted`, `byCompliance`, `byHealth`, `byLifecycle`, `byService`,
`byCountry`, `byState`, `byLocationType` (top-20 each).

**Location record validation (`PUT /map/locations/:batteryId`):**
`latitude`/`longitude` must be provided together and within range; a payload with
neither coordinates nor any address field (site/address/city/state/country) is
rejected — so an address-only row is possible, but an empty row is not.
`reason` is written into the audit history. Movement history rows keep
self-contained snapshots of the previous/new location, so a battery's history
stays truthful even though the current location row is updated in place.

---

## 7. Database

`sql/schema.sql` is the **single authoritative schema**. It is re-runnable and
additive — there is no separate `migrations/` folder and no ordered upgrade
scripts to keep in sync. Apply it with:

```bash
npm run db:migrate -- --status   # what the database looks like now
npm run db:migrate -- --check    # apply inside a rolled-back txn, then undo
npm run db:migrate               # apply for real
```

### 7.1 Battery passport lifecycle (section 7 of the schema)

| Table                        | Purpose |
| ---------------------------- | ------- |
| `battery_lifecycle_events`   | The append-only ledger. Hash-chained, immutable, `dedupe`-free by design |
| `battery_ownership_history`  | Custody periods; a closed period may only have `released_at` set |
| `battery_data_provenance`    | Per-field assertion of value/source/strength; an assertion may only be superseded |
| `battery_telemetry_events`   | Conclusions drawn from raw readings, with the source reading + threshold |
| `battery_firmware_updates`   | What firmware the BMS is running and how it got there |
| `battery_eol_assignments`    | Per-battery, time-boxed EPR partner authorisation |
| `battery_second_life_assessments` | Grading and the decision made on evidence |
| `users.partner_id`           | Links a `PARTNER` login to its `compliance_producers` registration |

Plus new columns on `batteries`: `registration_origin`,
`registration_recorded_at`, `lifecycle_stage`, `last_lifecycle_event_at`,
`owner_organization_id`; and lifecycle/EPR annotations on `compliance_documents`.

**The passport reads lifecycle data, so the schema must be applied before the
API is started.** A battery passport against an un-migrated database will fail.

### 7.2 Legacy backfill

Batteries that predate the passport get one honest event seeded from the
manufacturing record — no invented commissioning, owner, service or collection
history:

```bash
node scripts/backfillPassport.js --dry-run   # report what would change
node scripts/backfillPassport.js             # apply
node scripts/backfillPassport.js --battery BATT-GEN-0001   # one battery
```

It is idempotent (a battery with any event is skipped) and takes an advisory lock
per battery, so running it while an operator seeds the same battery from the
admin panel cannot produce two genesis events.

### 7.3 Other notes

- **Users table:** `password_hash` is always bcrypt (`$2…`, 60 chars — never
  plaintext), plus `username` / `full_name` columns that mirror the UI's display
  name.
- **Orphans:** batteries reference `owner_id` and technicians reference
  `service_person_id`; deletions are blocked while references still exist.
- **Compliance tables (BWMR 2022):** `compliance_producers`, `battery_compliance`
  (FK onto the real `batteries.battery_id`, one record per tracked battery),
  `epr_obligations`, `epr_credits`, `compliance_documents`, `compliance_events`.
  Deleting a producer cascades obligations/credits and SET NULLs its
  documents/records; deleting a battery cascades its compliance record.

Quick integrity check:
```bash
node scripts/audit.js   # ⚠ only run against a DISPOSABLE dev database
```

---

## 8. Tests & QA

```bash
npm test                  # node:test suite
npm run audit             # security/consistency audit (dev DB only)
node --check <file.js>    # syntax check any changed file
```

145 tests, all passing. Each file is run in its own process and the
database-backed ones build a throwaway database from the real `schema.sql`:

| Suite | Needs a database? |
| ----- | ----------------- |
| `tests/lifecycle.test.js` | no — pure ledger/provenance/detection logic |
| `tests/serviceLifecycle.test.js` | partly — mapping tests are pure; the chain tests need a throwaway DB |
| `tests/organizations.test.js` | no — role-visibility policy |
| `tests/compliance.test.js`, `tests/map.test.js`, `tests/telemetry.test.js`, `tests/batteryRegistration.test.js` | yes — throwaway DB per run |

Database-backed suites **skip rather than fail** when no PostgreSQL is
reachable (`withOptionalTestDatabase` in `tests/helpers/testDatabase.js`), so
"Postgres is down" is reported as skipped instead of looking like a code
defect. A schema that *does* apply badly is still re-thrown — that is a real
bug, not an environment problem.

```
[test-db] skipping database-backed suite for map.test.js: [test-db] could not create maxspace_test_map_…
```

`npm run audit` covers: plaintext-password scan, orphan FKs, CORS behavior,
unified 401s, sanitized payloads, role access control, and pagination — run it
against a throwaway DB, never against a real one.