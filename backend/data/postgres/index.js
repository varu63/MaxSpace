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

const mapUserRow = (row) =>
  row
    ? {
        id: row.id,
        name: row.name,
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
        id: row.id,
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
        stateOfHealth: row.state_of_health,
        stateOfCharge: row.state_of_charge,
        cycleCount: row.cycle_count,
        maxRatedCycles: row.max_rated_cycles,
        internalResistanceMOhms: row.internal_resistance_mohms,
        operatingTempC: row.operating_temp_c,
        carbonFootprintKgPerKwh: row.carbon_footprint_kg_per_kwh,
        recycledContent: row.recycled_content || {},
        warranty: row.warranty || {},
        complianceStandards: row.compliance_standards || [],
        dismantlingManual: row.dismantling_manual,
        healthHistory: row.health_history || [],
        createdAt: row.created_at,
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

/* ---------- Create the store ---------- */

export const createPostgresStore = async ({ databaseUrl }) => {
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
      await pool.query("BEGIN");
      try {
        await pool.query(
          'TRUNCATE TABLE services, batteries, profiles, users, service_persons RESTART IDENTITY CASCADE'
        );
        for (const b of seedBatteries) await store.createBattery(b);
        for (const s of seedServices) await store.createService(s);
        for (const u of [...seedAdminUsers, ...seedRegularUsers, ...seedEmployeeUsers]) {
          await store.createUser(u);
        }
        for (const sp of seedServicePersons) await store.createServicePerson(sp);
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
        `INSERT INTO users (id, name, email, password_hash, role, service_person_id, google_id, auth_provider, avatar, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          userData.id,
          userData.name,
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
         SET name = $2, email = $3, password_hash = $4, role = $5, service_person_id = $6,
             google_id = $7, auth_provider = $8, avatar = $9
         WHERE id = $1
         RETURNING *`,
        [
          id,
          next.name,
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

    /* ---------- Batteries ---------- */
    async getAllBatteries(ownerId = null) {
      const { rows } = await pool.query(
        `SELECT * FROM batteries ${ownerId ? "WHERE owner_id = $1" : ""} ORDER BY created_at`,
        ownerId ? [ownerId] : []
      );
      return rows.map(mapBatteryRow);
    },

    async getBatteryById(id, ownerId = null) {
      const { rows } = await pool.query(
        `SELECT * FROM batteries WHERE id = $1 ${ownerId ? "AND owner_id = $2" : ""} LIMIT 1`,
        ownerId ? [id, ownerId] : [id]
      );
      return mapBatteryRow(rows[0]);
    },

    async findBatteryByBarcodeOrSerial(code, ownerId = null) {
      const clean = String(code || "").trim().toUpperCase();
      if (!clean) return null;
      const { rows } = await pool.query(
        `SELECT * FROM batteries
         WHERE (UPPER(barcode) = $1 OR UPPER(serial_number) = $1 OR UPPER(id) = $1 OR UPPER(modal_id) = $1)
         ${ownerId ? "AND owner_id = $2" : ""}
         LIMIT 1`,
        ownerId ? [clean, ownerId] : [clean]
      );
      return mapBatteryRow(rows[0]);
    },

    async createBattery(battery) {
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
         WHERE id = $1
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
        "DELETE FROM batteries WHERE id = $1 RETURNING *",
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
  };

  return store;
};

export default null;