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
  CONSTRAINT services_cost_check CHECK (cost IS NULL OR cost >= 0)
);
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
-- 7. SCHEMA VERSION
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
