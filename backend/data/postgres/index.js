/* ============================================================
   POSTGRESQL REPOSITORY
   PostgreSQL-backed implementation of the same store interface
   as backend/data/store.js. Controllers import the facade
   (backend/data/index.js) and call exactly the same methods, so
   switching DATA_SOURCE=mock → postgres is a config change.

   Schema: backend/sql/schema.sql  (applied via psql / docker).
   Driver: pg (lazy-loaded by the data-source facade).
============================================================ */

/* ---------- Row mappers (snake_case → camelCase) ---------- */

import bcrypt from "bcryptjs";
import {
  seedBatteries,
  seedServices,
  seedUserProfile,
  seedAdminUsers,
  seedRegularUsers,
  seedServicePersons,
  seedEmployeeUsers,
} from "../seedData.js";
import { assertServiceIntegrity } from "../../utils/serviceValidation.js";
import { buildPagination } from "../../utils/pagination.js";

const mapUserRow = (row) =>
  row
    ? {
        id: row.id,
        name: row.name,
        username: row.username || "",
        fullName: row.full_name || "",
        email: row.email,
        password: row.password_hash,
        role: row.role,
        servicePersonId: row.service_person_id || null,
        googleId: row.google_id || null,
        authProvider: row.auth_provider || "local",
        avatar: row.avatar || "",
        resetTokenExpiresAt: row.reset_token_expires_at || null,
        createdAt: row.created_at,
      }
    : null;

/* Derive the legacy-friendly username and full_name columns for every user
   row the app creates. username prefers an explicit value, then the email
   local-part, then the name; full_name mirrors the display name. */
const toUsername = (userData) => {
  if (userData.username) return String(userData.username);
  const fromEmail = String(userData.email || "").split("@")[0]?.trim();
  if (fromEmail) return fromEmail;
  const fromName = String(userData.name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]/g, "");
  return fromName || String(userData.id || "user");
};

const toFullName = (userData) => userData.fullName || userData.name || "";

const mapServicePersonRow = (row) =>
  row
    ? {
        id: row.id,
        technicianId: row.technician_id,
        name: row.name,
        email: row.email,
        phone: row.phone || "",
        certification: row.certification || "",
        specializations: row.specializations || [],
        specialization: row.specialization || "",
        status: row.status,
        assignedServices: row.assigned_services || [],
        createdAt: row.created_at,
      }
    : null;

const mapBatteryRow = (row) =>
  row
    ? {
        id: row.battery_id ?? row.id,
        ownerId: row.owner_id,
        barcode: row.barcode,
        qrCode: row.qr_code,
        modalId: row.modal_id,
        hangStatus: row.hang_status,
        overallStatus: row.overall_status,
        name: row.name,
        modelName: row.model_name,
        model: row.model,
        type: row.type,
        manufacturer: row.manufacturer,
        serialNumber: row.serial_number,
        chemistry: row.chemistry,
        capacityKwh: row.capacity_kwh,
        capacity: row.capacity,
        nominalVoltage: row.nominal_voltage,
        voltage: row.voltage,
        weightKg: row.weight_kg,
        dimensionsMm: row.dimensions_mm,
        manufactureDate: row.manufacture_date,
        assemblyLocation: row.assembly_location,
        location: row.location,
        cells: row.cells,
        stateOfHealth: row.state_of_health ?? row.__state_of_health,
        stateOfCharge: row.state_of_charge,
        cycleCount: row.cycle_count,
        maxRatedCycles: row.max_rated_cycles,
        internalResistanceMOhms: row.internal_resistance_mohms ?? row.__pdi_resistance_mohms,
        operatingTempC: row.operating_temp_c,
        carbonFootprintKgPerKwh: row.carbon_footprint_kg_per_kwh,
        recycledContent: row.recycled_content || {},
        warranty: row.warranty || {},
        complianceStandards: row.compliance_standards || [],
        dismantlingManual: row.dismantling_manual,
        healthHistory: row.health_history || [],
        packTestingReport: row.__pack_testing || undefined,
        pdiReport: row.__pdi_report || undefined,
        dispatchRecord: row.__dispatch_record || undefined,
        bmsId: row.__bms?.bms_id || undefined,
        cellStats: row.__cell_stats || undefined,
        createdAt: row.created_at,
      }
    : null;

const mapTelemetryRow = (row) =>
  row
    ? {
        id: row.id,
        batteryId: row.battery_id,
        voltage: row.voltage,
        current: row.current,
        temperatureC: row.temperature_c,
        soc: row.soc,
        soh: row.soh,
        cycleCount: row.cycle_count,
        chargingStatus: row.charging_status,
        faultStatus: row.fault_status,
        source: row.source,
        recordedAt: row.recorded_at instanceof Date ? row.recorded_at.toISOString() : row.recorded_at,
      }
    : null;

const mapServiceRow = (row) =>
  row
    ? {
        id: row.id,
        ticketNumber: row.ticket_number,
        batteryId: row.battery_id,
        batteryName: row.battery_name,
        serviceType: row.service_type,
        center: row.center,
        scheduledDate: row.scheduled_date,
        scheduledTime: row.scheduled_time,
        mobileNumber: row.mobile_number || "",
        status: row.status,
        priority: row.priority,
        technician: row.technician || "",
        estimatedArrival: row.estimated_arrival,
        customerId: row.customer_id,
        assignedServicePersonId: row.assigned_service_person_id,
        adminApprovedAt: row.admin_approved_at,
        approvedBy: row.approved_by,
        notes: row.notes,
        cost: row.cost,
        history: row.history || [],
        createdAt: row.created_at,
      }
    : null;

const mapProfileRow = (row) =>
  row
    ? {
        id: row.user_id,
        name: row.name,
        title: row.title,
        email: row.email,
        phone: row.phone,
        location: row.location,
        memberSince: row.member_since,
        avatar: row.avatar,
        fleetType: row.fleet_type,
        totalCapacityKwh: row.total_capacity_kwh,
        euOperatorId: row.eu_operator_id,
        notificationSettings: row.notification_settings || {},
        activityLogs: row.activity_logs || [],
      }
    : null;

const toDateString = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const raw = String(value);
  const timeIndex = raw.indexOf("T");
  return timeIndex >= 0 ? raw.slice(0, timeIndex) : raw.slice(0, 10);
};

const mapServiceScheduleRow = (row) =>
  row
    ? {
        id: row.id,
        serviceId: row.service_id,
        scheduledDate: toDateString(row.scheduled_date),
        startTime: row.start_time,
        endTime: row.end_time,
        technicianId: row.technician_id,
        status: row.status,
        notes: row.notes || "",
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    : null;

const mapTechnicianAvailabilityRow = (row) =>
  row
    ? {
        id: row.id,
        servicePersonId: row.service_person_id,
        dayOfWeek: row.day_of_week,
        startTime: row.start_time,
        endTime: row.end_time,
        status: row.status,
        createdAt: row.created_at,
      }
    : null;

/* ---------- Create the store ---------- */

export const createPostgresStore = async ({
  databaseUrl,
  legacySchema = "",
  allowReset = false,
}) => {
  if (!databaseUrl) {
    throw new Error("createPostgresStore requires a databaseUrl");
  }

  let pg;
  try {
    pg = await import("pg");
  } catch (error) {
    throw new Error(
      `The "pg" package is required for postgres mode. Install it with: npm install pg · ${error.message}`
    );
  }

  const pool = new pg.Pool({ connectionString: databaseUrl });

  /* Legacy production tables may live in a non-public schema (e.g. the
     old maxspace_pro mirror). legacySchema lets callers point the
     production-data queries at that schema; on maxvolt_prod those tables
     are in `public`, so the prefix is empty. */
  const legacyTable = (table) => (legacySchema ? `${legacySchema}.${table}` : table);

  /* The legacy production schema keys batteries by `battery_id` while an
     app-shaped schema keys them by `id`. Detect the shape once at startup
     and adapt the battery SQL accordingly. */
  let hasBatteryIdColumn = false;
  let hasModelsTable = false;
  try {
    const { rows } = await pool.query(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_name = 'batteries' AND column_name = 'battery_id'
       ) AS has_battery_id,
       EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = ANY (ARRAY['public', 'maxspace_pro'])
           AND table_name = 'battery_models'
       ) AS has_models`
    );
    hasBatteryIdColumn = Boolean(rows[0] && rows[0].has_battery_id);
    hasModelsTable = Boolean(rows[0] && rows[0].has_models);
  } catch {
    // Connection/permission problem — fall back to the app-shaped column.
  }
  const batteryKey = hasBatteryIdColumn ? "battery_id" : "id";

  /* ---------- Production-data enrichment (maxvolt_prod) ----------
     The legacy flat `batteries` row has no weight/manufacturer/SoH columns,
     but the genuine values DO exist in the per-battery child tables (PDI,
     pack testing, dispatch, BMS, cells). These helpers pull the latest real
     record per battery so lists/detail can show them instead of blanks.
     Everything returned is a real stored value or a straight arithmetic
     derivation (SoH = measured ÷ rated capacity from the pack test) — never
     fabricated. Missing tables/rows are ignored. */

  const parseRatedAh = (spec) => {
    if (!spec) return null;
    const m = String(spec).match(/(\d+(?:\.\d+)?)\s*[Aa][Hh]?/);
    return m ? Number(m[1]) : null;
  };

  const deriveStateOfHealth = (pack) => {
    if (!pack) return null;
    const ratedAh = parseRatedAh(pack.specification);
    const measured =
      typeof pack.discharging_capacity === "number" && pack.discharging_capacity > 0
        ? pack.discharging_capacity
        : typeof pack.actual_cap === "number" && pack.actual_cap > 0
          ? pack.actual_cap
          : null;
    if (!ratedAh || !measured) return null;
    return Math.round((measured / ratedAh) * 10000) / 100;
  };

  const enrichBatteryRows = async (rows) => {
    if (!Array.isArray(rows) || !rows.length) return rows;
    const ids = rows.map((r) => String(r.battery_id ?? r.id).trim()).filter(Boolean);
    if (!ids.length) return rows;

    const byId = new Map();
    const attach = (id, key, value) => {
      if (!byId.has(id)) byId.set(id, {});
      byId.get(id)[key] = value;
    };
    const run = async (sql, params) => {
      try {
        const { rows: out } = await pool.query(sql, params);
        return out;
      } catch {
        return [];
      }
    };

    const pdi = await run(
      `SELECT DISTINCT ON (battery_id) battery_id, test_time, voltage_v, resistance_m_ohm, test_result
       FROM ${legacyTable("pdi_reports")}
       WHERE battery_id = ANY($1) ORDER BY battery_id, test_time DESC`,
      [ids]
    );
    for (const r of pdi) attach(r.battery_id, "pdi", r);

    const pack = await run(
      `SELECT DISTINCT ON (battery_id) battery_id, test_date, specification, cell_type, actual_cap,
              ocv_voltage, discharging_capacity, capacity_result, final_voltage, final_result, soc_result
       FROM ${legacyTable("pack_testing_reports")}
       WHERE battery_id = ANY($1) ORDER BY battery_id, test_date DESC`,
      [ids]
    );
    for (const r of pack) attach(r.battery_id, "pack", r);

    const dispatch = await run(
      `SELECT DISTINCT ON (battery_id) battery_id, customer_name, invoice_id, invoice_date, dispatch_timestamp
       FROM ${legacyTable("dispatch_records")}
       WHERE battery_id = ANY($1) ORDER BY battery_id, dispatch_timestamp DESC`,
      [ids]
    );
    for (const r of dispatch) attach(r.battery_id, "dispatch", r);

    const bms = await run(
      `SELECT DISTINCT ON (battery_id) battery_id, bms_id, is_used, added_at
       FROM ${legacyTable("bms_inventory")}
       WHERE battery_id = ANY($1) ORDER BY battery_id, added_at DESC`,
      [ids]
    );
    for (const r of bms) attach(r.battery_id, "bms", r);

    const cells = await run(
      `SELECT m.battery_id,
              count(*)::int AS cell_count,
              count(*) FILTER (WHERE c.status = 'pass')::int AS pass_count,
              count(*) FILTER (WHERE c.status IS DISTINCT FROM 'pass')::int AS fail_count
       FROM ${legacyTable("battery_cell_mapping")} m
       LEFT JOIN ${legacyTable("cells")} c ON c.cell_id = m.cell_id
       WHERE m.battery_id = ANY($1)
       GROUP BY m.battery_id`,
      [ids]
    );
    for (const r of cells) attach(r.battery_id, "cells", r);

    return rows.map((r) => {
      const id = String(r.battery_id ?? r.id).trim();
      const e = byId.get(id);
      if (!e) return r;
      return {
        ...r,
        __pack_testing: e.pack || null,
        __pdi_report: e.pdi || null,
        __dispatch_record: e.dispatch || null,
        __bms: e.bms || null,
        __cell_stats: e.cells || null,
        __state_of_health: deriveStateOfHealth(e.pack || null),
        __pdi_resistance_mohms: e.pdi && typeof e.pdi.resistance_m_ohm === "number" ? e.pdi.resistance_m_ohm : null,
      };
    });
  };

  /* Hash a password unless it is already a bcrypt hash (e.g. signup /
     createTechnician pre-hash, or a re-seed of already-hashed data). */
  const hashPassword = (password) => {
    const raw = String(password || "");
    return /^\$2[aby]\$/.test(raw) ? raw : bcrypt.hash(raw, 10);
  };

  const store = {
    /* ---------- Connection lifecycle ---------- */
    async ping() {
      const { rows } = await pool.query("SELECT NOW() AS now");
      return rows[0];
    },

    async close() {
      await pool.end();
    },

    async reset() {
      // Re-seed from the same dataset the mock store uses so both data
      // sources stay identical (see backend/data/seedData.js).
      if (!allowReset) {
        throw Object.assign(
          new Error(
            "Database reset is disabled on this database (ALLOW_DB_RESET is not set). Refusing to truncate production data."
          ),
          { statusCode: 403 }
        );
      }
      await pool.query("BEGIN");
      try {
        await pool.query(
          'TRUNCATE TABLE services, batteries, battery_telemetry, profiles, users, service_persons RESTART IDENTITY CASCADE'
        );
        // Insert order respects the FK graph added by migration 001:
        // service_persons → users → batteries → services → profiles
        // (batteries.owner_id → users.id; users.service_person_id →
        // service_persons.id; services reference all three).
        for (const sp of seedServicePersons) await store.createServicePerson(sp);
        for (const u of [...seedAdminUsers, ...seedRegularUsers, ...seedEmployeeUsers]) {
          await store.createUser(u);
        }
        for (const b of seedBatteries) await store.createBattery(b);
        for (const s of seedServices) await store.createService(s);
        await store.updateProfile(seedUserProfile.id, seedUserProfile);
        await pool.query("COMMIT");
      } catch (error) {
        await pool.query("ROLLBACK");
        throw error;
      }
      return { message: "Sample data restored" };
    },

    /* ---------- Users ---------- */
    async getAllUsers() {
      const { rows } = await pool.query("SELECT * FROM users ORDER BY created_at");
      return rows.map(mapUserRow);
    },

    async getUserById(id) {
      const { rows } = await pool.query("SELECT * FROM users WHERE id = $1 LIMIT 1", [id]);
      return mapUserRow(rows[0]);
    },

    async getUserByEmail(email) {
      const { rows } = await pool.query(
        "SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1",
        [String(email || "").trim()]
      );
      return mapUserRow(rows[0]);
    },

    async getUserByGoogleId(googleId) {
      if (!googleId) return null;
      const { rows } = await pool.query(
        "SELECT * FROM users WHERE google_id = $1 LIMIT 1",
        [String(googleId)]
      );
      return mapUserRow(rows[0]);
    },

    async setPasswordResetToken(userId, tokenHash, expiresAt) {
      await pool.query(
        `UPDATE users SET reset_token_hash = $2, reset_token_expires_at = $3 WHERE id = $1`,
        [userId, tokenHash, expiresAt]
      );
    },

    async getUserByPasswordResetToken(tokenHash) {
      const { rows } = await pool.query(
        "SELECT * FROM users WHERE reset_token_hash = $1 LIMIT 1",
        [tokenHash]
      );
      return mapUserRow(rows[0]);
    },

    async clearPasswordResetToken(userId) {
      await pool.query(
        `UPDATE users SET reset_token_hash = NULL, reset_token_expires_at = NULL WHERE id = $1`,
        [userId]
      );
    },

    async createUser(userData) {
      const passwordHash = await hashPassword(userData.password);
      const { rows } = await pool.query(
        `INSERT INTO users (id, name, username, full_name, email, password_hash, role, service_person_id, google_id, auth_provider, avatar, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          userData.id,
          userData.name,
          toUsername(userData),
          toFullName(userData),
          userData.email,
          passwordHash,
          userData.role,
          userData.servicePersonId || null,
          userData.googleId || null,
          userData.authProvider || "local",
          userData.avatar || "",
          userData.createdAt,
        ]
      );
      return mapUserRow(rows[0]);
    },

    async updateUser(id, fields) {
      const current = await store.getUserById(id);
      if (!current) return null;
      const next = { ...current, ...fields };
      const passwordHash = await hashPassword(next.password);
      const { rows } = await pool.query(
        `UPDATE users
         SET name = $2, username = $3, full_name = $4, email = $5, password_hash = $6,
             role = $7, service_person_id = $8, google_id = $9, auth_provider = $10, avatar = $11
         WHERE id = $1
         RETURNING *`,
        [
          id,
          next.name,
          toUsername(next),
          toFullName(next),
          next.email,
          passwordHash,
          next.role,
          next.servicePersonId || null,
          next.googleId || null,
          next.authProvider || "local",
          next.avatar || "",
        ]
      );
      return mapUserRow(rows[0]);
    },

    async getCustomers() {
      const { rows } = await pool.query(
        "SELECT * FROM users WHERE role = 'USER' ORDER BY created_at"
      );
      return rows.map(mapUserRow);
    },

    async getUsersByIds(ids = []) {
      const clean = (ids || []).filter(Boolean);
      if (!clean.length) return [];
      const { rows } = await pool.query(
        `SELECT * FROM users WHERE id = ANY($1)`,
        [clean]
      );
      return rows.map(mapUserRow);
    },

    async getProfilesByIds(userIds = []) {
      const clean = (userIds || []).filter(Boolean);
      if (!clean.length) return [];
      const { rows } = await pool.query(
        `SELECT * FROM profiles WHERE user_id = ANY($1)`,
        [clean]
      );
      return rows.map(mapProfileRow);
    },

    /* ---------- Batteries ---------- */
    async getAllBatteries(ownerId = null) {
      const { rows } = await pool.query(
        `SELECT * FROM batteries ${ownerId ? "WHERE owner_id = $1" : ""} ORDER BY created_at`,
        ownerId ? [ownerId] : []
      );
      return (await enrichBatteryRows(rows)).map(mapBatteryRow);
    },

    async getBatteryById(id, ownerId = null) {
      const { rows } = await pool.query(
        `SELECT * FROM batteries WHERE ${batteryKey} = $1 ${ownerId ? "AND owner_id = $2" : ""} LIMIT 1`,
        ownerId ? [id, ownerId] : [id]
      );
      return mapBatteryRow(rows[0]);
    },

    async getBatteriesByIds(ids = []) {
      const clean = (ids || []).filter(Boolean);
      if (!clean.length) return [];
      const { rows } = await pool.query(
        `SELECT * FROM batteries WHERE ${batteryKey} = ANY($1)`,
        [clean]
      );
      return (await enrichBatteryRows(rows)).map(mapBatteryRow);
    },

    async findBatteryByBarcodeOrSerial(code, ownerId = null) {
      const clean = String(code || "").trim().toUpperCase();
      if (!clean) return null;
      const stripped = clean.replace(/^BATT-/, "");
      const prefixed = clean.startsWith("BATT-") ? clean : `BATT-${clean}`;
      const { rows } = await pool.query(
        `SELECT * FROM batteries
         WHERE (
           UPPER(barcode) = $1
           OR UPPER(serial_number) = $1
           OR UPPER(${batteryKey}) = $1
           OR UPPER(${batteryKey}) = $2
           OR UPPER(modal_id) = $1
           OR UPPER(modal_id) = $3
           OR UPPER(serial_number) = $3
           OR barcode LIKE '%' || $1 || '%'
         )
         ${ownerId ? "AND owner_id = $4" : ""}
         LIMIT 1`,
        ownerId ? [clean, prefixed, stripped, ownerId] : [clean, prefixed, stripped]
      );
      return mapBatteryRow(rows[0]);
    },

    async getBatteryRelatedDetails(battery) {
      if (!battery) return {};

      let ownership = null;
      if (battery.ownerId) {
        try {
          const { rows: uRows } = await pool.query(
            `SELECT u.id, u.name, u.email, u.role, p.title, p.fleet_type, p.location, p.eu_operator_id
             FROM users u
             LEFT JOIN profiles p ON p.user_id = u.id
             WHERE u.id = $1 LIMIT 1`,
            [battery.ownerId]
          );
          if (uRows[0]) {
            ownership = {
              ownerId: uRows[0].id,
              ownerName: uRows[0].name,
              ownerEmail: uRows[0].email,
              role: uRows[0].role,
              fleetType: uRows[0].fleet_type || null,
              euOperatorId: uRows[0].eu_operator_id || null,
              location: uRows[0].location || null,
            };
          }
        } catch {
          // Ignore ownership lookup failure
        }
      }

      const proId = String(
        battery.modalId || battery.serialNumber || (battery.id ? battery.id.replace(/^batt-/, "") : "")
      ).trim();
      let modelSpec = null;
      let bmsInfo = null;
      let cellsList = [];
      let packTesting = null;
      let pdiReport = null;
      let dispatchRecord = null;
      let laserWelding = null;

      if (proId) {
        try {
          // 1. Model & specs
          const { rows: mRows } = await pool.query(
            `SELECT m.model_id, m.category, m.series_count, m.parallel_count, m.cell_type, m.bms_model, m.welding_type
             FROM ${legacyTable("battery_models")} m
             JOIN ${legacyTable("batteries")} b ON b.model_id = m.model_id
             WHERE b.battery_id = $1 LIMIT 1`,
            [proId]
          );
          modelSpec = mRows[0] || null;

          // 2. BMS inventory
          const { rows: bmsRows } = await pool.query(
            `SELECT bms_id, is_used, added_at FROM ${legacyTable("bms_inventory")} WHERE battery_id = $1 LIMIT 1`,
            [proId]
          );
          bmsInfo = bmsRows[0] || null;

          // 3. Cell mapping & cells
          const { rows: cRows } = await pool.query(
            `SELECT m.cell_id, m.assigned_at, c.status, c.discharging_capacity_mah, c.ir_value_m_ohm, c.sorting_voltage
             FROM ${legacyTable("battery_cell_mapping")} m
             LEFT JOIN ${legacyTable("cells")} c ON c.cell_id = m.cell_id
             WHERE m.battery_id = $1
             ORDER BY m.assigned_at ASC`,
            [proId]
          );
          cellsList = cRows.map((r) => ({
            cellId: r.cell_id,
            status: r.status,
            dischargingCapacityMah: r.discharging_capacity_mah,
            irValueMOhms: r.ir_value_m_ohm,
            sortingVoltage: r.sorting_voltage,
            assignedAt: r.assigned_at,
          }));

          // 4. Pack testing report
          const { rows: ptRows } = await pool.query(
            `SELECT test_date, specification, cell_type, actual_cap, ocv_voltage, upper_cutoff, lower_cutoff,
                    discharging_capacity, capacity_result, idle_difference, idle_diff_res, final_voltage, final_result,
                    soc_result, number_of_series, number_of_parallel
             FROM ${legacyTable("pack_testing_reports")}
             WHERE battery_id = $1
             ORDER BY test_date DESC LIMIT 1`,
            [proId]
          );
          packTesting = ptRows[0] || null;

          // 5. PDI report
          const { rows: pdiRows } = await pool.query(
            `SELECT test_time, voltage_v, resistance_m_ohm, cont_charging_current, cont_charging_voltage,
                    cont_discharging_current, cont_discharging_voltage, short_circuit_prot_time_us, test_result
             FROM ${legacyTable("pdi_reports")}
             WHERE battery_id = $1
             ORDER BY test_time DESC LIMIT 1`,
            [proId]
          );
          pdiReport = pdiRows[0] || null;

          // 6. Dispatch record
          const { rows: dRows } = await pool.query(
            `SELECT customer_name, invoice_id, invoice_date, dispatch_timestamp
             FROM ${legacyTable("dispatch_records")}
             WHERE battery_id = $1
             ORDER BY dispatch_timestamp DESC LIMIT 1`,
            [proId]
          );
          dispatchRecord = dRows[0] || null;

          // 7. Laser welding
          const { rows: lwRows } = await pool.query(
            `SELECT initial_speed, max_speed, power_mode, dac_power, scan_speed, "timestamp"
             FROM ${legacyTable("laser_welding_data")}
             WHERE battery_id = $1
             ORDER BY "timestamp" DESC LIMIT 1`,
            [proId]
          );
          laserWelding = lwRows[0] || null;
        } catch {
          // Ignore schema read error
        }
      }

      const derivedSoh = deriveStateOfHealth(packTesting);
      const pdiResistance =
        pdiReport && typeof pdiReport.resistance_m_ohm === "number"
          ? pdiReport.resistance_m_ohm
          : null;

      return {
        ownership,
        bmsModel: modelSpec?.bms_model || null,
        bmsId: bmsInfo?.bms_id || null,
        weldingType: modelSpec?.welding_type || null,
        seriesCount: modelSpec?.series_count || null,
        parallelCount: modelSpec?.parallel_count || null,
        installationDate: dispatchRecord?.invoice_date || null,
        dispatchCustomer: dispatchRecord?.customer_name || null,
        cellsDetail: cellsList,
        cellsCount: cellsList.length,
        cellsPassCount: cellsList.filter((c) => String(c.status || "").toLowerCase() === "pass").length,
        packTestingReport: packTesting,
        pdiReport,
        dispatchRecord,
        laserWeldingData: laserWelding,
        stateOfHealth: battery.stateOfHealth ?? derivedSoh,
        internalResistanceMOhms: battery.internalResistanceMOhms ?? pdiResistance,
      };
    },

    async createBattery(battery) {
      if (!hasBatteryIdColumn) {
        // App-shaped schema: batteries are keyed by `id` with no required
        // model reference — insert exactly as the app defined originally.
        const { rows } = await pool.query(
          `INSERT INTO batteries (
             id, owner_id, barcode, qr_code, modal_id, hang_status, overall_status,
             name, model_name, model, type, manufacturer,
             serial_number, chemistry, capacity_kwh, capacity, nominal_voltage, voltage,
             weight_kg, dimensions_mm, manufacture_date, assembly_location, location,
             cells, state_of_health, state_of_charge, cycle_count, max_rated_cycles,
             internal_resistance_mohms, operating_temp_c, carbon_footprint_kg_per_kwh,
             recycled_content, warranty, compliance_standards, dismantling_manual, health_history
           ) VALUES (
             $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
             $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32,
             $33, $34, $35, $36
           )
           RETURNING *`,
          [
            battery.id,
            battery.ownerId || null,
            battery.barcode,
            battery.qrCode || null,
            battery.modalId || null,
            battery.hangStatus || null,
            battery.overallStatus || null,
            battery.name,
            battery.modelName,
            battery.model,
            battery.type,
            battery.manufacturer,
            battery.serialNumber,
            battery.chemistry,
            battery.capacityKwh,
            battery.capacity,
            battery.nominalVoltage,
            battery.voltage,
            battery.weightKg,
            battery.dimensionsMm,
            battery.manufactureDate,
            battery.assemblyLocation,
            battery.location,
            battery.cells,
            battery.stateOfHealth,
            battery.stateOfCharge,
            battery.cycleCount,
            battery.maxRatedCycles,
            battery.internalResistanceMOhms,
            battery.operatingTempC,
            battery.carbonFootprintKgPerKwh,
            JSON.stringify(battery.recycledContent || {}),
            JSON.stringify(battery.warranty || {}),
            JSON.stringify(battery.complianceStandards || []),
            battery.dismantlingManual,
            JSON.stringify(battery.healthHistory || []),
          ]
        );
        return mapBatteryRow(rows[0]);
      }

      // maxvolt_prod shape: batteries.keyed by battery_id with a NOT NULL
      // model_id referencing battery_models. Resolve the model first so we
      // either insert a valid production battery or fail cleanly (400).
      let modelId = battery.modelId || null;
      if (!modelId && hasModelsTable) {
        const modelKey = String(
          battery.model || battery.name || battery.modelName || ""
        ).trim();
        if (modelKey) {
          const { rows: modelRows } = await pool.query(
            `SELECT model_id FROM ${legacyTable("battery_models")}
             WHERE LOWER(model_id) = LOWER($1) LIMIT 1`,
            [modelKey]
          );
          modelId = modelRows[0]?.model_id || null;
        }
        if (!modelId) {
          throw Object.assign(
            new Error(
              `Battery model "${modelKey}" is not registered in battery_models. ` +
                "Only models registered in the production database can be minted here."
            ),
            { statusCode: 400 }
          );
        }
      }

      // The battery identity: prefer the QR modal id, then the serial,
      // then the barcode — stripping only the lowercase legacy `batt-`
      // prefix that the older app generated (uppercase BATT- barcodes
      // such as BATT-GEN-… are kept intact).
      const rawId = String(
        battery.modalId || battery.serialNumber || battery.barcode || battery.id || ""
      ).trim();
      const batteryId = rawId.startsWith("batt-") ? rawId.slice(5) : rawId;
      if (!batteryId) {
        throw Object.assign(
          new Error(
            "A battery identifier (modal id, serial number or barcode) is required to register a battery in the production database."
          ),
          { statusCode: 400 }
        );
      }

      const { rows } = await pool.query(
        `INSERT INTO batteries (
           battery_id, model_id, owner_id, barcode, qr_code, modal_id, hang_status, overall_status,
           name, model_name, model, type, manufacturer,
           serial_number, chemistry, capacity_kwh, capacity, nominal_voltage, voltage,
           weight_kg, dimensions_mm, manufacture_date, assembly_location, location,
           cells, state_of_health, state_of_charge, cycle_count, max_rated_cycles,
           internal_resistance_mohms, operating_temp_c, carbon_footprint_kg_per_kwh,
           recycled_content, warranty, compliance_standards, dismantling_manual, health_history
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
           $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32,
           $33, $34, $35, $36, $37
         )
         RETURNING *`,
        [
          batteryId,
          modelId,
          battery.ownerId || null,
          battery.barcode,
          battery.qrCode || null,
          battery.modalId || null,
          battery.hangStatus || null,
          battery.overallStatus || null,
          battery.name,
          battery.modelName,
          battery.model,
          battery.type,
          battery.manufacturer,
          battery.serialNumber,
          battery.chemistry,
          battery.capacityKwh,
          battery.capacity,
          battery.nominalVoltage,
          battery.voltage,
          battery.weightKg,
          battery.dimensionsMm,
          battery.manufactureDate,
          battery.assemblyLocation,
          battery.location,
          battery.cells,
          battery.stateOfHealth,
          battery.stateOfCharge,
          battery.cycleCount,
          battery.maxRatedCycles,
          battery.internalResistanceMOhms,
          battery.operatingTempC,
          battery.carbonFootprintKgPerKwh,
          JSON.stringify(battery.recycledContent || {}),
          JSON.stringify(battery.warranty || {}),
          JSON.stringify(battery.complianceStandards || []),
          battery.dismantlingManual,
          JSON.stringify(battery.healthHistory || []),
        ]
      );
      return mapBatteryRow(rows[0]);
    },

    async claimBattery(id, ownerId) {
      const { rows } = await pool.query(
        `UPDATE batteries SET owner_id = $2 WHERE ${batteryKey} = $1 RETURNING *`,
        [id, ownerId]
      );
      return rows.length > 0 ? mapBatteryRow(rows[0]) : null;
    },

    async updateBattery(id, fields) {
      const current = await store.getBatteryById(id);
      if (!current) return null;
      const next = { ...current, ...fields };
      const { rows } = await pool.query(
        `UPDATE batteries SET
           barcode = $2, qr_code = $3, modal_id = $4, hang_status = $5, overall_status = $6,
           name = $7, model_name = $8, model = $9,
           type = $10, manufacturer = $11, serial_number = $12, chemistry = $13,
           capacity_kwh = $14, capacity = $15, nominal_voltage = $16, voltage = $17,
           weight_kg = $18, dimensions_mm = $19, manufacture_date = $20,
           assembly_location = $21, location = $22, cells = $23,
           state_of_health = $24, state_of_charge = $25, cycle_count = $26,
           max_rated_cycles = $27, internal_resistance_mohms = $28,
           operating_temp_c = $29, carbon_footprint_kg_per_kwh = $30,
           recycled_content = $31, warranty = $32, compliance_standards = $33,
           dismantling_manual = $34, health_history = $35
         WHERE ${batteryKey} = $1
         RETURNING *`,
        [
          id,
          next.barcode,
          next.qrCode || null,
          next.modalId || null,
          next.hangStatus || null,
          next.overallStatus || null,
          next.name,
          next.modelName,
          next.model,
          next.type,
          next.manufacturer,
          next.serialNumber,
          next.chemistry,
          next.capacityKwh,
          next.capacity,
          next.nominalVoltage,
          next.voltage,
          next.weightKg,
          next.dimensionsMm,
          next.manufactureDate,
          next.assemblyLocation,
          next.location,
          next.cells,
          next.stateOfHealth,
          next.stateOfCharge,
          next.cycleCount,
          next.maxRatedCycles,
          next.internalResistanceMOhms,
          next.operatingTempC,
          next.carbonFootprintKgPerKwh,
          JSON.stringify(next.recycledContent || {}),
          JSON.stringify(next.warranty || {}),
          JSON.stringify(next.complianceStandards || []),
          next.dismantlingManual,
          JSON.stringify(next.healthHistory || []),
        ]
      );
      return mapBatteryRow(rows[0]);
    },

    async deleteBattery(id) {
      const { rows } = await pool.query(
        `DELETE FROM batteries WHERE ${batteryKey} = $1 RETURNING *`,
        [id]
      );
      return rows.length > 0 ? mapBatteryRow(rows[0]) : false;
    },

    /* ---------- Services ---------- */
    async getAllServices() {
      const { rows } = await pool.query("SELECT * FROM services ORDER BY created_at");
      return rows.map(mapServiceRow);
    },

    async getServicesByCustomerId(customerId) {
      if (!customerId) return [];
      const { rows } = await pool.query(
        "SELECT * FROM services WHERE customer_id = $1 ORDER BY created_at",
        [customerId]
      );
      return rows.map(mapServiceRow);
    },

    async getServicesByBatteryId(batteryId) {
      const { rows } = await pool.query(
        "SELECT * FROM services WHERE battery_id = $1 ORDER BY scheduled_date ASC",
        [batteryId]
      );
      return rows.map(mapServiceRow);
    },

    async getServiceById(id) {
      const { rows } = await pool.query("SELECT * FROM services WHERE id = $1 LIMIT 1", [id]);
      return mapServiceRow(rows[0]);
    },

    async createService(service) {
      assertServiceIntegrity(service);
      const { rows } = await pool.query(
        `INSERT INTO services (
           id, ticket_number, battery_id, battery_name, service_type, center,
           scheduled_date, scheduled_time, mobile_number, status, priority,
           technician, estimated_arrival, customer_id, assigned_service_person_id,
           admin_approved_at, approved_by, notes, cost, history, created_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
         )
         RETURNING *`,
        [
          service.id,
          service.ticketNumber,
          service.batteryId,
          service.batteryName || null,
          service.serviceType,
          service.center,
          service.scheduledDate,
          service.scheduledTime,
          service.mobileNumber || "",
          service.status,
          service.priority,
          service.technician || "",
          service.estimatedArrival || null,
          service.customerId || null,
          service.assignedServicePersonId || null,
          service.adminApprovedAt || null,
          service.approvedBy || null,
          service.notes || null,
          service.cost || null,
          JSON.stringify(service.history || []),
          service.createdAt,
        ]
      );
      return mapServiceRow(rows[0]);
    },

    async updateService(id, fields) {
      const current = await store.getServiceById(id);
      if (!current) return null;
      const next = { ...current, ...fields };
      assertServiceIntegrity(next);
      const { rows } = await pool.query(
        `UPDATE services SET
           ticket_number = $2, battery_id = $3, battery_name = $4, service_type = $5,
           center = $6, scheduled_date = $7, scheduled_time = $8, mobile_number = $9,
           status = $10, priority = $11, technician = $12, estimated_arrival = $13,
           customer_id = $14, assigned_service_person_id = $15,
           admin_approved_at = $16, approved_by = $17, notes = $18, cost = $19, history = $20
         WHERE id = $1
         RETURNING *`,
        [
          id,
          next.ticketNumber,
          next.batteryId,
          next.batteryName || null,
          next.serviceType,
          next.center,
          next.scheduledDate,
          next.scheduledTime,
          next.mobileNumber || "",
          next.status,
          next.priority,
          next.technician || "",
          next.estimatedArrival || null,
          next.customerId || null,
          next.assignedServicePersonId || null,
          next.adminApprovedAt || null,
          next.approvedBy || null,
          next.notes || null,
          next.cost || null,
          JSON.stringify(next.history || []),
        ]
      );
      return mapServiceRow(rows[0]);
    },

    async deleteService(id) {
      const { rows } = await pool.query("DELETE FROM services WHERE id = $1 RETURNING *", [id]);
      return rows.length > 0 ? mapServiceRow(rows[0]) : false;
    },

    /* ---------- Service persons ---------- */
    async getAllServicePersons() {
      const { rows } = await pool.query("SELECT * FROM service_persons ORDER BY created_at");
      return rows.map(mapServicePersonRow);
    },

    async getServicePersonById(id) {
      const { rows } = await pool.query("SELECT * FROM service_persons WHERE id = $1 LIMIT 1", [id]);
      return mapServicePersonRow(rows[0]);
    },

    async getServicePersonsByIds(ids = []) {
      const clean = (ids || []).filter(Boolean);
      if (!clean.length) return [];
      const { rows } = await pool.query(
        `SELECT * FROM service_persons WHERE id = ANY($1)`,
        [clean]
      );
      return rows.map(mapServicePersonRow);
    },

    async createServicePerson(person) {
      const { rows } = await pool.query(
        `INSERT INTO service_persons (
           id, technician_id, name, email, phone, certification, specializations,
           specialization, status, assigned_services, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          person.id,
          person.technicianId,
          person.name,
          person.email,
          person.phone || "",
          person.certification || "",
          JSON.stringify(person.specializations || []),
          person.specialization || "",
          person.status || "active",
          JSON.stringify(person.assignedServices || []),
          person.createdAt,
        ]
      );
      return mapServicePersonRow(rows[0]);
    },

    async updateServicePerson(id, fields) {
      const current = await store.getServicePersonById(id);
      if (!current) return null;
      const next = { ...current, ...fields };
      const { rows } = await pool.query(
        `UPDATE service_persons SET
           technician_id = $2, name = $3, email = $4, phone = $5, certification = $6,
           specializations = $7, specialization = $8, status = $9, assigned_services = $10
         WHERE id = $1
         RETURNING *`,
        [
          id,
          next.technicianId,
          next.name,
          next.email,
          next.phone || "",
          next.certification || "",
          JSON.stringify(next.specializations || []),
          next.specialization || "",
          next.status || "active",
          JSON.stringify(next.assignedServices || []),
        ]
      );
      return mapServicePersonRow(rows[0]);
    },

    /* ---------- Technicians ---------- */
    async getAllTechnicians() {
      return store.getAllServicePersons();
    },

    async getTechnicianById(id) {
      return store.getServicePersonById(id);
    },

    async getTechnicianByEmail(email) {
      const { rows } = await pool.query(
        "SELECT * FROM service_persons WHERE LOWER(email) = LOWER($1) LIMIT 1",
        [String(email || "").trim()]
      );
      return mapServicePersonRow(rows[0]);
    },

    async isTechnicianIdUnique(technicianId, excludeId = null) {
      const { rows } = await pool.query(
        `SELECT 1 FROM service_persons WHERE technician_id = $1 AND ($2::text IS NULL OR id <> $2) LIMIT 1`,
        [technicianId, excludeId]
      );
      return rows.length === 0;
    },

    async isPhoneUnique(phone, excludeId = null) {
      if (!phone) return true;
      const { rows } = await pool.query(
        `SELECT 1 FROM service_persons WHERE phone = $1 AND ($2::text IS NULL OR id <> $2) LIMIT 1`,
        [phone, excludeId]
      );
      return rows.length === 0;
    },

    async getEmployeeByServicePersonId(servicePersonId) {
      const { rows } = await pool.query(
        "SELECT * FROM users WHERE role = 'EMPLOYEE' AND service_person_id = $1 LIMIT 1",
        [servicePersonId]
      );
      return mapUserRow(rows[0]);
    },

    /* ---------- Profile ---------- */
    async getProfile(userId = null) {
      if (!userId) return null;
      const { rows } = await pool.query(
        "SELECT * FROM profiles WHERE user_id = $1 LIMIT 1",
        [userId]
      );
      return mapProfileRow(rows[0]);
    },

    async updateProfile(userId, fields = {}) {
      const current = (await store.getProfile(userId)) || {};
      const next = { ...current, ...fields };
      if (next.password) delete next.password;
      const { rows } = await pool.query(
        `INSERT INTO profiles (
           user_id, name, title, email, phone, location, member_since, avatar,
           fleet_type, total_capacity_kwh, eu_operator_id, notification_settings, activity_logs
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (user_id) DO UPDATE SET
           name = EXCLUDED.name, title = EXCLUDED.title, email = EXCLUDED.email,
           phone = EXCLUDED.phone, location = EXCLUDED.location,
           member_since = EXCLUDED.member_since, avatar = EXCLUDED.avatar,
           fleet_type = EXCLUDED.fleet_type, total_capacity_kwh = EXCLUDED.total_capacity_kwh,
           eu_operator_id = EXCLUDED.eu_operator_id,
           notification_settings = EXCLUDED.notification_settings,
           activity_logs = EXCLUDED.activity_logs
         RETURNING *`,
        [
          userId,
          next.name || null,
          next.title || null,
          next.email || null,
          next.phone || null,
          next.location || null,
          next.memberSince || null,
          next.avatar || null,
          next.fleetType || null,
          next.totalCapacityKwh ?? null,
          next.euOperatorId || null,
          JSON.stringify(next.notificationSettings || {}),
          JSON.stringify(next.activityLogs || []),
        ]
      );
      return mapProfileRow(rows[0]);
    },

    /* ---------- Service history ---------- */
    async addServiceHistory(serviceId, entry) {
      const service = await store.getServiceById(serviceId);
      if (!service) return null;
      const history = service.history || [];
      const nextHistory = [
        ...history,
        {
          id: `hist-${Date.now()}`,
          status: entry.status,
          action: entry.action,
          performedBy: entry.performedBy || "System",
          performedByName: entry.performedByName || "",
          notes: entry.notes || "",
          timestamp: new Date().toISOString(),
        },
      ];
      return store.updateService(serviceId, { history: nextHistory });
    },

    /* ---------- Activity logs ---------- */
    async logActivity(userId, action, details, type = "general") {
      const profile = (await store.getProfile(userId)) || { activityLogs: [] };
      const log = { id: `act-${Date.now()}`, action, details, timestamp: "Just now", type };
      const activityLogs = [log, ...(profile.activityLogs || [])].slice(0, 20);
      await store.updateProfile(userId, { activityLogs });
      return log;
    },

    /* ---------- Battery telemetry (IoT/BMS readings) ---------- */
    async addBatteryTelemetry(reading) {
      const { rows } = await pool.query(
        `INSERT INTO battery_telemetry
           (battery_id, voltage, current, temperature_c, soc, soh, cycle_count,
            charging_status, fault_status, source, recorded_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          reading.batteryId,
          reading.voltage ?? null,
          reading.current ?? null,
          reading.temperatureC ?? null,
          reading.soc ?? null,
          reading.soh ?? null,
          reading.cycleCount ?? null,
          reading.chargingStatus ?? null,
          reading.faultStatus ?? null,
          reading.source || "api",
          reading.recordedAt,
        ]
      );
      return mapTelemetryRow(rows[0]);
    },

    async getLatestBatteryTelemetry(batteryId) {
      const { rows } = await pool.query(
        `SELECT * FROM battery_telemetry WHERE battery_id = $1 ORDER BY recorded_at DESC, id DESC LIMIT 1`,
        [batteryId]
      );
      return mapTelemetryRow(rows[0]);
    },

    async getBatteryTelemetryHistory(batteryId, { limit = 100, from, to } = {}) {
      const params = [batteryId];
      const where = ["battery_id = $1"];
      if (from) {
        params.push(new Date(from).toISOString());
        where.push(`recorded_at >= $${params.length}`);
      }
      if (to) {
        params.push(new Date(to).toISOString());
        where.push(`recorded_at <= $${params.length}`);
      }
      const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));
      params.push(safeLimit);
      // Most recent `safeLimit` readings, returned oldest→newest so chart
      // consumers can append left-to-right without a reverse.
      const { rows } = await pool.query(
        `SELECT * FROM (
           SELECT * FROM battery_telemetry WHERE ${where.join(" AND ")}
           ORDER BY recorded_at DESC, id DESC LIMIT $${params.length}
         ) t ORDER BY recorded_at ASC, id ASC`,
        params
      );
      return rows.map(mapTelemetryRow);
    },

    /* ------------------------------------------------------------
       PAGINATED LISTINGS
       DB-level pagination: WHERE filters applied before LIMIT/OFFSET.
       Each returns { data, pagination } (see backend/utils/pagination.js).
    ------------------------------------------------------------ */

    async listBatteries({
      ownerId = null,
      page = 1,
      limit = 20,
      search = "",
      sort = "",
      order = "asc",
    } = {}) {
      const params = [];
      const where = [];
      if (ownerId) {
        params.push(ownerId);
        where.push(`owner_id = $${params.length}`);
      }
      const q = String(search || "").trim();
      if (q) {
        params.push(`%${q}%`);
        const i = params.length;
        where.push(
          `(${batteryKey} ILIKE $${i} OR barcode ILIKE $${i} OR serial_number ILIKE $${i} OR
            modal_id ILIKE $${i} OR name ILIKE $${i} OR model_name ILIKE $${i} OR
            chemistry ILIKE $${i} OR manufacturer ILIKE $${i})`
        );
      }
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

      const fieldMap = {
        createdAt: "created_at",
        name: "name",
        barcode: "barcode",
        serialNumber: "serial_number",
        stateOfHealth: "state_of_health",
        manufactureDate: "manufacture_date",
      };
      const orderCol = fieldMap[sort] || "created_at";
      const orderSql = order === "desc" ? "DESC" : "ASC";

      const { rows: [countRow] } = await pool.query(
        `SELECT count(*)::int AS total FROM batteries ${whereSql}`,
        params
      );
      const total = countRow.total;

      const dataParams = [...params, limit, (page - 1) * limit];
      const { rows } = await pool.query(
        `SELECT * FROM batteries ${whereSql} ORDER BY ${orderCol} ${orderSql} LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
        dataParams
      );

      return {
        data: (await enrichBatteryRows(rows)).map(mapBatteryRow),
        pagination: buildPagination(page, limit, total),
      };
    },

    async listServices({
      customerId = null,
      status = "",
      search = "",
      page = 1,
      limit = 20,
      sort = "",
      order = "asc",
    } = {}) {
      const params = [];
      const where = [];
      if (customerId) {
        params.push(customerId);
        where.push(`customer_id = $${params.length}`);
      }
      if (status) {
        params.push(status);
        where.push(`status = $${params.length}`);
      }
      const q = String(search || "").trim();
      if (q) {
        params.push(`%${q}%`);
        const i = params.length;
        where.push(
          `(id ILIKE $${i} OR ticket_number ILIKE $${i} OR battery_id ILIKE $${i} OR
            battery_name ILIKE $${i} OR service_type ILIKE $${i} OR center ILIKE $${i} OR status ILIKE $${i})`
        );
      }
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

      const fieldMap = {
        createdAt: "created_at",
        scheduledDate: "scheduled_date",
        status: "status",
        priority: "priority",
        ticketNumber: "ticket_number",
      };
      const orderCol = fieldMap[sort] || "created_at";
      const orderSql = order === "desc" ? "DESC" : "ASC";

      const { rows: [countRow] } = await pool.query(
        `SELECT count(*)::int AS total FROM services ${whereSql}`,
        params
      );
      const total = countRow.total;

      const dataParams = [...params, limit, (page - 1) * limit];
      const { rows } = await pool.query(
        `SELECT * FROM services ${whereSql} ORDER BY ${orderCol} ${orderSql} LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
        dataParams
      );

      return {
        data: rows.map(mapServiceRow),
        pagination: buildPagination(page, limit, total),
      };
    },

    async listServicePersons({
      status = "",
      search = "",
      page = 1,
      limit = 20,
      sort = "",
      order = "asc",
    } = {}) {
      const params = [];
      const where = [];
      if (status) {
        params.push(status);
        where.push(`status = $${params.length}`);
      }
      const q = String(search || "").trim();
      if (q) {
        params.push(`%${q}%`);
        const i = params.length;
        where.push(
          `(id ILIKE $${i} OR technician_id ILIKE $${i} OR name ILIKE $${i} OR
            email ILIKE $${i} OR specialization ILIKE $${i} OR certification ILIKE $${i})`
        );
      }
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

      const fieldMap = { createdAt: "created_at", name: "name", status: "status" };
      const orderCol = fieldMap[sort] || "created_at";
      const orderSql = order === "desc" ? "DESC" : "ASC";

      const { rows: [countRow] } = await pool.query(
        `SELECT count(*)::int AS total FROM service_persons ${whereSql}`,
        params
      );
      const total = countRow.total;

      const dataParams = [...params, limit, (page - 1) * limit];
      const { rows } = await pool.query(
        `SELECT * FROM service_persons ${whereSql} ORDER BY ${orderCol} ${orderSql} LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
        dataParams
      );

      return {
        data: rows.map(mapServicePersonRow),
        pagination: buildPagination(page, limit, total),
      };
    },

    async listCustomers({ search = "", page = 1, limit = 20, sort = "", order = "asc" } = {}) {
      const params = [];
      const where = ["role = 'USER'"];
      const q = String(search || "").trim();
      if (q) {
        params.push(`%${q}%`);
        where.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length})`);
      }
      const whereSql = `WHERE ${where.join(" AND ")}`;

      const fieldMap = { createdAt: "created_at", name: "name", email: "email" };
      const orderCol = fieldMap[sort] || "created_at";
      const orderSql = order === "desc" ? "DESC" : "ASC";

      const { rows: [countRow] } = await pool.query(
        `SELECT count(*)::int AS total FROM users ${whereSql}`,
        params
      );
      const total = countRow.total;

      const dataParams = [...params, limit, (page - 1) * limit];
      const { rows } = await pool.query(
        `SELECT * FROM users ${whereSql} ORDER BY ${orderCol} ${orderSql} LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
        dataParams
      );

      return {
        data: rows.map(mapUserRow),
        pagination: buildPagination(page, limit, total),
      };
    },

    /* ------------------------------------------------------------
       SERVICE SCHEDULES + TECHNICIAN AVAILABILITY (P2.1)
    ------------------------------------------------------------ */

    async getServiceSchedule(serviceId) {
      const { rows } = await pool.query(
        "SELECT * FROM service_schedules WHERE service_id = $1 LIMIT 1",
        [serviceId]
      );
      return mapServiceScheduleRow(rows[0]);
    },

    async getServiceScheduleByScheduleId(id) {
      const { rows } = await pool.query(
        "SELECT * FROM service_schedules WHERE id = $1 LIMIT 1",
        [id]
      );
      return mapServiceScheduleRow(rows[0]);
    },

    async createServiceSchedule(schedule) {
      const { rows } = await pool.query(
        `INSERT INTO service_schedules (
           id, service_id, scheduled_date, start_time, end_time,
           technician_id, status, notes, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          schedule.id || `sched-${Date.now()}`,
          schedule.serviceId,
          schedule.scheduledDate,
          schedule.startTime || null,
          schedule.endTime || null,
          schedule.technicianId || null,
          schedule.status || "Scheduled",
          schedule.notes || "",
          schedule.createdAt || new Date(),
          schedule.updatedAt || new Date(),
        ]
      );
      return mapServiceScheduleRow(rows[0]);
    },

    async updateServiceSchedule(id, fields) {
      const current = await (async () => {
        const { rows } = await pool.query(
          "SELECT * FROM service_schedules WHERE id = $1 LIMIT 1",
          [id]
        );
        return mapServiceScheduleRow(rows[0]);
      })();
      if (!current) return null;
      const next = { ...current, ...fields };
      const { rows } = await pool.query(
        `UPDATE service_schedules SET
           scheduled_date = $2, start_time = $3, end_time = $4,
           technician_id = $5, status = $6, notes = $7, updated_at = $8
         WHERE id = $1
         RETURNING *`,
        [
          id,
          next.scheduledDate,
          next.startTime || null,
          next.endTime || null,
          next.technicianId || null,
          next.status,
          next.notes || "",
          new Date(),
        ]
      );
      return mapServiceScheduleRow(rows[0]);
    },

    async deleteServiceSchedule(id) {
      const { rows } = await pool.query(
        "DELETE FROM service_schedules WHERE id = $1 RETURNING *",
        [id]
      );
      return rows.length > 0 ? mapServiceScheduleRow(rows[0]) : false;
    },

    async listServiceSchedules({ date = "", serviceId = "", technicianId = "" } = {}) {
      const params = [];
      const where = [];
      if (date) {
        params.push(date);
        where.push(`scheduled_date = $${params.length}`);
      }
      if (serviceId) {
        params.push(serviceId);
        where.push(`service_id = $${params.length}`);
      }
      if (technicianId) {
        params.push(technicianId);
        where.push(`technician_id = $${params.length}`);
      }
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const { rows } = await pool.query(
        `SELECT * FROM service_schedules ${whereSql} ORDER BY scheduled_date, start_time`,
        params
      );
      return rows.map(mapServiceScheduleRow);
    },

    async getTechnicianAvailability(servicePersonId) {
      const { rows } = await pool.query(
        "SELECT * FROM technician_availability WHERE service_person_id = $1 ORDER BY day_of_week, start_time",
        [servicePersonId]
      );
      return rows.map(mapTechnicianAvailabilityRow);
    },

    async getTechnicianAvailabilityById(id) {
      const { rows } = await pool.query(
        "SELECT * FROM technician_availability WHERE id = $1 LIMIT 1",
        [id]
      );
      return mapTechnicianAvailabilityRow(rows[0]);
    },

    async createTechnicianAvailability(avail) {
      const { rows } = await pool.query(
        `INSERT INTO technician_availability (
           id, service_person_id, day_of_week, start_time, end_time, status, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          avail.id || `avail-${Date.now()}`,
          avail.servicePersonId,
          avail.dayOfWeek,
          avail.startTime,
          avail.endTime,
          avail.status || "active",
          avail.createdAt || new Date(),
        ]
      );
      return mapTechnicianAvailabilityRow(rows[0]);
    },

    async updateTechnicianAvailability(id, fields) {
      const current = await (async () => {
        const { rows } = await pool.query(
          "SELECT * FROM technician_availability WHERE id = $1 LIMIT 1",
          [id]
        );
        return mapTechnicianAvailabilityRow(rows[0]);
      })();
      if (!current) return null;
      const next = { ...current, ...fields };
      const { rows } = await pool.query(
        `UPDATE technician_availability SET
           service_person_id = $2, day_of_week = $3, start_time = $4,
           end_time = $5, status = $6
         WHERE id = $1
         RETURNING *`,
        [
          id,
          next.servicePersonId,
          next.dayOfWeek,
          next.startTime,
          next.endTime,
          next.status,
        ]
      );
      return mapTechnicianAvailabilityRow(rows[0]);
    },

    async deleteTechnicianAvailability(id) {
      const { rows } = await pool.query(
        "DELETE FROM technician_availability WHERE id = $1 RETURNING *",
        [id]
      );
      return rows.length > 0 ? mapTechnicianAvailabilityRow(rows[0]) : false;
    },
  };

  return store;
};

export default null;