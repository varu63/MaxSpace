/* ============================================================
   IMPORT MAXSPACE-PRO PRODUCTION BATTERIES INTO THE APP
   ------------------------------------------------------------
   Integrates the 1215 production battery units that were copied
   from maxvolt_prod into maxspace_db.maxspace_pro.batteries into
   the MaxSpace app table (public.batteries), so the application
   serves them via PostgreSQL (Frontend → Backend → maxspace_db).

   Field mapping (maxspace_pro → public.batteries):
     battery_id      → modal_id, serial_number, qr payload "Battery ID"
     model_id        → name / model / model_name (battery_models model_id)
     had_ng_status   → hang_status ("true"/"false")
     overall_status  → overall_status
     created_at      → manufacture_date
     model voltage/AH→ nominal_voltage, voltage, capacity_kwh, capacity
     series_count * parallel_count → cells
     cell_type       → chemistry
     category        → type ("ESS" → "Stationary Storage (ESS)")

   Ownership strategy (orphan records):
     The source system stores no customer/owner on its batteries
     (they are factory units). The app enforces per-user isolation
     (getAllBatteries(ownerId)), so every imported unit is assigned
     to ONE dedicated account "user-maxvolt" (MaxVolt Energy
     Production Fleet) created by this script. This is a
     deterministic, documented owner — NOT random assignment and NOT
     the seeded demo owner. Child records (mappings, reports, BMS)
     stay in maxspace_pro.batteries / related tables under the
     mirror schema.

   Deduplication:
     A unit whose battery_id already exists as a public.batteries
     modal_id (e.g. MVAE0014036, imported earlier via QR scan) is
     skipped — no duplicate records.

   Idempotent: safe to run multiple times.
============================================================ */

-- 1) Production fleet owner account (password: maxvolt123)
INSERT INTO users (id, name, email, password_hash, role, auth_provider, created_at)
SELECT 'user-maxvolt', 'MaxVolt Energy Production Fleet', 'fleet@maxvolt-energy.com',
       '$2b$10$D3h/I5yfZsDb4Rfi.L658efgenFG6Agyo4yyQpaJGcCZUPr.6yMdC',
       'USER', 'local', '2026-09-17'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = 'user-maxvolt');

-- 2) Profile row for the owner (profile endpoints + activity logs)
INSERT INTO profiles (user_id, name, title, email, fleet_type, total_capacity_kwh, notification_settings, activity_logs)
SELECT 'user-maxvolt',
       'MaxVolt Energy Production Fleet',
       'Battery Manufacturing & Quality',
       'fleet@maxvolt-energy.com',
       'ESS Solar Battery Production',
       0,
       '{"warrantyAlerts": true, "healthThresholdAlerts": true, "serviceReminders": true, "euComplianceUpdates": true, "smsAlerts": false}',
       '[]'
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = 'user-maxvolt');

-- 3) Import production batteries into the app (skip already-registered units)
WITH derived AS (
  SELECT
    b.battery_id,
    b.model_id,
    b.had_ng_status,
    b.overall_status,
    b.created_at,
    m.series_count,
    m.parallel_count,
    m.cell_type,
    m.category,
    (regexp_match(b.model_id, '^([0-9]+(?:\.[0-9]+)?)\s*V'))[1]::numeric AS volt,
    (regexp_match(b.model_id, '([0-9]+)\s*AH'))[1]::numeric AS ah
  FROM maxspace_pro.batteries b
  JOIN maxspace_pro.battery_models m ON m.model_id = b.model_id
  WHERE b.battery_id NOT IN (SELECT modal_id FROM public.batteries WHERE modal_id IS NOT NULL)
    AND b.battery_id NOT IN (SELECT barcode FROM public.batteries)
    AND b.battery_id NOT IN (SELECT serial_number FROM public.batteries)
)
INSERT INTO public.batteries (
  id, owner_id, barcode, qr_code, modal_id, hang_status, overall_status,
  name, model_name, model, type, manufacturer, serial_number, chemistry,
  capacity_kwh, capacity, nominal_voltage, voltage, cells, manufacture_date,
  state_of_health, warranty, compliance_standards, health_history,
  recycled_content, dismantling_manual
)
SELECT
  'batt-' || battery_id,
  'user-maxvolt',
  'Battery ID: ' || battery_id || E'\nModel: ' || model_id || E'\nModal ID: ' || battery_id || E'\nHang Status: ' || had_ng_status::text || E'\nOverall Status: ' || overall_status,
  'https://passport.battery-eu.org/passports/' || battery_id,
  battery_id,
  had_ng_status::text,
  overall_status,
  model_id,
  model_id,
  model_id,
  CASE category
    WHEN 'ESS'      THEN 'Stationary Storage (ESS)'
    WHEN '2-Wheeler' THEN 'Light Electric Vehicle (LEV)'
    WHEN '3-Wheeler' THEN 'Light Electric Vehicle (LEV)'
    ELSE 'Stationary Storage (ESS)'
  END,
  'MaxVolt Energy Pvt. Ltd.',
  battery_id,
  CASE cell_type
    WHEN 'LFP' THEN 'LFP (Lithium Iron Phosphate)'
    WHEN 'NMC' THEN 'NMC 811 (Nickel Manganese Cobalt)'
    ELSE 'LFP (Lithium Iron Phosphate)'
  END,
  round((volt * ah) / 1000, 2),
  round((volt * ah) / 1000, 2) || ' kWh',
  volt || ' V',
  volt || ' V',
  series_count * parallel_count,
  to_char(created_at, 'YYYY-MM-DD'),
  100,
  jsonb_build_object(
    'status', 'Active',
    'startDate', to_char(created_at, 'YYYY-MM-DD'),
    'endDate', to_char(created_at + interval '3 years', 'YYYY-MM-DD'),
    'remainingDays', 1095,
    'terms', '3 Years / 60,000 km Guaranteed Health Retention',
    'provider', 'EcoVolt Global Warranty Direct',
    'certificateNumber', 'WAR-MGPT-' || battery_id
  ),
  jsonb_build_array('EU Battery Regulation 2023/1542', 'ISO 26262 ASIL-D', 'UN 38.3 Transport Certified'),
  jsonb_build_array(jsonb_build_object('date', to_char(created_at, 'YYYY-MM'), 'soh', 100)),
  jsonb_build_object('cobalt', 20, 'nickel', 15, 'lithium', 14, 'lead', 0),
  'Safe discharge to <10V, disconnect HV interlock loop, use non-sparking insulated tooling.'
FROM derived;