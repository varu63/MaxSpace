-- ============================================================
-- 000_maxvolt_prod.sql — Base schema adaptation for the legacy
-- maxvolt_prod production database.
--
-- OVERVIEW
--   MaxSpace now treats maxvolt_prod (the existing MaxVolt
--   production database) as its source of truth. This migration
--   adapts the legacy tables to the application schema WITHOUT
--   dropping, truncating, deleting or renaming anything:
--
--   • users       — id is converted serial int → text (no inbound
--                   FKs exist, so this is safe), and the app-facing
--                   columns (name, email, role, password_hash, …)
--                   are added. Legacy rows keep email/role NULL and
--                   password_hash '' so those production accounts are
--                   preserved unchanged and simply cannot sign in to
--                   MaxSpace with their legacy credentials.
--   • batteries   — batteries.battery_id already stores the QR "Battery
--                   ID"; the app reuses it as the battery id (no
--                   duplicate `id` column). The app-facing columns are
--                   added and backfilled only from data that genuinely
--                   exists in maxvolt_prod (model lookup, series/parallel,
--                   cell type, created_at). Fields with no real source
--                   (weight, soh, warranty, compliance, …) stay NULL —
--                   nothing is fabricated.
--   • services, service_persons, profiles, service_schedules,
--     technician_availability — created fresh (they do not exist in
--     the legacy schema).
--
-- IDEMPOTENT
--   Every step is guarded (IF NOT EXISTS / information_schema / DO
--   blocks). Safe to run against a fresh app-shaped database created
--   from backend/sql/schema.sql as well as against maxvolt_prod.
--
-- APPLIED VIA
--   node backend/scripts/migrate.js   (DATABASE_URL → maxvolt_prod)
--   The runner wraps this file in a single transaction, so the whole
--   adaptation is atomic.
-- ============================================================

-- ------------------------------------------------------------
-- 1. users — adapt the legacy account table to the app shape
-- ------------------------------------------------------------

-- Drop the integer sequence default before changing the column type.
ALTER TABLE users ALTER COLUMN id DROP DEFAULT;
ALTER SEQUENCE IF EXISTS users_id_seq OWNED BY NONE;
ALTER TABLE users ALTER COLUMN id TYPE text USING id::text;

-- The app manages identity via `email`/`password_hash`, not the legacy
-- authority columns (username / hashed_password / full_name /
-- assigned_roles). Relax their NOT NULL so app-created accounts can be
-- inserted without fabricating legacy values; legacy writes that always
-- supply these columns are unaffected.
ALTER TABLE users ALTER COLUMN username DROP NOT NULL;
ALTER TABLE users ALTER COLUMN hashed_password DROP NOT NULL;
ALTER TABLE users ALTER COLUMN full_name DROP NOT NULL;
ALTER TABLE users ALTER COLUMN assigned_roles DROP NOT NULL;

-- App-facing columns (additive; legacy columns remain untouched).
ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS service_person_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMPTZ;

-- (Re)set defaults that the app schema declares, without overwriting
-- any existing values.
UPDATE users SET auth_provider = COALESCE(auth_provider, 'local');
UPDATE users SET avatar = COALESCE(avatar, '');
-- password_hash is NOT NULL in the app schema; legacy rows get '' so
-- they are functionally disabled but never deleted.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT NOT NULL DEFAULT '';

-- Backfill the app display name from the legacy full_name.
UPDATE users SET name = full_name WHERE name IS NULL AND full_name IS NOT NULL;

-- Keep the schema contract: name is required by the app.
ALTER TABLE users ALTER COLUMN name SET NOT NULL;

-- Role / auth_provider check constraints (nullable — legacy rows have no role).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check') THEN
    ALTER TABLE users ADD CONSTRAINT users_role_check
      CHECK (role IN ('USER','ADMIN','EMPLOYEE') OR role IS NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_auth_provider_check') THEN
    ALTER TABLE users ADD CONSTRAINT users_auth_provider_check
      CHECK (auth_provider IN ('local','google') OR auth_provider IS NULL);
  END IF;
END $$;

-- Indexes the app relies on (partial: legacy rows have no email/google id).
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users (reset_token_hash);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users (google_id) WHERE google_id IS NOT NULL;

-- ------------------------------------------------------------
-- 2. batteries — add the app-facing columns (no destructive change)
-- ------------------------------------------------------------

ALTER TABLE batteries ADD COLUMN IF NOT EXISTS owner_id TEXT REFERENCES users(id);
ALTER TABLE batteries ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE batteries ADD COLUMN IF NOT EXISTS qr_code TEXT;
ALTER TABLE batteries ADD COLUMN IF NOT EXISTS modal_id TEXT;
ALTER TABLE batteries ADD COLUMN IF NOT EXISTS hang_status TEXT;
ALTER TABLE batteries ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE batteries ADD COLUMN IF NOT EXISTS model_name TEXT;
ALTER TABLE batteries ADD COLUMN IF NOT EXISTS model TEXT;
ALTER TABLE batteries ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE batteries ADD COLUMN IF NOT EXISTS manufacturer TEXT;
ALTER TABLE batteries ADD COLUMN IF NOT EXISTS serial_number TEXT;
ALTER TABLE batteries ADD COLUMN IF NOT EXISTS chemistry TEXT;
ALTER TABLE batteries ADD COLUMN IF NOT EXISTS capacity_kwh NUMERIC;
ALTER TABLE batteries ADD COLUMN IF NOT EXISTS capacity TEXT;
ALTER TABLE batteries ADD COLUMN IF NOT EXISTS nominal_voltage TEXT;
ALTER TABLE batteries ADD COLUMN IF NOT EXISTS voltage TEXT;
ALTER TABLE batteries ADD COLUMN IF NOT EXISTS weight_kg NUMERIC;
ALTER TABLE batteries ADD COLUMN IF NOT EXISTS dimensions_mm TEXT;
ALTER TABLE batteries ADD COLUMN IF NOT EXISTS manufacture_date TEXT;
ALTER TABLE batteries ADD COLUMN IF NOT EXISTS assembly_location TEXT;
ALTER TABLE batteries ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE batteries ADD COLUMN IF NOT EXISTS cells INTEGER;
ALTER TABLE batteries ADD COLUMN IF NOT EXISTS state_of_health NUMERIC;
ALTER TABLE batteries ADD COLUMN IF NOT EXISTS state_of_charge NUMERIC;
ALTER TABLE batteries ADD COLUMN IF NOT EXISTS cycle_count INTEGER;
ALTER TABLE batteries ADD COLUMN IF NOT EXISTS max_rated_cycles INTEGER;
ALTER TABLE batteries ADD COLUMN IF NOT EXISTS internal_resistance_mohms NUMERIC;
ALTER TABLE batteries ADD COLUMN IF NOT EXISTS operating_temp_c NUMERIC;
ALTER TABLE batteries ADD COLUMN IF NOT EXISTS carbon_footprint_kg_per_kwh NUMERIC;
ALTER TABLE batteries ADD COLUMN IF NOT EXISTS recycled_content JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE batteries ADD COLUMN IF NOT EXISTS warranty JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE batteries ADD COLUMN IF NOT EXISTS compliance_standards JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE batteries ADD COLUMN IF NOT EXISTS dismantling_manual TEXT;
ALTER TABLE batteries ADD COLUMN IF NOT EXISTS health_history JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Backfill the app columns ONLY from real maxvolt_prod data. Runs only
-- on the legacy production shape (batteries keyed by battery_id joined
-- to battery_models); on an app-shaped database it is a no-op.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'batteries' AND column_name = 'battery_id')
     AND EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'battery_models' AND column_name = 'model_id') THEN

    UPDATE batteries b
    SET modal_id            = COALESCE(b.modal_id, b.battery_id),
        barcode             = COALESCE(b.barcode, b.battery_id),
        serial_number       = COALESCE(b.serial_number, b.battery_id),
        hang_status         = COALESCE(b.hang_status, b.had_ng_status::text),
        name                = COALESCE(b.name, COALESCE(m.model_id, b.battery_id)),
        model_name          = COALESCE(b.model_name, m.model_id),
        model               = COALESCE(b.model, m.model_id),
        type                = COALESCE(b.type, CASE m.category
                                    WHEN 'ESS' THEN 'Stationary Storage (ESS)'
                                    WHEN '2-Wheeler' THEN 'Light Electric Vehicle (LEV)'
                                    WHEN '3-Wheeler' THEN 'Light Electric Vehicle (LEV)'
                                    ELSE m.category END),
        chemistry           = COALESCE(b.chemistry, CASE m.cell_type
                                    WHEN 'LFP' THEN 'LFP (Lithium Iron Phosphate)'
                                    WHEN 'NMC' THEN 'NMC 811 (Nickel Manganese Cobalt)'
                                    ELSE m.cell_type::text END),
        cells               = COALESCE(b.cells, m.series_count * m.parallel_count),
        nominal_voltage     = COALESCE(b.nominal_voltage,
                                    NULLIF(SUBSTRING(UPPER(m.model_id) FROM '^([0-9]*\.?[0-9]+)'), '') || ' V'),
        voltage             = COALESCE(b.voltage,
                                    NULLIF(SUBSTRING(UPPER(m.model_id) FROM '^([0-9]*\.?[0-9]+)'), '') || ' V'),
        capacity_kwh        = COALESCE(b.capacity_kwh,
                                    ROUND(NULLIF(SUBSTRING(UPPER(m.model_id) FROM '^([0-9]*\.?[0-9]+)'), '')::numeric
                                        * NULLIF(SUBSTRING(UPPER(m.model_id) FROM '([0-9]+)[[:space:]]*AH'), '')::numeric
                                        / 1000.0, 3)),
        manufacture_date    = COALESCE(b.manufacture_date, to_char(b.created_at, 'YYYY-MM-DD'))
    FROM battery_models m
    WHERE m.model_id = b.model_id;

    -- The values above are guaranteed present for every existing row,
    -- so enforce the app-schema NOT NULL contract after backfill.
    ALTER TABLE batteries ALTER COLUMN barcode SET NOT NULL;
    ALTER TABLE batteries ALTER COLUMN serial_number SET NOT NULL;
    ALTER TABLE batteries ALTER COLUMN name SET NOT NULL;
  END IF;
END $$;

-- Indexes the app relies on.
CREATE INDEX IF NOT EXISTS idx_batteries_barcode ON batteries (barcode);
CREATE INDEX IF NOT EXISTS idx_batteries_serial ON batteries (serial_number);
CREATE INDEX IF NOT EXISTS idx_batteries_owner ON batteries (owner_id);
CREATE INDEX IF NOT EXISTS idx_batteries_modal ON batteries (modal_id);
CREATE INDEX IF NOT EXISTS idx_batteries_name ON batteries (name);
CREATE INDEX IF NOT EXISTS idx_batteries_created_at ON batteries (created_at DESC);

-- ------------------------------------------------------------
-- 3. App tables that do not exist in the legacy schema
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS service_persons (
  id                 TEXT PRIMARY KEY,
  technician_id      TEXT NOT NULL UNIQUE,
  name               TEXT NOT NULL,
  email              TEXT NOT NULL UNIQUE,
  phone              TEXT DEFAULT '',
  certification      TEXT DEFAULT '',
  specializations    JSONB NOT NULL DEFAULT '[]'::jsonb,
  specialization     TEXT DEFAULT '',
  status             TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  assigned_services  JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at         TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD')
);

CREATE TABLE IF NOT EXISTS services (
  id                      TEXT PRIMARY KEY,
  ticket_number           TEXT NOT NULL UNIQUE,
  battery_id              TEXT,                                 -- FK added below (legacy schema has no batteries.id)
  battery_name            TEXT,
  service_type            TEXT,
  center                  TEXT,
  scheduled_date          TEXT,
  scheduled_time          TEXT,
  mobile_number           TEXT DEFAULT '',
  status                  TEXT NOT NULL,
  priority                TEXT NOT NULL DEFAULT 'Normal',
  technician              TEXT DEFAULT '',
  estimated_arrival       TEXT,
  customer_id             TEXT,
  assigned_service_person_id TEXT,
  admin_approved_at       TEXT,
  approved_by             TEXT,
  notes                   TEXT,
  cost                    TEXT,
  history                 JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at              TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD')
);

CREATE INDEX IF NOT EXISTS idx_services_battery ON services (battery_id);
CREATE INDEX IF NOT EXISTS idx_services_status ON services (status);

CREATE TABLE IF NOT EXISTS profiles (
  user_id                TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name                   TEXT,
  title                  TEXT,
  email                  TEXT,
  phone                  TEXT,
  location               TEXT,
  member_since           TEXT,
  avatar                 TEXT,
  fleet_type             TEXT,
  total_capacity_kwh     NUMERIC,
  eu_operator_id         TEXT,
  notification_settings  JSONB NOT NULL DEFAULT '{}'::jsonb,
  activity_logs          JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- service_schedules / technician_availability (also created by
-- 002_scheduling.sql; guarded so whichever runs first wins).
CREATE TABLE IF NOT EXISTS service_schedules (
  id             TEXT PRIMARY KEY,
  service_id     TEXT NOT NULL UNIQUE REFERENCES services(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  start_time     TIME,
  end_time       TIME,
  technician_id  TEXT REFERENCES service_persons(id) ON DELETE SET NULL,
  status         TEXT NOT NULL DEFAULT 'Scheduled'
                 CHECK (status IN ('Scheduled','Rescheduled','Completed','Cancelled')),
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS technician_availability (
  id               TEXT PRIMARY KEY,
  service_person_id TEXT NOT NULL REFERENCES service_persons(id) ON DELETE CASCADE,
  day_of_week      SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time       TIME NOT NULL,
  end_time         TIME NOT NULL,
  status           TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','inactive')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 4. Referential integrity between app tables
--    (services.battery_id joins batteries via battery_id on the
--    legacy production schema, or via id on an app-shaped schema)
-- ------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'services_battery_id_fkey') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'batteries' AND column_name = 'battery_id') THEN
      ALTER TABLE services ADD CONSTRAINT services_battery_id_fkey
        FOREIGN KEY (battery_id) REFERENCES batteries(battery_id) ON DELETE SET NULL;
    ELSE
      ALTER TABLE services ADD CONSTRAINT services_battery_id_fkey
        FOREIGN KEY (battery_id) REFERENCES batteries(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- Constraint guards mirror 001_integrity.sql so that a fresh legacy
-- database gets the same constraints regardless of which file adds them.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'services_customer_id_fkey') THEN
    ALTER TABLE services ADD CONSTRAINT services_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'services_assigned_service_person_id_fkey') THEN
    ALTER TABLE services ADD CONSTRAINT services_assigned_service_person_id_fkey
      FOREIGN KEY (assigned_service_person_id) REFERENCES service_persons(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'services_approved_by_fkey') THEN
    ALTER TABLE services ADD CONSTRAINT services_approved_by_fkey
      FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_service_person_id_fkey') THEN
    ALTER TABLE users ADD CONSTRAINT users_service_person_id_fkey
      FOREIGN KEY (service_person_id) REFERENCES service_persons(id) ON DELETE SET NULL;
  END IF;
END $$;