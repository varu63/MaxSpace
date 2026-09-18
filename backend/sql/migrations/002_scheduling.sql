-- ============================================================
-- 002_scheduling.sql — Scheduling & technician availability (P2.1)
-- Creates the scheduling tables that power the admin schedule board:
--   • service_schedules        → one row per scheduled service slot
--   • technician_availability  → recurring weekly availability windows
-- Idempotent: safe to run repeatedly.
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = 'service_schedules') THEN
    CREATE TABLE service_schedules (
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
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = 'technician_availability') THEN
    CREATE TABLE technician_availability (
      id               TEXT PRIMARY KEY,
      service_person_id TEXT NOT NULL REFERENCES service_persons(id) ON DELETE CASCADE,
      day_of_week      SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
      start_time       TIME NOT NULL,
      end_time         TIME NOT NULL,
      status           TEXT NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active','inactive')),
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_service_schedules_date
  ON service_schedules (scheduled_date);
CREATE INDEX IF NOT EXISTS idx_service_schedules_technician
  ON service_schedules (technician_id);
CREATE INDEX IF NOT EXISTS idx_technician_availability_person
  ON technician_availability (service_person_id, day_of_week);

COMMIT;