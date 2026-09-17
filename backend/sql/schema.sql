-- ============================================================
-- MaxSpace — PostgreSQL schema (FUTURE)
-- Mirrors the entities in backend/data/seedData.js so the mock
-- store and the database stay structurally consistent.
--
-- NOT ACTIVE YET — the app runs on the in-memory mock store by
-- default (DATA_SOURCE=mock). Apply this schema when switching to
-- DATA_SOURCE=postgres. See docs/DATABASE_MIGRATION.md.
--
-- Apply with:
--   psql "$DATABASE_URL" -f backend/sql/schema.sql
--   # or (with docker-compose): docker compose exec -T postgres \
--   #     psql -U maxspace_user -d maxspace_db < backend/sql/schema.sql
-- ============================================================

-- Users (customers, admins, employees)
CREATE TABLE IF NOT EXISTS users (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  email              TEXT NOT NULL UNIQUE,
  password_hash      TEXT NOT NULL DEFAULT '',              -- bcrypt hash (empty for Google-only accounts)
  role               TEXT NOT NULL CHECK (role IN ('USER','ADMIN','EMPLOYEE')),
  service_person_id  TEXT,                                  -- FK to service_persons.id (EMPLOYEE only)
  google_id          TEXT UNIQUE,                           -- Google OAuth subject ID (Google-linked accounts)
  auth_provider      TEXT NOT NULL DEFAULT 'local' CHECK (auth_provider IN ('local','google')),
  avatar             TEXT DEFAULT '',                       -- profile picture URL (Google provides this)
  reset_token_hash   TEXT,                                 -- sha256 hash of the password-reset token
  reset_token_expires_at TIMESTAMPTZ,                      -- password-reset token expiry
  created_at         TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD')
);

CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users (reset_token_hash);

-- Service persons (battery technicians)
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
  assigned_services  JSONB NOT NULL DEFAULT '[]'::jsonb,  -- array of service ids
  created_at         TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD')
);

-- Batteries (Digital Battery Passports)
CREATE TABLE IF NOT EXISTS batteries (
  id                       TEXT PRIMARY KEY,
  owner_id                 TEXT REFERENCES users(id),          -- owning customer (user isolation)
  barcode                  TEXT NOT NULL UNIQUE,
  qr_code                  TEXT,
  modal_id                 TEXT,                               -- QR payload "Modal ID"
  hang_status              TEXT,                               -- QR payload "Hang Status"
  overall_status           TEXT,                               -- QR payload "Overall Status"
  name                     TEXT NOT NULL,
  model_name               TEXT,
  model                    TEXT,
  type                     TEXT,
  manufacturer             TEXT,
  serial_number            TEXT NOT NULL UNIQUE,
  chemistry                TEXT,
  capacity_kwh             NUMERIC,
  capacity                 TEXT,
  nominal_voltage          TEXT,
  voltage                  TEXT,
  weight_kg                NUMERIC,
  dimensions_mm            TEXT,
  manufacture_date         TEXT,
  assembly_location        TEXT,
  location                 TEXT,
  cells                    INTEGER,
  state_of_health          NUMERIC,
  state_of_charge          NUMERIC,
  cycle_count              INTEGER,
  max_rated_cycles         INTEGER,
  internal_resistance_mohms NUMERIC,
  operating_temp_c         NUMERIC,
  carbon_footprint_kg_per_kwh NUMERIC,
  recycled_content         JSONB NOT NULL DEFAULT '{}'::jsonb,   -- { cobalt, nickel, lithium, lead }
  warranty                 JSONB NOT NULL DEFAULT '{}'::jsonb,   -- { status, startDate, endDate, ... }
  compliance_standards     JSONB NOT NULL DEFAULT '[]'::jsonb,
  dismantling_manual       TEXT,
  health_history           JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [ { date, soh } ]
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_batteries_barcode ON batteries (barcode);
CREATE INDEX IF NOT EXISTS idx_batteries_serial ON batteries (serial_number);

-- Services
CREATE TABLE IF NOT EXISTS services (
  id                      TEXT PRIMARY KEY,
  ticket_number           TEXT NOT NULL UNIQUE,
  battery_id              TEXT REFERENCES batteries(id) ON DELETE SET NULL,
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
  customer_id             TEXT,                       -- FK to users.id
  assigned_service_person_id TEXT,                    -- FK to service_persons.id
  admin_approved_at       TEXT,
  approved_by             TEXT,
  notes                   TEXT,
  cost                    TEXT,
  history                 JSONB NOT NULL DEFAULT '[]'::jsonb,    -- [ { id, status, action, ... } ]
  created_at              TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD')
);

CREATE INDEX IF NOT EXISTS idx_services_battery ON services (battery_id);
CREATE INDEX IF NOT EXISTS idx_services_status ON services (status);
CREATE INDEX IF NOT EXISTS idx_services_customer ON services (customer_id);

-- Operator profiles (one row per user; created at signup).
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

-- ============================================================
-- MIGRATION (idempotent — safe to run against an existing DB)
-- Adds the ownership + QR fields introduced for user isolation
-- and complete battery QR mapping, then backfills legacy rows.
--
-- Ownership backfill behavior (documented):
--   • Batteries whose id matches "batt-<timestamp>" are owned by
--     the user "user-<timestamp>" (the account that created them,
--     sibling id prefix). This preserves the pre-isolation records.
--   • Any remaining orphan batteries (e.g. seed fleet batt-1..N)
--     are assigned to "user-1", the seeded demo fleet owner.
--   • Nothing is duplicated or assigned at random.
-- ============================================================
ALTER TABLE batteries ADD COLUMN IF NOT EXISTS owner_id TEXT REFERENCES users(id);
ALTER TABLE batteries ADD COLUMN IF NOT EXISTS modal_id TEXT;
ALTER TABLE batteries ADD COLUMN IF NOT EXISTS hang_status TEXT;
ALTER TABLE batteries ADD COLUMN IF NOT EXISTS overall_status TEXT;

CREATE INDEX IF NOT EXISTS idx_batteries_owner ON batteries (owner_id);
CREATE INDEX IF NOT EXISTS idx_batteries_modal ON batteries (modal_id);

UPDATE batteries b SET owner_id = COALESCE(
  (SELECT u.id FROM users u WHERE u.id = 'user-' || SUBSTRING(b.id FROM '^batt-([0-9]+)$')),
  'user-1'
) WHERE owner_id IS NULL;

-- Backfill QR fields from legacy rows whose barcode stored the raw
-- multiline payload (e.g. "Battery ID: MVAE0014036\nModel: ...\nModal ID: ...\nHang Status: ...\nOverall Status: ...").
UPDATE batteries SET
  modal_id      = COALESCE(SUBSTRING(barcode FROM 'Modal[:\s]+ID:\s*([^\r\n]+)'),
                           SUBSTRING(barcode FROM 'Battery[:\s]+ID:\s*([^\r\n]+)'), modal_id),
  hang_status   = COALESCE(SUBSTRING(barcode FROM 'Hang[:\s]+Status:\s*([^\r\n]+)'), hang_status),
  overall_status= COALESCE(SUBSTRING(barcode FROM 'Overall[:\s]+Status:\s*([^\r\n]+)'), overall_status),
  model_name    = COALESCE(SUBSTRING(barcode FROM 'Model:\s*([^\r\n]+)'), model_name)
WHERE barcode LIKE '%Battery ID%';

-- Seed services belong to the demo fleet owner so user-1 keeps the sample data.
UPDATE services SET customer_id = 'user-1' WHERE customer_id IS NULL;

-- ============================================================
-- Optional: mirror the mock seed dataset (same records as
-- backend/data/seedData.js). Uncomment and run after applying
-- the schema to get a production-identical demo dataset.
-- ============================================================
-- INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES
--   ('admin-1','Admin','admin@maxspace.com','$2a$10$<hash>','ADMIN','2024-01-01'),
--   ('user-1','Alex Rivera','alex.rivera@maxspace-energy.com','$2a$10$<hash>','USER','2024-01-15');
-- ... (generate bcrypt hashes with: node -e "require('bcryptjs').hash('password123',10).then(console.log)")