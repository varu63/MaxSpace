-- ============================================================
-- 001_integrity.sql — Database integrity hardening (P1.1)
-- Idempotent: safe to run repeatedly against an existing,
-- populated database. Adds the missing CHECK / FK / index
-- constraints and cleans up any orphaned rows first so the
-- constraint adds never fail on dirty data.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 0. Pre-constraint data cleanup
--    Orphan audits are run first so ADD CONSTRAINT never fails.
--    Orphan rows are retained but detached (set NULL) — no data
--    is deleted, preserving records for future re-attachment.
-- ------------------------------------------------------------

-- Detach services whose customer_id / technician no longer exist.
UPDATE services SET customer_id = NULL
WHERE customer_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM users WHERE users.id = services.customer_id);

UPDATE services SET assigned_service_person_id = NULL
WHERE assigned_service_person_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM service_persons WHERE service_persons.id = services.assigned_service_person_id);

UPDATE services SET approved_by = NULL
WHERE approved_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM users WHERE users.id = services.approved_by);

-- Detach services whose battery_id no longer exists. The battery
-- identity column differs between schema shapes: maxvolt_prod keys
-- batteries by `battery_id`, while an app-shaped schema keys them by
-- `id`. Resolve the column dynamically so this runs on both.
DO $$
DECLARE
  battery_col text;
BEGIN
  SELECT column_name INTO battery_col
  FROM information_schema.columns
  WHERE table_name = 'batteries'
    AND column_name IN ('battery_id', 'id')
  ORDER BY CASE column_name WHEN 'battery_id' THEN 0 ELSE 1 END
  LIMIT 1;

  IF battery_col IS NOT NULL THEN
    EXECUTE format(
      'UPDATE services SET battery_id = NULL
        WHERE battery_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM batteries WHERE batteries.%I = services.battery_id)',
      battery_col
    );
  END IF;
END $$;

-- Detach users whose service_person_id points to a missing technician.
UPDATE users u SET service_person_id = NULL
WHERE u.service_person_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM service_persons sp WHERE sp.id = u.service_person_id);

-- ------------------------------------------------------------
-- 1. Adapter — add a constraint only if it does not exist yet.
-- ------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'services_status_check') THEN
    ALTER TABLE services ADD CONSTRAINT services_status_check
      CHECK (status IN ('Confirmed','Accepted','Assigned','On The Way','In Progress',
                        'Waiting for Admin Approval','Completed','Cancelled'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'services_priority_check') THEN
    ALTER TABLE services ADD CONSTRAINT services_priority_check
      CHECK (priority IN ('Low','Normal','High','Urgent'));
  END IF;
END $$;

-- ------------------------------------------------------------
-- 2. Foreign keys previously declared as comment-only TEXT columns
-- ------------------------------------------------------------

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

-- ------------------------------------------------------------
-- 3. Indexes for hot query paths (joins, ordering, filters)
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_services_assigned_person
  ON services (assigned_service_person_id);
CREATE INDEX IF NOT EXISTS idx_services_scheduled_date
  ON services (scheduled_date);
CREATE INDEX IF NOT EXISTS idx_services_created_at
  ON services (created_at);
CREATE INDEX IF NOT EXISTS idx_services_priority
  ON services (priority);
CREATE INDEX IF NOT EXISTS idx_batteries_name
  ON batteries (name);
CREATE INDEX IF NOT EXISTS idx_batteries_created_at
  ON batteries (created_at DESC);

-- Composite status+scheduled index used by the scheduling/reminder engine
-- (P2.1) to find services that need attention by status and date in one pass.
CREATE INDEX IF NOT EXISTS idx_services_status_scheduled
  ON services (status, scheduled_date);

-- ------------------------------------------------------------
-- 4. Verification query (informational; 0 rows = clean).
-- ------------------------------------------------------------

SELECT 'orphan_service_customer' AS check, count(*) FROM services s
  WHERE s.customer_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = s.customer_id);
SELECT 'orphan_service_technician' AS check, count(*) FROM services s
  WHERE s.assigned_service_person_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM service_persons sp WHERE sp.id = s.assigned_service_person_id);
SELECT 'orphan_user_technician' AS check, count(*) FROM users u
  WHERE u.service_person_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM service_persons sp WHERE sp.id = u.service_person_id);

COMMIT;