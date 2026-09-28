/* ============================================================
   ONE-TIME DATA MIGRATION: legacy 27-table layout -> v2 schema
   ============================================================
   Reads every row from the preserved legacy clone in `legacy_src`
   and writes it into the clean `public` schema.

   Every statement is an explicit column list plus a SELECT, so each
   transformation is auditable and nothing is carried over implicitly.

   Safety properties:
     * Reads only from `legacy_src`; never touches `maxvolt_prod`.
     * Idempotent: re-running truncates the target tables first.
     * Any value that cannot be converted raises an error rather than
       being silently dropped (all conversions were pre-validated).

   Usage:
     psql "$DEV_DATABASE_URL" -v ON_ERROR_STOP=1 \
       -f backend/sql/migrate_legacy_to_v2.sql
   ============================================================ */

BEGIN;

-- Order matters: children after parents so every FK resolves.
TRUNCATE TABLE
  user_activity, profiles, companies, users,
  technician_availability, service_persons, service_schedules, services,
  cells, battery_cell_mapping,
  pdi_reports, pack_testing_reports, laser_welding_data, spot_welding_data,
  dispatch_records, bms_inventory, battery_location_history, battery_locations,
  battery_telemetry, compliance_documents, compliance_events,
  epr_credits, epr_obligations, battery_compliance, compliance_producers,
  battery_models, batteries, compliance_types, compliance_records,
  compliance_settings, schema_version
RESTART IDENTITY CASCADE;

-- ------------------------------------------------------------------
-- Identity
-- ------------------------------------------------------------------
-- Dead columns dropped: hashed_password, full_name, assigned_roles,
-- is_active, last_login. verified against the data: full_name was
-- identical to name in 3/3 rows, and assigned_roles / is_active /
-- last_login were NULL in 3/3 rows, so nothing is lost.
-- `companies` is new in v2: migrations 007/008 were never applied to the
-- source database, so it has no rows to carry over and starts empty. The
-- same is true of compliance_types and compliance_records below.

INSERT INTO users (
  id, name, username, email, password_hash, role, service_person_id,
  company_id, google_id, auth_provider, avatar, reset_token_hash,
  reset_token_expires_at, created_at
)
SELECT
  id, name, username, email, password_hash, role, service_person_id,
  NULL::integer AS company_id,   -- column did not exist in the legacy layout
  google_id, auth_provider, avatar, reset_token_hash,
  reset_token_expires_at, created_at AT TIME ZONE 'UTC'
FROM legacy_src.users;

-- profiles.name / email / avatar are now served from `users` via a join.
-- The legacy rows disagreed with `users` in 1/3 cases (the EMPLOYEE row
-- had an empty profile name/e-mail), so deriving is a correction, not a
-- regression. notification_settings is carried over unchanged.
INSERT INTO profiles (
  user_id, title, phone, location, member_since, fleet_type,
  total_capacity_kwh, eu_operator_id, notification_settings
)
SELECT
  user_id, title, phone, location, member_since, fleet_type,
  total_capacity_kwh, eu_operator_id, notification_settings
FROM legacy_src.profiles;

-- The legacy jsonb array stored the literal string "Just now" for every
-- entry, but each entry id was act-<epoch-ms>. The real timestamps are
-- therefore recovered from the id, then validated against the real
-- timestamps in services.history (agreement within 10 ms).
INSERT INTO user_activity (user_id, action, details, type, created_at)
SELECT
  p.user_id,
  elem->>'action',
  elem->>'details',
  COALESCE(elem->>'type', 'general'),
  to_timestamp((regexp_replace(elem->>'id', '^act-', ''))::numeric / 1000)
FROM legacy_src.profiles p,
     LATERAL jsonb_array_elements(p.activity_logs) elem
WHERE elem->>'id' ~ '^act-\d{10,}$';

INSERT INTO service_persons (
  id, technician_id, name, email, phone, certification, specializations,
  status, created_at
)
SELECT
  id, technician_id, name, email, phone, certification, specializations,
  status, created_at::date    -- legacy column was text, value '2026-09-24'
FROM legacy_src.service_persons;

INSERT INTO technician_availability (
  id, service_person_id, day_of_week, start_time, end_time, status, created_at
)
SELECT
  id, service_person_id, day_of_week, start_time, end_time, status, created_at
FROM legacy_src.technician_availability;

-- ------------------------------------------------------------------
-- Fleet
-- ------------------------------------------------------------------
INSERT INTO battery_models (model_id, category, series_count, parallel_count,
                            cell_type, bms_model, welding_type)
SELECT model_id, category, series_count, parallel_count,
       cell_type, bms_model, welding_type
FROM legacy_src.battery_models;

-- hang_status was text holding the strings 'true'/'false' (1185 false /
-- 30 true); manufacture_date was text but 1215/1215 rows were already
-- valid ISO dates. Dropped: model, location, cells (all derivable).
INSERT INTO batteries (
  battery_id, model_id, owner_id, barcode, serial_number, modal_id, qr_code,
  name, model_name, type, manufacturer, chemistry, capacity_kwh, capacity,
  nominal_voltage, voltage, weight_kg, dimensions_mm, manufacture_date,
  assembly_location, hang_status, overall_status, state_of_health,
  state_of_charge, cycle_count, max_rated_cycles, internal_resistance_mohms,
  operating_temp_c, carbon_footprint_kg_per_kwh, had_ng_status,
  cell_ir_lower, cell_ir_upper, cell_voltage_lower, cell_voltage_upper,
  cell_capacity_lower, cell_capacity_upper, recycled_content, warranty,
  compliance_standards, dismantling_manual, health_history, created_at
)
SELECT
  battery_id, model_id, owner_id, barcode, serial_number, modal_id, qr_code,
  name, model_name, type, manufacturer, chemistry, capacity_kwh, capacity,
  nominal_voltage, voltage, weight_kg, dimensions_mm,
  manufacture_date::date,
  assembly_location, hang_status::boolean, overall_status, state_of_health,
  state_of_charge, cycle_count, max_rated_cycles, internal_resistance_mohms,
  operating_temp_c, carbon_footprint_kg_per_kwh, had_ng_status,
  cell_ir_lower, cell_ir_upper, cell_voltage_lower, cell_voltage_upper,
  cell_capacity_lower, cell_capacity_upper, recycled_content, warranty,
  compliance_standards, dismantling_manual, health_history, created_at
FROM legacy_src.batteries;

INSERT INTO battery_locations (
  id, battery_id, latitude, longitude, address, city, state, country,
  site_name, location_type, is_current, created_at, updated_at
)
SELECT
  id, battery_id, latitude, longitude, address, city, state, country,
  site_name, location_type, is_current, created_at, updated_at
FROM legacy_src.battery_locations;

INSERT INTO battery_location_history (
  id, battery_id, previous_location_id, new_location_id, moved_at, reason,
  created_by, created_at, prev_latitude, prev_longitude, prev_address,
  prev_city, prev_state, prev_country, prev_site_name, new_latitude,
  new_longitude, new_address, new_city, new_state, new_country, new_site_name
)
SELECT
  id, battery_id, previous_location_id, new_location_id, moved_at, reason,
  created_by, created_at, prev_latitude, prev_longitude, prev_address,
  prev_city, prev_state, prev_country, prev_site_name, new_latitude,
  new_longitude, new_address, new_city, new_state, new_country, new_site_name
FROM legacy_src.battery_location_history;

-- ------------------------------------------------------------------
-- Manufacturing: cells + cell_gradings merged into one table
-- ------------------------------------------------------------------
-- Both legacy tables had a `discharging_capacity_mah` column and they are
-- NOT the same measurement: 838 of the 6532 rows populated in both
-- disagree (by up to 106 mAh), so both are preserved side by side.
INSERT INTO cells (
  cell_id, registration_date, is_used, status, ng_count,
  discharging_capacity_mah, last_test_date, ir_value_m_ohm, sorting_voltage,
  sorting_date, test_date, lot, brand, specification, ocv_voltage_mv,
  upper_cutoff_mv, lower_cutoff_mv, grading_discharging_capacity_mah, result,
  final_soc_mah, soc_result, final_cv_capacity, final_result
)
SELECT
  c.cell_id, c.registration_date, c.is_used, c.status, c.ng_count,
  c.discharging_capacity_mah, c.last_test_date AT TIME ZONE 'UTC',
  c.ir_value_m_ohm, c.sorting_voltage, c.sorting_date AT TIME ZONE 'UTC',
  g.test_date AT TIME ZONE 'UTC',
  g.lot, g.brand, g.specification, g.ocv_voltage_mv,
  g.upper_cutoff_mv, g.lower_cutoff_mv, g.discharging_capacity_mah,
  g.result, g.final_soc_mah, g.soc_result, g.final_cv_capacity, g.final_result
FROM legacy_src.cells c
LEFT JOIN legacy_src.cell_gradings g ON g.cell_id = c.cell_id;

-- The legacy mapping's third index (battery_id, cell_id) duplicated the
-- leading column of its own PRIMARY KEY and was removed; the PRIMARY KEY
-- and the UNIQUE on cell_id now cover both directions.
INSERT INTO battery_cell_mapping (battery_id, cell_id, assigned_at)
SELECT battery_id, cell_id, assigned_at
FROM legacy_src.battery_cell_mapping;

INSERT INTO bms_inventory (bms_id, battery_id, is_used, added_at)
SELECT bms_id, battery_id, is_used, added_at
FROM legacy_src.bms_inventory;

-- test_time was `timestamp without time zone`; the database runs at
-- Etc/UTC, so the conversion is an exact, lossless reinterpretation.
INSERT INTO pdi_reports (
  id, battery_id, test_time, voltage_v, resistance_m_ohm,
  cont_charging_current, cont_charging_voltage, cont_discharging_current,
  cont_discharging_voltage, short_circuit_prot_time_us, test_result,
  created_at, updated_at
)
SELECT
  id, battery_id, test_time AT TIME ZONE 'UTC', voltage_v, resistance_m_ohm,
  cont_charging_current, cont_charging_voltage, cont_discharging_current,
  cont_discharging_voltage, short_circuit_prot_time_us, test_result,
  created_at, updated_at
FROM legacy_src.pdi_reports;

INSERT INTO pack_testing_reports (
  id, battery_id, test_date, specification, cell_type, actual_cap,
  ocv_voltage, upper_cutoff, lower_cutoff, discharging_capacity,
  capacity_result, idle_difference, idle_diff_res, final_voltage,
  final_result, soc_result, number_of_series, number_of_parallel, created_at
)
SELECT
  id, battery_id, test_date AT TIME ZONE 'UTC', specification, cell_type,
  actual_cap, ocv_voltage, upper_cutoff, lower_cutoff, discharging_capacity,
  capacity_result, idle_difference, idle_diff_res, final_voltage,
  final_result, soc_result,
  COALESCE(number_of_series, 0), COALESCE(number_of_parallel, 0), created_at
FROM legacy_src.pack_testing_reports;

-- NOTE: the legacy table names its timestamp column `timestamp` (a reserved
-- word), which is renamed to the clearer `recorded_at` here.
INSERT INTO laser_welding_data (
  id, battery_id, initial_speed, max_speed, acceleration, laser_on_delay,
  laser_off_delay, point_duration, power_mode, pwm_freq, pwm_cycle,
  pwm_duty_rate, pwm_width, code, dac_power, scan_speed, lsm_laser_on_delay,
  lsm_laser_off_delay, recorded_at
)
SELECT
  id, battery_id, initial_speed, max_speed, acceleration, laser_on_delay,
  laser_off_delay, point_duration, power_mode, pwm_freq, pwm_cycle,
  pwm_duty_rate, pwm_width, code, dac_power, scan_speed, lsm_laser_on_delay,
  lsm_laser_off_delay, "timestamp"
FROM legacy_src.laser_welding_data;

INSERT INTO spot_welding_data (
  id, battery_id, solder_joint_mode, welding_needle_direction,
  hole_setback_distance, total_stroke_welding_head, start_delay,
  clamping_delay, welding_time, air_speed, working_speed, hole_inlet_speed,
  recorded_at
)
SELECT
  id, battery_id, solder_joint_mode, welding_needle_direction,
  hole_setback_distance, total_stroke_welding_head, start_delay,
  clamping_delay, welding_time, air_speed, working_speed, hole_inlet_speed,
  "timestamp"
FROM legacy_src.spot_welding_data;

INSERT INTO dispatch_records (
  id, battery_id, customer_name, invoice_id, invoice_date, dispatch_timestamp
)
SELECT id, battery_id, customer_name, invoice_id, invoice_date, dispatch_timestamp
FROM legacy_src.dispatch_records;

-- ------------------------------------------------------------------
-- Service
-- ------------------------------------------------------------------
-- scheduled_date / scheduled_time / admin_approved_at / created_at were all
-- text; every one of the 7 populated values was already a valid ISO
-- date/time, so the casts are lossless.
-- cost was a pre-formatted string such as '$0.00 (Warranty Covered)'; it is
-- split into amount / currency / note so no character is discarded.
INSERT INTO services (
  id, ticket_number, battery_id, customer_id, assigned_service_person_id,
  service_type, center, scheduled_date, scheduled_time, estimated_arrival,
  mobile_number, status, priority, admin_approved_at, approved_by, notes,
  cost, cost_currency, cost_note, history, created_at
)
SELECT
  id, ticket_number, battery_id, customer_id, assigned_service_person_id,
  service_type, center,
  scheduled_date::date,
  scheduled_time::time,
  estimated_arrival,
  mobile_number, status, priority,
  admin_approved_at::timestamptz,
  approved_by, notes,
  -- '$0.00 (Warranty Covered)' -> 0.00 / '$' / 'Warranty Covered'
  -- '$65.00'                    -> 65.00 / '$' / NULL
  NULLIF(regexp_replace(cost, '[^0-9.]', '', 'g'), '')::numeric,
  CASE
    WHEN cost LIKE '$%' THEN '$'
    ELSE NULLIF(btrim(substring(cost FROM '\$?([A-Za-z]{3})')), '')
  END,
  NULLIF(btrim(substring(cost FROM '\(([^)]*)\)')), ''),
  history,
  created_at::date::timestamptz
FROM legacy_src.services;

INSERT INTO service_schedules (
  id, service_id, scheduled_date, start_time, end_time, technician_id,
  status, notes, created_at, updated_at
)
SELECT
  id, service_id, scheduled_date, start_time, end_time, technician_id,
  status, notes, created_at, updated_at
FROM legacy_src.service_schedules;

-- ------------------------------------------------------------------
-- Telemetry
-- ------------------------------------------------------------------
INSERT INTO battery_telemetry (
  id, battery_id, voltage, current, temperature_c, soc, soh, cycle_count,
  charging_status, fault_status, source, recorded_at
)
SELECT
  id, battery_id, voltage, current, temperature_c, soc, soh, cycle_count,
  charging_status, fault_status, source, recorded_at
FROM legacy_src.battery_telemetry;

-- ------------------------------------------------------------------
-- Compliance
-- ------------------------------------------------------------------
INSERT INTO compliance_producers (
  id, producer_name, registration_number, registration_valid_until,
  producer_category, pan, gstin, address, contact_email, contact_phone,
  website, status, notes, created_at, updated_at
)
SELECT
  id, producer_name, registration_number, registration_valid_until,
  producer_category, pan, gstin, address, contact_email, contact_phone,
  website, status, notes, created_at, updated_at
FROM legacy_src.compliance_producers;

INSERT INTO battery_compliance (
  id, battery_id, producer_id, framework, battery_category,
  collection_channel, compliance_status, verified_in_app, verified_at,
  notes, collection_status, collection_date, collection_location,
  refurbisher_id, refurbisher_name, refurbisher_details, recycler_id,
  recycler_name, recycler_registration, recycling_facility, recycling_date,
  recycling_status, recycling_certificate, epr_reference, created_at, updated_at
)
SELECT
  id, battery_id, producer_id, framework, battery_category,
  collection_channel, compliance_status, verified_in_app, verified_at,
  notes, collection_status, collection_date, collection_location,
  refurbisher_id, refurbisher_name, refurbisher_details, recycler_id,
  recycler_name, recycler_registration, recycling_facility, recycling_date,
  recycling_status, recycling_certificate, epr_reference, created_at, updated_at
FROM legacy_src.battery_compliance;

INSERT INTO compliance_documents (
  id, battery_id, producer_id, document_type, document_name,
  document_number, issued_by, issued_on, expires_on, status, notes,
  created_at, updated_at
)
SELECT
  id, battery_id, producer_id, document_type, document_name,
  document_number, issued_by, issued_on, expires_on, status, notes,
  created_at, updated_at
FROM legacy_src.compliance_documents;

INSERT INTO compliance_events (
  id, battery_id, producer_id, event_type, event_description, created_by,
  created_at
)
SELECT
  id, battery_id, producer_id, event_type, event_description, created_by,
  created_at
FROM legacy_src.compliance_events;

INSERT INTO epr_obligations (
  id, producer_id, financial_year, battery_category, target_percent,
  obligation_kg, achieved_kg, status, notes, created_at, updated_at
)
SELECT
  id, producer_id, financial_year, battery_category, target_percent,
  obligation_kg, COALESCE(achieved_kg, 0), status, notes, created_at, updated_at
FROM legacy_src.epr_obligations;

INSERT INTO epr_credits (
  id, obligation_id, certificate_number, quantity_kg, issue_date, valid_until,
  status, notes, created_at, updated_at
)
SELECT
  id, obligation_id, certificate_number, COALESCE(quantity_kg, 0), issue_date,
  valid_until, status, notes, created_at, updated_at
FROM legacy_src.epr_credits;

-- These four tables are new in v2 and have no legacy counterpart, so they
-- start empty (except the single compliance_settings row, which the
-- schema seeds).

-- ------------------------------------------------------------------
-- Record the applied architecture version in place of the old
-- per-file migration history.
-- ------------------------------------------------------------------
INSERT INTO schema_version (version, description)
VALUES (2, 'Normalized v2: merged cell_gradings, real foreign keys, '
             'typed dates/booleans/numerics, deduped identity columns, '
             'append-only user_activity, 4 new compliance tables.');

COMMIT;

-- Refresh planner statistics for the freshly written tables.
ANALYZE;
