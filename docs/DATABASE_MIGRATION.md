# MaxSpace — PostgreSQL Guide

This document explains how MaxSpace switches between the in-memory mock store
and a **PostgreSQL** database. The PostgreSQL repository
(`backend/data/postgres/index.js`) is **fully implemented** — enabling it is a
configuration change. The app still works out of the box on the seeded mock
store by default.

---

## 1. Current architecture

```
frontend/src/services/        → centralized API layer (client.js, api.js,
                                adminApi.js, batteryTechnicianApi.js, index.js)
        │  HTTP (fetch)
        ▼
backend/index.js              → Express server, security headers, rate limiting
backend/routes/*              → URL mapping only (no business logic)
backend/controllers/*         → business logic (reads/writes via the store)
        │
        ▼
backend/data/index.js         → DATA SOURCE FACADE (single import point)
        │   default: mock store (backend/data/store.js)
        │   "postgres": PostgreSQL repository (backend/data/postgres/index.js)
        ▼
backend/data/store.js         → in-memory seeded store (from data/seedData.js)
backend/data/postgres/        → pg-pool repository (fully implemented)
```

**Key rule:** controllers `import store from "../data/index.js"`. They never
import `store.js` or the PostgreSQL repository directly. Swapping the
persistence layer is therefore a configuration change, not a code change.

## 2. How the data-source switch works

| Config                  | Meaning                                        | Requires |
|-------------------------|------------------------------------------------|----------|
| `DATA_SOURCE=mock`      | In-memory seeded store (default)               | nothing  |
| `DATA_SOURCE=postgres`  | PostgreSQL repository (`backend/data/postgres`) | `DATABASE_URL` + `pg` package |

- If `DATA_SOURCE=postgres` but `DATABASE_URL` is missing **or** the `pg`
  package is not installed, the app logs a warning and **falls back to the mock
  store** — it never crashes at boot.
- The health endpoint (`GET /`) reports `dataSource` and `databaseConfigured`.

## 3. Switching to PostgreSQL (enabling the live database)

1. Start PostgreSQL (Docker is already prepared in `docker-compose.yaml`):
   ```bash
   docker compose up -d postgres
   ```
2. In `backend/.env` (copy from `backend/.env.example`):
   ```env
   DATA_SOURCE=postgres
   DATABASE_URL=postgresql://maxspace_user:maxspace_password@localhost:5432/maxspace_db
   ```
3. The `pg` driver is already a backend dependency — no install needed.
4. Apply the schema:
   ```bash
   psql "$DATABASE_URL" -f backend/sql/schema.sql
   ```
   or with Docker:
   ```bash
   docker compose exec -T postgres psql -U maxspace_user -d maxspace_db < backend/sql/schema.sql
   ```
5. All repository methods are already implemented in
   `backend/data/postgres/index.js` and map 1:1 to the mock store interface, so
   controllers do not change.
6. Restart the backend and verify:
   ```bash
   cd backend && npm run dev   # expect: "Using PostgreSQL repository."
   curl http://localhost:5000  # expect: dataSource: "postgres"
   ```

The frontend does **not** change at all — it only talks to the same REST API.

> If PostgreSQL is unreachable at boot, the data-source facade logs a warning
> and falls back to the seeded mock store so the app never crashes.

## 4. Frontend service layer

All HTTP access is centralized in `frontend/src/services/`:

- `client.js` — shared `fetch` wrapper, JWT handling, `BASE_URL`
  (from `VITE_API_URL`, default `/api`), token keys for user/admin/technician.
- `api.js` — customer app endpoints (auth, batteries, services, profile).
- `adminApi.js` — admin panel endpoints.
- `batteryTechnicianApi.js` — battery technician panel endpoints.
- `index.js` — barrel export (`import { fetchBatteries } from "../services"`).

To point the whole app at a different API deployment, change `VITE_API_URL`
(`frontend/.env.example`).

## 5. Data consistency (mock ↔ future DB)

The single source of truth for shape:

- Frontend: `frontend/src/data/dummyData.js` + `frontend/src/data/serviceStatuses.js`
- Backend: `backend/data/seedData.js` + `backend/constants/serviceStatuses.js`

`seedData.js` explicitly mirrors `dummyData.js` so the app behaves identically
whether data comes from the API or from local state. Keep both in sync whenever
an entity's shape changes. The PostgreSQL schema (`backend/sql/schema.sql`) is
generated from the same fields, so the three layers stay consistent.

Service status values are shared as constants on both sides
(`SERVICE_STATUSES`). Never hard-code a status string inline.

## 6. Mock data strategy

- `backend/data/seedData.js` seeds the in-memory store at boot.
- `resetData` (`POST /api/data/reset`) restores the seeded dataset on demand.
- The frontend `dummyData.js` is used for instant UI rendering and offline-safe
  defaults; the backend API remains the authoritative source at runtime.

## 7. Checklist before enabling PostgreSQL in production

- [ ] `pg` is installed in `backend/` (a listed dependency)
- [ ] `backend/sql/schema.sql` applied
- [ ] Repository methods in `backend/data/postgres/index.js` cover the flows you
      need (all are implemented; verify auth, batteries, services, profile,
      admin analytics, and the technician flow against the DB)
- [ ] Backend smoke-tested: login, battery list, service list/status updates,
      admin analytics, technician flow against the DB
- [ ] `DATA_SOURCE=postgres` + `DATABASE_URL` set in production `.env`
- [ ] `JWT_SECRET` set to a strong value in production

---

## 8. "maxspace-pro" (maxvolt_prod) data migration

The legacy production database referred to as **maxspace-pro** is the
PostgreSQL database `maxvolt_prod`. There is no database literally named
`maxspace-pro`. Its data was migrated into the single app database
`maxspace_db` without disturbing the MaxSpace schema.

### 8.1 Why a separate schema

`maxvolt_prod` and MaxSpace (`public`) both use the table names `users` and
`batteries` but with **incompatible columns**. Overwriting `public.batteries`
would break the app, so the entire legacy database is replicated verbatim
(names, keys, data types, indexes, FKs) into a dedicated schema
**`maxspace_pro`** inside `maxspace_db`:
`public` = MaxSpace app tables, `maxspace_pro` = legacy maxvolt mirror.

### 8.2 Scripts

| Script | Purpose |
|--------|---------|
| `backend/sql/migrate_maxspace_pro.sql` | Creates schema `maxspace_pro` and all 12 legacy tables (mirror DDL). |
| `backend/sql/import_maxspace_pro_batteries.sql` | Creates the production-fleet owner account and imports the 1214 production batteries into `public.batteries`. |

Applying the mirror data (run once):

```
docker exec maxspace-postgres pg_dump -U maxspace_user -d maxvolt_prod \
  --data-only --no-owner --no-privileges -f /tmp/maxvolt_full.sql
docker exec maxspace-postgres sed -i 's/public\./maxspace_pro./g' /tmp/maxvolt_full.sql
docker exec maxspace-postgres psql -U maxspace_user -d maxspace_db -f /tmp/maxvolt_full.sql
docker exec maxspace-postgres psql -U maxspace_user -d maxspace_db -f /tmp/migrate_maxspace_pro.sql
docker exec maxspace-postgres psql -U maxspace_user -d maxspace_db -f /tmp/import_maxspace_pro_batteries.sql
```

### 8.3 Mirrored tables (schema `maxspace_pro`)

`users`, `battery_models`, `batteries`, `cells`, `cell_gradings`,
`bms_inventory`, `laser_welding_data`, `pdi_reports`, `pack_testing_reports`,
`battery_cell_mapping`, `spot_welding_data`, `dispatch_records`.
Row counts match the source exactly (e.g. batteries 1215, cells/gradings 6660,
battery_cell_mapping 5200).

### 8.4 App battery import (public.batteries)

1214 of the 1215 legacy batteries are imported as app batteries; `MVAE0014036`
is skipped because it already exists in `public.batteries` (imported earlier via
QR scan), so there are no duplicate records.

| Legacy field | App field |
|--------------|-----------|
| `battery_id` | `id` = `batt-<battery_id>`, `modal_id`, `serial_number`, QR "Battery ID" |
| `battery_id` | `qr_code` = `https://passport.battery-eu.org/passports/<battery_id>` |
| `model_id` | `name`, `model`, `model_name` |
| `had_ng_status` | `hang_status` (`"true"`/`"false"`) |
| `overall_status` | `overall_status` (`PROD` / `FG PENDING`) |
| model `voltage` x `AH` | `capacity_kwh`, `nominal_voltage`, `voltage` |
| `series_count` x `parallel_count` | `cells` |
| model `cell_type` | `chemistry` |
| `created_at` | `manufacture_date` |

The scanned `barcode` uses the app's multiline QR payload
(`Battery ID:` / `Model:` / `Modal ID:` / `Hang Status:` / `Overall Status:`),
so production units resolve through the normal QR/identifier lookup.

### 8.5 Ownership and users

- Legacy `maxspace_pro.users` use a different username/role model and are kept
  in the mirror only; they are **not** merged into `public.users`, to avoid
  granting legacy factory roles app access.
- Legacy batteries carry no customer/owner, so all 1214 imported units are
  assigned to one dedicated, documented account:
  **`user-maxvolt`** (`fleet@maxvolt-energy.com`, MaxVolt Energy Production
  Fleet), which exists only for these records. This keeps per-user battery
  isolation working without hard-coding `user-1`.

### 8.6 Verified

- Health endpoint reports `dataSource: "postgres"`, `databaseConnected: true`.
- User `alex.rivera@maxspace-energy.com` sees 8 batteries / 6 services;
  `user-maxvolt` sees 1214 batteries; new sign-ups see 0 (isolation intact).
- QR lookup (raw id and full QR payload), passport, and health-history resolve.
- Admin analytics total 1222 batteries; admin to technician assign/unassign
  round-trip verified.
- No orphan batteries, no duplicate barcode/serial/modal_id.