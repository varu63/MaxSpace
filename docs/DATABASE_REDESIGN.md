# MaxSpace Database Redesign — Analysis & Design

Status: applied to the **`dev`** database only. `maxvolt_prod` is read-only and untouched.

---

## 1. Current design (as found in `maxvolt_prod`)

27 tables, ~24 MB, no views/functions/triggers, 35 FKs, 67 secondary indexes, 16 sequences,
2 enum types (`celltype`, `weldingtype`).

| Module | Tables |
|---|---|
| Identity | `users`, `profiles`, `service_persons`, `technician_availability` |
| Fleet | `batteries`, `battery_models`, `battery_locations`, `battery_location_history` |
| Manufacturing | `cells`, `cell_gradings`, `battery_cell_mapping`, `bms_inventory`, `pdi_reports`, `pack_testing_reports`, `laser_welding_data`, `spot_welding_data`, `dispatch_records` |
| Service | `services`, `service_schedules` |
| Telemetry | `battery_telemetry` |
| Compliance | `battery_compliance`, `compliance_producers`, `compliance_documents`, `compliance_events`, `epr_obligations`, `epr_credits` |
| Bookkeeping | `schema_migrations` |

**Not present although the application already queries it:** `companies`, `compliance_types`,
`compliance_records`, `compliance_settings`, and `users.company_id`. Migrations `007`/`008` were
never applied, so the admin compliance pages returned HTTP 500
(`relation "compliance_settings" does not exist`).

---

## 2. Problems found

### 2.1 Data integrity

| # | Problem | Impact |
|---|---|---|
| P1 | `users` carries **two** password columns (`hashed_password`, `password_hash`) and **two** display-name columns (`name`, `full_name`) | Split-brain; the unused one can silently diverge and shadow real auth state |
| P2 | `users.is_active`, `users.last_login`, `users.assigned_roles` are **never read or written** by any code path | Dead columns implying capabilities the app does not have |
| P3 | `batteries.hang_status` is `TEXT` holding `'true'`/`'false'`; every query must do `UPPER(TRIM(hang_status::text)) = 'TRUE'` | Boolean stored as string — no index usable, no constraint, typo-tolerant |
| P4 | `batteries.barcode`, `batteries.serial_number`, `battery_id` are all `NOT NULL` but **none** is unique | Duplicate identity is storable |
| P5 | `service_persons.assigned_services jsonb` duplicates the `services.assigned_service_person_id` relationship | Two sources of truth for the same fact |
| P6 | `service_persons.specialization text` duplicates `specializations jsonb` | Two sources of truth |
| P7 | `profiles.name` / `profiles.email` duplicate `users.name` / `users.email` | Stale denormalized copies |
| P8 | `battery_compliance.refurbisher_id` / `recycler_id` both FK to `compliance_producers` but carry parallel free-text `refurbisher_name` / `recycler_name` | Orphan-prone duplication |
| P9 | 4 app tables (`companies`, `compliance_types`, `compliance_records`, `compliance_settings`) and `users.company_id` are referenced by code but absent from the database | Runtime 500s |

### 2.2 Query performance

| # | Problem | Impact |
|---|---|---|
| P10 | `findBatteryByBarcodeOrSerial` searches with `UPPER(barcode) = $1 OR UPPER(serial_number) = $1 OR UPPER(modal_id) = $1 … OR barcode LIKE '%'||$1||'%'` while the indexes are plain btree on the raw columns | Postgres cannot use any of them — every lookup is a **sequential scan** |
| P11 | `listBatteries` / `listMapBatteries` search with `ILIKE '%term%'` across 8 columns | Unindexable substring search |
| P12 | `enrichBatteryRows` issues **5 separate queries per list call** (PDI, pack test, dispatch, BMS, cell stats) — an N+1 pattern | 6 round trips per battery page instead of 1 |
| P13 | `listMapBatteries` issues 6 queries per request (count, page, summary, 3 region rollups) | 6 round trips per map render |
| P14 | `battery_cell_mapping` has both `UNIQUE(cell_id)` and `ix_mapping_lookup(battery_id, cell_id)` | The unique index already serves the reverse lookup |

### 2.3 Storage

| # | Problem | Impact |
|---|---|---|
| P15 | **~16 redundant indexes** — index on a column that is already the PK, or a strict prefix of another index, or a duplicate of a unique index | ~1.5 MB wasted + write amplification on every INSERT/UPDATE |
| P16 | `batteries.health_history jsonb` duplicates what `battery_telemetry` already stores relationally | Same fact twice, unbounded JSON growth |
| P17 | `battery_location_history` stores FKs **and** full 7-field snapshots of the previous and new location (22 columns) | Large, but this one is intentional audit data — retained |
| P18 | `cells` (6660 rows) and `cell_gradings` (6660 rows) are a strict **1:1** pair; `cell_gradings.id` is a surrogate that duplicates `cell_id` | An entire table + 3 indexes + 688 kB of index for zero added meaning |
| P19 | `services.battery_name` duplicates `batteries.name`; `services.technician` duplicates the assigned service person | Stale copies on every battery rename |
| P20 | 4 legacy `*_welding_data` tables hold 1092 + 0 rows with no consumer beyond an optional enrich | Retention candidate, kept (audit) |

### 2.4 Maintainability

| # | Problem | Impact |
|---|---|---|
| P21 | Time types are inconsistent: `timestamptz`, `timestamp` (no tz), `date`, and `text` all appear; `services.scheduled_date/created_at/admin_approved_at` and `service_persons.created_at` are **text** | Lexicographic sort, no date functions, no validation |
| P22 | 9 sequential migration files; `schema_migrations` records 7 of them, 007/008 never applied | State is not reproducible from the repo |
| P23 | `DATA_SOURCE` defaults to `mock`, and any value that is not exactly `"postgres"` silently selects the in-memory seeded store (`data/index.js`) | A typo in the environment silently serves 7 fake batteries |
| P24 | `POST /api/data/reset` truncates and re-seeds `seedData` (7 fake batteries, 7 fake tickets, 11 users with plaintext passwords) | A production-shaped endpoint that injects fake records |
| P25 | `batteryController.createBattery` invents a full passport when fields are missing (`"EcoVolt Certified Partner"`, 60 kWh, 400 V, random `WAR-…` certificate) and **persists it to PostgreSQL** | Mock values become production records |

---

## 3. Proposed design

Optimised for integrity first, then query performance, then storage. The API read contract is
preserved exactly — verified by a 19-endpoint golden-response diff before/after.

### 3.1 Identity

- `users`: **drop** `hashed_password`, `full_name`, `is_active`, `last_login`, `assigned_roles`.
  Keep `password_hash` as the single credential store, `name` as the single display name.
  `created_at` → `timestamptz`. **Add** `company_id` FK (the guard the app already expects).
  Add `UNIQUE (serial_number-style)`? no — batteries are the unique entity here.
- `profiles`: **drop** `name`, `email`, `avatar` (all served from `users` via join). Keeps
  notification settings; `activity_logs` is replaced by real rows in a new append-only
  `user_activity` table so history is queryable and bounded.
- `service_persons`: **drop** `specialization` (keep `specializations` jsonb) and
  `assigned_services` (derive from `services.assigned_service_person_id`).
  `created_at` → `date`.

### 3.2 Fleet

- `batteries`: `hang_status` → `boolean` (the existing `UPPER(TRIM(x::text))='TRUE'` predicates
  keep working unchanged). **Drop** `location` (authoritative in `battery_locations`),
  `cells` (derivable from `battery_cell_mapping`) and `model` (keep `model_name`).
  `manufacture_date` → `date`. `nominal_voltage` / `voltage` / `capacity` / `dimensions_mm`
  keep as `text` **deliberately**: they are display strings such as `"400 V"`, `"51.2 Ah"`,
  `"1800 x 1200 x 140"` and are not parseable numerics — storing them as numeric would lose
  the unit and break the passport display. `health_history` jsonb is kept as a cached summary;
  `battery_telemetry` remains the system of record for readings.
  Add `UNIQUE (serial_number)` and `UNIQUE (barcode)` — both are business identifiers.
- `battery_models`: unchanged; keeps the `celltype` / `weldingtype` enums.

### 3.3 Manufacturing

- **Merge `cell_gradings` into `cells`.** The relation is exactly 1:1 (6660/6660, zero
  ungraded cells). Folding 15 grading columns into `cells` removes a table, a surrogate
  primary key, and 3 indexes (1.15 MB) while making the cell's grading result a single read.
- `battery_cell_mapping`: drop the redundant `ix_mapping_lookup` prefix index (the
  `UNIQUE(cell_id)` index already answers the reverse direction).

### 3.4 Service

- `services`: `scheduled_date` → `date`, `scheduled_time` → `time`,
  `admin_approved_at` → `timestamptz`, `created_at` → `timestamptz`, `cost` → `numeric`.
  **Drop** `battery_name` (join `batteries`) and `technician` (the assigned service person
  name comes from the join). `history` jsonb is retained — it is the service timeline the
  UI renders, and there is no relational equivalent in scope.

### 3.5 Compliance (new tables finally created)

- `companies`, `compliance_types`, `compliance_records`, `compliance_settings` — created from
  the 007 design so the four admin compliance endpoints stop returning 500.
- `users.company_id` FK added (008).
- `battery_compliance`: keep the producer FKs; the parallel free-text name columns are kept
  as a **historical snapshot** of the producer name at time of record — deliberate, because
  producer rows are soft-deletable and an audit record must not change retroactively.

### 3.6 Index strategy

**Remove (16):** every index that duplicates a PK, duplicates a UNIQUE index, or is a
strict prefix of another index.

**Add (4):** only what real queries need.

| Index | Query it serves |
|---|---|
| `batteries (UPPER(barcode))`, `(UPPER(serial_number))`, `(UPPER(modal_id))` expression indexes | `findBatteryByBarcodeOrSerial` — makes the current sequential scan an index scan (P10) |
| `pg_trgm` GIN on `batteries (name)` | `listBatteries` substring search (P11) |
| `cells (lot)` | cell-lot lookups during grading review |

**Keep:** all FK-supporting indexes, all `services` filter indexes, all unique constraints.
Target: 67 → ~55 indexes, and the ones that remain are actually used.

### 3.7 Migration mechanism

The 9 sequential `migrations/00N_*.sql` files are replaced by **one authoritative
`backend/sql/schema.sql`** describing the final architecture, plus a single
`schema_migrations` row recording the schema version. A fresh install runs one file, not
nine. This removes P22 and makes the database reproducible.

---

## 4. Expected benefit

| Metric | Before | After (projected) | Driver |
|---|---|---|---|
| Tables | 27 + 4 missing | 26 (incl. 4 new, `cell_gradings` merged away) | merge + completing the schema |
| Secondary indexes | 67 (16 ineffective) | ~55, all justified | drop redundant, add expression indexes |
| Index storage | ~4.3 MB | ~3.0 MB | removal |
| `users` columns | 18 | 13 | drop 5 dead/duplicate |
| `services` columns | 21 | 19 | drop 2 denormalized |
| `services` date columns | `text` ×4 | `date`/`time`/`timestamptz` | integrity + indexability |
| Battery lookup | seq scan | index scan | expression indexes |
| Admin compliance endpoints | HTTP 500 | HTTP 200 | create missing tables |
| Mock-data paths | 5 reachable | 0 | env + code changes |

---

## 5. Safety rules honoured

- `maxvolt_prod` is opened **read-only**; it was never migrated, altered or dropped.
- `dev` was created by `pg_dump`/`pg_restore` from `maxvolt_prod`, so `dev` starts as an exact
  copy and every transformation is reproducible.
- A `pg_dump -Fc` safety backup of `maxvolt_prod` was taken before any work.
- No table is dropped in `maxvolt_prod`. Merging `cell_gradings` happens only inside `dev`.
