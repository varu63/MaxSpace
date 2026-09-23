# MaxSpace — Digital Battery Passport System

A full-stack web application for managing battery fleets and generating
**EU-compliant Digital Battery Passports** under the
[EU Battery Regulation 2023/1542](https://eur-lex.europa.eu/eli/reg/2023/1542).

**Three role-based panels in one app:**

| Panel            | For             | Login URL                                        |
| ---------------- | --------------- | ------------------------------------------------ |
| **Customer app** | Battery owners  | `http://localhost:5173`                          |
| **Admin panel**  | MaxSpace admins | `http://localhost:5173/admin/login`              |
| **Technician**   | Technicians     | `http://localhost:5173/battery-technician/login` |

---

## Table of contents

1. [What it does](#1-what-it-does)
2. [Tech stack](#2-tech-stack)
3. [Architecture](#3-architecture)
4. [Folder structure](#4-folder-structure)
5. [Quick start](#5-quick-start)
6. [Demo accounts](#6-demo-accounts)
7. [Configuration](#7-configuration)
8. [Development commands](#8-development-commands)
9. [Testing & QA](#9-testing--qa)
10. [Security design](#10-security-design)
11. [Database](#11-database)
12. [Future BMS / IoT Integration](#12-future-bms--iot-integration)
13. [Documentation](#13-documentation)
14. [License](#14-license)

---

## 1. What it does

A "battery passport" is a single record describing everything important about a
battery: identity, owner, chemistry and specs, state of health, warranty,
recycled content, compliance certificates, and service history.

MaxSpace lets a fleet owner:

- **Register** batteries (7 categories: EV, ESS, LEV, Commercial, Aerial/UAV,
  Industrial Cordless, Material Handling) — a passport, serial number, and EU
  passport QR/URL are generated automatically.
- **Scan** a battery QR/barcode to open its passport instantly; unknown codes
  open the pre-filled registration form.
- **Track** fleet health — total batteries, SoH buckets (Optimal / Good /
  Attention), total capacity, average health.
- **Book services** and follow the request from `Pending → Accepted → Assigned
  → In Progress → Completed → Approved`.
- **View analytics** per battery and for the whole fleet.
- **Admins** run the back office: accept/assign/approve services, manage
  technicians, and inspect read-only registries of the full battery fleet and
  every account.
- **Technicians** receive assigned tickets and update their status.

## 2. Tech stack

| Layer      | Technology                                                                      |
| ---------- | ------------------------------------------------------------------------------- |
| Frontend   | React 19, Vite, React Router DOM 7, Tailwind CSS 3, Lucide icons                |
| Backend    | Node.js (ES modules) + Express 5                                                 |
| Passwords  | bcrypt (cost 10)                                                                |
| Tokens     | JWT (`Authorization: Bearer`)                                                    |
| Storage    | **Pluggable:** seeded in-memory store (default, zero setup) **or** PostgreSQL (`pg`) repository |
| Tests      | `node:test` (backend), ESLint (frontend)                                         |

## 3. Architecture

```
React Frontend (Customer / Admin / Technician panels)
        │  fetch() → /api/*   (Vite dev proxy: /api → localhost:5000)
        ▼
Express Backend (backend/index.js)
        ├── middleware   → helmet, CORS, JSON body (1MB), rate limits, auth guards
        ├── routes       → /api/auth, /api/admin, /api/batteries, /api/services,
        │                  /api/profile, /api/analytics, /api/data, /api/battery-technician
        ├── controllers  → validation + business logic + response shape
        └── data facade  → backend/data/index.js picks the repository
                 ├── mock store (in-memory, seeded)   ← DATA_SOURCE=mock (default)
                 └── PostgreSQL repository (pg pool)   ← DATA_SOURCE=postgres
                                    ▼
                        maxvolt_prod database
```

**Request flow:** browser → Vite proxy → middleware → route → controller →
data façade → store → response JSON.

**Data flow:** each React Context loads its data from the API on mount/login
(`BatteryContext` → batteries/services/profile; `AdminContext` →
admin endpoints; `BatteryTechnicianContext` → technician endpoints). The
frontend **never touches the database** — it only speaks HTTP.

## 4. Folder structure

```
MaxSpace/
├── backend/          # Express API — see backend/README.md (API + responses)
│   ├── controllers/  routes/  middleware/  data/  utils/  scripts/  tests/
├── frontend/         # React app — see frontend/README.md (easy guide)
│   ├── src/context/  src/services/  src/components/  src/pages/  src/App.jsx
├── docs/             # Additional documentation
├── docker-compose.yaml   # PostgreSQL 17 service (DATA_SOURCE=postgres)
├── package.json      # Root scripts (scripts/dev runs both apps)
└── README.md
```

## 5. Quick start

Requirements: **Node.js 20+** and (optional) **PostgreSQL 17** for the real
database mode.

```bash
# 1. Install both apps
cd backend  && npm install
cd ../frontend && npm install

# 2. Configure
cd ../backend
cp .env.example .env          # DATA_SOURCE stays "mock" for zero-setup dev

# 3. Run — one terminal per app (or: npm run dev from the repo root)
cd ../backend  && node index.js        # API  → http://localhost:5000
cd ../frontend && npm run dev          # UI   → http://localhost:5173
```

> Frontend dev server proxies `/api` to `localhost:5000` automatically.

### Run against the real database (`maxvolt_prod`)

```bash
# in backend/.env
DATA_SOURCE=postgres
DATABASE_URL=postgresql://user:password@localhost:5432/maxvolt_prod

node scripts/migrate.js     # apply schema-adaptation migrations (idempotent)
node index.js               # expect: "Using PostgreSQL repository."
```

See [backend/README.md §1–2](backend/README.md) for full details.

## 6. Demo accounts

Mock mode (default) — see `backend/data/seed.js`:

| Role       | Email                             | Password     |
| ---------- | --------------------------------- | ------------ |
| Admin      | admin@maxspace.com                | admin123     |
| Customer   | alex.rivera@maxspace-energy.com   | password123  |
| Technician | markus.vance@maxspace.com         | employee123  |

The bundled `maxvolt_prod` test database (postgres mode):
`integrator@maxspace.local` / `admin123` (ADMIN) · `test@gmail.com` / `Test@12345` (USER).

## 7. Configuration

Configuration lives in two `.env` files (both git-ignored; copy the `.example`.
**Do not commit real secrets.**)

- `backend/.env` — `PORT`, `DATA_SOURCE`, `DATABASE_URL`, `JWT_SECRET`,
  `JWT_EXPIRES_IN`, `FRONTEND_URL`/`CLIENT_URL` (CORS origins),
  `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, `ALLOW_DB_RESET`.
  → Full table in [backend/README.md §2](backend/README.md#2-configuration-backendenv).
- `frontend/.env` — `VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID` (only `VITE_*`
  variables reach the browser).
  → Full table in [frontend/README.md §7](frontend/README.md#7-environment-variables-frontendenv).

## 8. Development commands

```bash
npm run dev              # root: runs frontend + backend together (concurrently)

cd backend
  npm test               # backend unit/integration tests (node:test)
  npm run audit          # security/consistency audit — DISPOSABLE dev DB only
  node index.js          # serve API

cd frontend
  npm run dev            # dev server (hot reload)
  npm run lint           # ESLint — aim for 0 errors
  npm run build          # production bundle → dist/
  npm run preview        # serve the built app
```

## 9. Testing & QA

- **Backend:** `npm test` (14 unit/integration tests) + `node scripts/audit.js`
  against a disposable dev database (plaintext-password scan, orphan-FK checks,
  CORS, unified 401s, sanitized payloads, role access control, pagination).
- **Frontend:** `npm run lint` (0 errors) and `npm run build`.
- **Live smoke:** log in as each role and exercise batteries → passport →
  services → admin → technician flows against either data source.

## 10. Security design

- bcrypt-hashed passwords (never plaintext); JWT access tokens with expiry.
- `helmet` security headers; CORS restricted to configured frontend origins.
- Rate limits on auth endpoints and both admin/technician logins
  (failed attempts only — legit users are never blacklisted).
- Standard error envelope with **5xx messages scrubbed in production**
  (no stack traces leak).
- Sanitized user objects — `password_hash` / `google_id` never leave the API.
- Role guards (`protect` / `requireAdmin` / `requireEmployee`) on every route;
  dataset-scoped queries so customers only ever see their own data.
- `POST /api/data/reset` is gated by `ALLOW_DB_RESET` (default **off**, stays
  off on production).

## 11. Database

- **Mock mode** needs nothing installed. **Postgres mode** connects to the
  existing `maxvolt_prod` production database (PostgreSQL 17, see
  `docker-compose.yaml` for a local instance); migrations in
  `backend/scripts/migrate.js` adapt the legacy schema (battery_models, cells,
  bms_inventory, pack_testing, pdi_reports, dispatch_records, …) to the app
  tables (users, profiles, batteries, service_persons, services, schedules).
- If PostgreSQL is configured but unavailable at boot, the app logs a warning
  and falls back to the mock store — it never crashes at startup.
- Telemetry / IoT readings append to `battery_telemetry` (created by
  `backend/sql/migrations/003_telemetry.sql`); the existing battery columns
  remain the static passport record.

## 12. Future BMS / IoT Integration

MaxSpace is **architecture-ready** for real-time battery telemetry, but no
device, gateway, or MQTT broker is installed or required today. The app ships
with the seam in place so a physical BMS can connect with zero schema or API
changes later.

**Why it behaves the way it does now:** the passports and fleet views show the
last **recorded** passport values (SoH, SoC, temperature, cycle count), which
are plainly labeled as recorded — not "live". A "Live Telemetry" section only
appears once a real device pushes data. No telemetry is fabricated.

**What's already in place (this change set):**

- **Schema** — `battery_telemetry` table (time-series; voltage, current,
  temperature, SoC, SoH, cycle count, charging/fault status, source,
  recorded_at) with an FK onto the actual battery key (`battery_id` on
  `maxvolt_prod`) and composite `(battery_id, recorded_at)` indexes.
  Migration: `backend/sql/migrations/003_telemetry.sql`.
- **Service layer** — `backend/services/batteryTelemetryService.js`:
  validated reading ingestion (`validateTelemetryReading` range/enum/timestamp
  checks) plus a documented `TelemetryProvider` contract for future adapters
  (MQTT, BMS API, CAN bus, RS-485, Bluetooth).
- **Repositories** — both the mock store and the PostgreSQL repository
  implement `addBatteryTelemetry`, `getLatestBatteryTelemetry`, and
  `getBatteryTelemetryHistory` (bounded, windowable).
- **API** — `backend/routes/batteryRoutes.js`:
  - `GET /api/batteries/:id/telemetry/latest` — newest reading (or `available:false`)
  - `GET /api/batteries/:id/telemetry/history` — time series (`limit`/`from`/`to`)
  - `POST /api/batteries/:id/telemetry` — device ingest
- **Frontend** — passport & battery detail pages request the latest reading and
  render a clearly-labeled LIVE block; without a source they show
  "Telemetry unavailable" and never relabel recorded values as live.

**Connecting a real device later (no code changes required):**

1. Configure a shared secret: `IOT_DEVICE_KEY=<random 32 bytes hex>` in
   `backend/.env` (generate with
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
2. Have the gateway send each reading as:
   `POST /api/batteries/:id/telemetry` with header
   `X-IoT-Device-Key: <secret>` and a JSON body such as:
   ```json
   { "voltage": 48.2, "current": -3.5, "temperatureC": 28.4,
     "soc": 87, "soh": 95.2, "cycleCount": 212,
     "chargingStatus": "discharging", "faultStatus": null,
     "source": "mqtt", "recordedAt": "2026-09-23T10:30:00Z" }
   ```
3. Or implement a `TelemetryProvider` (see the contract in
   `batteryTelemetryService.js`) and call
   `BatteryTelemetryService.record(snapshot)` from your MQTT/BMS/CAN/RS-485
   subscriber.
4. Readings appear automatically in `/telemetry/latest`, `/telemetry/history`,
   and the frontend's Live Telemetry blocks.

**Security posture for ingest:**

- Device key comparison is constant-time (`crypto.timingSafeEqual`); when
  `IOT_DEVICE_KEY` is unset, only an ADMIN JWT can ingest — the public app
  surface is unchanged until a real integration ships.
- Every reading is validated (numeric ranges, allowed charging statuses,
  source vocabulary, ISO-8601/epoch timestamp parsing, future-timestamp
  rejection beyond 30 s clock skew) before it touches the store.
- Ingest is rate-limited per IP (120 readings/min) and the body size is capped
  at the existing 1 MB JSON limit.
- Readings are append-only; battery identity is enforced by an FK, so a device
  can never attach data to a non-existent battery.
- TLS is assumed for production hosting; device credentials ship only in the
  server env, never in the frontend.

## 13. Documentation

| Document | What you'll find |
| -------- | ---------------- |
| [backend/README.md](backend/README.md) | Setup, env vars, and the **complete API reference with request/response examples** for every endpoint |
| [frontend/README.md](frontend/README.md) | Beginner-friendly guide: how the app works, where each screen lives, how to add one |
| [docs/](docs/) | Additional project documentation |

## 14. License

ISC (as declared in `package.json`; no separate LICENSE file is shipped).