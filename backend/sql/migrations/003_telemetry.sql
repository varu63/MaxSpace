-- ============================================================
-- 003_telemetry.sql — Battery telemetry / history table
--
-- PURPOSE
--   Add a time-series table for battery telemetry so the backend
--   is IoT/BMS-ready. Physical BMS data (voltage, current,
--   temperature, SoC, SoH, cycle count, charging/fault status)
--   can be recorded per battery and read back as "latest" or
--   "history" without disturbing the existing battery columns.
--
-- DESIGN
--   • Keyed off the ACTUAL battery primary key. maxvolt_prod keys
--     batteries by `battery_id` (varchar); an app-shaped schema
--     keys them by `id`. The FK target is detected dynamically,
--     mirroring migration 000 / 001.
--   • Append-only: rows are never updated, only inserted. The
--     battery's static columns (state_of_health, operating_temp_c,
--     cycle_count, ...) remain untouched — telemetry is a separate
--     recorded history.
--   • Data is only present when a real device/gateway pushes it.
--     This migration creates no rows and fabricates nothing.
--
-- IDEMPOTENT
--   Guarded with IF NOT EXISTS / information_schema checks like the
--   other migrations. Safe to run against maxvolt_prod or a fresh
--   app-shaped database.
-- ============================================================

CREATE TABLE IF NOT EXISTS battery_telemetry (
  id               BIGSERIAL PRIMARY KEY,
  battery_id       TEXT NOT NULL,
  voltage          NUMERIC,
  current          NUMERIC,
  temperature_c    NUMERIC,
  soc              NUMERIC,
  soh              NUMERIC,
  cycle_count      INTEGER,
  charging_status  TEXT,
  fault_status     TEXT,
  source           TEXT NOT NULL DEFAULT 'api',
  recorded_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Numeric range guards (NULL allowed when the field is unknown).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'battery_telemetry_voltage_check') THEN
    ALTER TABLE battery_telemetry ADD CONSTRAINT battery_telemetry_voltage_check
      CHECK (voltage IS NULL OR voltage >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'battery_telemetry_soc_check') THEN
    ALTER TABLE battery_telemetry ADD CONSTRAINT battery_telemetry_soc_check
      CHECK (soc IS NULL OR (soc >= 0 AND soc <= 100));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'battery_telemetry_soh_check') THEN
    ALTER TABLE battery_telemetry ADD CONSTRAINT battery_telemetry_soh_check
      CHECK (soh IS NULL OR (soh >= 0 AND soh <= 100));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'battery_telemetry_temperature_check') THEN
    ALTER TABLE battery_telemetry ADD CONSTRAINT battery_telemetry_temperature_check
      CHECK (temperature_c IS NULL OR (temperature_c >= -100 AND temperature_c <= 300));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'battery_telemetry_cycle_count_check') THEN
    ALTER TABLE battery_telemetry ADD CONSTRAINT battery_telemetry_cycle_count_check
      CHECK (cycle_count IS NULL OR cycle_count >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'battery_telemetry_charging_status_check') THEN
    ALTER TABLE battery_telemetry ADD CONSTRAINT battery_telemetry_charging_status_check
      CHECK (charging_status IS NULL OR charging_status IN
        ('charging','discharging','idle','standby','unknown'));
  END IF;
END $$;

-- Foreign key to the ACTUAL battery primary key (battery_id on the
-- legacy maxvolt_prod shape, id on an app-shaped schema). The battery
-- is never deleted by telemetry; referencing rows are cascade-removed
-- only when the battery row itself is deleted.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'battery_telemetry_battery_id_fkey') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'batteries' AND column_name = 'battery_id') THEN
      ALTER TABLE battery_telemetry ADD CONSTRAINT battery_telemetry_battery_id_fkey
        FOREIGN KEY (battery_id) REFERENCES batteries(battery_id) ON DELETE CASCADE;
    ELSE
      ALTER TABLE battery_telemetry ADD CONSTRAINT battery_telemetry_battery_id_fkey
        FOREIGN KEY (battery_id) REFERENCES batteries(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- Indexes: per-battery lookup, timestamp range scans, and the
-- composite index used by "latest reading" + "history for one battery".
CREATE INDEX IF NOT EXISTS idx_battery_telemetry_battery
  ON battery_telemetry (battery_id);
CREATE INDEX IF NOT EXISTS idx_battery_telemetry_recorded_at
  ON battery_telemetry (recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_battery_telemetry_battery_time
  ON battery_telemetry (battery_id, recorded_at DESC);