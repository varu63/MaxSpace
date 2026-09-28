/* ============================================================
   POSTGRESQL REPOSITORY
   The only persistence implementation. Controllers import the facade
   (backend/data/index.js) and call these methods; there is no
   in-memory alternative and no seed path.

   Schema: backend/sql/schema.sql  (applied via psql / docker).
   Driver: pg (lazy-loaded by the data-source facade).
   ============================================================ */

/* ---------- Row mappers (snake_case → camelCase) ---------- */

import bcrypt from "bcryptjs";
import { assertServiceIntegrity } from "../../utils/serviceValidation.js";
import { buildPagination } from "../../utils/pagination.js";
import { ACTIVE_SERVICE_STATUSES } from "../../constants/serviceStatuses.js";
import { buildMapMarker } from "../../utils/mapMarker.js";
import { createComplianceManagementStore } from "../compliance/postgres.js";

const mapUserRow = (row) =>
  row
    ? {
        id: row.id,
        name: row.name,
        username: row.username || "",
        // `users.full_name` was removed as a duplicate of `users.name`;
        // it was identical in every row, so the display name is served
        // from the single stored value.
        fullName: row.name || "",
        email: row.email,
        password: row.password_hash,
        role: row.role,
        servicePersonId: row.service_person_id || null,
        companyId: row.company_id ?? null,
        googleId: row.google_id || null,
        authProvider: row.auth_provider || "local",
        avatar: row.avatar || "",
        resetTokenExpiresAt: row.reset_token_expires_at || null,
        createdAt: row.created_at,
      }
    : null;

/* Derive the username column for every user row the app creates. It prefers
   an explicit value, then the e-mail local-part, then the name. */
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

/* `hang_status` is a BOOLEAN in the schema, but the QR scanner reads free
   text ("Hang Status: <anything>"). Recognised truthy/falsy tokens become
   the boolean; anything else is stored verbatim in `hang_status_note` so a
   scan is never rejected and no text is lost. */
const toHangStatus = (value) => {
  if (value === null || value === undefined || value === "") {
    return { hangStatus: false, hangStatusNote: null };
  }
  if (typeof value === "boolean") {
    return { hangStatus: value, hangStatusNote: null };
  }
  const raw = String(value).trim();
  if (/^(true|yes|y|1|hanging|hung)$/i.test(raw)) {
    return { hangStatus: true, hangStatusNote: raw };
  }
  if (/^(false|no|n|0|not hanging|active)$/i.test(raw)) {
    return { hangStatus: false, hangStatusNote: raw };
  }
  return { hangStatus: false, hangStatusNote: raw };
};

/* `assigned_services` is derived: it is the list of service ids whose
   assigned_service_person_id points at this technician. The projection
   below is appended to every service_persons read so the mapper can use
   it without the column being stored. */
const SERVICE_PERSON_SELECT = `
  sp.*,
  COALESCE(
    (SELECT json_agg(sv.id ORDER BY sv.id) FROM services sv
      WHERE sv.assigned_service_person_id = sp.id),
    '[]'::json
  ) AS __assigned_services,
  (SELECT count(*)::int FROM services sv2
    WHERE sv2.assigned_service_person_id = sp.id) AS __assigned_service_count`;

/* `battery_name` and `technician` were stored copies of the related
   battery / service-person names. They are resolved here instead, so the
   names can never go stale. Every service read must use this projection. */
const SERVICE_SELECT = `
  s.*,
  b.name AS __battery_name,
  sp.name AS __technician_name`;

const SERVICE_JOINS = `
  LEFT JOIN batteries b ON b.battery_id = s.battery_id
  LEFT JOIN service_persons sp ON sp.id = s.assigned_service_person_id`;


const mapServiceCenterRow = (row) =>
  row
    ? {
        key: row.key,
        name: row.name,
        address: row.address ?? null,
        city: row.city ?? null,
        state: row.state ?? null,
        pincode: row.pincode ?? null,
        latitude: row.latitude === null ? null : Number(row.latitude),
        longitude: row.longitude === null ? null : Number(row.longitude),
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
        // The duplicate `specialization` text column was removed; the
        // singular value is the first entry of the array.
        specialization: (row.specializations || [])[0] || "",
        status: row.status,
        // `assigned_services` was a JSON copy of the services relationship
        // and is now read from the join in the same query.
        assignedServices: row.__assigned_services || [],
        assignedServiceCount: row.__assigned_service_count ?? 0,
        createdAt: row.created_at,
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

const toTimeString = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    return `${String(value.getHours()).padStart(2, "0")}:${String(
      value.getMinutes()
    ).padStart(2, "0")}`;
  }
  return String(value).slice(0, 5);
};

const mapBatteryRow = (row) =>
  row
    ? {
        id: row.battery_id ?? row.id,
        ownerId: row.owner_id,
        barcode: row.barcode,
        qrCode: row.qr_code,
        modalId: row.modal_id,
        // Stored as a real BOOLEAN; `hang_status_note` keeps the verbatim
        // text when a QR scan contained something other than true/false.
        // It is omitted when empty so the common case matches the old
        // response exactly.
        hangStatus: row.hang_status === true,
        ...(row.hang_status_note ? { hangStatusNote: row.hang_status_note } : {}),
        overallStatus: row.overall_status,
        name: row.name,
        modelName: row.model_name,
        // `batteries.model` was a stored duplicate of `model_name` in every
        // row. It is served from the single source so the response shape is
        // unchanged while the duplication is gone.
        model: row.model_name,
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
        manufactureDate: toDateString(row.manufacture_date),
        assemblyLocation: row.assembly_location,
        // `batteries.location` was NULL in every row and is served from
        // battery_locations instead. `cells` duplicated battery_models
        // .series_count * parallel_count (both verified as exact duplicates
        // of their source) and is now derived at read time.
        location: row.__location_name ?? null,
        cells: row.__total_cells ?? null,
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

/* `batteries.cells` used to be a stored column that duplicated
   battery_models.series_count * parallel_count (verified identical for all
   1215 rows). It is derived at read time so the two can never drift apart.
   Every battery read path must join battery_models and select this. */
const BATTERY_MODEL_JOIN = `
         LEFT JOIN battery_models bm ON bm.model_id = b.model_id`;
const BATTERY_DERIVED = `
         (bm.series_count * bm.parallel_count)::int AS __total_cells`;

/* `cost` is stored decomposed as amount + currency + note because the
   original single column held a pre-formatted display string such as
   "$0.00 (Warranty Covered)". Reassembling it here keeps the API response
   byte-identical to the legacy format the UI renders. */
const formatServiceCost = (row) => {
  if (row.cost === null || row.cost === undefined) return null;
  const amount = row.cost;
  const currency = row.cost_currency ?? "$";
  const base = `${currency}${amount}`;
  return row.cost_note ? `${base} (${row.cost_note})` : base;
};

/* Inverse of formatServiceCost: turn the display string the app passes in
   back into the three stored columns, mirroring migrate_legacy_to_v2.sql so
   the value survives a round trip character for character. */
const splitServiceCost = (value) => {
  if (value === null || value === undefined || value === "") {
    return [null, null, null];
  }
  const raw = String(value);
  const amountMatch = raw.match(/-?\d[\d,]*\.?\d*/);
  const amount = amountMatch
    ? Number(amountMatch[0].replace(/,/g, ""))
    : null;
  const noteMatch = raw.match(/\(([^)]*)\)/);
  const note = noteMatch ? noteMatch[1].trim() || null : null;
  let currency = null;
  const codeMatch = raw.match(/\$\s?([A-Za-z]{3})/);
  const symbolMatch = raw.match(/^\s*([^\d\s(]+)/);
  if (codeMatch) currency = `$${codeMatch[1]}`;
  else if (raw.includes("$")) currency = "$";
  else if (symbolMatch) currency = symbolMatch[1];
  return [amount, currency, note];
};

const mapServiceRow = (row) =>
  row
    ? {
        id: row.id,
        ticketNumber: row.ticket_number,
        batteryId: row.battery_id,
        // `battery_name` and `technician` were stored copies of the
        // related battery / service-person names and are now read from
        // joins in the same query.
        batteryName: row.__battery_name ?? null,
        serviceType: row.service_type,
        center: row.center,
        scheduledDate: toDateString(row.scheduled_date),
        scheduledTime: toTimeString(row.scheduled_time),
        mobileNumber: row.mobile_number || "",
        status: row.status,
        priority: row.priority,
        technician: row.__technician_name || "",
        estimatedArrival: row.estimated_arrival,
        customerId: row.customer_id,
        assignedServicePersonId: row.assigned_service_person_id,
        adminApprovedAt: row.admin_approved_at,
        approvedBy: row.approved_by,
        notes: row.notes,
        cost: formatServiceCost(row),
        costAmount: row.cost ?? null,
        costCurrency: row.cost_currency ?? null,
        costNote: row.cost_note ?? null,
        history: row.history || [],
        createdAt: row.created_at,
      }
    : null;

const mapProfileRow = (row) =>
  row
    ? {
        id: row.user_id,
        // name / email / avatar were removed from `profiles` because they
        // duplicated `users` and had already drifted (the EMPLOYEE row had
        // an empty profile name and e-mail while `users` held the real
        // values). They are joined in from `users` instead.
        name: row.__user_name ?? row.user_id,
        title: row.title,
        email: row.__user_email ?? null,
        phone: row.phone,
        location: row.location,
        memberSince: row.member_since,
        avatar: row.__user_avatar || null,
        fleetType: row.fleet_type,
        totalCapacityKwh: row.total_capacity_kwh,
        euOperatorId: row.eu_operator_id,
        notificationSettings: row.notification_settings || {},
        // The capped jsonb array is replaced by the append-only
        // user_activity table; the last 20 entries are assembled here so
        // the response shape the UI renders is unchanged.
        activityLogs: row.__activity_logs || [],
      }
    : null;

/* The legacy activity entries only stored the display string "Just now".
   user_activity keeps the real created_at, which is formatted here for
   display. */
const formatActivityTimestamp = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().replace("T", " ").slice(0, 16) + " UTC";
};

const mapActivityRows = (rows) =>
  (rows || []).map((r) => ({
    id: `act-${r.id}`,
    action: r.action,
    details: r.details || "",
    timestamp: formatActivityTimestamp(r.created_at),
    type: r.type || "general",
  }));

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

const toIso = (value) =>
  value instanceof Date ? value.toISOString() : value;

const mapComplianceProducerRow = (row) =>
  row
    ? {
        id: row.id,
        producerName: row.producer_name,
        registrationNumber: row.registration_number,
        registrationValidUntil: toDateString(row.registration_valid_until),
        producerCategory: row.producer_category,
        pan: row.pan,
        gstin: row.gstin,
        address: row.address,
        contactEmail: row.contact_email,
        contactPhone: row.contact_phone,
        website: row.website,
        status: row.status,
        notes: row.notes,
        createdAt: toIso(row.created_at),
        updatedAt: toIso(row.updated_at),
      }
    : null;

const mapBatteryComplianceRow = (row) =>
  row
    ? {
        id: row.id,
        batteryId: row.battery_id,
        producerId: row.producer_id ?? null,
        framework: row.framework,
        batteryCategory: row.battery_category,
        collectionChannel: row.collection_channel,
        complianceStatus: row.compliance_status,
        verifiedInApp: Boolean(row.verified_in_app),
        verifiedAt: row.verified_at ? toIso(row.verified_at) : null,
        notes: row.notes,
        collectionStatus: row.collection_status || null,
        collectionDate: toDateString(row.collection_date),
        collectionLocation: row.collection_location || null,
        refurbisherId: row.refurbisher_id ?? null,
        refurbisherName: row.refurbisher_name || null,
        refurbisherDetails: row.refurbisher_details || null,
        recyclerId: row.recycler_id ?? null,
        recyclerName: row.recycler_name || null,
        recyclerRegistration: row.recycler_registration || null,
        recyclingFacility: row.recycling_facility || null,
        recyclingDate: toDateString(row.recycling_date),
        recyclingStatus: row.recycling_status || null,
        recyclingCertificate: row.recycling_certificate || null,
        eprReference: row.epr_reference || null,
        createdAt: toIso(row.created_at),
        updatedAt: toIso(row.updated_at),
        producer: row.__producer ? mapComplianceProducerRow(row.__producer) : undefined,
        batteryName: row.battery_name || undefined,
        batteryBarcode: row.battery_barcode || undefined,
        batteryModalId: row.battery_modal_id || undefined,
        producerDisplayName: row.producer_display_name || undefined,
        refurbisherDisplayName: row.refurbisher_display_name || undefined,
        recyclerDisplayName: row.recycler_display_name || undefined,
      }
    : null;

const mapObligationRow = (row) =>
  row
    ? {
        id: row.id,
        producerId: row.producer_id,
        financialYear: row.financial_year,
        batteryCategory: row.battery_category,
        targetPercent: row.target_percent == null ? null : Number(row.target_percent),
        obligationKg: row.obligation_kg == null ? null : Number(row.obligation_kg),
        achievedKg: row.achieved_kg == null ? 0 : Number(row.achieved_kg),
        status: row.status,
        notes: row.notes,
        createdAt: toIso(row.created_at),
        updatedAt: toIso(row.updated_at),
      }
    : null;

const mapCreditRow = (row) =>
  row
    ? {
        id: row.id,
        obligationId: row.obligation_id,
        certificateNumber: row.certificate_number,
        quantityKg: row.quantity_kg == null ? 0 : Number(row.quantity_kg),
        issueDate: toDateString(row.issue_date),
        validUntil: toDateString(row.valid_until),
        status: row.status,
        notes: row.notes,
        createdAt: toIso(row.created_at),
        updatedAt: toIso(row.updated_at),
      }
    : null;

const mapDocumentRow = (row) =>
  row
    ? {
        id: row.id,
        batteryId: row.battery_id || null,
        producerId: row.producer_id ?? null,
        documentType: row.document_type,
        documentName: row.document_name,
        documentNumber: row.document_number || null,
        issuedBy: row.issued_by || null,
        issuedOn: toDateString(row.issued_on),
        expiresOn: toDateString(row.expires_on),
        status: row.status,
        notes: row.notes,
        createdAt: toIso(row.created_at),
        updatedAt: toIso(row.updated_at),
      }
    : null;

const mapComplianceEventRow = (row) =>
  row
    ? {
        id: row.id,
        batteryId: row.battery_id || null,
        producerId: row.producer_id ?? null,
        eventType: row.event_type,
        eventDescription: row.event_description || "",
        createdBy: row.created_by || null,
        createdAt: toIso(row.created_at),
      }
    : null;

const mapBatteryLocationRow = (row) =>
  row
    ? {
        id: row.id,
        batteryId: row.battery_id,
        latitude: row.latitude === null ? null : Number(row.latitude),
        longitude: row.longitude === null ? null : Number(row.longitude),
        address: row.address || null,
        city: row.city || null,
        state: row.state || null,
        country: row.country || null,
        siteName: row.site_name || null,
        locationType: row.location_type,
        isCurrent: Boolean(row.is_current),
        createdAt: toIso(row.created_at),
        updatedAt: toIso(row.updated_at),
      }
    : null;

const mapLocationHistoryRow = (row) => {
  if (!row) return null;
  const snap = (p) => ({
    siteName: row[`${p}_site_name`] || null,
    city: row[`${p}_city`] || null,
    state: row[`${p}_state`] || null,
    country: row[`${p}_country`] || null,
    latitude: row[`${p}_latitude`] === null ? null : Number(row[`${p}_latitude`]),
    longitude: row[`${p}_longitude`] === null ? null : Number(row[`${p}_longitude`]),
    address: row[`${p}_address`] || null,
  });
  return {
    id: row.id,
    batteryId: row.battery_id,
    previousLocationId: row.previous_location_id ?? null,
    newLocationId: row.new_location_id ?? null,
    movedAt: toIso(row.moved_at),
    reason: row.reason || null,
    createdBy: row.created_by || null,
    createdAt: toIso(row.created_at),
    previousLocation: row.previous_location_id !== null ? snap("prev") : null,
    newLocation: row.new_location_id !== null ? snap("new") : null,
  };
};

/* ---------- Create the store ---------- */

export const createPostgresStore = async ({
  databaseUrl,
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

  /* node-postgres returns NUMERIC (OID 1700) as a string by default, which
     would leak into the API as `"56"` where the previous store returned
     `56`. Parse it as a float so every numeric column crosses the wire as a
     JSON number. Display formatting (cost strings, percentages) is applied
     in the mappers below, not by the driver. */
  pg.types.setTypeParser(1700, (value) => (value === null ? null : parseFloat(value)));

  const pool = new pg.Pool({ connectionString: databaseUrl });

  /* The v2 schema is authoritative and lives entirely in `public`, so there
     is no schema probing and no column-shape guessing: `batteries` is keyed
     by the business key `battery_id` (its primary key — there is no
     surrogate `id` column) and every table the app reads is guaranteed to
     exist. A missing table is a real error and must surface as one rather
     than silently degrading to a different query. */
  const batteryKey = "battery_id";
  const modelKey = "model_id";
  const hasModelsTable = true;
  const hasBatteryModelLink = true;

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
       FROM pdi_reports
       WHERE battery_id = ANY($1) ORDER BY battery_id, test_time DESC`,
      [ids]
    );
    for (const r of pdi) attach(r.battery_id, "pdi", r);

    const pack = await run(
      `SELECT DISTINCT ON (battery_id) battery_id, test_date, specification, cell_type, actual_cap,
              ocv_voltage, discharging_capacity, capacity_result, final_voltage, final_result, soc_result
       FROM pack_testing_reports
       WHERE battery_id = ANY($1) ORDER BY battery_id, test_date DESC`,
      [ids]
    );
    for (const r of pack) attach(r.battery_id, "pack", r);

    const dispatch = await run(
      `SELECT DISTINCT ON (battery_id) battery_id, customer_name, invoice_id, invoice_date, dispatch_timestamp
       FROM dispatch_records
       WHERE battery_id = ANY($1) ORDER BY battery_id, dispatch_timestamp DESC`,
      [ids]
    );
    for (const r of dispatch) attach(r.battery_id, "dispatch", r);

    const bms = await run(
      `SELECT DISTINCT ON (battery_id) battery_id, bms_id, is_used, added_at
       FROM bms_inventory
       WHERE battery_id = ANY($1) ORDER BY battery_id, added_at DESC`,
      [ids]
    );
    for (const r of bms) attach(r.battery_id, "bms", r);

    const cells = await run(
      `SELECT m.battery_id,
              count(*)::int AS cell_count,
              count(*) FILTER (WHERE c.status = 'pass')::int AS pass_count,
              count(*) FILTER (WHERE c.status IS DISTINCT FROM 'pass')::int AS fail_count
       FROM battery_cell_mapping m
       LEFT JOIN cells c ON c.cell_id = m.cell_id
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
        `INSERT INTO users (id, name, username, email, password_hash, role, service_person_id, google_id, auth_provider, avatar, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          userData.id,
          userData.name,
          toUsername(userData),
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
         SET name = $2, username = $3, email = $4, password_hash = $5,
             role = $6, service_person_id = $7, google_id = $8, auth_provider = $9, avatar = $10
         WHERE id = $1
         RETURNING *`,
        [
          id,
          next.name,
          toUsername(next),
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
        `SELECT b.*,${BATTERY_DERIVED}
         FROM batteries b ${BATTERY_MODEL_JOIN}
         WHERE b.${batteryKey} = $1 ${ownerId ? "AND b.owner_id = $2" : ""} LIMIT 1`,
        ownerId ? [id, ownerId] : [id]
      );
      return mapBatteryRow(rows[0]);
    },

    async getBatteriesByIds(ids = []) {
      const clean = (ids || []).filter(Boolean);
      if (!clean.length) return [];
      const { rows } = await pool.query(
        `SELECT b.*,${BATTERY_DERIVED}
         FROM batteries b ${BATTERY_MODEL_JOIN}
         WHERE b.${batteryKey} = ANY($1)`,
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
        `SELECT b.*,${BATTERY_DERIVED}
         FROM batteries b ${BATTERY_MODEL_JOIN}
         WHERE (
           UPPER(b.barcode) = $1
           OR UPPER(b.serial_number) = $1
           OR UPPER(b.${batteryKey}) = $1
           OR UPPER(b.${batteryKey}) = $2
           OR UPPER(b.modal_id) = $1
           OR UPPER(b.modal_id) = $3
           OR UPPER(b.serial_number) = $3
           OR b.barcode LIKE '%' || $1 || '%'
         )
         ${ownerId ? "AND b.owner_id = $4" : ""}
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
             FROM battery_models m
             JOIN batteries b ON b.model_id = m.model_id
             WHERE b.battery_id = $1 LIMIT 1`,
            [proId]
          );
          modelSpec = mRows[0] || null;

          // 2. BMS inventory
          const { rows: bmsRows } = await pool.query(
            `SELECT bms_id, is_used, added_at FROM bms_inventory WHERE battery_id = $1 LIMIT 1`,
            [proId]
          );
          bmsInfo = bmsRows[0] || null;

          // 3. Cell mapping & cells
          const { rows: cRows } = await pool.query(
            `SELECT m.cell_id, m.assigned_at, c.status, c.discharging_capacity_mah, c.ir_value_m_ohm, c.sorting_voltage
             FROM battery_cell_mapping m
             LEFT JOIN cells c ON c.cell_id = m.cell_id
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
             FROM pack_testing_reports
             WHERE battery_id = $1
             ORDER BY test_date DESC LIMIT 1`,
            [proId]
          );
          packTesting = ptRows[0] || null;

          // 5. PDI report
          const { rows: pdiRows } = await pool.query(
            `SELECT test_time, voltage_v, resistance_m_ohm, cont_charging_current, cont_charging_voltage,
                    cont_discharging_current, cont_discharging_voltage, short_circuit_prot_time_us, test_result
             FROM pdi_reports
             WHERE battery_id = $1
             ORDER BY test_time DESC LIMIT 1`,
            [proId]
          );
          pdiReport = pdiRows[0] || null;

          // 6. Dispatch record
          const { rows: dRows } = await pool.query(
            `SELECT customer_name, invoice_id, invoice_date, dispatch_timestamp
             FROM dispatch_records
             WHERE battery_id = $1
             ORDER BY dispatch_timestamp DESC LIMIT 1`,
            [proId]
          );
          dispatchRecord = dRows[0] || null;

            // 7. Laser welding
            const { rows: lwRows } = await pool.query(
              `SELECT initial_speed, max_speed, power_mode, dac_power, scan_speed, recorded_at
               FROM laser_welding_data
               WHERE battery_id = $1
               ORDER BY recorded_at DESC LIMIT 1`,
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
      // The schema keys batteries by `battery_id` with a NOT NULL model_id
      // referencing battery_models, so the model is resolved first: we either
      // insert a valid battery or fail cleanly (400).
      let modelId = battery.modelId || null;
      if (!modelId && hasModelsTable) {
        const modelKey = String(
          battery.model || battery.name || battery.modelName || ""
        ).trim();
        if (modelKey) {
          const { rows: modelRows } = await pool.query(
            `SELECT model_id FROM battery_models
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
           battery_id, model_id, owner_id, barcode, qr_code, modal_id,
           hang_status, hang_status_note, overall_status,
           name, model_name, type, manufacturer,
           serial_number, chemistry, capacity_kwh, capacity, nominal_voltage, voltage,
           weight_kg, dimensions_mm, manufacture_date, assembly_location,
           state_of_health, state_of_charge, cycle_count, max_rated_cycles,
           internal_resistance_mohms, operating_temp_c, carbon_footprint_kg_per_kwh,
           recycled_content, warranty, compliance_standards, dismantling_manual, health_history
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
            $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32,
            $33, $34, $35
          )
          RETURNING battery_id`,
        [
          batteryId,
          modelId,
          battery.ownerId || null,
          battery.barcode,
          battery.qrCode || null,
          battery.modalId || null,
          toHangStatus(battery.hangStatus).hangStatus,
          toHangStatus(battery.hangStatus).hangStatusNote,
          battery.overallStatus || null,
          battery.name,
          battery.modelName,
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
      // Re-read through the joins so `cells` is derived, not missing.
      return store.getBatteryById(rows[0].battery_id);
    },

    async claimBattery(id, ownerId) {
      const { rows } = await pool.query(
        `UPDATE batteries SET owner_id = $2 WHERE ${batteryKey} = $1 RETURNING battery_id`,
        [id, ownerId]
      );
      return rows.length > 0 ? store.getBatteryById(id) : null;
    },

    async updateBattery(id, fields) {
      const current = await store.getBatteryById(id);
      if (!current) return null;
      const next = { ...current, ...fields };
      const { rows } = await pool.query(
        `UPDATE batteries SET
           barcode = $2, qr_code = $3, modal_id = $4,
           hang_status = $5, hang_status_note = $6, overall_status = $7,
           name = $8, model_name = $9,
           type = $10, manufacturer = $11, serial_number = $12, chemistry = $13,
           capacity_kwh = $14, capacity = $15, nominal_voltage = $16, voltage = $17,
           weight_kg = $18, dimensions_mm = $19, manufacture_date = $20,
           assembly_location = $21,
           state_of_health = $22, state_of_charge = $23, cycle_count = $24,
           max_rated_cycles = $25, internal_resistance_mohms = $26,
           operating_temp_c = $27, carbon_footprint_kg_per_kwh = $28,
           recycled_content = $29, warranty = $30, compliance_standards = $31,
           dismantling_manual = $32, health_history = $33
         WHERE ${batteryKey} = $1
         RETURNING *`,
        [
          id,
          next.barcode,
          next.qrCode || null,
          next.modalId || null,
          toHangStatus(next.hangStatus).hangStatus,
          toHangStatus(next.hangStatus).hangStatusNote,
          next.overallStatus || null,
          next.name,
          next.modelName,
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
      // Re-read through the joins so `cells` is derived, not missing.
      return store.getBatteryById(id);
    },

    async deleteBattery(id) {
      const existing = await store.getBatteryById(id);
      if (!existing) return false;
      await pool.query(`DELETE FROM batteries WHERE ${batteryKey} = $1`, [id]);
      return existing;
    },

    /* ---------- Services ---------- */
    async getAllServices() {
      const { rows } = await pool.query(
        `SELECT${SERVICE_SELECT} FROM services s ${SERVICE_JOINS} ORDER BY s.created_at`
      );
      return rows.map(mapServiceRow);
    },

    async getServicesByCustomerId(customerId) {
      if (!customerId) return [];
      const { rows } = await pool.query(
        `SELECT${SERVICE_SELECT} FROM services s ${SERVICE_JOINS}
         WHERE s.customer_id = $1 ORDER BY s.created_at`,
        [customerId]
      );
      return rows.map(mapServiceRow);
    },

    async getServicesByBatteryId(batteryId) {
      const { rows } = await pool.query(
        `SELECT${SERVICE_SELECT} FROM services s ${SERVICE_JOINS}
         WHERE s.battery_id = $1 ORDER BY s.scheduled_date ASC`,
        [batteryId]
      );
      return rows.map(mapServiceRow);
    },

    async getServiceById(id) {
      const { rows } = await pool.query(
        `SELECT${SERVICE_SELECT} FROM services s ${SERVICE_JOINS} WHERE s.id = $1 LIMIT 1`,
        [id]
      );
      return mapServiceRow(rows[0]);
    },

    async createService(service) {
      assertServiceIntegrity(service);
      const { rows } = await pool.query(
        `INSERT INTO services (
           id, ticket_number, battery_id, service_type, center,
           scheduled_date, scheduled_time, mobile_number, status, priority,
           estimated_arrival, customer_id, assigned_service_person_id,
           admin_approved_at, approved_by, notes,
           cost, cost_currency, cost_note, history, created_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
           $17, $18, $19, $20, $21
         )
         RETURNING *`,
        [
          service.id,
          service.ticketNumber,
          service.batteryId,
          service.serviceType,
          service.center,
          service.scheduledDate,
          service.scheduledTime,
          service.mobileNumber || "",
          service.status,
          service.priority,
          service.estimatedArrival || null,
          service.customerId || null,
          service.assignedServicePersonId || null,
          service.adminApprovedAt || null,
          service.approvedBy || null,
          service.notes || null,
          // `battery_name` and `technician` are no longer stored: they are
          // derived from the battery / service-person joins on read.
          ...splitServiceCost(service.cost),
          JSON.stringify(service.history || []),
          service.createdAt,
        ]
      );
      // Re-read through the joins so batteryName / technician are resolved.
      return store.getServiceById(rows[0].id);
    },

    async updateService(id, fields) {
      const current = await store.getServiceById(id);
      if (!current) return null;
      const next = { ...current, ...fields };
      assertServiceIntegrity(next);
      const { rows } = await pool.query(
        `UPDATE services SET
           ticket_number = $2, battery_id = $3, service_type = $4,
           center = $5, scheduled_date = $6, scheduled_time = $7, mobile_number = $8,
           status = $9, priority = $10, estimated_arrival = $11,
           customer_id = $12, assigned_service_person_id = $13,
           admin_approved_at = $14, approved_by = $15, notes = $16,
           cost = $17, cost_currency = $18, cost_note = $19, history = $20
         WHERE id = $1
         RETURNING *`,
        [
          id,
          next.ticketNumber,
          next.batteryId,
          next.serviceType,
          next.center,
          next.scheduledDate,
          next.scheduledTime,
          next.mobileNumber || "",
          next.status,
          next.priority,
          next.estimatedArrival || null,
          next.customerId || null,
          next.assignedServicePersonId || null,
          next.adminApprovedAt || null,
          next.approvedBy || null,
          next.notes || null,
          ...splitServiceCost(next.cost),
          JSON.stringify(next.history || []),
        ]
      );
      // Re-read through the joins so batteryName / technician are resolved.
      return store.getServiceById(id);
    },

    async deleteService(id) {
      const existing = await store.getServiceById(id);
      if (!existing) return false;
      await pool.query("DELETE FROM services WHERE id = $1", [id]);
      return existing;
    },

    /* ---------- Service centers & organization network ----------
       These replace the hardcoded coordinate lists that used to live in
       utils/serviceLocation.js and utils/organizationLocations.js.
       `services.center` is free text, so it is resolved by matching the
       text against the real center rows. An unmatched center returns
       null: no coordinate is ever invented. */

    async getServiceCenters({ activeOnly = true } = {}) {
      const { rows } = await pool.query(
        `SELECT * FROM service_centers
         ${activeOnly ? "WHERE is_active" : ""}
         ORDER BY name`
      );
      return rows.map(mapServiceCenterRow);
    },

    /* Resolves the free-text `services.center` value to a real row by
       matching key, name, city or address. Most specific match wins. */
    async resolveServiceCenter(centerText) {
      const text = String(centerText || "").trim();
      if (!text) return null;
      const centers = await store.getServiceCenters();
      const haystack = text.toLowerCase();
      const score = (c) => {
        const fields = [c.key, c.name, c.city, c.address]
          .filter(Boolean)
          .map((v) => String(v).toLowerCase());
        if (fields.some((f) => f === haystack)) return 3;
        if (fields.some((f) => haystack.includes(f) && f.length > 3)) return 2;
        if (fields.some((f) => f.includes(haystack) && haystack.length > 3)) return 1;
        return 0;
      };
      const ranked = centers
        .map((c) => ({ c, s: score(c) }))
        .filter((r) => r.s > 0)
        .sort((a, b) => b.s - a.s);
      return ranked.length ? ranked[0].c : null;
    },

    async getOrganizationLocations({ type = "" } = {}) {
      const params = [];
      const where = ["o.is_active"];
      if (type) {
        params.push(type);
        where.push(`o.type = $${params.length}`);
      }
      const { rows } = await pool.query(
        `SELECT o.*,
                COALESCE(o.latitude,  sc.latitude)  AS latitude,
                COALESCE(o.longitude, sc.longitude) AS longitude,
                COALESCE(o.address,   sc.address)   AS address,
                COALESCE(o.city,      sc.city)      AS city,
                COALESCE(o.state,     sc.state)     AS state,
                COALESCE(o.pincode,   sc.pincode)   AS pincode
         FROM organization_locations o
         LEFT JOIN service_centers sc ON sc.key = o.service_center_key
         WHERE ${where.join(" AND ")}
         ORDER BY o.type, o.name`,
        params
      );
      return rows.map((r) => ({
        key: r.key,
        name: r.name,
        type: r.type,
        city: r.city ?? null,
        state: r.state ?? null,
        address: r.address ?? null,
        pincode: r.pincode ?? null,
        latitude: r.latitude === null ? null : Number(r.latitude),
        longitude: r.longitude === null ? null : Number(r.longitude),
        compliance: r.compliance_status ?? null,
      }));
    },

    /* ---------- Service persons ---------- */
    async getAllServicePersons() {
      const { rows } = await pool.query(`SELECT ${SERVICE_PERSON_SELECT} FROM service_persons sp ORDER BY sp.created_at`);
      return rows.map(mapServicePersonRow);
    },

    async getServicePersonById(id) {
      const { rows } = await pool.query(`SELECT ${SERVICE_PERSON_SELECT} FROM service_persons sp WHERE sp.id = $1 LIMIT 1`, [id]);
      return mapServicePersonRow(rows[0]);
    },

    async getServicePersonsByIds(ids = []) {
      const clean = (ids || []).filter(Boolean);
      if (!clean.length) return [];
      const { rows } = await pool.query(
        `SELECT ${SERVICE_PERSON_SELECT} FROM service_persons sp WHERE sp.id = ANY($1)`,
        [clean]
      );
      return rows.map(mapServicePersonRow);
    },

    async createServicePerson(person) {
      const { rows } = await pool.query(
        `INSERT INTO service_persons (
           id, technician_id, name, email, phone, certification, specializations,
           status, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          person.id,
          person.technicianId,
          person.name,
          person.email,
          person.phone || "",
          person.certification || "",
          // `specialization` and `assigned_services` were duplicates: the
          // singular is specializations[0] (derived on read) and the list
          // came from the services relationship (also derived on read).
          JSON.stringify(person.specializations || []),
          person.status || "active",
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
           specializations = $7, status = $8
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
          next.status || "active",
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
        `SELECT ${SERVICE_PERSON_SELECT} FROM service_persons sp WHERE LOWER(sp.email) = LOWER($1) LIMIT 1`,
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
      // name / email / avatar live on `users`; the activity feed lives in
      // `user_activity`. Both are read here so the response shape the UI
      // consumes is unchanged.
      const { rows } = await pool.query(
        `SELECT p.*,
                u.name AS __user_name,
                u.email AS __user_email,
                u.avatar AS __user_avatar
           FROM profiles p
           JOIN users u ON u.id = p.user_id
          WHERE p.user_id = $1
          LIMIT 1`,
        [userId]
      );
      const profile = rows[0];
      if (!profile) return null;
      profile.__activity_logs = mapActivityRows(await store.getUserActivity(userId, 20));
      return mapProfileRow(profile);
    },

    async updateProfile(userId, fields = {}) {
      const current = (await store.getProfile(userId)) || {};
      const next = { ...current, ...fields };
      if (next.password) delete next.password;
      // name / email / avatar are no longer profile columns; they are
      // written to `users` so there is a single source for each value.
      const userPatch = {};
      if (fields.name !== undefined) userPatch.name = fields.name;
      if (fields.email !== undefined) userPatch.email = fields.email;
      if (fields.avatar !== undefined) userPatch.avatar = fields.avatar;
      if (Object.keys(userPatch).length) {
        await pool.query(
          `UPDATE users
              SET name = COALESCE($2, name),
                  email = COALESCE($3, email),
                  avatar = COALESCE($4, avatar)
            WHERE id = $1`,
          [userId, userPatch.name ?? null, userPatch.email ?? null, userPatch.avatar ?? null]
        );
      }
      const { rows } = await pool.query(
        `INSERT INTO profiles (
           user_id, title, phone, location, member_since,
           fleet_type, total_capacity_kwh, eu_operator_id, notification_settings
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (user_id) DO UPDATE SET
           title = EXCLUDED.title, phone = EXCLUDED.phone, location = EXCLUDED.location,
           member_since = EXCLUDED.member_since,
           fleet_type = EXCLUDED.fleet_type, total_capacity_kwh = EXCLUDED.total_capacity_kwh,
           eu_operator_id = EXCLUDED.eu_operator_id,
           notification_settings = EXCLUDED.notification_settings
         RETURNING *`,
        [
          userId,
          next.title || null,
          next.phone || null,
          next.location || null,
          next.memberSince || null,
          next.fleetType || null,
          next.totalCapacityKwh ?? null,
          next.euOperatorId || null,
          JSON.stringify(next.notificationSettings || {}),
        ]
      );
      const profile = rows[0];
      const { rows: userRows } = await pool.query(
        "SELECT name, email, avatar FROM users WHERE id = $1",
        [userId]
      );
      profile.__user_name = userRows[0]?.name ?? null;
      profile.__user_email = userRows[0]?.email ?? null;
      profile.__user_avatar = userRows[0]?.avatar ?? null;
      profile.__activity_logs = mapActivityRows(await store.getUserActivity(userId, 20));
      return mapProfileRow(profile);
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
    /* Append-only insert. The previous implementation read the whole jsonb
       array, prepended an entry, truncated to 20 and rewrote it, so
       concurrent writes silently lost entries and old history was
       destroyed. */
    async logActivity(userId, action, details, type = "general") {
      const { rows } = await pool.query(
        `INSERT INTO user_activity (user_id, action, details, type)
         VALUES ($1, $2, $3, $4)
         RETURNING id, action, details, type, created_at`,
        [userId, action, details ?? null, type]
      );
      return mapActivityRows(rows)[0];
    },

    async getUserActivity(userId, limit = 20) {
      const { rows } = await pool.query(
        `SELECT id, action, details, type, created_at
           FROM user_activity
          WHERE user_id = $1
          ORDER BY created_at DESC, id DESC
          LIMIT $2`,
        [userId, limit]
      );
      return rows;
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
          `(b.${batteryKey} ILIKE $${i} OR b.barcode ILIKE $${i} OR b.serial_number ILIKE $${i} OR
            b.modal_id ILIKE $${i} OR b.name ILIKE $${i} OR b.model_name ILIKE $${i} OR
            b.chemistry ILIKE $${i} OR b.manufacturer ILIKE $${i})`
        );
      }
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

      const fieldMap = {
        createdAt: "b.created_at",
        name: "b.name",
        barcode: "b.barcode",
        serialNumber: "b.serial_number",
        stateOfHealth: "b.state_of_health",
        manufactureDate: "b.manufacture_date",
      };
      const orderCol = fieldMap[sort] || "b.created_at";
      const orderSql = order === "desc" ? "DESC" : "ASC";

      const { rows: [countRow] } = await pool.query(
        `SELECT count(*)::int AS total FROM batteries b ${whereSql}`,
        params
      );
      const total = countRow.total;

      const dataParams = [...params, limit, (page - 1) * limit];
      const { rows } = await pool.query(
        `SELECT b.*,${BATTERY_DERIVED}
         FROM batteries b ${BATTERY_MODEL_JOIN}
         ${whereSql}
         ORDER BY ${orderCol} ${orderSql}
         LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
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
        where.push(`s.customer_id = $${params.length}`);
      }
      if (status) {
        params.push(status);
        where.push(`s.status = $${params.length}`);
      }
      const q = String(search || "").trim();
      // `battery_name` is no longer a stored column: it is derived from the
      // battery, so the search joins the battery to match its name.
      const joinSql = q
        ? "LEFT JOIN batteries b_search ON b_search.battery_id = s.battery_id"
        : "";
      if (q) {
        params.push(`%${q}%`);
        const i = params.length;
        where.push(
          `(s.id ILIKE $${i} OR s.ticket_number ILIKE $${i} OR s.battery_id ILIKE $${i} OR
            b_search.name ILIKE $${i} OR s.service_type ILIKE $${i} OR
            s.center ILIKE $${i} OR s.status ILIKE $${i})`
        );
      }
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

      const fieldMap = {
        createdAt: "s.created_at",
        scheduledDate: "s.scheduled_date",
        status: "s.status",
        priority: "s.priority",
        ticketNumber: "s.ticket_number",
      };
      const orderCol = fieldMap[sort] || "s.created_at";
      const orderSql = order === "desc" ? "DESC" : "ASC";

      const { rows: [countRow] } = await pool.query(
        `SELECT count(*)::int AS total FROM services s ${joinSql} ${whereSql}`,
        params
      );
      const total = countRow.total;

      const dataParams = [...params, limit, (page - 1) * limit];
      // battery_name and technician are derived here rather than stored.
      const { rows } = await pool.query(
        `SELECT s.*,
                b.name AS __battery_name,
                sp.name AS __technician_name
           FROM services s
           ${joinSql}
           LEFT JOIN batteries b ON b.battery_id = s.battery_id
           LEFT JOIN service_persons sp ON sp.id = s.assigned_service_person_id
           ${whereSql}
          ORDER BY ${orderCol} ${orderSql}
          LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
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
        where.push(`sp.status = $${params.length}`);
      }
      const q = String(search || "").trim();
      if (q) {
        params.push(`%${q}%`);
        const i = params.length;
        where.push(
          `(sp.id ILIKE $${i} OR sp.technician_id ILIKE $${i} OR sp.name ILIKE $${i} OR
            sp.email ILIKE $${i} OR sp.specializations::text ILIKE $${i} OR sp.certification ILIKE $${i})`
        );
      }
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

      const fieldMap = { createdAt: "sp.created_at", name: "sp.name", status: "sp.status" };
      const orderCol = fieldMap[sort] || "sp.created_at";
      const orderSql = order === "desc" ? "DESC" : "ASC";

      const { rows: [countRow] } = await pool.query(
        `SELECT count(*)::int AS total FROM service_persons sp ${whereSql}`,
        params
      );
      const total = countRow.total;

      const dataParams = [...params, limit, (page - 1) * limit];
      const { rows } = await pool.query(
        `SELECT ${SERVICE_PERSON_SELECT} FROM service_persons sp ${whereSql} ORDER BY ${orderCol} ${orderSql} LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
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

    /* ------------------------------------------------------------
       INDIA BATTERY COMPLIANCE (BWMR 2022)
       Producers, per-battery records, EPR obligations/credits,
       document references and the append-only audit log.
       Vocabulary is validated by the controllers against
       backend/constants/compliance.js — never as opaque DB CHECKs.
    ------------------------------------------------------------ */

    async listComplianceProducers({
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
          `(producer_name ILIKE $${i} OR registration_number ILIKE $${i} OR
            producer_category ILIKE $${i} OR pan ILIKE $${i} OR gstin ILIKE $${i} OR
            contact_email ILIKE $${i})`
        );
      }
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const fieldMap = { createdAt: "created_at", producerName: "producer_name", status: "status" };
      const orderCol = fieldMap[sort] || "created_at";
      const orderSql = order === "desc" ? "DESC" : "ASC";

      const { rows: [countRow] } = await pool.query(
        `SELECT count(*)::int AS total FROM compliance_producers ${whereSql}`,
        params
      );
      const total = countRow.total;
      const dataParams = [...params, limit, (page - 1) * limit];
      const { rows } = await pool.query(
        `SELECT * FROM compliance_producers ${whereSql} ORDER BY ${orderCol} ${orderSql} LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
        dataParams
      );
      return {
        data: rows.map(mapComplianceProducerRow),
        pagination: buildPagination(page, limit, total),
      };
    },

    async getComplianceProducerById(id) {
      const { rows } = await pool.query(
        "SELECT * FROM compliance_producers WHERE id = $1 LIMIT 1",
        [Number(id)]
      );
      return mapComplianceProducerRow(rows[0]);
    },

    async isRegistrationNumberUnique(registrationNumber, excludeId = null) {
      if (!registrationNumber) return true;
      const { rows } = await pool.query(
        `SELECT 1 FROM compliance_producers
         WHERE LOWER(registration_number) = LOWER($1)
           AND ($2::int IS NULL OR id <> $2) LIMIT 1`,
        [registrationNumber, excludeId ? Number(excludeId) : null]
      );
      return rows.length === 0;
    },

    async createComplianceProducer(input) {
      const { rows } = await pool.query(
        `INSERT INTO compliance_producers (
           producer_name, registration_number, registration_valid_until, producer_category,
           pan, gstin, address, contact_email, contact_phone, website, status, notes
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          input.producerName,
          input.registrationNumber,
          input.registrationValidUntil || null,
          input.producerCategory || "Manufacturer",
          input.pan || null,
          input.gstin || null,
          input.address || null,
          input.contactEmail || null,
          input.contactPhone || null,
          input.website || null,
          input.status || "Active",
          input.notes || null,
        ]
      );
      return mapComplianceProducerRow(rows[0]);
    },

    async updateComplianceProducer(id, fields) {
      const current = await store.getComplianceProducerById(id);
      if (!current) return null;
      const next = { ...current, ...fields };
      const { rows } = await pool.query(
        `UPDATE compliance_producers SET
           producer_name = $2, registration_number = $3, registration_valid_until = $4,
           producer_category = $5, pan = $6, gstin = $7, address = $8,
           contact_email = $9, contact_phone = $10, website = $11, status = $12, notes = $13,
           updated_at = now()
         WHERE id = $1
         RETURNING *`,
        [
          id,
          next.producerName,
          next.registrationNumber,
          next.registrationValidUntil || null,
          next.producerCategory,
          next.pan || null,
          next.gstin || null,
          next.address || null,
          next.contactEmail || null,
          next.contactPhone || null,
          next.website || null,
          next.status,
          next.notes || null,
        ]
      );
      return mapComplianceProducerRow(rows[0]);
    },

    async deleteComplianceProducer(id) {
      const { rows } = await pool.query(
        "DELETE FROM compliance_producers WHERE id = $1 RETURNING *",
        [Number(id)]
      );
      return rows.length > 0 ? mapComplianceProducerRow(rows[0]) : false;
    },

    async listBatteryCompliance({
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
        where.push(`bc.compliance_status = $${params.length}`);
      }
      const q = String(search || "").trim();
      if (q) {
        params.push(`%${q}%`);
        const i = params.length;
        where.push(
          `(bc.battery_id ILIKE $${i} OR b.name ILIKE $${i} OR b.barcode ILIKE $${i} OR
            b.serial_number ILIKE $${i} OR p.producer_name ILIKE $${i})`
        );
      }
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const fieldMap = { createdAt: "created_at", batteryId: "battery_id", complianceStatus: "compliance_status" };
      const orderCol = fieldMap[sort] || "created_at";
      const orderSql = order === "desc" ? "DESC" : "ASC";

      const { rows: [countRow] } = await pool.query(
        `SELECT count(*)::int AS total
         FROM battery_compliance bc
         LEFT JOIN batteries b ON b.${batteryKey} = bc.battery_id
         LEFT JOIN compliance_producers p ON p.id = bc.producer_id
         ${whereSql}`,
        params
      );
      const total = countRow.total;

      const dataParams = [...params, limit, (page - 1) * limit];
      const { rows } = await pool.query(
        `SELECT bc.*, b.name AS battery_name, b.barcode AS battery_barcode,
                b.modal_id AS battery_modal_id, p.producer_name AS producer_display_name
         FROM battery_compliance bc
         LEFT JOIN batteries b ON b.${batteryKey} = bc.battery_id
         LEFT JOIN compliance_producers p ON p.id = bc.producer_id
         ${whereSql}
         ORDER BY bc.${orderCol} ${orderSql}
         LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
        dataParams
      );
      return {
        data: rows.map(mapBatteryComplianceRow),
        pagination: buildPagination(page, limit, total),
      };
    },

    async getBatteryCompliance(batteryId) {
      const { rows } = await pool.query(
        `SELECT bc.*, b.name AS battery_name, b.barcode AS battery_barcode,
                b.modal_id AS battery_modal_id
         FROM battery_compliance bc
         LEFT JOIN batteries b ON b.${batteryKey} = bc.battery_id
         WHERE bc.battery_id = $1 LIMIT 1`,
        [batteryId]
      );
      const row = rows[0];
      if (!row) return null;
      if (row.producer_id) {
        const { rows: pRows } = await pool.query(
          "SELECT * FROM compliance_producers WHERE id = $1 LIMIT 1",
          [row.producer_id]
        );
        row.__producer = pRows[0] || null;
      }
      return mapBatteryComplianceRow(row);
    },

     async createBatteryCompliance(input) {
      const { rows } = await pool.query(
        `INSERT INTO battery_compliance (
           battery_id, producer_id, framework, battery_category, collection_channel,
           compliance_status, verified_in_app, verified_at, notes,
           collection_status, collection_date, collection_location,
           refurbisher_id, refurbisher_name, refurbisher_details,
           recycler_id, recycler_name, recycler_registration,
           recycling_facility, recycling_date, recycling_status, recycling_certificate,
           epr_reference
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
         RETURNING *`,
        [
          input.batteryId,
          input.producerId || null,
          input.framework || "BWMR 2022",
          input.batteryCategory || null,
          input.collectionChannel || null,
          input.complianceStatus || "Pending",
          Boolean(input.verifiedInApp),
          input.verifiedAt || null,
          input.notes || null,
          input.collectionStatus || null,
          input.collectionDate || null,
          input.collectionLocation || null,
          input.refurbisherId || null,
          input.refurbisherName || null,
          input.refurbisherDetails || null,
          input.recyclerId || null,
          input.recyclerName || null,
          input.recyclerRegistration || null,
          input.recyclingFacility || null,
          input.recyclingDate || null,
          input.recyclingStatus || null,
          input.recyclingCertificate || null,
          input.eprReference || null,
        ]
      );
      return mapBatteryComplianceRow(rows[0]);
    },

    async updateBatteryCompliance(batteryId, fields) {
      const current = await store.getBatteryCompliance(batteryId);
      if (!current) return null;
      const next = { ...current, ...fields };
      if (next.verifiedInApp === false) next.verifiedAt = null;
      else if (next.verifiedInApp === true) next.verifiedAt = fields.verifiedAt || new Date().toISOString();
      else if (fields.verifiedAt) next.verifiedAt = fields.verifiedAt;
      const { rows } = await pool.query(
        `UPDATE battery_compliance SET
           producer_id = $2, framework = $3, battery_category = $4, collection_channel = $5,
           compliance_status = $6, verified_in_app = $7, verified_at = $8, notes = $9,
           collection_status = $10, collection_date = $11, collection_location = $12,
           refurbisher_id = $13, refurbisher_name = $14, refurbisher_details = $15,
           recycler_id = $16, recycler_name = $17, recycler_registration = $18,
           recycling_facility = $19, recycling_date = $20, recycling_status = $21, recycling_certificate = $22,
           epr_reference = $23,
           updated_at = now()
         WHERE battery_id = $1
         RETURNING *`,
        [
          batteryId,
          next.producerId || null,
          next.framework,
          next.batteryCategory || null,
          next.collectionChannel || null,
          next.complianceStatus,
          Boolean(next.verifiedInApp),
          next.verifiedAt || null,
          next.notes || null,
          next.collectionStatus || null,
          next.collectionDate || null,
          next.collectionLocation || null,
          next.refurbisherId || null,
          next.refurbisherName || null,
          next.refurbisherDetails || null,
          next.recyclerId || null,
          next.recyclerName || null,
          next.recyclerRegistration || null,
          next.recyclingFacility || null,
          next.recyclingDate || null,
          next.recyclingStatus || null,
          next.recyclingCertificate || null,
          next.eprReference || null,
        ]
      );
      const row = rows[0];
      if (!row) return null;
      if (row.producer_id) {
        const { rows: pRows } = await pool.query(
          "SELECT * FROM compliance_producers WHERE id = $1 LIMIT 1",
          [row.producer_id]
        );
        row.__producer = pRows[0] || null;
      }
      return mapBatteryComplianceRow(row);
    },

    async listComplianceObligations({
      producerId = null,
      financialYear = "",
      status = "",
      search = "",
      page = 1,
      limit = 20,
      sort = "",
      order = "asc",
    } = {}) {
      const params = [];
      const where = [];
      if (producerId) {
        params.push(Number(producerId));
        where.push(`producer_id = $${params.length}`);
      }
      if (financialYear) {
        params.push(financialYear);
        where.push(`financial_year = $${params.length}`);
      }
      if (status) {
        params.push(status);
        where.push(`status = $${params.length}`);
      }
      const q = String(search || "").trim();
      if (q) {
        params.push(`%${q}%`);
        const i = params.length;
        where.push(`(financial_year ILIKE $${i} OR battery_category ILIKE $${i} OR status ILIKE $${i})`);
      }
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const fieldMap = { createdAt: "created_at", financialYear: "financial_year", status: "status" };
      const orderCol = fieldMap[sort] || "created_at";
      const orderSql = order === "desc" ? "DESC" : "ASC";

      const { rows: [countRow] } = await pool.query(
        `SELECT count(*)::int AS total FROM epr_obligations ${whereSql}`,
        params
      );
      const total = countRow.total;
      const dataParams = [...params, limit, (page - 1) * limit];
      const { rows } = await pool.query(
        `SELECT * FROM epr_obligations ${whereSql} ORDER BY ${orderCol} ${orderSql} LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
        dataParams
      );
      return {
        data: rows.map(mapObligationRow),
        pagination: buildPagination(page, limit, total),
      };
    },

    async getComplianceObligationById(id) {
      const { rows } = await pool.query(
        "SELECT * FROM epr_obligations WHERE id = $1 LIMIT 1",
        [Number(id)]
      );
      return mapObligationRow(rows[0]);
    },

    async createComplianceObligation(input) {
      const { rows } = await pool.query(
        `INSERT INTO epr_obligations (
           producer_id, financial_year, battery_category, target_percent,
           obligation_kg, achieved_kg, status, notes
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          input.producerId,
          input.financialYear,
          input.batteryCategory || "Medium",
          input.targetPercent ?? null,
          input.obligationKg ?? null,
          input.achievedKg ?? 0,
          input.status || "Open",
          input.notes || null,
        ]
      );
      return mapObligationRow(rows[0]);
    },

    async updateComplianceObligation(id, fields) {
      const { rows: [currentRow] } = await pool.query(
        "SELECT * FROM epr_obligations WHERE id = $1 LIMIT 1",
        [Number(id)]
      );
      if (!currentRow) return null;
      const next = { ...mapObligationRow(currentRow), ...fields };
      const { rows } = await pool.query(
        `UPDATE epr_obligations SET
           producer_id = $2, financial_year = $3, battery_category = $4,
           target_percent = $5, obligation_kg = $6, achieved_kg = $7, status = $8, notes = $9,
           updated_at = now()
         WHERE id = $1
         RETURNING *`,
        [
          id,
          next.producerId,
          next.financialYear,
          next.batteryCategory,
          next.targetPercent ?? null,
          next.obligationKg ?? null,
          next.achievedKg ?? 0,
          next.status,
          next.notes || null,
        ]
      );
      return mapObligationRow(rows[0]);
    },

    async deleteComplianceObligation(id) {
      const { rows } = await pool.query(
        "DELETE FROM epr_obligations WHERE id = $1 RETURNING *",
        [Number(id)]
      );
      return rows.length > 0 ? mapObligationRow(rows[0]) : false;
    },

    async listComplianceCredits({
      obligationId = null,
      status = "",
      page = 1,
      limit = 20,
      sort = "",
      order = "asc",
    } = {}) {
      const params = [];
      const where = [];
      if (obligationId) {
        params.push(Number(obligationId));
        where.push(`obligation_id = $${params.length}`);
      }
      if (status) {
        params.push(status);
        where.push(`status = $${params.length}`);
      }
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const fieldMap = { createdAt: "created_at", certificateNumber: "certificate_number", status: "status" };
      const orderCol = fieldMap[sort] || "created_at";
      const orderSql = order === "desc" ? "DESC" : "ASC";

      const { rows: [countRow] } = await pool.query(
        `SELECT count(*)::int AS total FROM epr_credits ${whereSql}`,
        params
      );
      const total = countRow.total;
      const dataParams = [...params, limit, (page - 1) * limit];
      const { rows } = await pool.query(
        `SELECT * FROM epr_credits ${whereSql} ORDER BY ${orderCol} ${orderSql} LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
        dataParams
      );
      return {
        data: rows.map(mapCreditRow),
        pagination: buildPagination(page, limit, total),
      };
    },

    async isCertificateNumberUnique(certificateNumber, excludeId = null) {
      if (!certificateNumber) return true;
      const { rows } = await pool.query(
        `SELECT 1 FROM epr_credits
         WHERE LOWER(certificate_number) = LOWER($1)
           AND ($2::int IS NULL OR id <> $2) LIMIT 1`,
        [certificateNumber, excludeId ? Number(excludeId) : null]
      );
      return rows.length === 0;
    },

    async getComplianceCreditById(id) {
      const { rows } = await pool.query(
        "SELECT * FROM epr_credits WHERE id = $1 LIMIT 1",
        [Number(id)]
      );
      return mapCreditRow(rows[0]);
    },

    async createComplianceCredit(input) {
      const { rows } = await pool.query(
        `INSERT INTO epr_credits (
           obligation_id, certificate_number, quantity_kg, issue_date, valid_until, status, notes
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          input.obligationId,
          input.certificateNumber,
          input.quantityKg ?? 0,
          input.issueDate || null,
          input.validUntil || null,
          input.status || "Active",
          input.notes || null,
        ]
      );
      return mapCreditRow(rows[0]);
    },

    async updateComplianceCredit(id, fields) {
      const { rows: [currentRow] } = await pool.query(
        "SELECT * FROM epr_credits WHERE id = $1 LIMIT 1",
        [Number(id)]
      );
      if (!currentRow) return null;
      const next = { ...mapCreditRow(currentRow), ...fields };
      const { rows } = await pool.query(
        `UPDATE epr_credits SET
           obligation_id = $2, certificate_number = $3, quantity_kg = $4,
           issue_date = $5, valid_until = $6, status = $7, notes = $8,
           updated_at = now()
         WHERE id = $1
         RETURNING *`,
        [
          id,
          next.obligationId,
          next.certificateNumber,
          next.quantityKg ?? 0,
          next.issueDate || null,
          next.validUntil || null,
          next.status,
          next.notes || null,
        ]
      );
      return mapCreditRow(rows[0]);
    },

    async deleteComplianceCredit(id) {
      const { rows } = await pool.query(
        "DELETE FROM epr_credits WHERE id = $1 RETURNING *",
        [Number(id)]
      );
      return rows.length > 0 ? mapCreditRow(rows[0]) : false;
    },

    async listComplianceDocuments({
      batteryId = "",
      producerId = null,
      documentType = "",
      status = "",
      page = 1,
      limit = 20,
      sort = "",
      order = "asc",
    } = {}) {
      const params = [];
      const where = [];
      if (batteryId) {
        params.push(batteryId);
        where.push(`battery_id = $${params.length}`);
      }
      if (producerId) {
        params.push(Number(producerId));
        where.push(`producer_id = $${params.length}`);
      }
      if (documentType) {
        params.push(documentType);
        where.push(`document_type = $${params.length}`);
      }
      if (status) {
        params.push(status);
        where.push(`status = $${params.length}`);
      }
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const fieldMap = { createdAt: "created_at", documentName: "document_name", status: "status" };
      const orderCol = fieldMap[sort] || "created_at";
      const orderSql = order === "desc" ? "DESC" : "ASC";

      const { rows: [countRow] } = await pool.query(
        `SELECT count(*)::int AS total FROM compliance_documents ${whereSql}`,
        params
      );
      const total = countRow.total;
      const dataParams = [...params, limit, (page - 1) * limit];
      const { rows } = await pool.query(
        `SELECT * FROM compliance_documents ${whereSql} ORDER BY ${orderCol} ${orderSql} LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
        dataParams
      );
      return {
        data: rows.map(mapDocumentRow),
        pagination: buildPagination(page, limit, total),
      };
    },

    async getComplianceDocumentById(id) {
      const { rows } = await pool.query(
        "SELECT * FROM compliance_documents WHERE id = $1 LIMIT 1",
        [Number(id)]
      );
      return mapDocumentRow(rows[0]);
    },

    async createComplianceDocument(input) {
      const { rows } = await pool.query(
        `INSERT INTO compliance_documents (
           battery_id, producer_id, document_type, document_name, document_number,
           issued_by, issued_on, expires_on, status, notes
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          input.batteryId || null,
          input.producerId || null,
          input.documentType,
          input.documentName,
          input.documentNumber || null,
          input.issuedBy || null,
          input.issuedOn || null,
          input.expiresOn || null,
          input.status || "Pending Review",
          input.notes || null,
        ]
      );
      return mapDocumentRow(rows[0]);
    },

    async updateComplianceDocument(id, fields) {
      const { rows: [currentRow] } = await pool.query(
        "SELECT * FROM compliance_documents WHERE id = $1 LIMIT 1",
        [Number(id)]
      );
      if (!currentRow) return null;
      const next = { ...mapDocumentRow(currentRow), ...fields };
      const { rows } = await pool.query(
        `UPDATE compliance_documents SET
           battery_id = $2, producer_id = $3, document_type = $4, document_name = $5,
           document_number = $6, issued_by = $7, issued_on = $8, expires_on = $9,
           status = $10, notes = $11, updated_at = now()
         WHERE id = $1
         RETURNING *`,
        [
          id,
          next.batteryId || null,
          next.producerId || null,
          next.documentType,
          next.documentName,
          next.documentNumber || null,
          next.issuedBy || null,
          next.issuedOn || null,
          next.expiresOn || null,
          next.status,
          next.notes || null,
        ]
      );
      return mapDocumentRow(rows[0]);
    },

    async deleteComplianceDocument(id) {
      const { rows } = await pool.query(
        "DELETE FROM compliance_documents WHERE id = $1 RETURNING *",
        [Number(id)]
      );
      return rows.length > 0 ? mapDocumentRow(rows[0]) : false;
    },

    async listComplianceEvents({
      batteryId = "",
      producerId = null,
      eventType = "",
      page = 1,
      limit = 20,
      sort = "",
      order = "desc",
    } = {}) {
      const params = [];
      const where = [];
      if (batteryId) {
        params.push(batteryId);
        where.push(`battery_id = $${params.length}`);
      }
      if (producerId) {
        params.push(Number(producerId));
        where.push(`producer_id = $${params.length}`);
      }
      if (eventType) {
        params.push(eventType);
        where.push(`event_type = $${params.length}`);
      }
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const fieldMap = { createdAt: "created_at", eventType: "event_type" };
      const orderCol = fieldMap[sort] || "created_at";
      const orderSql = order === "desc" ? "DESC" : "ASC";

      const { rows: [countRow] } = await pool.query(
        `SELECT count(*)::int AS total FROM compliance_events ${whereSql}`,
        params
      );
      const total = countRow.total;
      const dataParams = [...params, limit, (page - 1) * limit];
      const { rows } = await pool.query(
        `SELECT * FROM compliance_events ${whereSql} ORDER BY ${orderCol} ${orderSql}, id ${orderSql} LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
        dataParams
      );
      return {
        data: rows.map(mapComplianceEventRow),
        pagination: buildPagination(page, limit, total),
      };
    },

    async addComplianceEvent(input) {
      const { rows } = await pool.query(
        `INSERT INTO compliance_events (battery_id, producer_id, event_type, event_description, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          input.batteryId || null,
          input.producerId || null,
          input.eventType,
          input.eventDescription || "",
          input.createdBy || null,
        ]
      );
      return mapComplianceEventRow(rows[0]);
    },

    async getComplianceOverview() {
      const { rows: [r] } = await pool.query(
        `SELECT
           (SELECT count(*)::int FROM compliance_producers) AS producers,
           (SELECT count(*)::int FROM compliance_producers WHERE status = 'Active') AS active_producers,
           (SELECT count(*)::int FROM battery_compliance) AS batteries_tracked,
           (SELECT count(*)::int FROM battery_compliance WHERE compliance_status = 'Compliant') AS compliant,
           (SELECT count(*)::int FROM battery_compliance WHERE compliance_status = 'Pending') AS pending,
           (SELECT count(*)::int FROM battery_compliance WHERE compliance_status = 'In Progress') AS in_progress,
           (SELECT count(*)::int FROM battery_compliance WHERE compliance_status = 'Non-Compliant') AS non_compliant,
           (SELECT count(*)::int FROM epr_obligations WHERE status = 'Open') AS open_obligations,
           (SELECT count(*)::int FROM epr_credits WHERE status = 'Active') AS credits_active`
      );
      return {
        producers: r.producers,
        activeProducers: r.active_producers,
        batteriesTracked: r.batteries_tracked,
        compliant: r.compliant,
        pending: r.pending,
        inProgress: r.in_progress,
        nonCompliant: r.non_compliant,
        openObligations: r.open_obligations,
        creditsActive: r.credits_active,
      };
    },

    /* ============================================================
       FLEET MAP + BATTERY LOCATIONS
       battery_locations holds one row per battery; battery_location_history
       is append-only. listMapBatteries starts from located batteries only,
       applies the caller's OWNER / EMPLOYEE scope, then builds markers with
       the shared builder (backend/utils/mapMarker.js). Summary counts and
       region totals are computed over the FULL filtered set so stats and
       filters agree with the rendered clusters.
    ============================================================ */

    async getBatteryLocation(batteryId) {
      const { rows } = await pool.query(
        "SELECT * FROM battery_locations WHERE battery_id = $1 LIMIT 1",
        [batteryId]
      );
      return mapBatteryLocationRow(rows[0]);
    },

    async listBatteryLocations({
      search = "",
      country = "",
      state = "",
      city = "",
      site = "",
      locationType = "",
      page = 1,
      limit = 20,
      sort = "",
      order = "asc",
    } = {}) {
      const params = [];
      const where = [];
      const addEq = (col, value) => {
        if (value) {
          params.push(value);
          where.push(`loc.${col} = $${params.length}`);
        }
      };
      addEq("country", country);
      addEq("state", state);
      addEq("city", city);
      addEq("location_type", locationType);
      if (site) {
        params.push(`%${site}%`);
        where.push(`loc.site_name ILIKE $${params.length}`);
      }
      const q = String(search || "").trim();
      if (q) {
        params.push(`%${q}%`);
        const i = params.length;
        where.push(
          `(loc.battery_id ILIKE $${i} OR b.name ILIKE $${i} OR b.barcode ILIKE $${i} OR
            loc.address ILIKE $${i} OR loc.city ILIKE $${i} OR loc.state ILIKE $${i} OR
            loc.country ILIKE $${i} OR loc.site_name ILIKE $${i})`
        );
      }
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const fieldMap = {
        createdAt: "created_at",
        updatedAt: "updated_at",
        batteryId: "battery_id",
        country: "country",
        city: "city",
      };
      const orderCol = fieldMap[sort] || "updated_at";
      const orderSql = order === "desc" ? "DESC" : "ASC";

      const { rows: [countRow] } = await pool.query(
        `SELECT count(*)::int AS total
         FROM battery_locations loc
         LEFT JOIN batteries b ON b.${batteryKey} = loc.battery_id
         ${whereSql}`,
        params
      );
      const total = countRow.total;

      const dataParams = [...params, limit, (page - 1) * limit];
      const { rows } = await pool.query(
        `SELECT loc.*, b.name AS battery_name, b.barcode AS battery_barcode,
                b.model_name AS battery_model
         FROM battery_locations loc
         LEFT JOIN batteries b ON b.${batteryKey} = loc.battery_id
         ${whereSql}
         ORDER BY loc.${orderCol} ${orderSql}, loc.id ${orderSql}
         LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
        dataParams
      );
      return {
        data: rows.map((r) => ({
          ...mapBatteryLocationRow(r),
          batteryName: r.battery_name || null,
          batteryBarcode: r.battery_barcode || null,
          batteryModel: r.battery_model || null,
        })),
        pagination: buildPagination(page, limit, total),
      };
    },

    async saveBatteryLocation(batteryId, fields, { actorId = null, reason = "" } = {}) {
      const locate = (l) =>
        l
          ? {
              latitude: l.latitude,
              longitude: l.longitude,
              address: l.address,
              city: l.city,
              state: l.state,
              country: l.country,
              siteName: l.site_name,
              locationType: l.location_type,
            }
          : null;
      const { rows: [current] } = await pool.query(
        "SELECT * FROM battery_locations WHERE battery_id = $1 LIMIT 1",
        [batteryId]
      );
      const isCurrent = fields.isCurrent === undefined ? true : Boolean(fields.isCurrent);
      let row;
      if (current) {
        const { rows } = await pool.query(
          `UPDATE battery_locations SET
             latitude = $2, longitude = $3, address = $4, city = $5, state = $6,
             country = $7, site_name = $8, location_type = $9, is_current = $10,
             updated_at = now()
           WHERE battery_id = $1
           RETURNING *`,
          [
            batteryId,
            fields.latitude,
            fields.longitude,
            fields.address,
            fields.city,
            fields.state,
            fields.country,
            fields.siteName,
            fields.locationType,
            isCurrent,
          ]
        );
        row = rows[0];
      } else {
        const { rows } = await pool.query(
          `INSERT INTO battery_locations
             (battery_id, latitude, longitude, address, city, state, country, site_name, location_type, is_current)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING *`,
          [
            batteryId,
            fields.latitude,
            fields.longitude,
            fields.address,
            fields.city,
            fields.state,
            fields.country,
            fields.siteName,
            fields.locationType,
            isCurrent,
          ]
        );
        row = rows[0];
      }
      const changed = JSON.stringify(locate(current)) !== JSON.stringify(locate(row));
      if (!current || changed) {
        const prev = locate(current) || {};
        const next = locate(row);
        await pool.query(
          `INSERT INTO battery_location_history
             (battery_id, previous_location_id, new_location_id, moved_at, reason, created_by,
              prev_latitude, prev_longitude, prev_address, prev_city, prev_state, prev_country, prev_site_name,
              new_latitude, new_longitude, new_address, new_city, new_state, new_country, new_site_name)
           VALUES ($1, $2, $3, now(), $4, $5,
                   $6, $7, $8, $9, $10, $11, $12,
                   $13, $14, $15, $16, $17, $18, $19)`,
          [
            batteryId,
            current?.id ?? null,
            row.id,
            reason || null,
            actorId || null,
            prev.latitude,
            prev.longitude,
            prev.address,
            prev.city,
            prev.state,
            prev.country,
            prev.siteName,
            next.latitude,
            next.longitude,
            next.address,
            next.city,
            next.state,
            next.country,
            next.siteName,
          ]
        );
      }
      return mapBatteryLocationRow(row);
    },

    async deleteBatteryLocation(batteryId) {
      const { rows } = await pool.query(
        "DELETE FROM battery_locations WHERE battery_id = $1 RETURNING id",
        [batteryId]
      );
      return rows.length > 0;
    },

    async getBatteryLocationHistory(batteryId) {
      const { rows } = await pool.query(
        `SELECT *
         FROM battery_location_history
         WHERE battery_id = $1
         ORDER BY moved_at DESC, id DESC`,
        [batteryId]
      );
      return rows.map(mapLocationHistoryRow);
    },

    async listMapBatteries({
      ownerId = null,
      employeePersonId = null,
      includeOwner = false,
      page = 1,
      limit = 50,
      search = "",
      complianceStatus = "",
      batteryStatus = "",
      serviceStatus = "",
      healthStatus = "",
      country = "",
      state = "",
      city = "",
      site = "",
      locationType = "",
      bbox = null,
      sort = "",
      order = "asc",
    } = {}) {
      const params = [];
      const where = [];

      if (ownerId) {
        params.push(ownerId);
        where.push(`b.owner_id = $${params.length}`);
      }
      if (employeePersonId) {
        params.push(employeePersonId);
        where.push(
          `EXISTS (SELECT 1 FROM services svc WHERE svc.battery_id = loc.battery_id AND svc.assigned_service_person_id = $${params.length})`
        );
      }
      if (complianceStatus) {
        const map = {
          compliant: `c.compliance_status = 'Compliant'`,
          pending: `c.compliance_status = 'Pending'`,
          under_review: `c.compliance_status = 'In Progress'`,
          non_compliant: `c.compliance_status = 'Non-Compliant'`,
          not_applicable: `(c.compliance_status = 'Exempt' OR c.battery_id IS NULL)`,
        };
        if (map[complianceStatus]) where.push(map[complianceStatus]);
      }
      if (batteryStatus) {
  // `hang_status` is a real BOOLEAN now, so these are plain boolean
  // predicates instead of string comparisons against a text column.
  const hangIs = `b.hang_status IS TRUE`;
  const hangNot = `b.hang_status IS NOT TRUE`;
        const map = {
          in_service: `UPPER(TRIM(b.overall_status)) = 'PROD' AND ${hangNot}`,
          fg_pending: `UPPER(TRIM(b.overall_status)) = 'FG PENDING' AND ${hangNot}`,
          defect_hold: hangIs,
        };
        if (map[batteryStatus]) where.push(map[batteryStatus]);
      }
      if (serviceStatus) {
        if (serviceStatus === "active") {
          params.push(ACTIVE_SERVICE_STATUSES);
          where.push(`sv.status = ANY($${params.length}::text[])`);
        } else if (serviceStatus === "completed") {
          where.push(`sv.status = 'Completed'`);
        } else if (serviceStatus === "none") {
          params.push(ACTIVE_SERVICE_STATUSES);
          where.push(
            `(sv.id IS NULL OR (sv.status <> ALL($${params.length}::text[]) AND sv.status <> 'Completed'))`
          );
        }
      }
      if (healthStatus) {
        const sohExpr = "COALESCE(b.state_of_health, pk.soh)";
        const map = {
          healthy: `${sohExpr} >= 90`,
          warning: `(${sohExpr} >= 80 AND ${sohExpr} < 90)`,
          critical: `${sohExpr} < 80`,
        };
        if (map[healthStatus]) where.push(map[healthStatus]);
      }
      const addEq = (col, value) => {
        if (value) {
          params.push(value);
          where.push(`lower(loc.${col}) = lower($${params.length})`);
        }
      };
      addEq("country", country);
      addEq("state", state);
      addEq("city", city);
      if (site) {
        params.push(`%${site}%`);
        where.push(`loc.site_name ILIKE $${params.length}`);
      }
      if (locationType) {
        params.push(locationType);
        where.push(`loc.location_type = $${params.length}`);
      }
      if (bbox) {
        params.push(bbox.minLat, bbox.maxLat, bbox.minLng, bbox.maxLng);
        const k = params.length - 3;
        where.push(
          `(loc.latitude IS NOT NULL AND loc.longitude IS NOT NULL AND loc.latitude >= $${k} AND loc.latitude <= $${k + 1} AND loc.longitude >= $${k + 2} AND loc.longitude <= $${k + 3})`
        );
      }
      const q = String(search || "").trim();
      if (q) {
        params.push(`%${q}%`);
        const i = params.length;
        where.push(
          `(loc.battery_id ILIKE $${i} OR b.name ILIKE $${i} OR b.serial_number ILIKE $${i} OR
              b.barcode ILIKE $${i} OR b.model_name ILIKE $${i} OR
            b.manufacturer ILIKE $${i} OR b.type ILIKE $${i} OR
            loc.site_name ILIKE $${i} OR loc.city ILIKE $${i} OR loc.state ILIKE $${i} OR
            loc.country ILIKE $${i} OR p.producer_name ILIKE $${i} OR
            u.name ILIKE $${i} OR u.email ILIKE $${i})`
        );
      }
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

      const serviceLateral = `
        LEFT JOIN LATERAL (
          SELECT id, status, created_at
          FROM services sv
          WHERE sv.battery_id = loc.battery_id
          ORDER BY sv.created_at DESC, sv.id DESC
          LIMIT 1
        ) sv ON true`;
      /* State of health is measured, never guessed: the latest pack test is
         divided by the rated Ah parsed out of its own specification string. */
      const healthLateral = `
        LEFT JOIN LATERAL (
          SELECT
            CASE
              WHEN tt.discharging_capacity IS NOT NULL AND tt.discharging_capacity > 0
                AND rr.rated IS NOT NULL AND rr.rated > 0
                THEN round((tt.discharging_capacity / rr.rated)::numeric * (100)::numeric, 2)
              WHEN tt.actual_cap IS NOT NULL AND tt.actual_cap > 0
                AND rr.rated IS NOT NULL AND rr.rated > 0
                THEN round((tt.actual_cap / rr.rated)::numeric * (100)::numeric, 2)
              ELSE NULL
            END AS soh
          FROM (
            SELECT specification, discharging_capacity, actual_cap
            FROM pack_testing_reports
            WHERE battery_id = loc.battery_id
            ORDER BY test_date DESC, id DESC
            LIMIT 1
          ) tt
          CROSS JOIN LATERAL (
            SELECT CAST((regexp_match(tt.specification, '(\\d+(?:\\.\\d+)?)\\s*[Aa][Hh]?'))[1] AS numeric) AS rated
          ) rr
        ) pk ON true`;

      const ownerSelect = includeOwner
        ? `u.id AS owner_user_id, u.name AS owner_user_name, u.email AS owner_user_email, u.role AS owner_user_role`
        : `NULL::text AS owner_user_id, NULL::text AS owner_user_name, NULL::text AS owner_user_email, NULL::text AS owner_user_role`;

      const fieldMap = { updatedAt: "loc.updated_at", batteryId: "loc.battery_id", country: "loc.country", state: "loc.state", city: "loc.city" };
      const orderCol = fieldMap[sort] || "loc.updated_at";
      const orderSql = order === "desc" ? "DESC" : "ASC";

      const { rows: [countRow] } = await pool.query(
        `SELECT count(*)::int AS total
         FROM battery_locations loc
         JOIN batteries b ON b.${batteryKey} = loc.battery_id
         LEFT JOIN battery_compliance c ON c.battery_id = loc.battery_id
         LEFT JOIN compliance_producers p ON p.id = c.producer_id
         LEFT JOIN users u ON u.id = b.owner_id
         ${serviceLateral}
         ${healthLateral}
         ${whereSql}`,
        params
      );
      const total = countRow.total;

      const dataParams = [...params, limit, (page - 1) * limit];
      const { rows } = await pool.query(
        `SELECT loc.id AS loc_row_id, loc.battery_id AS loc_battery_id,
                loc.latitude, loc.longitude, loc.address, loc.city, loc.state, loc.country,
                loc.site_name, loc.location_type, loc.is_current,
                loc.created_at AS loc_created_at, loc.updated_at AS loc_updated_at,
                b.*,${BATTERY_DERIVED},
                c.compliance_status, c.verified_in_app, p.producer_name,
                sv.id AS service_id, sv.status AS service_status, sv.created_at AS service_created_at,
                pk.soh AS __state_of_health, ${ownerSelect}
         FROM battery_locations loc
         JOIN batteries b ON b.${batteryKey} = loc.battery_id
         ${BATTERY_MODEL_JOIN}
         LEFT JOIN battery_compliance c ON c.battery_id = loc.battery_id
         LEFT JOIN compliance_producers p ON p.id = c.producer_id
         LEFT JOIN users u ON u.id = b.owner_id
         ${serviceLateral}
         ${healthLateral}
         ${whereSql}
         ORDER BY ${orderCol} ${orderSql}, loc.id ${orderSql}
         LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
        dataParams
      );

      const data = rows.map((r) => {
        const location = {
          id: r.loc_row_id,
          batteryId: r.loc_battery_id,
          latitude: r.latitude === null ? null : Number(r.latitude),
          longitude: r.longitude === null ? null : Number(r.longitude),
          address: r.address || null,
          city: r.city || null,
          state: r.state || null,
          country: r.country || null,
          siteName: r.site_name || null,
          locationType: r.location_type,
          isCurrent: Boolean(r.is_current),
          createdAt: toIso(r.loc_created_at),
          updatedAt: toIso(r.loc_updated_at),
        };
        const compliance = r.compliance_status
          ? {
              complianceStatus: r.compliance_status,
              verifiedInApp: Boolean(r.verified_in_app),
            }
          : null;
        const owner =
          includeOwner && r.owner_user_id
            ? {
                id: r.owner_user_id,
                name: r.owner_user_name,
                email: r.owner_user_email,
                role: r.owner_user_role,
              }
            : null;
        return buildMapMarker({
          battery: mapBatteryRow(r),
          location,
          compliance,
          producerName: r.producer_name || null,
          services: r.service_id
            ? [{ id: r.service_id, status: r.service_status, createdAt: toIso(r.service_created_at) }]
            : [],
          owner,
        });
      });

      /* Summary + region totals over the FULL filtered set (not the page),
         so headline stats always reflect the applied filters. */
      const sohFilter = "COALESCE(b.state_of_health, pk.soh)";
      const activeIdx = params.length + 1;
      const summaryResult = await pool.query(
          `SELECT
             count(*)::int AS total,
             count(*) FILTER (WHERE loc.latitude IS NOT NULL AND loc.longitude IS NOT NULL)::int AS plotted,
             count(*) FILTER (WHERE c.compliance_status = 'Compliant')::int AS compliant,
             count(*) FILTER (WHERE c.compliance_status = 'Pending')::int AS pending,
             count(*) FILTER (WHERE c.compliance_status = 'In Progress')::int AS under_review,
             count(*) FILTER (WHERE c.compliance_status = 'Non-Compliant')::int AS non_compliant,
             count(*) FILTER (WHERE c.compliance_status = 'Exempt')::int AS not_applicable,
             count(*) FILTER (WHERE c.battery_id IS NULL)::int AS not_tracked,
             count(*) FILTER (WHERE ${sohFilter} >= 90)::int AS healthy,
             count(*) FILTER (WHERE ${sohFilter} >= 80 AND ${sohFilter} < 90)::int AS warning,
             count(*) FILTER (WHERE ${sohFilter} < 80)::int AS critical,
             count(*) FILTER (WHERE ${sohFilter} IS NULL)::int AS health_unknown,
    count(*) FILTER (WHERE UPPER(TRIM(b.overall_status)) = 'PROD' AND b.hang_status IS NOT TRUE)::int AS in_service,
    count(*) FILTER (WHERE UPPER(TRIM(b.overall_status)) = 'FG PENDING' AND b.hang_status IS NOT TRUE)::int AS fg_pending,
    count(*) FILTER (WHERE b.hang_status IS TRUE)::int AS defect_hold,
             count(*) FILTER (WHERE sv.status = ANY($${activeIdx}::text[]))::int AS service_active,
             count(*) FILTER (WHERE sv.status = 'Completed')::int AS service_completed,
             count(*) FILTER (WHERE sv.id IS NULL OR (sv.status <> ALL($${activeIdx}::text[]) AND sv.status <> 'Completed'))::int AS service_none
           FROM battery_locations loc
           JOIN batteries b ON b.${batteryKey} = loc.battery_id
           LEFT JOIN battery_compliance c ON c.battery_id = loc.battery_id
           LEFT JOIN compliance_producers p ON p.id = c.producer_id
           LEFT JOIN users u ON u.id = b.owner_id
           ${serviceLateral}
           ${healthLateral}
           ${whereSql}`,
          [...params, ACTIVE_SERVICE_STATUSES]
        );
      const summaryRow = summaryResult.rows[0];

      const regionSql = (col, nameAlias) => `
        SELECT ${col} AS name, count(*)::int AS count
        FROM battery_locations loc
        JOIN batteries b ON b.${batteryKey} = loc.battery_id
        LEFT JOIN battery_compliance c ON c.battery_id = loc.battery_id
        LEFT JOIN compliance_producers p ON p.id = c.producer_id
        LEFT JOIN users u ON u.id = b.owner_id
        ${serviceLateral}
        ${healthLateral}
        ${whereSql}
        AND (${col} IS NOT NULL AND ${col} <> '')
        GROUP BY ${col}
        ORDER BY count DESC, name
        LIMIT 20`;
      const [countries, states, locationTypes] = await Promise.all([
        pool.query(regionSql("loc.country", "name"), params),
        pool.query(regionSql("loc.state", "name"), params),
        pool.query(regionSql("loc.location_type", "name"), params),
      ]);
      const strip = (r) => r.map((x) => ({ name: String(x.name), count: x.count }));

      return {
        data,
        pagination: buildPagination(page, limit, total),
        summary: {
          total,
          plotted: summaryRow.plotted,
          byCompliance: {
            compliant: summaryRow.compliant,
            pending: summaryRow.pending,
            underReview: summaryRow.under_review,
            nonCompliant: summaryRow.non_compliant,
            notApplicable: summaryRow.not_applicable,
            notTracked: summaryRow.not_tracked,
          },
          byHealth: {
            healthy: summaryRow.healthy,
            warning: summaryRow.warning,
            critical: summaryRow.critical,
            unknown: summaryRow.health_unknown,
          },
          byLifecycle: {
            inService: summaryRow.in_service,
            fgPending: summaryRow.fg_pending,
            defectHold: summaryRow.defect_hold,
            unknown: summaryRow.total - summaryRow.in_service - summaryRow.fg_pending - summaryRow.defect_hold,
          },
          byService: {
            active: summaryRow.service_active,
            completed: summaryRow.service_completed,
            none: summaryRow.service_none,
          },
          byCountry: strip(countries.rows),
          byState: strip(states.rows),
          byLocationType: strip(locationTypes.rows),
        },
      };
    },
  };

  /* ------------------------------------------------------------
     HIERARCHICAL COMPLIANCE MANAGEMENT
     Companies → battery models → individual batteries, with the
     configurable type catalogue and expiry thresholds. Implemented in
     data/compliance/postgres.js and attached after the object literal
     because those methods call back into `store` (e.g. re-reading a
     record with its joins). The vocabulary is validated in the service
     layer against backend/constants/complianceManagement.js.
  ------------------------------------------------------------ */
  Object.assign(
    store,
    createComplianceManagementStore({
      pool,
      store,
      batteryKey,
      modelKey: "model_id",
      hasModelsTable,
      hasBatteryModelLink,
      buildPagination,
    })
  );

  return store;
};

export default null;
