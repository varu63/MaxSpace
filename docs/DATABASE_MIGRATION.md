# MaxSpace — PostgreSQL Guide

This document explains how MaxSpace switches between the in-memory mock store
and a **PostgreSQL** database — and how the production deployment uses the
legacy **`maxvolt_prod`** database as the single source of truth, adapted in
place by migrations.

The PostgreSQL repository (`backend/data/postgres/index.js`) is **fully
implemented** — enabling it is a configuration change. The app still works out
of the box on the seeded mock store by default.

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

Additional env (`backend/.env`):

| Variable | Meaning |
|----------|---------|
| `LEGACY_SCHEMA` | Optional schema prefix for an app column set living in a separate schema. Empty (default) on `maxvolt_prod`, where app columns were added to the legacy `public` tables in place. |
| `ALLOW_DB_RESET` | `true` to permit `POST /api/data/reset`. Default `false` — production returns `403`. |

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
   DATABASE_URL=postgresql://maxspace_user:maxspace_password@localhost:5432/maxvolt_prod
   LEGACY_SCHEMA=
   ALLOW_DB_RESET=false
   ```
3. The `pg` driver is already a backend dependency — no install needed.
4. **`maxvolt_prod` is legacy and adapted in place — NEVER apply
   `backend/sql/schema.sql` to it.** Instead run the idempotent migrations
   (safe to re-run):
   ```bash
   cd backend
   npm run db:migrate           # applies 000, 001, 002
   npm run db:migrate:status    # all three show [APPLIED]
   ```
   (For a brand-new empty database, apply `schema.sql` once first, then run the
   migrations the same way.)
5. All repository methods are implemented in
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

## 4. `maxvolt_prod` — the production single source of truth

The container database **`maxvolt_prod`** (batteries-manufacturing traceability:
`users`, `batteries`, `battery_models`, `cells`, `cell_gradings`,
`bms_inventory`, `spot_welding_data`, `laser_welding_data`, `pdi_reports`,
`pack_testing_reports`, `battery_cell_mapping`, `dispatch_records`) is the live
production data the app runs against. There is **no mirror schema** and no
second database — the app connects to `maxvolt_prod` directly.

### 4.1 Why in-place migration

`maxvolt_prod` and the MaxSpace app both use the table names `users` and
`batteries` but with different columns. Migration `000_maxvolt_prod.sql`
**adds only what the app genuinely needs and is idempotent**: it re-uses the
existing tables and rows and never creates duplicates.

What `000_maxvolt_prod.sql` does (all idempotent / guarded):

- **`users`**: converts `id` from `serial` to `text` in place (existing integer
  ids preserved, sequence detached via `OWNED BY NONE`), relaxes the legacy
  NOT NULLs (`username`, `hashed_password`, `full_name`, `assigned_roles`) so
  app inserts work, and adds the app columns `name`, `email`, `role`,
  `service_person_id`, `google_id`, `auth_provider`, `avatar`,
  `reset_token_hash`, `reset_token_expires_at`,
  `password_hash TEXT NOT NULL DEFAULT ''` — with `users_role_check` /
  `users_auth_provider_check` and supporting indexes.
- **`batteries`**: keeps `battery_id` as the identity column (no `id` column is
  created — the repository maps `battery_id` → app `id`). Adds the app columns
  `owner_id`, `barcode`, `serial_number`, `qr_code`, `modal_id`, `hang_status`,
  `name`, `model_name`, `model`, `type`, `manufacturer`, `chemistry`,
  `capacity_kwh`, `nominal_voltage`, `voltage`, `weight_kg`, `cells`,
  `state_of_health`, etc. plus JSONB defaults (`warranty`, `recycled_content`,
  `compliance_standards`, `health_history`) — **backfilled exclusively from real
  legacy data** (see below). Unknown fields stay NULL/`{}` — nothing is
  fabricated.
- **New app tables**: `profiles`, `service_persons`, `services`,
  `service_schedules`, `technician_availability`, with guarded (`conname`)
  named foreign keys.

### 4.2 Legacy → app backfill mapping (batteries)

| Legacy value | App column(s) — derived without fabrication |
|---|---|
| `battery_id` | `barcode`, `serial_number`, `modal_id` (and `qr_code` = `https://passport.battery-eu.org/passports/<battery_id>`) |
| `model_id` → `battery_models` | `name`, `model_name`, `model`, (`manufacturer` where a model manufacturer exists) |
| `cell_type` | `chemistry` — `LFP` → `LFP (Lithium Iron Phosphate)`, `NMC` → `NMC 811 (Nickel Manganese Cobalt)` |
| `category` | `type` — `ESS` → `Stationary Storage (ESS)`, `2-Wheeler`/`3-Wheeler` → `Light Electric Vehicle (LEV)` |
| `series_count` × `parallel_count` | `cells` |
| model `voltage` (regex `^([0-9]*\.?[0-9]+)`) | `nominal_voltage`, `voltage` (kept as `"<value> V"`) |
| `voltage` × `AH` (regex, ÷ 1000) | `capacity_kwh` |
| `had_ng_status` | `hang_status` (`"true"`/`"false"`) |
| `created_at` | `manufacture_date` |

### 4.3 Legacy users

The 6 legacy `maxvolt_prod.users` rows are preserved verbatim; they carry no
legacy password (app `password_hash = ''`, `email`/`role` NULL) so legacy
factory identities cannot sign in. App accounts are added by normal sign-up and
an ADMIN is bootstrapped with:

```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'your@email.com';
```

### 4.4 Battery ownership / isolation

Legacy batteries have no `owner_id` (NULL) — they are visible to operator roles
(ADMIN / EMPLOYEE) only. Customer (`USER`) accounts are strictly isolated to
the batteries whose `owner_id` is theirs, enforced in
`backend/utils/ownerScope.js` and applied in the battery, service, and profile
controllers. The production fleet is never reset through the API.

### 4.5 Read-time enrichment (genuine child-table data)

The flat legacy `batteries` row has no weight / manufacturer / SoH columns, but
the real values live in the per-battery child tables. The postgres repository
pulls them in so lists and detail pages show real data instead of blanks:

- `pdi_reports` (latest per battery) → `pdiReport`; `internalResistanceMOhms`
  falls back to `resistance_m_ohm` when the flat column is NULL.
- `pack_testing_reports` (latest per battery) → `packTestingReport`; derived
  `stateOfHealth` = measured capacity ÷ rated capacity parsed from the pack
  test `specification` (e.g. `25V200AH` → 200 Ah; `198.482 / 200 ≈ 99.24`).
- `battery_cell_mapping` + `cells` → `cellStats` (count, pass/fail) in lists and
  full `cellsDetail` in the detail/passport views; `bms_inventory` → `bmsId`;
  `dispatch_records` → `dispatchRecord` (currently 0 rows exist).

Coverage on maxvolt_prod (of 1,215 batteries): pack tests 759, PDI 121, cells
950, BMS 921. Fields remain blank **only** where the database has no data.

### 4.6 Verification (all done live against `maxvolt_prod`)

- `schema_migrations` records all three migrations `[APPLIED]`; 18 tables
  (12 legacy + `profiles`, `service_persons`, `service_schedules`, `services`,
  `schema_migrations`, `technician_availability`, `users`); 1,215 batteries and
  6 legacy users intact; backfill values spot-verified on `MVAE0014036`.
- Health endpoint reports `dataSource: "postgres"`, `databaseConnected: true`.
- Sign-up + sign-in, QR lookup (`MVAE0014036`), passport with 16 real
  `cellsDetail` rows (`MVBE0001235`), service booking → status → delete
  lifecycle, and technician creation all verified end-to-end.
- `POST /api/data/reset` returns `403` (`ALLOW_DB_RESET=false`).

## 5. Frontend service layer

All HTTP access is centralized in `frontend/src/services/`:

- `client.js` — shared `fetch` wrapper, JWT handling, `BASE_URL`
  (from `VITE_API_URL`, default `/api`), token keys for user/admin/technician.
- `api.js` — customer app endpoints (auth, batteries, services, profile).
- `adminApi.js` — admin panel endpoints.
- `batteryTechnicianApi.js` — battery technician panel endpoints.
- `index.js` — barrel export (`import { fetchBatteries } from "../services"`).

To point the whole app at a different API deployment, change `VITE_API_URL`
(`frontend/.env.example`).

## 6. Data consistency (mock ↔ DB)

The single source of truth for shape:

- Frontend: `frontend/src/data/dummyData.js` + `frontend/src/data/serviceStatuses.js`
- Backend: `backend/data/seedData.js` + `backend/constants/serviceStatuses.js`

`seedData.js` explicitly mirrors `dummyData.js` so the app behaves identically
whether data comes from the API or from local state. Keep both in sync whenever
an entity's shape changes. The PostgreSQL schema (`backend/sql/schema.sql`) is
generated from the same fields, so the three layers stay consistent.

Service status values are shared as constants on both sides
(`SERVICE_STATUSES`). Never hard-code a status string inline.

## 7. Mock data strategy

- `backend/data/seedData.js` seeds the in-memory store at boot.
- `POST /api/data/reset` restores the seeded dataset **only when
  `ALLOW_DB_RESET=true`** — on production it returns `403`.
- The frontend `dummyData.js` is used for instant UI rendering and offline-safe
  defaults; the backend API remains the authoritative source at runtime.

## 8. Checklist for production (`maxvolt_prod`)

- [ ] `pg` is installed in `backend/` (a listed dependency)
- [ ] `DATABASE_URL` points at `maxvolt_prod`, `LEGACY_SCHEMA` empty,
      `ALLOW_DB_RESET=false`
- [ ] Migrations up to date: `npm run db:migrate` then
      `npm run db:migrate:status` — `000_maxvolt_prod`, `001_integrity` and
      `002_scheduling` all `[APPLIED]` (`schema.sql` must NOT be applied)
- [ ] Repository methods in `backend/data/postgres/index.js` cover the flows you
      need (verification done: auth, batteries, services lifecycle,
      technicians, admin list) 
- [ ] Backend smoke-tested: login, battery list/lookup/passport, service
      booking, admin view against `maxvolt_prod`
- [ ] `JWT_SECRET` set to a strong value in production

---

## 9. Migrations, integrity constraints & scaling

### 9.1 Migration runner

`backend/sql/migrations/` holds ordered, idempotent SQL files applied by
`backend/scripts/migrate.js` (tracked in the `schema_migrations` table):

```
node backend/scripts/migrate.js            # apply pending   (npm run db:migrate)
node backend/scripts/migrate.js --status   # list status     (npm run db:migrate:status)
```

- `000_maxvolt_prod.sql` — adapts legacy `users` / `batteries` in place, adds
  the app tables, and backfills app columns from real legacy data. Deliberately
  wraps no BEGIN/COMMIT of its own — the runner applies it atomically in one
  transaction.
- `001_integrity.sql` — real foreign keys and CHECK constraints on `services`
  and `users` (status/priority CHECKs, FKs to `batteries`, `users`,
  `service_persons`). The battery orphan-cleanup resolves the identity column
  (`battery_id` vs `id`) dynamically. FKs already added by `000` are skipped via
  `conname` guards.
- `002_scheduling.sql` — `service_schedules` and `technician_availability`
  tables used by the admin scheduling board and scheduler service.

### 9.2 App-layer parity

`backend/utils/serviceValidation.js` mirrors the CHECK constraints
(`assertServiceIntegrity`, `normalizeTicketNumber`), and both stores (mock +
postgres) call it — so order/status/priority violations return clean `400`
responses in both modes instead of raw database errors.

### 9.3 Server-side pagination

List endpoints run `LIMIT/OFFSET` + `COUNT` in the database and return the
standard pagination envelope (see README → API Reference → Pagination). Legacy
clients that omit `page`/`limit` still receive a plain full array. Search uses
`ILIKE` on the live DB and `matchesSearch` (case-insensitive) in the mock store
so behavior stays identical across modes.

### 9.4 Scaling notes for very large fleets

- List pages are already bounded (`MAX_LIMIT = 100`); filters/sort run in SQL.
- The remaining full-scans are **aggregation/context loads**: context providers,
  analytics, and the service-enrichment batch lookups. Enrichment is batched
  (`getUsersByIds` / `getBatteriesByIds` / `getServicePersonsByIds` /
  `getProfilesByIds`) so one page of services costs O(1) queries, not O(n).
- If a fleet grows to tens of thousands of batteries, move dashboard
  aggregations to the analytics endpoints and add indexes to the hot filter
  columns before any further UI work.
- `maxvolt_prod` already ships the fleet indexes (`idx_batteries_barcode`,
  `idx_batteries_serial`, `idx_batteries_owner`, `idx_batteries_modal`,
  `idx_batteries_name`, `idx_batteries_created_at`,
  `idx_services_battery/status/customer`, `idx_users_reset_token`).