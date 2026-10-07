/* ============================================================
   MAXSPACE — AUTHORITATIVE DATABASE SCHEMA
   ============================================================

   This is the single source of truth for the MaxSpace data model.
   A fresh installation is created by running this ONE file:

       psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/sql/schema.sql

   The historical incremental migrations under
   backend/sql/migrations/ have been folded into this file and
   removed, so the schema is reproducible from the repository in a
   single step and there is no migration-history drift.

   Design notes (see docs/DATABASE_REDESIGN.md for the full analysis):

   * One timestamp convention. Every point in time is TIMESTAMPTZ.
     Calendar dates are DATE, wall-clock times are TIME. Text dates are
     gone — they could not be range-scanned, sorted or validated.
   * No duplicated facts. A value that is derivable from a foreign key
     is not stored (e.g. services.battery_name, service_person counts).
   * Identity is enforced. Business identifiers are UNIQUE, and every
     relationship that the application relies on is a real FOREIGN KEY.
   * Indexes are justified. Every index below either backs a foreign
     key, enforces a constraint, or serves a query the application
     actually issues (see the comment above each group).
   * Historical/audit data is preserved, not flattened away.

   Conventions
   -----------
   * ids that the application generates are TEXT (users, batteries, …)
   * ids that the database generates are INTEGER/SERIAL (child rows)
   * monetary and measured quantities are NUMERIC, never float/text

   Idempotent: safe to run against an already-populated database.
   ============================================================ */

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ------------------------------------------------------------------
-- Enumerated domains
-- Only these two values sets are genuinely closed in the business
-- rules; everything else stays TEXT so the catalogue can grow without
-- a schema change.
-- ------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'celltype') THEN
    CREATE TYPE celltype AS ENUM ('NMC', 'LFP');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'weldingtype') THEN
    CREATE TYPE weldingtype AS ENUM ('LASER', 'SPOT');
  END IF;
END $$;


-- ==============================================================
-- 1. IDENTITY
-- ==============================================================

-- Companies ------------------------------------------------------------
-- Root of the compliance hierarchy. Previously referenced by the
-- application but never created in the database (migrations 007/008
-- were never applied), which made the admin compliance pages 500.
CREATE TABLE IF NOT EXISTS companies (
  id                   SERIAL PRIMARY KEY,
  name                 TEXT NOT NULL,
  code                 TEXT,
  legal_name           TEXT,
  registration_number  TEXT,
  authority            TEXT,
  country              TEXT NOT NULL DEFAULT 'India',
  contact_email        TEXT,
  contact_phone        TEXT,
  address              TEXT,
  status               TEXT NOT NULL DEFAULT 'Active',
  notes                TEXT,
  is_development_data  BOOLEAN NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_companies_name_lower ON companies (LOWER(name));
CREATE UNIQUE INDEX IF NOT EXISTS uq_companies_code_lower ON companies (LOWER(code)) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_companies_status ON companies (status);

-- Users ----------------------------------------------------------------
-- One credential store (password_hash) and one display name (name).
-- Removed: hashed_password (dead duplicate), full_name (duplicate of
-- name), assigned_roles / is_active / last_login (never read or
-- written by any code path).
CREATE TABLE IF NOT EXISTS users (
  id                       TEXT PRIMARY KEY,
  name                     TEXT NOT NULL,
  username                 TEXT,
  email                    TEXT,
  password_hash            TEXT NOT NULL DEFAULT '',
  role                     TEXT,
  service_person_id        TEXT,
  company_id               INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  google_id                TEXT,
  auth_provider            TEXT,
  avatar                   TEXT,
  reset_token_hash         TEXT,
  reset_token_expires_at   TIMESTAMPTZ,
  -- Set once a reset token has been consumed, so a replayed link can be
  -- reported as "already used" instead of a generic invalid/expired error.
  -- Cleared when a NEW reset token is issued.
  reset_token_used_at      TIMESTAMPTZ,
  -- Email verification (self-service sign-up only).
  -- DEFAULT true keeps every account that predates this column (and every
  -- account created by an admin or by Google Sign-In) usable: only the
  -- local sign-up flow writes `false` and waits for the e-mail link.
  email_verified           BOOLEAN NOT NULL DEFAULT true,
  email_verified_at        TIMESTAMPTZ,
  email_verification_token_hash TEXT,
  email_verification_expires_at TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_role_check
    CHECK (role IS NULL OR role IN ('USER', 'ADMIN', 'EMPLOYEE')),
  CONSTRAINT users_auth_provider_check
    CHECK (auth_provider IS NULL OR auth_provider IN ('local', 'google'))
);
-- Supports: sign-in by e-mail (LOWER(email) = …) and by username.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON users (username) WHERE username IS NOT NULL;
-- Supports: Google sign-in lookup.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users (google_id) WHERE google_id IS NOT NULL;
-- Supports: password-reset token lookup.
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users (reset_token_hash) WHERE reset_token_hash IS NOT NULL;
-- (The e-mail-verification token index lives in 7.11 so this section stays
-- compatible with databases created before the verification columns existed.)
-- Supports: EMPLOYEE -> technician record resolution on every request.
CREATE INDEX IF NOT EXISTS idx_users_service_person ON users (service_person_id) WHERE service_person_id IS NOT NULL;
-- Supports: company-scoped compliance queries.
CREATE INDEX IF NOT EXISTS idx_users_company ON users (company_id) WHERE company_id IS NOT NULL;

-- Profiles -------------------------------------------------------------
-- name / email / avatar are served from `users` via a join, so they are
-- no longer stored here — they used to drift silently out of sync.
-- activity_logs (an unbounded JSON array rewritten on every write) is
-- replaced by the append-only user_activity table below.
CREATE TABLE IF NOT EXISTS profiles (
  user_id                 TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  title                   TEXT,
  phone                   TEXT,
  location                TEXT,
  member_since            TEXT,
  fleet_type              TEXT,
  total_capacity_kwh      NUMERIC,
  eu_operator_id          TEXT,
  notification_settings   JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- User activity --------------------------------------------------------
-- Append-only audit trail. The previous jsonb array was capped at 20
-- entries and rewritten with a read-modify-write, so concurrent writes
-- lost entries and history was destroyed.
-- Recovery note: the legacy array only stored the display string
-- "Just now", but each entry id had the form act-<epoch-ms>, so the
-- real timestamps of the existing rows are recovered exactly during
-- migration (validated against services.history to within 10 ms).
CREATE TABLE IF NOT EXISTS user_activity (
  id          BIGSERIAL PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,
  details     TEXT,
  type        TEXT NOT NULL DEFAULT 'general',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Supports: the last-20 activity feed on the profile page.
CREATE INDEX IF NOT EXISTS idx_user_activity_user ON user_activity (user_id, created_at DESC);

-- Service persons (technicians) ---------------------------------------
-- specializations jsonb is the single source (the duplicate
-- `specialization` text column is gone). assigned_services was a JSON
-- copy of the services relationship and is now derived by a join, so it
-- can no longer disagree with `services`.
CREATE TABLE IF NOT EXISTS service_persons (
  id                TEXT PRIMARY KEY,
  technician_id     TEXT NOT NULL UNIQUE,
  name              TEXT NOT NULL,
  email             TEXT NOT NULL UNIQUE,
  phone             TEXT NOT NULL DEFAULT '',
  certification     TEXT NOT NULL DEFAULT '',
  specializations   JSONB NOT NULL DEFAULT '[]'::jsonb,
  status            TEXT NOT NULL DEFAULT 'active',
  created_at        DATE NOT NULL DEFAULT CURRENT_DATE,
  CONSTRAINT service_persons_status_check CHECK (status IN ('active', 'inactive'))
);
CREATE INDEX IF NOT EXISTS idx_service_persons_status ON service_persons (status);

-- Technician weekly availability --------------------------------------
-- day_of_week follows the application's own contract: 0 = Sunday,
-- 6 = Saturday (enforced in adminSchedulingController.js).
CREATE TABLE IF NOT EXISTS technician_availability (
  id                  TEXT PRIMARY KEY,
  service_person_id   TEXT NOT NULL REFERENCES service_persons(id) ON DELETE CASCADE,
  day_of_week         SMALLINT NOT NULL,
  start_time          TIME NOT NULL,
  end_time            TIME NOT NULL,
  status              TEXT NOT NULL DEFAULT 'active',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT technician_availability_day_of_week_check CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT technician_availability_status_check CHECK (status IN ('active', 'inactive')),
  CONSTRAINT technician_availability_time_check CHECK (start_time < end_time)
);
-- Supports: "is this technician free on day X" for service booking.
CREATE INDEX IF NOT EXISTS idx_technician_availability_person
  ON technician_availability (service_person_id, day_of_week);


-- ==============================================================
-- 2. FLEET
-- ==============================================================

-- Battery models -------------------------------------------------------
CREATE TABLE IF NOT EXISTS battery_models (
  model_id         TEXT PRIMARY KEY,
  category         TEXT NOT NULL,
  series_count     INTEGER NOT NULL,
  parallel_count   INTEGER NOT NULL,
  cell_type        celltype NOT NULL,
  bms_model        TEXT,
  welding_type     weldingtype NOT NULL
);

-- battery_models.company_id lets a model be attributed to a company, which
-- the hierarchical compliance module needs in order to list models per
-- company and to count a company's model footprint. It is nullable so the
-- 46 already-registered catalogue rows keep working unattributed.
ALTER TABLE battery_models
  ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_battery_models_company ON battery_models (company_id);

-- Batteries ------------------------------------------------------------
-- Corrections vs. the previous shape:
--   hang_status      text  -> boolean  (was 'true'/'false' strings, so
--                                 no index or constraint could apply)
--   manufacture_date text  -> date
--   location         dropped; battery_locations is authoritative
--   cells            dropped; the count comes from battery_cell_mapping
--   model            dropped; model_name is the stored name
--   barcode / serial_number are now UNIQUE business identifiers
-- nominal_voltage, voltage, capacity and dimensions_mm intentionally
-- stay TEXT: they are display strings ("400 V", "51.2 Ah",
-- "1800 x 1200 x 140") and are not safely parseable as numerics.
CREATE TABLE IF NOT EXISTS batteries (
  battery_id                    TEXT PRIMARY KEY,
  model_id                      TEXT NOT NULL REFERENCES battery_models(model_id),
  owner_id                      TEXT REFERENCES users(id) ON DELETE SET NULL,
  barcode                       TEXT NOT NULL,
  serial_number                 TEXT NOT NULL,
  modal_id                      TEXT,
  qr_code                       TEXT,
  name                          TEXT NOT NULL,
  model_name                    TEXT,
  type                          TEXT,
  manufacturer                  TEXT,
  chemistry                     TEXT,
  capacity_kwh                  NUMERIC,
  capacity                      TEXT,
  nominal_voltage               TEXT,
  voltage                       TEXT,
  weight_kg                     NUMERIC,
  dimensions_mm                 TEXT,
  manufacture_date              DATE,
  assembly_location             TEXT,
  hang_status                   BOOLEAN DEFAULT false NOT NULL,
  -- The QR scanner reads hang status as free text ("Hang Status: ...").
  -- Recognised true/false tokens are parsed into `hang_status`; any other
  -- text is kept verbatim here so a scan is never rejected and no
  -- character is lost.
  hang_status_note              TEXT,
  overall_status                TEXT,
  state_of_health               NUMERIC,
  state_of_charge               NUMERIC,
  cycle_count                   INTEGER,
  max_rated_cycles              INTEGER,
  internal_resistance_mohms     NUMERIC,
  operating_temp_c              NUMERIC,
  carbon_footprint_kg_per_kwh   NUMERIC,
  had_ng_status                 BOOLEAN,
  cell_ir_lower                 DOUBLE PRECISION,
  cell_ir_upper                 DOUBLE PRECISION,
  cell_voltage_lower            DOUBLE PRECISION,
  cell_voltage_upper            DOUBLE PRECISION,
  cell_capacity_lower           DOUBLE PRECISION,
  cell_capacity_upper           DOUBLE PRECISION,
  recycled_content              JSONB NOT NULL DEFAULT '{}'::jsonb,
  warranty                      JSONB NOT NULL DEFAULT '{}'::jsonb,
  compliance_standards          JSONB NOT NULL DEFAULT '[]'::jsonb,
  dismantling_manual            TEXT,
  health_history                JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT batteries_barcode_key UNIQUE (barcode),
  CONSTRAINT batteries_serial_key UNIQUE (serial_number),
  CONSTRAINT batteries_soh_check
    CHECK (state_of_health IS NULL OR (state_of_health >= 0 AND state_of_health <= 100)),
  CONSTRAINT batteries_soc_check
    CHECK (state_of_charge IS NULL OR (state_of_charge >= 0 AND state_of_charge <= 100)),
  CONSTRAINT batteries_cycle_count_check
    CHECK (cycle_count IS NULL OR cycle_count >= 0)
);
-- Serves the owner-scoped battery list (the single hottest query).
CREATE INDEX IF NOT EXISTS idx_batteries_owner ON batteries (owner_id);
-- Serves the default fleet list ordering.
CREATE INDEX IF NOT EXISTS idx_batteries_created_at ON batteries (created_at DESC);
-- Serves the admin status filter and the map's lifecycle buckets.
CREATE INDEX IF NOT EXISTS idx_batteries_overall_status ON batteries (overall_status);
-- Serves findBatteryByBarcodeOrSerial, which compares UPPER(col) = $1.
-- Plain btree indexes on the raw columns were unusable for that query,
-- so every lookup was a sequential scan. These expression indexes make
-- it an index scan.
CREATE INDEX IF NOT EXISTS idx_batteries_barcode_upper ON batteries (UPPER(barcode));
CREATE INDEX IF NOT EXISTS idx_batteries_serial_upper ON batteries (UPPER(serial_number));
CREATE INDEX IF NOT EXISTS idx_batteries_modal_upper ON batteries (UPPER(modal_id));
-- Serves the substring (ILIKE '%term%') battery search.
CREATE INDEX IF NOT EXISTS idx_batteries_name_trgm ON batteries USING gin (name gin_trgm_ops);

-- Battery locations ----------------------------------------------------
CREATE TABLE IF NOT EXISTS battery_locations (
  id             SERIAL PRIMARY KEY,
  battery_id     TEXT NOT NULL UNIQUE REFERENCES batteries(battery_id) ON DELETE CASCADE,
  latitude       DOUBLE PRECISION,
  longitude      DOUBLE PRECISION,
  address        TEXT,
  city           TEXT,
  state          TEXT,
  country        TEXT,
  site_name      TEXT,
  location_type  TEXT NOT NULL DEFAULT 'Other',
  is_current     BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT battery_locations_content_check CHECK (
    latitude IS NOT NULL OR longitude IS NOT NULL OR (address IS NOT NULL AND address <> '')),
  CONSTRAINT battery_locations_coords_check CHECK ((latitude IS NULL) = (longitude IS NULL)),
  CONSTRAINT battery_locations_latitude_check
    CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CONSTRAINT battery_locations_longitude_check
    CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);
-- Serves the map's administrative-area filters.
CREATE INDEX IF NOT EXISTS idx_battery_locations_country ON battery_locations (country);
CREATE INDEX IF NOT EXISTS idx_battery_locations_state ON battery_locations (state);
CREATE INDEX IF NOT EXISTS idx_battery_locations_city ON battery_locations (city);
CREATE INDEX IF NOT EXISTS idx_battery_locations_site_name ON battery_locations (site_name);
CREATE INDEX IF NOT EXISTS idx_battery_locations_type ON battery_locations (location_type, is_current);

-- Battery location history ---------------------------------------------
-- The prev_* / new_* snapshots are deliberate audit data: a location
-- row is overwritten in place, so without the snapshot a move would
-- destroy its own history.
CREATE TABLE IF NOT EXISTS battery_location_history (
  id                     SERIAL PRIMARY KEY,
  battery_id             TEXT NOT NULL REFERENCES batteries(battery_id) ON DELETE CASCADE,
  previous_location_id   INTEGER REFERENCES battery_locations(id) ON DELETE SET NULL,
  new_location_id        INTEGER REFERENCES battery_locations(id) ON DELETE SET NULL,
  moved_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason                 TEXT,
  created_by             TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  prev_latitude          DOUBLE PRECISION,
  prev_longitude         DOUBLE PRECISION,
  prev_address           TEXT,
  prev_city              TEXT,
  prev_state             TEXT,
  prev_country           TEXT,
  prev_site_name         TEXT,
  new_latitude           DOUBLE PRECISION,
  new_longitude          DOUBLE PRECISION,
  new_address            TEXT,
  new_city               TEXT,
  new_state              TEXT,
  new_country            TEXT,
  new_site_name          TEXT
);
-- Serves the per-battery move timeline.
CREATE INDEX IF NOT EXISTS idx_battery_location_history_battery
  ON battery_location_history (battery_id, moved_at DESC);


-- ==============================================================
-- 3. MANUFACTURING
-- ==============================================================

-- Cells ----------------------------------------------------------------
-- The previous schema had `cells` and `cell_gradings` as two tables in
-- a strict 1:1 relationship (6660/6660 rows, zero ungraded cells) with
-- a surrogate `cell_gradings.id` duplicating `cell_id`. The grading
-- result is a property of the cell, so it lives here now — one table
-- and three fewer indexes.
--
-- Note: both tables carried a `discharging_capacity_mah` column, but
-- they are *not* the same measurement — 838 of the 6532 rows where both
-- are populated disagree (by up to 106 mAh), i.e. they are two separate
-- test passes. Both are therefore preserved under distinct names rather
-- than collapsed into one.
CREATE TABLE IF NOT EXISTS cells (
  cell_id                  TEXT PRIMARY KEY,
  registration_date        TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_used                  BOOLEAN,
  status                   TEXT,
  ng_count                 INTEGER,
  discharging_capacity_mah DOUBLE PRECISION,
  last_test_date           TIMESTAMPTZ,
  ir_value_m_ohm           DOUBLE PRECISION,
  sorting_voltage          DOUBLE PRECISION,
  sorting_date             TIMESTAMPTZ,
  -- grading (was cell_gradings)
  test_date                TIMESTAMPTZ,
  lot                      TEXT,
  brand                    TEXT,
  specification            TEXT,
  ocv_voltage_mv           DOUBLE PRECISION,
  upper_cutoff_mv          DOUBLE PRECISION,
  lower_cutoff_mv          DOUBLE PRECISION,
  grading_discharging_capacity_mah DOUBLE PRECISION,
  result                   TEXT,
  final_soc_mah            DOUBLE PRECISION,
  soc_result               TEXT,
  final_cv_capacity        DOUBLE PRECISION,
  final_result             TEXT,
  CONSTRAINT cells_ng_count_check CHECK (ng_count IS NULL OR ng_count >= 0)
);
-- Serves lot/brand grading review.
CREATE INDEX IF NOT EXISTS idx_cells_lot ON cells (lot);
CREATE INDEX IF NOT EXISTS idx_cells_brand ON cells (brand);
CREATE INDEX IF NOT EXISTS idx_cells_status ON cells (status);

-- Battery <-> cell assembly -------------------------------------------
CREATE TABLE IF NOT EXISTS battery_cell_mapping (
  battery_id   TEXT NOT NULL REFERENCES batteries(battery_id) ON DELETE CASCADE,
  cell_id      TEXT NOT NULL UNIQUE REFERENCES cells(cell_id) ON DELETE CASCADE,
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (battery_id, cell_id)
);
-- The PRIMARY KEY already indexes battery_id, and the UNIQUE constraint
-- on cell_id already indexes cell_id. The previous third index
-- (battery_id, cell_id) was a pure prefix duplicate and is gone.

-- BMS inventory --------------------------------------------------------
CREATE TABLE IF NOT EXISTS bms_inventory (
  bms_id      TEXT PRIMARY KEY,
  battery_id  TEXT REFERENCES batteries(battery_id) ON DELETE SET NULL,
  is_used     BOOLEAN,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bms_inventory_battery ON bms_inventory (battery_id);

-- PDI reports ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS pdi_reports (
  id                          SERIAL PRIMARY KEY,
  battery_id                  TEXT REFERENCES batteries(battery_id) ON DELETE CASCADE,
  test_time                   TIMESTAMPTZ,
  voltage_v                   DOUBLE PRECISION,
  resistance_m_ohm            DOUBLE PRECISION,
  cont_charging_current       DOUBLE PRECISION,
  cont_charging_voltage       DOUBLE PRECISION,
  cont_discharging_current    DOUBLE PRECISION,
  cont_discharging_voltage    DOUBLE PRECISION,
  short_circuit_prot_time_us  INTEGER,
  test_result                 TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ
);
-- Serves "latest PDI report per battery" (DISTINCT ON … ORDER BY test_time DESC).
CREATE INDEX IF NOT EXISTS idx_pdi_reports_battery ON pdi_reports (battery_id, test_time DESC);

-- Pack testing reports -------------------------------------------------
CREATE TABLE IF NOT EXISTS pack_testing_reports (
  id                     SERIAL PRIMARY KEY,
  battery_id             TEXT UNIQUE REFERENCES batteries(battery_id) ON DELETE CASCADE,
  test_date              TIMESTAMPTZ,
  specification          TEXT,
  cell_type              TEXT,
  actual_cap             DOUBLE PRECISION,
  ocv_voltage            DOUBLE PRECISION,
  upper_cutoff           DOUBLE PRECISION,
  lower_cutoff           DOUBLE PRECISION,
  discharging_capacity   DOUBLE PRECISION,
  capacity_result        TEXT,
  idle_difference        DOUBLE PRECISION,
  idle_diff_res          TEXT,
  final_voltage          DOUBLE PRECISION,
  final_result           TEXT,
  soc_result             TEXT,
  number_of_series       INTEGER NOT NULL DEFAULT 0,
  number_of_parallel     INTEGER NOT NULL DEFAULT 0,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pack_testing_reports_battery
  ON pack_testing_reports (battery_id, test_date DESC);

-- Laser welding --------------------------------------------------------
CREATE TABLE IF NOT EXISTS laser_welding_data (
  id                    SERIAL PRIMARY KEY,
  battery_id            TEXT REFERENCES batteries(battery_id) ON DELETE CASCADE,
  initial_speed         DOUBLE PRECISION,
  max_speed             DOUBLE PRECISION,
  acceleration          DOUBLE PRECISION,
  laser_on_delay        INTEGER,
  laser_off_delay       INTEGER,
  point_duration        INTEGER,
  power_mode            TEXT,
  pwm_freq              INTEGER,
  pwm_cycle             INTEGER,
  pwm_duty_rate         DOUBLE PRECISION,
  pwm_width             DOUBLE PRECISION,
  code                  INTEGER,
  dac_power             DOUBLE PRECISION,
  scan_speed            DOUBLE PRECISION,
  lsm_laser_on_delay    INTEGER,
  lsm_laser_off_delay   INTEGER,
  recorded_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_laser_welding_data_battery
  ON laser_welding_data (battery_id, recorded_at DESC);

-- Spot welding ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS spot_welding_data (
  id                        SERIAL PRIMARY KEY,
  battery_id                TEXT REFERENCES batteries(battery_id) ON DELETE CASCADE,
  solder_joint_mode         TEXT,
  welding_needle_direction  TEXT,
  hole_setback_distance     DOUBLE PRECISION,
  total_stroke_welding_head DOUBLE PRECISION,
  start_delay               INTEGER,
  clamping_delay            INTEGER,
  welding_time              INTEGER,
  air_speed                 DOUBLE PRECISION,
  working_speed             DOUBLE PRECISION,
  hole_inlet_speed          DOUBLE PRECISION,
  recorded_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_spot_welding_data_battery
  ON spot_welding_data (battery_id, recorded_at DESC);

-- Dispatch records -----------------------------------------------------
CREATE TABLE IF NOT EXISTS dispatch_records (
  id                 SERIAL PRIMARY KEY,
  battery_id         TEXT UNIQUE REFERENCES batteries(battery_id) ON DELETE CASCADE,
  customer_name      TEXT NOT NULL,
  invoice_id         TEXT NOT NULL,
  invoice_date       DATE NOT NULL,
  dispatch_timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ==============================================================
-- 4. SERVICE
-- ==============================================================

-- Services -------------------------------------------------------------
-- Corrections vs. the previous shape:
--   scheduled_date / scheduled_time / admin_approved_at / created_at
--       text -> date / time / timestamptz
--   cost            text -> numeric
--   battery_name    dropped; joined from batteries
--   technician      dropped; joined from service_persons
CREATE TABLE IF NOT EXISTS services (
  id                          TEXT PRIMARY KEY,
  ticket_number               TEXT NOT NULL UNIQUE,
  battery_id                  TEXT REFERENCES batteries(battery_id) ON DELETE SET NULL,
  customer_id                 TEXT REFERENCES users(id) ON DELETE SET NULL,
  assigned_service_person_id  TEXT REFERENCES service_persons(id) ON DELETE SET NULL,
  service_type                TEXT,
  center                      TEXT,
  -- Customer's service location: where the technician actually goes.
  -- Stored as separate columns (same shape as service_centers /
  -- organization_locations) rather than stuffed into the free-text
  -- `center`, so address, coordinates, city, state and PIN code can be
  -- displayed and mapped individually. All nullable: a booking made
  -- before geocoding (or without GPS) still succeeds with address only.
  address                     TEXT,
  city                        TEXT,
  state                       TEXT,
  pincode                     TEXT,
  latitude                    NUMERIC(9,6),
  longitude                   NUMERIC(9,6),
  scheduled_date              DATE,
  scheduled_time              TIME,
  estimated_arrival           TEXT,
  mobile_number               TEXT NOT NULL DEFAULT '',
  status                      TEXT NOT NULL,
  priority                    TEXT NOT NULL DEFAULT 'Normal',
  admin_approved_at           TIMESTAMPTZ,
  approved_by                 TEXT REFERENCES users(id) ON DELETE SET NULL,
  notes                       TEXT,
  -- `cost` used to be a single text column holding a pre-formatted
  -- display string, e.g. '$65.00' or '$0.00 (Warranty Covered)'.
  -- Casting that to a number would have silently discarded the currency
  -- symbol and the warranty annotation, so the three parts are stored
  -- separately and the API reformats them.
  cost                        NUMERIC(12,2),
  cost_currency               TEXT,
  cost_note                   TEXT,
  history                     JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT services_status_check CHECK (status IN (
    'Confirmed', 'Accepted', 'Assigned', 'On The Way', 'In Progress',
    'Waiting for Admin Approval', 'Completed', 'Cancelled')),
  CONSTRAINT services_priority_check CHECK (priority IN ('Low', 'Normal', 'High', 'Urgent')),
  CONSTRAINT services_cost_check CHECK (cost IS NULL OR cost >= 0),
  CONSTRAINT services_latitude_check  CHECK (latitude  IS NULL OR latitude  BETWEEN  -90 AND  90),
  CONSTRAINT services_longitude_check CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);
-- CREATE TABLE IF NOT EXISTS never alters an existing table, so an
-- already-deployed database gets the location columns here instead.
ALTER TABLE services ADD COLUMN IF NOT EXISTS address  TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS city     TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS state    TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS pincode  TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS latitude  NUMERIC(9,6);
ALTER TABLE services ADD COLUMN IF NOT EXISTS longitude NUMERIC(9,6);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'services_latitude_check'
  ) THEN
    ALTER TABLE services ADD CONSTRAINT services_latitude_check
      CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'services_longitude_check'
  ) THEN
    ALTER TABLE services ADD CONSTRAINT services_longitude_check
      CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180);
  END IF;
END
$$;
-- Serves the customer "my services" list.
CREATE INDEX IF NOT EXISTS idx_services_customer ON services (customer_id);
-- Serves the battery service timeline.
CREATE INDEX IF NOT EXISTS idx_services_battery ON services (battery_id);
-- Serves the technician work list.
CREATE INDEX IF NOT EXISTS idx_services_assigned_person ON services (assigned_service_person_id);
-- Serves the admin status + schedule board (composite covers both the
-- plain status filter and the status+date range scan).
CREATE INDEX IF NOT EXISTS idx_services_status_scheduled ON services (status, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_services_created_at ON services (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_services_priority ON services (priority);

-- Service schedules ----------------------------------------------------
CREATE TABLE IF NOT EXISTS service_schedules (
  id              TEXT PRIMARY KEY,
  service_id      TEXT NOT NULL UNIQUE REFERENCES services(id) ON DELETE CASCADE,
  scheduled_date  DATE NOT NULL,
  start_time      TIME,
  end_time        TIME,
  technician_id   TEXT REFERENCES service_persons(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'Scheduled',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_schedules_status_check
    CHECK (status IN ('Scheduled', 'Rescheduled', 'Completed', 'Cancelled'))
);
CREATE INDEX IF NOT EXISTS idx_service_schedules_date ON service_schedules (scheduled_date);
CREATE INDEX IF NOT EXISTS idx_service_schedules_technician ON service_schedules (technician_id);


-- ==============================================================
-- 4b. SERVICE CENTERS AND ORGANIZATION NETWORK
-- ==============================================================
-- These two tables replace hardcoded coordinate lists in
-- backend/utils/serviceLocation.js and organizationLocations.js.
-- Both previously invented a location for any unrecognised text
-- (serviceLocation.js hashed the free-text `center` into one of six
-- fixed points), so an unrecognised service silently received
-- fabricated coordinates. Resolution is now a real lookup and an
-- unmatched center yields no location at all.

CREATE TABLE IF NOT EXISTS service_centers (
  key           TEXT PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  address       TEXT,
  city          TEXT,
  state         TEXT,
  pincode       TEXT,
  latitude      NUMERIC(9,6),
  longitude     NUMERIC(9,6),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_centers_lat_check  CHECK (latitude  IS NULL OR latitude  BETWEEN  -90 AND  90),
  CONSTRAINT service_centers_long_check CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);
CREATE INDEX IF NOT EXISTS idx_service_centers_city  ON service_centers (lower(city));
CREATE INDEX IF NOT EXISTS idx_service_centers_lower_name ON service_centers (lower(name));

-- The organization/facility network shown on the visual map. This is a
-- schematic network view, not a navigation map.
CREATE TABLE IF NOT EXISTS organization_locations (
  key                  TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  type                 TEXT NOT NULL,
  city                 TEXT,
  state                TEXT,
  address              TEXT,
  pincode              TEXT,
  latitude             NUMERIC(9,6),
  longitude            NUMERIC(9,6),
  compliance_status    TEXT,
  service_center_key   TEXT REFERENCES service_centers(key) ON DELETE SET NULL,
  is_active            BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT organization_locations_type_check
    CHECK (type IN ('Manufacturer', 'Service Provider', 'Reseller',
                    'Recycler', 'Collection Center')),
  CONSTRAINT organization_locations_lat_check  CHECK (latitude  IS NULL OR latitude  BETWEEN  -90 AND  90),
  CONSTRAINT organization_locations_long_check CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);
CREATE INDEX IF NOT EXISTS idx_organization_locations_type ON organization_locations (type);
CREATE INDEX IF NOT EXISTS idx_organization_locations_lower_name
  ON organization_locations (lower(name));

-- Reference data for the six MaxVolt service centers. These are the real
-- operating sites; they are seeded once and then owned by the database.
INSERT INTO service_centers (key, name, address, city, state, pincode, latitude, longitude)
VALUES
  ('noida',     'MaxVolt Noida Service Center',     'Noida Sector 62',        'Noida',     'Uttar Pradesh', '201309', 28.628000, 77.364900),
  ('delhi',     'MaxVolt Delhi Service Center',     'New Delhi Service Hub',   'New Delhi', 'Delhi',          '110020', 28.567200, 77.243000),
  ('gurugram',  'MaxVolt Gurugram Service Center',  'Gurugram Industrial Area','Gurugram',  'Haryana',       '122001', 28.459500, 77.026600),
  ('bengaluru', 'MaxVolt Bengaluru Service Center', 'Bengaluru Electronic City','Bengaluru','Karnataka',     '560001', 12.971600, 77.594600),
  ('mumbai',    'MaxVolt Mumbai Service Center',    'Mumbai Andheri East',     'Mumbai',    'Maharashtra',   '400001', 18.938800, 72.835400),
  ('pune',      'MaxVolt Pune Service Center',      'Pune Hinjewadi',          'Pune',      'Maharashtra',   '411001', 18.520400, 73.856700)
ON CONFLICT (key) DO UPDATE
  SET name     = EXCLUDED.name,
      address  = EXCLUDED.address,
      city     = EXCLUDED.city,
      state    = EXCLUDED.state,
      pincode  = EXCLUDED.pincode,
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude;

-- Organizations that sit at a service center reuse that center's row via
-- service_center_key instead of repeating its coordinates. The two
-- standalone company sites (manufacturing plant, recycler) carry their own.
INSERT INTO organization_locations
  (key, name, type, city, state, address, pincode, latitude, longitude, compliance_status, service_center_key)
VALUES
  ('delhi',     'MaxVolt Manufacturing Plant',   'Manufacturer',      'Delhi',        'Delhi',        'Delhi Industrial Area',   '110020', 28.613900, 77.209000, 'Compliant',   NULL),
  ('noida',     'MaxVolt Noida Service Center',  'Service Provider',  'Noida',        'Uttar Pradesh','Noida Sector 62',         '201309', NULL,       NULL,      'Compliant',   'noida'),
  ('gurugram',  'MaxVolt Reseller Hub',          'Reseller',          'Gurugram',     'Haryana',      'Gurugram Industrial Area','122001', 28.459500, 77.026600, 'Pending',     NULL),
  ('mumbai',    'Maxvolt Reearth Private Ltd',   'Recycler',          'Mumbai',       'Maharashtra',  'Mumbai Andheri East',     '400001', 18.938800, 72.835400, 'Compliant',   NULL),
  ('pune',      'MaxVolt Collection Center',     'Collection Center', 'Pune',         'Maharashtra',  'Pune Hinjewadi',          '411001', 18.520400, 73.856700, 'In Progress', NULL),
  ('bengaluru', 'MaxVolt Bengaluru Service Center','Service Provider','Bengaluru',    'Karnataka',    'Bengaluru Electronic City','560001',NULL,       NULL,      'Compliant',   'bengaluru')
ON CONFLICT (key) DO UPDATE
  SET name               = EXCLUDED.name,
      type               = EXCLUDED.type,
      city               = EXCLUDED.city,
      state              = EXCLUDED.state,
      address            = EXCLUDED.address,
      pincode            = EXCLUDED.pincode,
      latitude           = EXCLUDED.latitude,
      longitude          = EXCLUDED.longitude,
      compliance_status  = EXCLUDED.compliance_status,
      service_center_key = EXCLUDED.service_center_key;


-- ==============================================================
-- 5. TELEMETRY
-- ==============================================================

CREATE TABLE IF NOT EXISTS battery_telemetry (
  id              BIGSERIAL PRIMARY KEY,
  battery_id      TEXT NOT NULL REFERENCES batteries(battery_id) ON DELETE CASCADE,
  voltage         NUMERIC,
  current         NUMERIC,
  temperature_c   NUMERIC,
  soc             NUMERIC,
  soh             NUMERIC,
  cycle_count     INTEGER,
  charging_status TEXT,
  fault_status    TEXT,
  source          TEXT NOT NULL DEFAULT 'api',
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT battery_telemetry_soc_check   CHECK (soc IS NULL OR soc BETWEEN 0 AND 100),
  CONSTRAINT battery_telemetry_soh_check   CHECK (soh IS NULL OR soh BETWEEN 0 AND 100),
  CONSTRAINT battery_telemetry_voltage_check CHECK (voltage IS NULL OR voltage >= 0),
  CONSTRAINT battery_telemetry_temperature_check
    CHECK (temperature_c IS NULL OR temperature_c BETWEEN -100 AND 300),
  CONSTRAINT battery_telemetry_cycle_count_check CHECK (cycle_count IS NULL OR cycle_count >= 0),
  CONSTRAINT battery_telemetry_charging_status_check
    CHECK (charging_status IS NULL
           OR charging_status IN ('charging', 'discharging', 'idle', 'standby', 'unknown'))
);
-- Serves "latest reading" and the per-battery history chart.
CREATE INDEX IF NOT EXISTS idx_battery_telemetry_battery_time
  ON battery_telemetry (battery_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_battery_telemetry_recorded_at
  ON battery_telemetry (recorded_at DESC);


-- ==============================================================
-- 6. COMPLIANCE
-- ==============================================================

-- Producers (EPR / battery waste producers) ---------------------------
CREATE TABLE IF NOT EXISTS compliance_producers (
  id                      SERIAL PRIMARY KEY,
  producer_name           TEXT NOT NULL,
  registration_number     TEXT NOT NULL,
  registration_valid_until DATE,
  producer_category       TEXT NOT NULL DEFAULT 'Manufacturer',
  pan                     TEXT,
  gstin                   TEXT,
  address                 TEXT,
  contact_email           TEXT,
  contact_phone           TEXT,
  website                 TEXT,
  status                  TEXT NOT NULL DEFAULT 'Active',
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_compliance_producers_registration
  ON compliance_producers (registration_number);
CREATE INDEX IF NOT EXISTS idx_compliance_producers_status ON compliance_producers (status);

-- Per-battery compliance state -----------------------------------------
-- refurbisher_name / recycler_name are a deliberate snapshot of the
-- producer name at the time of the record: producers are soft-deleted,
-- so an audit record must not change retroactively.
CREATE TABLE IF NOT EXISTS battery_compliance (
  id                      SERIAL PRIMARY KEY,
  battery_id              TEXT NOT NULL UNIQUE REFERENCES batteries(battery_id) ON DELETE CASCADE,
  producer_id             INTEGER REFERENCES compliance_producers(id) ON DELETE SET NULL,
  framework               TEXT NOT NULL DEFAULT 'BWMR 2022',
  battery_category        TEXT,
  collection_channel      TEXT,
  compliance_status       TEXT NOT NULL DEFAULT 'Pending',
  verified_in_app         BOOLEAN NOT NULL DEFAULT false,
  verified_at             TIMESTAMPTZ,
  notes                   TEXT,
  collection_status       TEXT,
  collection_date         DATE,
  collection_location     TEXT,
  refurbisher_id          INTEGER REFERENCES compliance_producers(id) ON DELETE SET NULL,
  refurbisher_name        TEXT,
  refurbisher_details     TEXT,
  recycler_id             INTEGER REFERENCES compliance_producers(id) ON DELETE SET NULL,
  recycler_name           TEXT,
  recycler_registration   TEXT,
  recycling_facility      TEXT,
  recycling_date          DATE,
  recycling_status        TEXT,
  recycling_certificate   TEXT,
  epr_reference           TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_battery_compliance_producer ON battery_compliance (producer_id);
CREATE INDEX IF NOT EXISTS idx_battery_compliance_status ON battery_compliance (compliance_status);

-- Compliance documents -------------------------------------------------
CREATE TABLE IF NOT EXISTS compliance_documents (
  id               SERIAL PRIMARY KEY,
  battery_id       TEXT REFERENCES batteries(battery_id) ON DELETE CASCADE,
  producer_id      INTEGER REFERENCES compliance_producers(id) ON DELETE SET NULL,
  document_type    TEXT NOT NULL,
  document_name    TEXT NOT NULL,
  document_number  TEXT,
  issued_by        TEXT,
  issued_on        DATE,
  expires_on       DATE,
  status           TEXT NOT NULL DEFAULT 'Pending Review',
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT compliance_documents_dates_check
    CHECK (expires_on IS NULL OR issued_on IS NULL OR expires_on >= issued_on)
);
CREATE INDEX IF NOT EXISTS idx_compliance_documents_battery ON compliance_documents (battery_id);
CREATE INDEX IF NOT EXISTS idx_compliance_documents_producer ON compliance_documents (producer_id);
CREATE INDEX IF NOT EXISTS idx_compliance_documents_type ON compliance_documents (document_type, status);

-- Compliance audit events ----------------------------------------------
CREATE TABLE IF NOT EXISTS compliance_events (
  id                 SERIAL PRIMARY KEY,
  battery_id         TEXT REFERENCES batteries(battery_id) ON DELETE CASCADE,
  producer_id        INTEGER REFERENCES compliance_producers(id) ON DELETE SET NULL,
  event_type         TEXT NOT NULL,
  event_description  TEXT,
  created_by         TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_compliance_events_battery ON compliance_events (battery_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_compliance_events_producer ON compliance_events (producer_id, created_at DESC);

-- EPR obligations ------------------------------------------------------
CREATE TABLE IF NOT EXISTS epr_obligations (
  id               SERIAL PRIMARY KEY,
  producer_id      INTEGER NOT NULL REFERENCES compliance_producers(id) ON DELETE CASCADE,
  financial_year   TEXT NOT NULL,
  battery_category TEXT NOT NULL,
  target_percent   NUMERIC,
  obligation_kg    NUMERIC,
  achieved_kg      NUMERIC NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'Open',
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT epr_obligations_kg_check CHECK (
    (obligation_kg IS NULL OR obligation_kg >= 0) AND achieved_kg >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_epr_obligations_producer_fy_category
  ON epr_obligations (producer_id, financial_year, battery_category);
CREATE INDEX IF NOT EXISTS idx_epr_obligations_producer ON epr_obligations (producer_id);

-- EPR credits ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS epr_credits (
  id                  SERIAL PRIMARY KEY,
  obligation_id       INTEGER NOT NULL REFERENCES epr_obligations(id) ON DELETE CASCADE,
  certificate_number  TEXT NOT NULL,
  quantity_kg         NUMERIC NOT NULL DEFAULT 0,
  issue_date          DATE,
  valid_until         DATE,
  status              TEXT NOT NULL DEFAULT 'Active',
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT epr_credits_quantity_check CHECK (quantity_kg >= 0),
  CONSTRAINT epr_credits_validity_check
    CHECK (valid_until IS NULL OR issue_date IS NULL OR valid_until >= issue_date)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_epr_credits_certificate ON epr_credits (certificate_number);
CREATE INDEX IF NOT EXISTS idx_epr_credits_obligation ON epr_credits (obligation_id);
CREATE INDEX IF NOT EXISTS idx_epr_credits_status ON epr_credits (status);

-- Compliance type catalogue --------------------------------------------
CREATE TABLE IF NOT EXISTS compliance_types (
  id                    SERIAL PRIMARY KEY,
  code                  TEXT NOT NULL UNIQUE,
  label                 TEXT NOT NULL,
  description           TEXT,
  authority             TEXT,
  regulation_name       TEXT,
  default_level         TEXT NOT NULL DEFAULT 'BATTERY_MODEL',
  default_applicability TEXT NOT NULL DEFAULT 'Applicable',
  requires_certificate  BOOLEAN NOT NULL DEFAULT true,
  requires_test_report  BOOLEAN NOT NULL DEFAULT false,
  requires_capacity     BOOLEAN NOT NULL DEFAULT false,
  requires_expiry       BOOLEAN NOT NULL DEFAULT true,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  sort_order            INTEGER NOT NULL DEFAULT 100,
  is_development_data   BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hierarchical compliance records (company -> model -> battery) --------
CREATE TABLE IF NOT EXISTS compliance_records (
  id                    SERIAL PRIMARY KEY,
  company_id            INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  battery_model_id      TEXT REFERENCES battery_models(model_id) ON DELETE CASCADE,
  battery_id            TEXT REFERENCES batteries(battery_id) ON DELETE CASCADE,
  compliance_type       TEXT NOT NULL,
  authority             TEXT,
  regulation_name       TEXT,
  standard_number       TEXT,
  registration_number   TEXT,
  certificate_number    TEXT,
  status                TEXT NOT NULL DEFAULT 'Pending',
  applicability         TEXT NOT NULL DEFAULT 'Applicable',
  issue_date            DATE,
  expiry_date           DATE,
  compliance_deadline   DATE,
  last_verified_at      TIMESTAMPTZ,
  next_review_date      DATE,
  verified_by           TEXT,
  test_lab              TEXT,
  test_date             DATE,
  test_standard         TEXT,
  test_clause           TEXT,
  declared_capacity_ah  NUMERIC,
  verified_capacity_ah  NUMERIC,
  test_temperature_c    NUMERIC,
  notes                 TEXT,
  internal_comments     TEXT,
  is_development_data   BOOLEAN NOT NULL DEFAULT false,
  created_by            TEXT,
  verified_by_notes     TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- A record is scoped to at most one of (model, battery): a model
  -- certificate covers every battery built to that model.
  CONSTRAINT compliance_records_scope_check CHECK (num_nonnulls(battery_id, battery_model_id) <= 1),
  CONSTRAINT compliance_records_capacity_check CHECK (
    (declared_capacity_ah IS NULL OR declared_capacity_ah >= 0)
    AND (verified_capacity_ah IS NULL OR verified_capacity_ah >= 0)),
  CONSTRAINT compliance_records_test_temperature_check
    CHECK (test_temperature_c IS NULL OR test_temperature_c BETWEEN -100 AND 300),
  CONSTRAINT compliance_records_dates_check
    CHECK (expiry_date IS NULL OR issue_date IS NULL OR expiry_date >= issue_date)
);
CREATE INDEX IF NOT EXISTS idx_compliance_records_company ON compliance_records (company_id);
CREATE INDEX IF NOT EXISTS idx_compliance_records_battery ON compliance_records (battery_id);
CREATE INDEX IF NOT EXISTS idx_compliance_records_model ON compliance_records (battery_model_id);
CREATE INDEX IF NOT EXISTS idx_compliance_records_type ON compliance_records (compliance_type);
CREATE INDEX IF NOT EXISTS idx_compliance_records_status ON compliance_records (status);
CREATE INDEX IF NOT EXISTS idx_compliance_records_expiry ON compliance_records (expiry_date)
  WHERE expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_compliance_records_deadline ON compliance_records (compliance_deadline)
  WHERE compliance_deadline IS NOT NULL;

-- Record-scoped evidence and audit trail.
--
-- compliance_documents and compliance_events can already hang off a battery
-- or a producer. The hierarchical compliance module also raises both against
-- a compliance record, which is what compliance_id links to; the ALTERs live
-- here rather than beside their tables because compliance_records is defined
-- below them.
--
-- Both columns are nullable, so every battery- and producer-scoped row that
-- already exists is untouched. visibility defaults to Internal because
-- evidence must never become customer-visible by omission, and its values
-- match DOCUMENT_VISIBILITY_VALUES (utils/../constants/complianceManagement).
ALTER TABLE compliance_documents
  ADD COLUMN IF NOT EXISTS compliance_id INTEGER REFERENCES compliance_records(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS visibility      TEXT NOT NULL DEFAULT 'Internal';
CREATE INDEX IF NOT EXISTS idx_compliance_documents_compliance
  ON compliance_documents (compliance_id, visibility);

ALTER TABLE compliance_events
  ADD COLUMN IF NOT EXISTS compliance_id INTEGER REFERENCES compliance_records(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_compliance_events_compliance
  ON compliance_events (compliance_id, created_at DESC);

-- Singleton compliance settings ----------------------------------------
CREATE TABLE IF NOT EXISTS compliance_settings (
  id                    INTEGER PRIMARY KEY DEFAULT 1,
  expiry_warning_days   INTEGER NOT NULL DEFAULT 90,
  deadline_soon_days    INTEGER NOT NULL DEFAULT 30,
  review_interval_days  INTEGER NOT NULL DEFAULT 180,
  show_development_data BOOLEAN NOT NULL DEFAULT true,
  updated_by            TEXT,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT compliance_settings_singleton CHECK (id = 1),
  CONSTRAINT compliance_settings_expiry_warning_check CHECK (expiry_warning_days >= 0),
  CONSTRAINT compliance_settings_deadline_soon_check CHECK (deadline_soon_days >= 0),
  CONSTRAINT compliance_settings_review_interval_check CHECK (review_interval_days >= 0)
);
INSERT INTO compliance_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;


-- ==============================================================
-- 7. BATTERY PASSPORT LIFECYCLE
-- ==============================================================
-- The passport was already identity-rich (batteries.battery_id as the
-- permanent key, UNIQUE barcode/serial_number, modal_id, qr_code) and
-- manufacturing-rich (PDI, pack tests, cells, BMS inventory, welding,
-- dispatch). What it had NO way to express was the *history*: every one
-- of those facts is stored as a current-state row, so "who owned this
-- battery two years ago", "when was it retired", "who graded it for
-- second life" simply do not exist anywhere.
--
-- This section adds that history without duplicating any existing
-- entity:
--   * batteries gains only governance columns (no new identity column)
--   * lifecycle events, ownership history, provenance, telemetry events,
--     firmware history, EOL partner assignments and second-life
--     assessments are all new
--   * compliance_documents and users are ALTERed in place, never
--     duplicated
--   * collection/recycling addresses reuse organization_locations and
--     companies; there is no new locations table
--
-- Every history table here is append-only. A current-state column may
-- mirror the newest row for query speed, but the row itself is never
-- rewritten -- there is a trigger below that makes that a database
-- error, not a convention.
-- ==============================================================


-- ------------------------------------------------------------------
-- 7.1 IDENTITY GOVERNANCE
-- ------------------------------------------------------------------
-- registration_origin is deliberately NULLABLE with no default.
-- Existing rows pre-date the digital passport system and were imported
-- from the manufacturing database, so claiming they are
-- 'digital_passport' would assert something untrue. NULL means "not yet
-- classified"; the one-time backfill (scripts/backfillPassport.js)
-- classifies real rows as 'legacy_import', and it never invents a
-- source for a field it cannot attribute.
ALTER TABLE batteries
  ADD COLUMN IF NOT EXISTS registration_origin        TEXT,
  ADD COLUMN IF NOT EXISTS registration_recorded_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lifecycle_stage            TEXT NOT NULL DEFAULT 'Unknown',
  ADD COLUMN IF NOT EXISTS last_lifecycle_event_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS owner_organization_id      INTEGER REFERENCES companies(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'batteries_registration_origin_check'
  ) THEN
    ALTER TABLE batteries ADD CONSTRAINT batteries_registration_origin_check
      CHECK (registration_origin IS NULL OR registration_origin IN
             ('digital_passport', 'legacy_import', 'legacy_registration'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'batteries_lifecycle_stage_check'
  ) THEN
    ALTER TABLE batteries ADD CONSTRAINT batteries_lifecycle_stage_check
      CHECK (lifecycle_stage IN (
        'Unknown', 'Manufactured', 'Commissioned', 'InService',
        'OwnershipTransferred', 'Serviced', 'Retired', 'Collected',
        'UnderAssessment', 'Refurbished', 'SecondLife', 'Recycled',
        'FinalEvidenceRecorded'));
  END IF;
END $$;

-- Serves the lifecycle-stage filter and the "batteries needing triage" list.
CREATE INDEX IF NOT EXISTS idx_batteries_lifecycle_stage
  ON batteries (lifecycle_stage);
CREATE INDEX IF NOT EXISTS idx_batteries_registration_origin
  ON batteries (registration_origin);
CREATE INDEX IF NOT EXISTS idx_batteries_owner_organization
  ON batteries (owner_organization_id) WHERE owner_organization_id IS NOT NULL;
-- findBatteryByBarcodeOrSerial scans UPPER(battery_id) alongside
-- UPPER(barcode)/UPPER(serial_number)/UPPER(modal_id). The latter three have
-- expression indexes (above); battery_id only had its raw PRIMARY KEY btree,
-- which the upper-cased comparison cannot use. Without this, every scanned
-- QR payload that resolves by canonical id degrades to a sequential scan.
CREATE INDEX IF NOT EXISTS idx_batteries_battery_id_upper
  ON batteries (UPPER(battery_id));

-- Immutable identity ---------------------------------------------------
-- The permanent passport identity is decided once, at manufacture, and is
-- then fixed. The application already refuses to put these columns in a
-- user-supplied update, but "the application says so" is not a guarantee:
-- an ad-hoc UPDATE or a future code path could still rewrite a serial
-- number and silently orphan every lifecycle event attached to it. This
-- makes it a database error instead.
--
-- The escape hatch is a session flag that only an operator running a
-- deliberate, audited correction would set. No application code path sets
-- it, so ordinary requests -- admin, user, technician, partner or device
-- -- cannot move these columns. registration_origin is the one exception,
-- because classifying an unclassified row is not a correction: see the
-- check inside.
CREATE OR REPLACE FUNCTION maxspace_guard_battery_identity() RETURNS trigger AS $$
BEGIN
  IF current_setting('maxspace.allow_identity_change', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.battery_id IS DISTINCT FROM OLD.battery_id THEN
    RAISE EXCEPTION
      'batteries.battery_id is the permanent passport identity and cannot be changed'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.barcode IS DISTINCT FROM OLD.barcode THEN
    RAISE EXCEPTION
      'batteries.barcode is a permanent passport identifier and cannot be changed'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.serial_number IS DISTINCT FROM OLD.serial_number THEN
    RAISE EXCEPTION
      'batteries.serial_number is a permanent passport identifier and cannot be changed'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.modal_id IS DISTINCT FROM OLD.modal_id THEN
    RAISE EXCEPTION
      'batteries.modal_id is a permanent passport identifier and cannot be changed'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.qr_code IS DISTINCT FROM OLD.qr_code THEN
    RAISE EXCEPTION
      'batteries.qr_code is a permanent passport identifier and cannot be changed'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.model_id IS DISTINCT FROM OLD.model_id THEN
    RAISE EXCEPTION
      'batteries.model_id is manufacturer-authoritative and cannot be changed'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.manufacture_date IS DISTINCT FROM OLD.manufacture_date THEN
    RAISE EXCEPTION
      'batteries.manufacture_date is manufacturer-authoritative and cannot be changed'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.registration_origin IS DISTINCT FROM OLD.registration_origin THEN
    -- NULL means "not yet classified" (the row predates the digital
    -- passport). Filling it in for the first time is the classification
    -- itself, which the one-time backfill must be able to do without a
    -- privileged override. Once a value exists it is final: re-labelling a
    -- passport as something else would rewrite how it was born.
    IF OLD.registration_origin IS NOT NULL THEN
      RAISE EXCEPTION
        'batteries.registration_origin records how the passport was created and cannot be changed'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS batteries_identity_immutable ON batteries;
CREATE TRIGGER batteries_identity_immutable
  BEFORE UPDATE ON batteries
  FOR EACH ROW EXECUTE FUNCTION maxspace_guard_battery_identity();


-- ------------------------------------------------------------------
-- 7.2 LIFECYCLE EVENT LEDGER
-- ------------------------------------------------------------------
-- The single append-only record of everything that has happened to a
-- physical battery. One row per fact, never updated.
--
-- Tamper evidence without blockchain: every row stores row_hash, a
-- SHA-256 over the row's own content plus the previous row's hash for
-- the same battery. Rewriting or removing any event breaks the chain at
-- that point and every event after it, and `verifyLifecycleChain`
-- reports exactly where. A determined database superuser can still
-- recompute the whole chain -- that is a deliberate, detectable
-- administrative act rather than an invisible one, which is the point.
CREATE TABLE IF NOT EXISTS battery_lifecycle_events (
  id                    BIGSERIAL PRIMARY KEY,
  battery_id            TEXT NOT NULL REFERENCES batteries(battery_id) ON DELETE CASCADE,
  -- Human-facing kind ("In Service") and its stable machine code
  -- ("in_service"). The code is what application logic matches on, so a
  -- re-worded label is not a breaking change.
  event_type            TEXT NOT NULL,
  event_code            TEXT NOT NULL,
  -- The current-state stage this event puts the battery into, or NULL
  -- when the event is a note/evidence entry that does not move it.
  lifecycle_stage       TEXT,
  occurred_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id              TEXT REFERENCES users(id) ON DELETE SET NULL,
  -- Name/role are snapshotted because the user row may be deleted later
  -- and the event must still say who did it.
  actor_name            TEXT,
  actor_role            TEXT,
  source                TEXT NOT NULL DEFAULT 'admin',
  service_id            TEXT REFERENCES services(id) ON DELETE SET NULL,
  previous_value        TEXT,
  new_value             TEXT,
  previous_state        TEXT,
  new_state             TEXT,
  notes                 TEXT,
  evidence_document_id  INTEGER REFERENCES compliance_documents(id) ON DELETE SET NULL,
  partner_id            INTEGER REFERENCES compliance_producers(id) ON DELETE SET NULL,
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
  prev_hash             TEXT NOT NULL,
  row_hash              TEXT NOT NULL,
  CONSTRAINT battery_lifecycle_events_actor_role_check
    CHECK (actor_role IS NULL OR actor_role IN ('USER', 'ADMIN', 'EMPLOYEE', 'PARTNER', 'SYSTEM')),
  CONSTRAINT battery_lifecycle_events_source_check
    CHECK (source IN (
      'manufacturer_system', 'manufacturing_record', 'admin', 'user',
      'service_technician', 'bms_telemetry', 'import', 'legacy_registration',
      'partner', 'derived_calculated'))
);
-- Serves the passport timeline (the single hottest read in the new module).
CREATE INDEX IF NOT EXISTS idx_battery_lifecycle_events_battery_time
  ON battery_lifecycle_events (battery_id, occurred_at DESC, id DESC);
-- Serves fleet-wide lifecycle reporting and the EOL work queues.
CREATE INDEX IF NOT EXISTS idx_battery_lifecycle_events_type
  ON battery_lifecycle_events (event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_battery_lifecycle_events_stage
  ON battery_lifecycle_events (lifecycle_stage, occurred_at DESC)
  WHERE lifecycle_stage IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_battery_lifecycle_events_recorded
  ON battery_lifecycle_events (recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_battery_lifecycle_events_actor
  ON battery_lifecycle_events (actor_id, occurred_at DESC)
  WHERE actor_id IS NOT NULL;
-- Serves "the service events for ticket X" without scanning the timeline.
CREATE INDEX IF NOT EXISTS idx_battery_lifecycle_events_service
  ON battery_lifecycle_events (service_id, occurred_at)
  WHERE service_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_battery_lifecycle_events_partner
  ON battery_lifecycle_events (partner_id, occurred_at DESC)
  WHERE partner_id IS NOT NULL;

-- Append-only enforcement ---------------------------------------------
-- UPDATE is always refused. DELETE is refused while the battery still
-- exists; the one exception is the ON DELETE CASCADE from batteries
-- itself, which the parent row has already removed by the time the
-- cascade reaches here, so deleting a battery still works and the
-- lifecycle cannot be selectively pruned from a live battery.
CREATE OR REPLACE FUNCTION maxspace_guard_lifecycle_ledger() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION
      'battery_lifecycle_events is append-only: lifecycle events cannot be updated'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (SELECT 1 FROM batteries b WHERE b.battery_id = OLD.battery_id) THEN
    RAISE EXCEPTION
      'battery_lifecycle_events is append-only: lifecycle events cannot be deleted while the battery exists'
      USING ERRCODE = '23514';
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS battery_lifecycle_events_immutable ON battery_lifecycle_events;
CREATE TRIGGER battery_lifecycle_events_immutable
  BEFORE UPDATE OR DELETE ON battery_lifecycle_events
  FOR EACH ROW EXECUTE FUNCTION maxspace_guard_lifecycle_ledger();


-- ------------------------------------------------------------------
-- 7.3 OWNERSHIP / TRANSFER HISTORY
-- ------------------------------------------------------------------
-- batteries.owner_id remains the current owner (fast access, and every
-- existing owner-scoped query depends on it). This table is the
-- history it used to destroy.
--
-- A row is a closed period of custody: acquired_at .. released_at. The
-- partial unique index below guarantees at most one OPEN period per
-- battery, so "current owner" can be read from the history as well as
-- from the batteries row and the two can be cross-checked.
CREATE TABLE IF NOT EXISTS battery_ownership_history (
  id                      BIGSERIAL PRIMARY KEY,
  battery_id              TEXT NOT NULL REFERENCES batteries(battery_id) ON DELETE CASCADE,
  owner_id                TEXT REFERENCES users(id) ON DELETE SET NULL,
  owner_organization_id   INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  -- Snapshot: a deleted user must not erase the record of who held a
  -- battery, and companies can be reorganised out from under the row.
  owner_name              TEXT,
  owner_email             TEXT,
  ownership_type          TEXT NOT NULL DEFAULT 'transfer',
  responsibility          TEXT,
  acquired_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at             TIMESTAMPTZ,
  transfer_reference      TEXT,
  notes                   TEXT,
  source                  TEXT NOT NULL DEFAULT 'admin',
  recorded_by             TEXT REFERENCES users(id) ON DELETE SET NULL,
  recorded_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT battery_ownership_history_type_check CHECK (ownership_type IN (
    'first_owner', 'legacy_registration', 'transfer', 'resale', 'lease',
    'battery_as_a_service', 'release', 'return_to_producer', 'unassigned')),
  CONSTRAINT battery_ownership_history_source_check CHECK (source IN (
    'manufacturer_system', 'manufacturing_record', 'admin', 'user',
    'import', 'legacy_registration', 'partner', 'derived_calculated')),
  CONSTRAINT battery_ownership_history_period_check
    CHECK (released_at IS NULL OR released_at >= acquired_at)
);
-- At most one open custody period per battery.
CREATE UNIQUE INDEX IF NOT EXISTS uq_battery_ownership_current
  ON battery_ownership_history (battery_id) WHERE released_at IS NULL;
-- Serves the passport ownership timeline and reverse "what did X own" queries.
CREATE INDEX IF NOT EXISTS idx_battery_ownership_history_battery
  ON battery_ownership_history (battery_id, acquired_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_battery_ownership_history_owner
  ON battery_ownership_history (owner_id, acquired_at DESC)
  WHERE owner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_battery_ownership_history_partner
  ON battery_ownership_history (owner_organization_id, acquired_at DESC)
  WHERE owner_organization_id IS NOT NULL;

-- Closed periods are history and are not rewritable. The single legal
-- UPDATE is closing the open period (released_at NULL -> a timestamp);
-- everything else, including which owner the period belonged to, is
-- fixed at the time it is written.
CREATE OR REPLACE FUNCTION maxspace_guard_ownership_history() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM batteries b WHERE b.battery_id = OLD.battery_id) THEN
      RAISE EXCEPTION
        'battery_ownership_history is append-only: custody records cannot be deleted while the battery exists'
        USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.released_at IS NOT NULL THEN
    RAISE EXCEPTION
      'battery_ownership_history is append-only: a closed custody record cannot be changed'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.released_at IS NULL THEN
    RAISE EXCEPTION
      'battery_ownership_history may only be closed, not reopened'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.id           IS DISTINCT FROM OLD.id
     OR NEW.battery_id IS DISTINCT FROM OLD.battery_id
     OR NEW.owner_id   IS DISTINCT FROM OLD.owner_id
     OR NEW.owner_organization_id IS DISTINCT FROM OLD.owner_organization_id
     OR NEW.owner_name IS DISTINCT FROM OLD.owner_name
     OR NEW.owner_email IS DISTINCT FROM OLD.owner_email
     OR NEW.ownership_type IS DISTINCT FROM OLD.ownership_type
     OR NEW.responsibility IS DISTINCT FROM OLD.responsibility
     OR NEW.acquired_at IS DISTINCT FROM OLD.acquired_at
     OR NEW.transfer_reference IS DISTINCT FROM OLD.transfer_reference
     OR NEW.notes      IS DISTINCT FROM OLD.notes
     OR NEW.source     IS DISTINCT FROM OLD.source
     OR NEW.recorded_by IS DISTINCT FROM OLD.recorded_by
     OR NEW.recorded_at IS DISTINCT FROM OLD.recorded_at THEN
    RAISE EXCEPTION
      'battery_ownership_history is append-only: only released_at may be set when closing a custody record'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS battery_ownership_history_immutable ON battery_ownership_history;
CREATE TRIGGER battery_ownership_history_immutable
  BEFORE UPDATE OR DELETE ON battery_ownership_history
  FOR EACH ROW EXECUTE FUNCTION maxspace_guard_ownership_history();


-- ------------------------------------------------------------------
-- 7.4 DATA PROVENANCE
-- ------------------------------------------------------------------
-- Where a passport value came from, per field. Without this a passport
-- value typed by a customer is indistinguishable from a value measured
-- by the pack test bench, and "is this manufacturer-certified?" has no
-- answer.
--
-- History, not current state: a new assertion supersedes the old row
-- (superseded_at) instead of overwriting it, so the passport can show
-- how a value's origin changed over the battery's life.
CREATE TABLE IF NOT EXISTS battery_data_provenance (
  id              BIGSERIAL PRIMARY KEY,
  battery_id      TEXT NOT NULL REFERENCES batteries(battery_id) ON DELETE CASCADE,
  field_name      TEXT NOT NULL,
  classification  TEXT NOT NULL DEFAULT 'unclassified_legacy',
  source          TEXT NOT NULL DEFAULT 'legacy_unknown',
  source_ref      TEXT,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by     TEXT REFERENCES users(id) ON DELETE SET NULL,
  superseded_at   TIMESTAMPTZ,
  notes           TEXT,
  CONSTRAINT battery_data_provenance_classification_check CHECK (classification IN (
    'authoritative', 'measured', 'derived', 'service', 'user_supplied', 'unclassified_legacy')),
  CONSTRAINT battery_data_provenance_source_check CHECK (source IN (
    'manufacturer_system', 'manufacturing_record', 'bms_telemetry',
    'service_technician', 'inspection', 'admin', 'user',
    'derived_calculated', 'import', 'legacy_registration', 'legacy_unknown'))
);
-- At most one live assertion per field.
CREATE UNIQUE INDEX IF NOT EXISTS uq_battery_data_provenance_current
  ON battery_data_provenance (battery_id, field_name) WHERE superseded_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_battery_data_provenance_battery
  ON battery_data_provenance (battery_id, field_name);
CREATE INDEX IF NOT EXISTS idx_battery_data_provenance_source
  ON battery_data_provenance (source, recorded_at DESC);

CREATE OR REPLACE FUNCTION maxspace_guard_provenance_history() RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM batteries b WHERE b.battery_id = OLD.battery_id) THEN
    RAISE EXCEPTION
      'battery_data_provenance is append-only: a provenance assertion cannot be deleted while the battery exists'
      USING ERRCODE = '23514';
  END IF;

  /* UPDATE is only legal as "supersede": superseded_at goes from NULL to
     a timestamp and nothing else moves. */
  IF OLD.superseded_at IS NOT NULL THEN
    RAISE EXCEPTION
      'battery_data_provenance is append-only: a superseded assertion cannot be changed'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.superseded_at IS NULL THEN
    RAISE EXCEPTION
      'battery_data_provenance is append-only: an assertion can only be superseded, not modified'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.id         IS DISTINCT FROM OLD.id
     OR NEW.battery_id IS DISTINCT FROM OLD.battery_id
     OR NEW.field_name IS DISTINCT FROM OLD.field_name
     OR NEW.classification IS DISTINCT FROM OLD.classification
     OR NEW.source   IS DISTINCT FROM OLD.source
     OR NEW.source_ref IS DISTINCT FROM OLD.source_ref
     OR NEW.recorded_at IS DISTINCT FROM OLD.recorded_at
     OR NEW.recorded_by IS DISTINCT FROM OLD.recorded_by
     OR NEW.notes    IS DISTINCT FROM OLD.notes THEN
    RAISE EXCEPTION
      'battery_data_provenance is append-only: only superseded_at may be set when superseding an assertion'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS battery_data_provenance_immutable ON battery_data_provenance;
CREATE TRIGGER battery_data_provenance_immutable
  BEFORE UPDATE OR DELETE ON battery_data_provenance
  FOR EACH ROW EXECUTE FUNCTION maxspace_guard_provenance_history();


-- ------------------------------------------------------------------
-- 7.5 DERIVED TELEMETRY EVENTS
-- ------------------------------------------------------------------
-- Shared guard for the "record once, never revise" history tables
-- (derived telemetry events, firmware installs, second-life grades).
-- A conclusion that could be quietly edited is not evidence: if the
-- verdict was wrong the fix is a new row or a corrected reading, not an
-- UPDATE. Deleting is blocked only while the battery still exists, so an
-- operator can still delete a battery (and take its history with it)
-- without the database fighting them.
CREATE OR REPLACE FUNCTION maxspace_guard_append_only_simple() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND EXISTS (
    SELECT 1 FROM batteries b WHERE b.battery_id = OLD.battery_id
  ) THEN
    RAISE EXCEPTION '% is append-only: rows cannot be deleted while the battery exists',
      TG_TABLE_NAME USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION '% is append-only: rows cannot be updated', TG_TABLE_NAME
      USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- battery_telemetry keeps exactly what a device reported -- raw, one row
-- per reading, never interpreted. This table holds the *conclusions*
-- drawn from those readings (a charge session happened, the pack ran hot)
-- so the raw series stays raw and the analysis stays reproducible.
--
-- Every row points at the real reading that produced it and carries the
-- threshold it was compared against, so a reviewer can re-derive the
-- verdict instead of taking it on trust. dedupe_key makes detection
-- idempotent: re-running detection over the same window cannot invent a
-- second copy of the same event.
CREATE TABLE IF NOT EXISTS battery_telemetry_events (
  id               BIGSERIAL PRIMARY KEY,
  battery_id       TEXT NOT NULL REFERENCES batteries(battery_id) ON DELETE CASCADE,
  telemetry_id     BIGINT REFERENCES battery_telemetry(id) ON DELETE SET NULL,
  event_type       TEXT NOT NULL,
  severity         TEXT NOT NULL DEFAULT 'info',
  occurred_at      TIMESTAMPTZ NOT NULL,
  detected_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  measured_value   NUMERIC,
  threshold_value  NUMERIC,
  unit             TEXT,
  start_at         TIMESTAMPTZ,
  end_at           TIMESTAMPTZ,
  details          JSONB NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key       TEXT NOT NULL,
  CONSTRAINT battery_telemetry_events_type_check CHECK (event_type IN (
    'charge_session', 'discharge_session', 'temperature_excursion',
    'deep_discharge', 'overcharge', 'abnormal_event', 'bms_event')),
  CONSTRAINT battery_telemetry_events_severity_check
    CHECK (severity IN ('info', 'warning', 'critical'))
);
-- Detection is idempotent per battery.
CREATE UNIQUE INDEX IF NOT EXISTS uq_battery_telemetry_events_dedupe
  ON battery_telemetry_events (battery_id, dedupe_key);
CREATE INDEX IF NOT EXISTS idx_battery_telemetry_events_battery_time
  ON battery_telemetry_events (battery_id, occurred_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_battery_telemetry_events_type
  ON battery_telemetry_events (event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_battery_telemetry_events_severity
  ON battery_telemetry_events (battery_id, severity, occurred_at DESC)
  WHERE severity IN ('warning', 'critical');

DROP TRIGGER IF EXISTS battery_telemetry_events_immutable ON battery_telemetry_events;
CREATE TRIGGER battery_telemetry_events_immutable
  BEFORE UPDATE OR DELETE ON battery_telemetry_events
  FOR EACH ROW EXECUTE FUNCTION maxspace_guard_append_only_simple();


-- ------------------------------------------------------------------
-- 7.6 FIRMWARE / BMS HISTORY
-- ------------------------------------------------------------------
-- battery_models.bms_model records which BMS model a pack was built
-- with; this records what firmware that BMS is actually running and how
-- it got there. There is no current-value column on purpose: the current
-- version is the newest row, so the two can never disagree.
--
-- No rows are fabricated for packs whose firmware was never recorded --
-- the passport says "not recorded", not "1.0.0".
CREATE TABLE IF NOT EXISTS battery_firmware_updates (
  id                BIGSERIAL PRIMARY KEY,
  battery_id        TEXT NOT NULL REFERENCES batteries(battery_id) ON DELETE CASCADE,
  bms_model         TEXT,
  firmware_version  TEXT NOT NULL,
  previous_version  TEXT,
  installed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  installed_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  service_person_id TEXT REFERENCES service_persons(id) ON DELETE SET NULL,
  result            TEXT NOT NULL DEFAULT 'Success',
  notes             TEXT,
  source            TEXT NOT NULL DEFAULT 'admin',
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT battery_firmware_updates_result_check
    CHECK (result IN ('Success', 'Failed', 'Rolled Back', 'Pending')),
  CONSTRAINT battery_firmware_updates_source_check
    CHECK (source IN ('manufacturer_system', 'admin', 'service_technician', 'import'))
);
CREATE INDEX IF NOT EXISTS idx_battery_firmware_updates_battery
  ON battery_firmware_updates (battery_id, installed_at DESC, id DESC);

CREATE OR REPLACE FUNCTION maxspace_guard_firmware_append_only() RETURNS trigger AS $$
BEGIN
  -- Same contract as maxspace_guard_append_only_simple, kept as its own
  -- function so the firmware rule can diverge later without silently
  -- changing the telemetry / second-life tables it is shared with.
  IF TG_OP = 'DELETE' AND EXISTS (
    SELECT 1 FROM batteries b WHERE b.battery_id = OLD.battery_id
  ) THEN
    RAISE EXCEPTION '% is append-only: rows cannot be deleted while the battery exists',
      TG_TABLE_NAME USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION '% is append-only: rows cannot be updated', TG_TABLE_NAME
      USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS battery_firmware_updates_immutable ON battery_firmware_updates;
CREATE TRIGGER battery_firmware_updates_immutable
  BEFORE UPDATE OR DELETE ON battery_firmware_updates
  FOR EACH ROW EXECUTE FUNCTION maxspace_guard_firmware_append_only();


-- ------------------------------------------------------------------
-- 7.7 EOL PARTNER ASSIGNMENTS
-- ------------------------------------------------------------------
-- MaxSpace is the manufacturer and the service provider; collection and
-- recycling are done by third parties. There is deliberately no MaxSpace
-- "recycling department" here -- the partner is a real external
-- organization, and the existing compliance_producers table is exactly
-- that entity (it already holds Recycler and Refurbisher registrations
-- with their real CPCB/registration numbers), so it is reused instead of
-- a new organisation table.
--
-- An assignment is the authorisation: it says this partner is allowed to
-- act on this battery, in this role, until this date. The partner
-- endpoints refuse to write an EOL event for a battery with no active
-- assignment for the caller's own partner_id, so a partner account can
-- never reach the whole fleet.
--
-- Collection address reuses the existing location structures:
-- location_key points at organization_locations (which already carries
-- 'Recycler' and 'Collection Center' rows with real coordinates), and
-- collection_address holds a free-text site address. No new table.
CREATE TABLE IF NOT EXISTS battery_eol_assignments (
  id                 BIGSERIAL PRIMARY KEY,
  battery_id         TEXT NOT NULL REFERENCES batteries(battery_id) ON DELETE CASCADE,
  partner_id         INTEGER NOT NULL REFERENCES compliance_producers(id) ON DELETE CASCADE,
  partner_role       TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'active',
  assigned_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by        TEXT REFERENCES users(id) ON DELETE SET NULL,
  access_expires_at  TIMESTAMPTZ,
  completed_at       TIMESTAMPTZ,
  collection_address TEXT,
  location_key       TEXT REFERENCES organization_locations(key) ON DELETE SET NULL,
  contact_reference  TEXT,
  notes              TEXT,
  recorded_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT battery_eol_assignments_role_check CHECK (partner_role IN (
    'collection_center', 'recycler', 'refurbisher', 'auditor')),
  CONSTRAINT battery_eol_assignments_status_check
    CHECK (status IN ('active', 'completed', 'revoked'))
);
-- A partner holds at most one live assignment per role per battery.
CREATE UNIQUE INDEX IF NOT EXISTS uq_battery_eol_assignments_active
  ON battery_eol_assignments (battery_id, partner_id, partner_role)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_battery_eol_assignments_battery
  ON battery_eol_assignments (battery_id, assigned_at DESC);
CREATE INDEX IF NOT EXISTS idx_battery_eol_assignments_partner
  ON battery_eol_assignments (partner_id, status, assigned_at DESC);


-- ------------------------------------------------------------------
-- 7.8 SECOND-LIFE GRADING
-- ------------------------------------------------------------------
-- A controlled, human decision. There is no automatic path here: a
-- retired battery is NOT classified as second-life-suitable by anything
-- in this codebase. Grade and decision must be supplied by an authorised
-- assessor, and the row keeps who, when and on what evidence.
CREATE TABLE IF NOT EXISTS battery_second_life_assessments (
  id                   BIGSERIAL PRIMARY KEY,
  battery_id           TEXT NOT NULL REFERENCES batteries(battery_id) ON DELETE CASCADE,
  lifecycle_event_id   BIGINT REFERENCES battery_lifecycle_events(id) ON DELETE SET NULL,
  partner_id           INTEGER REFERENCES compliance_producers(id) ON DELETE SET NULL,
  assessor_user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  assessor_name        TEXT,
  assessed_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  health_percent       NUMERIC,
  capacity_percent     NUMERIC,
  safety_assessment    TEXT,
  safety_passed        BOOLEAN,
  grade                TEXT,
  decision             TEXT NOT NULL,
  decision_notes       TEXT,
  evidence_document_id INTEGER REFERENCES compliance_documents(id) ON DELETE SET NULL,
  source               TEXT NOT NULL DEFAULT 'admin',
  recorded_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT battery_second_life_grade_check
    CHECK (grade IS NULL OR grade IN ('A', 'B', 'C', 'Not Suitable')),
  CONSTRAINT battery_second_life_decision_check CHECK (decision IN (
    'second_life', 'repair', 'recycle', 'reuse_application',
    'pending_inspection', 'reject')),
  CONSTRAINT battery_second_life_source_check
    CHECK (source IN ('admin', 'partner', 'service_technician', 'inspection')),
  CONSTRAINT battery_second_life_health_check
    CHECK (health_percent IS NULL OR (health_percent >= 0 AND health_percent <= 100)),
  CONSTRAINT battery_second_life_capacity_check
    CHECK (capacity_percent IS NULL OR (capacity_percent >= 0 AND capacity_percent <= 100))
);
CREATE INDEX IF NOT EXISTS idx_battery_second_life_battery
  ON battery_second_life_assessments (battery_id, assessed_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_battery_second_life_partner
  ON battery_second_life_assessments (partner_id, assessed_at DESC)
  WHERE partner_id IS NOT NULL;

-- A grade is a judgement someone signed their name to. Re-grading in
-- place would make the passport disagree with what was signed, so a
-- revised assessment is a new row and the old one stays on the record.
DROP TRIGGER IF EXISTS battery_second_life_immutable ON battery_second_life_assessments;
CREATE TRIGGER battery_second_life_immutable
  BEFORE UPDATE OR DELETE ON battery_second_life_assessments
  FOR EACH ROW EXECUTE FUNCTION maxspace_guard_append_only_simple();


-- ------------------------------------------------------------------
-- 7.9 EPR EVIDENCE CHAIN — link existing compliance documents
-- ------------------------------------------------------------------
-- compliance_documents is the existing evidence store and stays exactly
-- as it is. These columns let a document be tied to the lifecycle event
-- it was produced for, to the partner that produced it, and to the mass
-- and processing outcome the evidence attests -- which is what turns a
-- pile of documents into a chain: battery -> event -> partner -> weight
-- -> processing -> certificate.
ALTER TABLE compliance_documents
  ADD COLUMN IF NOT EXISTS lifecycle_event_id  BIGINT,
  ADD COLUMN IF NOT EXISTS partner_id         INTEGER REFERENCES compliance_producers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS weight_kg           NUMERIC,
  ADD COLUMN IF NOT EXISTS processing_outcome TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'compliance_documents_weight_check'
  ) THEN
    ALTER TABLE compliance_documents ADD CONSTRAINT compliance_documents_weight_check
      CHECK (weight_kg IS NULL OR weight_kg >= 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'compliance_documents_processing_outcome_check'
  ) THEN
    ALTER TABLE compliance_documents ADD CONSTRAINT compliance_documents_processing_outcome_check
      CHECK (processing_outcome IS NULL OR processing_outcome IN
             ('recycled', 'refurbished', 'reused', 'rejected', 'partially_processed'));
  END IF;
  /* The circular reference (a document cites an event, an event cites a
     document) is added here, after both tables exist. */
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'compliance_documents_lifecycle_event_fk'
  ) THEN
    ALTER TABLE compliance_documents ADD CONSTRAINT compliance_documents_lifecycle_event_fk
      FOREIGN KEY (lifecycle_event_id)
      REFERENCES battery_lifecycle_events(id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_compliance_documents_lifecycle_event
  ON compliance_documents (lifecycle_event_id) WHERE lifecycle_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_compliance_documents_partner
  ON compliance_documents (partner_id, issued_on DESC) WHERE partner_id IS NOT NULL;


-- ------------------------------------------------------------------
-- 7.10 PARTNER ACCOUNTS
-- ------------------------------------------------------------------
-- A third-party recycler/collection partner is an operator of the EPR
-- module, so it links to compliance_producers rather than getting a new
-- organisation entity. users.role gains 'PARTNER' so their reach can be
-- limited to the batteries they are actually assigned (see
-- battery_eol_assignments) instead of inheriting the whole fleet that
-- ADMIN and EMPLOYEE see.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_partner_id_fk'
  ) THEN
    ALTER TABLE users ADD COLUMN IF NOT EXISTS partner_id
      INTEGER REFERENCES compliance_producers(id) ON DELETE SET NULL;
  END IF;

  ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
  ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IS NULL OR role IN ('USER', 'ADMIN', 'EMPLOYEE', 'PARTNER'));
END $$;
-- Serves "which partner does this account act for" on every partner request.
CREATE INDEX IF NOT EXISTS idx_users_partner ON users (partner_id) WHERE partner_id IS NOT NULL;


-- ------------------------------------------------------------------
-- 7.11 E-MAIL VERIFICATION + RESET-TOKEN REUSE TRACKING
-- ------------------------------------------------------------------
-- CREATE TABLE IF NOT EXISTS never alters an existing table, so the
-- columns added for the Resend e-mail-verification flow are declared
-- here as well for databases created before this feature existed.
--
-- `email_verified` is NOT NULL DEFAULT true on purpose: filling the
-- existing rows with `true` is what keeps every pre-existing account
-- (and every admin-created or Google-linked account) able to sign in.
-- Only the local sign-up flow writes `false`, and only until the
-- e-mail link is clicked — no production account is locked out by this
-- migration and no user row is deleted or rewritten.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS reset_token_used_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_verified             BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_verified_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_verification_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_email_verification_token
  ON users (email_verification_token_hash) WHERE email_verification_token_hash IS NOT NULL;


-- ------------------------------------------------------------------
-- 7.12 QR OWNERSHIP TRANSFERS (owner-to-owner, self service)
-- ------------------------------------------------------------------
-- The current owner hands a battery to a second MaxSpace account by
-- showing a short-lived QR code. The QR carries ONLY a random token;
-- this table carries the parties, so no user data, battery data or
-- database id ever travels inside the code and the frontend can never
-- assert who owns what.
--
-- `token_hash` is the SHA-256 of the token (same convention as the
-- e-mail verification / reset tokens in `users`): a leaked database
-- dump cannot be replayed as a working QR. Only the hash is stored.
--
-- The partial unique index is what makes "one live QR per battery" a
-- database guarantee instead of an application convention, and it is
-- also what serialises concurrent accepts: two users racing on the
-- same token queue on the row lock taken in the accept transaction.
CREATE TABLE IF NOT EXISTS battery_ownership_transfers (
  id                 BIGSERIAL PRIMARY KEY,
  battery_id         TEXT NOT NULL REFERENCES batteries(battery_id) ON DELETE CASCADE,
  -- RESTRICT, not CASCADE: this row IS the audit record of who gave
  -- the battery away, and deleting that account must not erase it.
  previous_owner_id  TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  new_owner_id       TEXT REFERENCES users(id) ON DELETE SET NULL,
  token_hash         TEXT NOT NULL UNIQUE,
  status             TEXT NOT NULL DEFAULT 'pending',
  expires_at         TIMESTAMPTZ NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at        TIMESTAMPTZ,
  accepted_by        TEXT REFERENCES users(id) ON DELETE SET NULL,
  cancelled_at       TIMESTAMPTZ,
  CONSTRAINT battery_ownership_transfers_status_check
    CHECK (status IN ('pending', 'accepted', 'cancelled', 'expired')),
  CONSTRAINT battery_ownership_transfers_accepted_after_created
    CHECK (accepted_at IS NULL OR accepted_at >= created_at)
);

-- At most one live transfer per battery: creating a second QR first
-- closes the first one (see store.createOwnershipTransfer).
CREATE UNIQUE INDEX IF NOT EXISTS uq_battery_ownership_transfers_pending
  ON battery_ownership_transfers (battery_id) WHERE status = 'pending';
-- Every validate / accept / cancel request resolves its token by hash.
CREATE INDEX IF NOT EXISTS idx_battery_ownership_transfers_previous_owner
  ON battery_ownership_transfers (previous_owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_battery_ownership_transfers_battery
  ON battery_ownership_transfers (battery_id, created_at DESC);


-- ==============================================================
-- 8. SCHEMA VERSION
-- ==============================================================
-- A single row records the architecture version of this file. The old
-- per-file migration history is gone; this table now only answers
-- "which schema revision is installed".
CREATE TABLE IF NOT EXISTS schema_version (
  version      INTEGER PRIMARY KEY,
  applied_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  description  TEXT
);

COMMIT;

-- ------------------------------------------------------------------
-- Post-schema optimisation. Kept outside the transaction so the file
-- can run on a large existing database without a long lock.
-- ------------------------------------------------------------------
VACUUM ANALYZE;
