/* ============================================================
   COMPLIANCE MANAGEMENT — PostgreSQL store methods
   Company → Battery Model → Compliance Record → Batteries, plus the
   configurable type catalogue and the expiry thresholds.

   Production shape notes (maxvolt_prod, verified against the live
   schema) — every query below is written against these, not against
   assumptions:
     • batteries      : PK `battery_id`; `model_id` → battery_models.model_id
     • battery_models : PK `model_id`; NO model_name column, so the model
                        label shown in the admin table is model_id
     • batteries      : status lives in `overall_status`, customer in
                        `owner_id`; there is no `id` or `customer_id`
   `batteryKey` is the only shape-dependent column, and it is detected
   once at startup (the same pattern the BWMR repository uses).

   Design notes
   ------------
   • Company scoping is pushed into SQL as an extra predicate rather
     than filtered in JavaScript, so a company admin can never see
     another company's rows and pagination totals stay correct.
   • Expiry / deadline buckets are NOT computed in SQL: they depend on
     the configurable thresholds, so they are attached by the service
     layer from the compliance_settings row. Queries only filter on raw
     dates using thresholds the caller resolved from those settings.
   • Binary documents are never stored here — compliance_documents keeps
     a file name plus an external storage reference, exactly like the
     existing metadata-only document model.
   ============================================================ */

const toIso = (value) => (value instanceof Date ? value.toISOString() : value);

/* A DATE column arrives from the driver as a Date pinned to LOCAL
   midnight, so it must be read back with local date parts. Using
   toISOString() here would shift every date by a day east of UTC —
   the same rule the existing mappers in data/postgres/index.js follow. */
const toDateString = (value) => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const raw = String(value);
  const timeIndex = raw.indexOf("T");
  return timeIndex >= 0 ? raw.slice(0, timeIndex) : raw.slice(0, 10);
};

const num = (value) => (value === null || value === undefined ? null : Number(value));

/* ---------- row mappers ---------- */

const mapCompanyRow = (row) =>
  row
    ? {
        id: row.id,
        name: row.name,
        code: row.code || null,
        legalName: row.legal_name || null,
        registrationNumber: row.registration_number || null,
        authority: row.authority || null,
        country: row.country || "India",
        contactEmail: row.contact_email || null,
        contactPhone: row.contact_phone || null,
        address: row.address || null,
        status: row.status || "Active",
        notes: row.notes || null,
        isDevelopmentData: Boolean(row.is_development_data),
        createdAt: toIso(row.created_at),
        updatedAt: toIso(row.updated_at),
        recordCount: row.record_count === undefined ? undefined : Number(row.record_count || 0),
        modelCount: row.model_count === undefined ? undefined : Number(row.model_count || 0),
      }
    : null;

const mapTypeRow = (row) =>
  row
    ? {
        id: row.id,
        code: row.code,
        label: row.label,
        description: row.description || null,
        authority: row.authority || null,
        regulationName: row.regulation_name || null,
        defaultLevel: row.default_level,
        defaultApplicability: row.default_applicability || "Applicable",
        requiresCertificate: Boolean(row.requires_certificate),
        requiresTestReport: Boolean(row.requires_test_report),
        requiresCapacity: Boolean(row.requires_capacity),
        requiresExpiry: row.requires_expiry !== false,
        isActive: row.is_active !== false,
        sortOrder: row.sort_order ?? 100,
        isDevelopmentData: Boolean(row.is_development_data),
        createdAt: toIso(row.created_at),
        updatedAt: toIso(row.updated_at),
      }
    : null;

const mapSettingsRow = (row) =>
  row
    ? {
        id: row.id,
        expiryWarningDays: row.expiry_warning_days,
        deadlineSoonDays: row.deadline_soon_days,
        reviewIntervalDays: row.review_interval_days,
        showDevelopmentData: Boolean(row.show_development_data),
        updatedBy: row.updated_by || null,
        updatedAt: toIso(row.updated_at),
      }
    : null;

/* `level` is a pure function of the two link columns, so it is derived
   here rather than stored — it can never drift out of sync with the
   scope the record actually applies to. */
const mapRecordRow = (row) =>
  row
    ? {
        id: row.id,
        companyId: row.company_id,
        batteryModelId: row.battery_model_id || null,
        batteryId: row.battery_id || null,
        level: row.battery_id ? "BATTERY" : row.battery_model_id ? "BATTERY_MODEL" : "COMPANY",
        complianceType: row.compliance_type,
        authority: row.authority || null,
        regulationName: row.regulation_name || null,
        standardNumber: row.standard_number || null,
        registrationNumber: row.registration_number || null,
        certificateNumber: row.certificate_number || null,
        status: row.status,
        applicability: row.applicability || "Applicable",
        issueDate: toDateString(row.issue_date),
        expiryDate: toDateString(row.expiry_date),
        complianceDeadline: toDateString(row.compliance_deadline),
        lastVerifiedAt: toIso(row.last_verified_at),
        nextReviewDate: toDateString(row.next_review_date),
        verifiedBy: row.verified_by || null,
        verifiedByNotes: row.verified_by_notes || null,
        testLab: row.test_lab || null,
        testDate: toDateString(row.test_date),
        testStandard: row.test_standard || null,
        testClause: row.test_clause || null,
        declaredCapacityAh: num(row.declared_capacity_ah),
        verifiedCapacityAh: num(row.verified_capacity_ah),
        testTemperatureC: num(row.test_temperature_c),
        notes: row.notes || null,
        internalComments: row.internal_comments || null,
        isDevelopmentData: Boolean(row.is_development_data),
        createdBy: row.created_by || null,
        createdAt: toIso(row.created_at),
        updatedAt: toIso(row.updated_at),
        companyName: row.company_name || undefined,
        batteryModelName: row.battery_model_name || undefined,
        batteryName: row.battery_name || undefined,
        documentCount: row.document_count === undefined ? undefined : Number(row.document_count || 0),
        impactBatteryCount:
          row.impact_battery_count === undefined ? undefined : Number(row.impact_battery_count || 0),
      }
    : null;

const mapRecordDocumentRow = (row) =>
  row
    ? {
        id: row.id,
        batteryId: row.battery_id || null,
        producerId: row.producer_id ?? null,
        complianceId: row.compliance_id ?? null,
        documentType: row.document_type,
        documentName: row.document_name,
        documentNumber: row.document_number || null,
        issuedBy: row.issued_by || null,
        issuedOn: toDateString(row.issued_on),
        expiresOn: toDateString(row.expires_on),
        status: row.status,
        notes: row.notes || null,
        fileName: row.file_name || null,
        storageRef: row.storage_ref || null,
        uploadedBy: row.uploaded_by || null,
        visibility: row.visibility || "Internal",
        complianceType: row.compliance_type || undefined,
        complianceLevel: row.compliance_level || undefined,
        createdAt: toIso(row.created_at),
        updatedAt: toIso(row.updated_at),
      }
    : null;

const mapRecordEventRow = (row) =>
  row
    ? {
        id: row.id,
        batteryId: row.battery_id || null,
        producerId: row.producer_id ?? null,
        complianceId: row.compliance_id ?? null,
        eventType: row.event_type,
        eventDescription: row.event_description || "",
        oldValue: row.old_value || null,
        newValue: row.new_value || null,
        reason: row.reason || null,
        createdBy: row.created_by || null,
        createdAt: toIso(row.created_at),
        complianceType: row.compliance_type || undefined,
      }
    : null;

const mapTypeStatsRow = (row) =>
  row
    ? {
        complianceType: row.compliance_type,
        typeLabel: row.type_label || row.compliance_type,
        total: Number(row.total || 0),
        compliant: Number(row.compliant || 0),
        pending: Number(row.pending || 0),
        attention: Number(row.attention || 0),
        expired: Number(row.expired || 0),
        notApplicable: Number(row.not_applicable || 0),
      }
    : null;

/* Columns of compliance_records a patch may write. Anything not listed
   (id, created_at, created_by, last_verified_at, verified_by) is
   controlled by a dedicated audited action instead. */
const RECORD_WRITABLE_COLUMNS = {
  companyId: "company_id",
  batteryModelId: "battery_model_id",
  batteryId: "battery_id",
  complianceType: "compliance_type",
  authority: "authority",
  regulationName: "regulation_name",
  standardNumber: "standard_number",
  registrationNumber: "registration_number",
  certificateNumber: "certificate_number",
  status: "status",
  applicability: "applicability",
  issueDate: "issue_date",
  expiryDate: "expiry_date",
  complianceDeadline: "compliance_deadline",
  nextReviewDate: "next_review_date",
  testLab: "test_lab",
  testDate: "test_date",
  testStandard: "test_standard",
  testClause: "test_clause",
  declaredCapacityAh: "declared_capacity_ah",
  verifiedCapacityAh: "verified_capacity_ah",
  testTemperatureC: "test_temperature_c",
  notes: "notes",
  internalComments: "internal_comments",
  isDevelopmentData: "is_development_data",
};

const COMPANY_WRITABLE_COLUMNS = {
  name: "name",
  code: "code",
  legalName: "legal_name",
  registrationNumber: "registration_number",
  authority: "authority",
  country: "country",
  contactEmail: "contact_email",
  contactPhone: "contact_phone",
  address: "address",
  status: "status",
  notes: "notes",
  isDevelopmentData: "is_development_data",
};

const TYPE_WRITABLE_COLUMNS = {
  code: "code",
  label: "label",
  description: "description",
  authority: "authority",
  regulationName: "regulation_name",
  defaultLevel: "default_level",
  defaultApplicability: "default_applicability",
  requiresCertificate: "requires_certificate",
  requiresTestReport: "requires_test_report",
  requiresCapacity: "requires_capacity",
  requiresExpiry: "requires_expiry",
  isActive: "is_active",
  sortOrder: "sort_order",
  isDevelopmentData: "is_development_data",
};

const SETTINGS_COLUMNS = {
  expiryWarningDays: "expiry_warning_days",
  deadlineSoonDays: "deadline_soon_days",
  reviewIntervalDays: "review_interval_days",
  showDevelopmentData: "show_development_data",
};

/* Build a dynamic SET clause from a whitelisted column map. Returns
   { columns, sets, params } so the caller can assemble the INSERT or
   UPDATE from the same validated list. */
const buildAssignments = (fields, columnMap, startIndex = 1) => {
  const columns = [];
  const params = [];
  for (const [key, column] of Object.entries(columnMap)) {
    if (!Object.prototype.hasOwnProperty.call(fields, key)) continue;
    columns.push(column);
    params.push(fields[key] === undefined ? null : fields[key]);
  }
  return {
    columns,
    params,
    sets: columns.map((column, i) => `${column} = $${startIndex + i}`),
  };
};

const placeholders = (count, startIndex = 1) =>
  Array.from({ length: count }, (_, i) => `$${startIndex + i}`).join(", ");

export const createComplianceManagementStore = ({
  pool,
  store,
  batteryKey,
  modelKey = "model_id",
  hasModelsTable,
  hasBatteryModelLink,
  buildPagination,
}) => {
  /* battery_models has no display-name column on the production schema,
     so model_id is the label. battery_models only exists on the
     production shape. */
  const modelLabel = "bm.model_id";
  const modelJoin = hasModelsTable ? `LEFT JOIN battery_models bm ON bm.model_id = cr.battery_model_id` : "";

  /* Rows selected for a record: the record itself, its company name, the
     model/battery labels, the document count and the number of batteries
     the record actually covers (the operational blast radius). */
  const recordSelectSql = (documentVisibility = null) => `
    cr.*,
    co.name AS company_name,
    ${hasModelsTable ? modelLabel : "NULL::text"} AS battery_model_name,
    b.name AS battery_name,
    (SELECT count(*)::int FROM compliance_documents cd
      WHERE cd.compliance_id = cr.id${documentVisibility ? ` AND cd.visibility = '${documentVisibility}'` : ""}
    ) AS document_count,
    CASE
      WHEN cr.battery_id IS NOT NULL THEN 1
      WHEN cr.battery_model_id IS NOT NULL THEN (
        SELECT count(*)::int FROM batteries cb WHERE cb.${modelKey} = cr.battery_model_id
      )
      WHEN cr.company_id IS NOT NULL AND ${hasModelsTable ? "true" : "false"} THEN (
        SELECT count(*)::int FROM batteries cb
        JOIN battery_models cbm ON cbm.model_id = cb.${modelKey}
        WHERE cbm.company_id = cr.company_id
      )
      ELSE 0
    END AS impact_battery_count`;

  const recordFromSql = `FROM compliance_records cr
    JOIN companies co ON co.id = cr.company_id
    LEFT JOIN batteries b ON b.${batteryKey} = cr.battery_id
    ${modelJoin}`;

  /* Company predicates shared by every list/dashboard query. `startIndex`
     matters: several dashboard queries reserve $1..$3 for the threshold
     parameters, so the company predicate must be numbered after them or
     the two would collide on the same placeholder. */
  const companyPredicate = (companyId, restrictToCompanyId, startIndex = 1) => {
    const params = [];
    const clauses = [];
    if (companyId) {
      params.push(Number(companyId));
      clauses.push(`cr.company_id = $${startIndex + params.length - 1}`);
    }
    if (restrictToCompanyId) {
      params.push(Number(restrictToCompanyId));
      clauses.push(`cr.company_id = $${startIndex + params.length - 1}`);
    }
    return { params, clauses };
  };

  /* ============================================================
     companies
     ============================================================ */

  async function listCompanies({ search = "", status = "", restrictToCompanyId = null, includeDevelopmentData = true } = {}) {
    const params = [];
    const where = [];
    if (restrictToCompanyId) {
      params.push(Number(restrictToCompanyId));
      where.push(`c.id = $${params.length}`);
    }
    if (status) {
      params.push(status);
      where.push(`c.status = $${params.length}`);
    }
    if (!includeDevelopmentData) where.push(`c.is_development_data = false`);
    const q = String(search || "").trim();
    if (q) {
      params.push(`%${q}%`);
      const i = params.length;
      where.push(
        `(c.name ILIKE $${i} OR c.code ILIKE $${i} OR c.legal_name ILIKE $${i} OR c.registration_number ILIKE $${i})`
      );
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const modelCount = hasModelsTable
      ? `, (SELECT count(*)::int FROM battery_models bm2 WHERE bm2.company_id = c.id) AS model_count`
      : "";
    const { rows } = await pool.query(
      `SELECT c.*,
              (SELECT count(*)::int FROM compliance_records cr WHERE cr.company_id = c.id) AS record_count
              ${modelCount}
       FROM companies c ${whereSql} ORDER BY c.name ASC`,
      params
    );
    return rows.map(mapCompanyRow);
  }

  async function getCompanyById(id) {
    const modelCount = hasModelsTable
      ? `, (SELECT count(*)::int FROM battery_models bm WHERE bm.company_id = companies.id) AS model_count`
      : "";
    const { rows } = await pool.query(
      `SELECT companies.*,
              (SELECT count(*)::int FROM compliance_records cr WHERE cr.company_id = companies.id) AS record_count
              ${modelCount}
       FROM companies WHERE id = $1 LIMIT 1`,
      [Number(id)]
    );
    return mapCompanyRow(rows[0]);
  }

  async function findCompanyByName(name) {
    if (!name) return null;
    const { rows } = await pool.query("SELECT * FROM companies WHERE LOWER(name) = LOWER($1) LIMIT 1", [
      String(name).trim(),
    ]);
    return mapCompanyRow(rows[0]);
  }

  async function findCompanyByCode(code) {
    if (!code) return null;
    const { rows } = await pool.query("SELECT * FROM companies WHERE LOWER(code) = LOWER($1) LIMIT 1", [
      String(code).trim(),
    ]);
    return mapCompanyRow(rows[0]);
  }

  async function isCompanyNameUnique(name, excludeId = null) {
    const { rows } = await pool.query(
      `SELECT 1 FROM companies WHERE LOWER(name) = LOWER($1) AND ($2::int IS NULL OR id <> $2) LIMIT 1`,
      [String(name).trim(), excludeId ? Number(excludeId) : null]
    );
    return rows.length === 0;
  }

  async function isCompanyCodeUnique(code, excludeId = null) {
    if (!code) return true;
    const { rows } = await pool.query(
      `SELECT 1 FROM companies WHERE LOWER(code) = LOWER($1) AND ($2::int IS NULL OR id <> $2) LIMIT 1`,
      [String(code).trim(), excludeId ? Number(excludeId) : null]
    );
    return rows.length === 0;
  }

  async function createCompany(input) {
    const { columns, params } = buildAssignments(input, COMPANY_WRITABLE_COLUMNS, 1);
    const { rows } = await pool.query(
      `INSERT INTO companies (${columns.join(", ")}) VALUES (${placeholders(columns.length)}) RETURNING *`,
      params
    );
    return mapCompanyRow(rows[0]);
  }

  async function updateCompany(id, fields) {
    const { sets, params } = buildAssignments(fields, COMPANY_WRITABLE_COLUMNS, 2);
    if (!sets.length) return store.getCompanyById(id);
    const { rows } = await pool.query(
      `UPDATE companies SET ${sets.join(", ")}, updated_at = now() WHERE id = $1 RETURNING *`,
      [Number(id), ...params]
    );
    return mapCompanyRow(rows[0]);
  }

  /* Only ever called after the caller has confirmed the company has no
     records — the controller performs that check. */
  async function deleteCompany(id) {
    const { rows } = await pool.query("DELETE FROM companies WHERE id = $1 RETURNING *", [Number(id)]);
    return rows.length > 0 ? mapCompanyRow(rows[0]) : false;
  }

  /* ---------- model ↔ company ---------- */

  async function setModelCompany(modelId, companyId) {
    if (!hasModelsTable) return false;
    const { rows } = await pool.query(
      "UPDATE battery_models SET company_id = $2 WHERE model_id = $1 RETURNING model_id, company_id",
      [String(modelId), companyId === null || companyId === undefined ? null : Number(companyId)]
    );
    return rows.length > 0;
  }

  async function listCompanyModels(companyId) {
    if (!hasModelsTable) return [];
    const { rows } = await pool.query(
      `SELECT bm.model_id,
              bm.company_id,
              (SELECT count(*)::int FROM batteries b WHERE b.${modelKey} = bm.model_id) AS battery_count
       FROM battery_models bm
       WHERE ($1::int IS NULL OR bm.company_id = $1)
       ORDER BY bm.model_id ASC`,
      [companyId ? Number(companyId) : null]
    );
    return rows.map((row) => ({
      modelId: row.model_id,
      modelName: row.model_id,
      companyId: row.company_id ?? null,
      batteryCount: Number(row.battery_count || 0),
    }));
  }

  async function getBatteryModelById(modelId) {
    if (!hasModelsTable) return null;
    const { rows } = await pool.query(
      "SELECT model_id, company_id FROM battery_models WHERE model_id = $1 LIMIT 1",
      [String(modelId)]
    );
    if (!rows[0]) return null;
    return { modelId: rows[0].model_id, modelName: rows[0].model_id, companyId: rows[0].company_id ?? null };
  }

  async function countBatteriesForModel(modelId) {
    if (!hasModelsTable) return 0;
    const { rows } = await pool.query(`SELECT count(*)::int AS total FROM batteries WHERE ${modelKey} = $1`, [
      String(modelId),
    ]);
    return Number(rows[0]?.total || 0);
  }

  async function countBatteriesForCompany(companyId) {
    if (!hasModelsTable) return 0;
    const { rows } = await pool.query(
      `SELECT count(*)::int AS total FROM batteries b
       JOIN battery_models bm ON bm.model_id = b.${modelKey}
       WHERE bm.company_id = $1`,
      [Number(companyId)]
    );
    return Number(rows[0]?.total || 0);
  }

  /* ============================================================
     compliance types (configurable catalogue)
     ============================================================ */

  async function listComplianceTypes({ includeInactive = true, includeDevelopmentData = true } = {}) {
    const where = [];
    if (!includeInactive) where.push("is_active = true");
    if (!includeDevelopmentData) where.push("is_development_data = false");
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const { rows } = await pool.query(
      `SELECT * FROM compliance_types ${whereSql} ORDER BY sort_order ASC, label ASC`
    );
    return rows.map(mapTypeRow);
  }

  async function getComplianceTypeById(id) {
    const { rows } = await pool.query("SELECT * FROM compliance_types WHERE id = $1 LIMIT 1", [Number(id)]);
    return mapTypeRow(rows[0]);
  }

  async function getComplianceTypeByCode(code) {
    if (!code) return null;
    const { rows } = await pool.query("SELECT * FROM compliance_types WHERE LOWER(code) = LOWER($1) LIMIT 1", [
      String(code).trim(),
    ]);
    return mapTypeRow(rows[0]);
  }

  /* Accepts a code OR a label so the import and the API are forgiving
     about which form the admin typed. */
  async function findComplianceType(input) {
    if (!input) return null;
    const value = String(input).trim();
    const { rows } = await pool.query(
      `SELECT * FROM compliance_types
       WHERE LOWER(code) = LOWER($1) OR LOWER(label) = LOWER($1)
       ORDER BY sort_order ASC LIMIT 1`,
      [value]
    );
    return mapTypeRow(rows[0]);
  }

  async function isComplianceTypeCodeUnique(code, excludeId = null) {
    const { rows } = await pool.query(
      `SELECT 1 FROM compliance_types WHERE LOWER(code) = LOWER($1) AND ($2::int IS NULL OR id <> $2) LIMIT 1`,
      [String(code).trim(), excludeId ? Number(excludeId) : null]
    );
    return rows.length === 0;
  }

  async function createComplianceType(input) {
    const { columns, params } = buildAssignments(input, TYPE_WRITABLE_COLUMNS, 1);
    const { rows } = await pool.query(
      `INSERT INTO compliance_types (${columns.join(", ")}) VALUES (${placeholders(columns.length)}) RETURNING *`,
      params
    );
    return mapTypeRow(rows[0]);
  }

  async function updateComplianceType(id, fields) {
    const { sets, params } = buildAssignments(fields, TYPE_WRITABLE_COLUMNS, 2);
    if (!sets.length) return store.getComplianceTypeById(id);
    const { rows } = await pool.query(
      `UPDATE compliance_types SET ${sets.join(", ")}, updated_at = now() WHERE id = $1 RETURNING *`,
      [Number(id), ...params]
    );
    return mapTypeRow(rows[0]);
  }

  /* Refuses to delete a type that is still referenced, so historical
     records keep a meaningful type. */
  async function deleteComplianceType(id) {
    const { rows } = await pool.query(
      "SELECT count(*)::int AS total FROM compliance_records WHERE compliance_type = (SELECT code FROM compliance_types WHERE id = $1)",
      [Number(id)]
    );
    if (Number(rows[0]?.total || 0) > 0) {
      return { deleted: false, inUse: Number(rows[0].total) };
    }
    const { rows: deleted } = await pool.query("DELETE FROM compliance_types WHERE id = $1 RETURNING *", [
      Number(id),
    ]);
    return { deleted: deleted.length > 0, inUse: 0 };
  }

  /* ============================================================
     settings (configurable expiry / deadline thresholds)
     ============================================================ */

  async function getComplianceSettings() {
    const { rows } = await pool.query("SELECT * FROM compliance_settings ORDER BY id ASC LIMIT 1");
    return mapSettingsRow(rows[0]);
  }

  async function updateComplianceSettings(fields, updatedBy = null) {
    const { sets, params } = buildAssignments(fields, SETTINGS_COLUMNS, 1);
    if (!sets.length) return store.getComplianceSettings();
    // The settings row is a singleton keyed on id = 1. The trailing
    // updated_by needs its own placeholder — reusing $N would force one
    // parameter to be both an integer and text.
    const { rows } = await pool.query(
      `UPDATE compliance_settings SET ${sets.join(", ")}, updated_by = $${params.length + 1}, updated_at = now()
       WHERE id = (SELECT min(id) FROM compliance_settings)
       RETURNING *`,
      [...params, updatedBy]
    );
    if (rows[0]) return mapSettingsRow(rows[0]);

    // Only reachable on a database migrated before 007 existed.
    const { rows: inserted } = await pool.query(
      `INSERT INTO compliance_settings (${sets.join(", ")}, id, updated_by)
       VALUES (${placeholders(sets.length)}, 1, $${sets.length + 1})
       ON CONFLICT (id) DO UPDATE SET ${sets.join(", ")}, updated_by = $${sets.length + 1}, updated_at = now()
       RETURNING *`,
      [...params, updatedBy]
    );
    return mapSettingsRow(inserted[0]);
  }

  /* ============================================================
     compliance records
     ============================================================ */

  async function listComplianceRecords({
    companyId = null,
    level = "",
    complianceType = "",
    status = "",
    applicability = "",
    search = "",
    batteryId = "",
    batteryModelId = "",
    includeDevelopmentData = true,
    restrictToCompanyId = null,
    expiringWithinDays = null,
    deadlineWithinDays = null,
    page = 1,
    limit = 20,
    sort = "",
    order = "asc",
  } = {}) {
    const scope = companyPredicate(companyId, restrictToCompanyId);
    const params = [...scope.params];
    const where = [...scope.clauses];

    if (level === "COMPANY") where.push(`cr.battery_id IS NULL AND cr.battery_model_id IS NULL`);
    else if (level === "BATTERY_MODEL") where.push(`cr.battery_model_id IS NOT NULL AND cr.battery_id IS NULL`);
    else if (level === "BATTERY") where.push(`cr.battery_id IS NOT NULL`);

    if (complianceType) {
      params.push(complianceType);
      where.push(`cr.compliance_type = $${params.length}`);
    }
    if (status) {
      params.push(status);
      where.push(`cr.status = $${params.length}`);
    }
    if (applicability) {
      params.push(applicability);
      where.push(`cr.applicability = $${params.length}`);
    }
    if (batteryId) {
      params.push(String(batteryId));
      where.push(`cr.battery_id = $${params.length}`);
    }
    if (batteryModelId) {
      params.push(String(batteryModelId));
      where.push(`cr.battery_model_id = $${params.length}`);
    }
    if (!includeDevelopmentData) where.push(`cr.is_development_data = false`);

    // Thresholds are resolved from compliance_settings by the caller.
    // The ::int cast is required: CURRENT_DATE + $n is ambiguous without it.
    // NOTE: an absent threshold arrives as null, and Number(null) is 0 — so
    // null/undefined/"" must be rejected before the numeric check or every
    // list call would silently filter on "due today".
    const dayWindow = (value) => {
      if (value === null || value === undefined || value === "") return null;
      const n = Number(value);
      return Number.isFinite(n) && n >= 0 ? n : null;
    };
    const expiringDays = dayWindow(expiringWithinDays);
    const deadlineDays = dayWindow(deadlineWithinDays);
    if (expiringDays !== null) {
      params.push(expiringDays);
      where.push(`cr.expiry_date IS NOT NULL AND cr.expiry_date <= (CURRENT_DATE + $${params.length}::int)`);
    }
    if (deadlineDays !== null) {
      params.push(deadlineDays);
      where.push(
        `cr.compliance_deadline IS NOT NULL AND cr.compliance_deadline <= (CURRENT_DATE + $${params.length}::int)`
      );
    }

    const q = String(search || "").trim();
    if (q) {
      params.push(`%${q}%`);
      const i = params.length;
      where.push(
        `(cr.certificate_number ILIKE $${i} OR cr.registration_number ILIKE $${i} OR
          cr.standard_number ILIKE $${i} OR cr.regulation_name ILIKE $${i} OR
          cr.test_lab ILIKE $${i} OR cr.notes ILIKE $${i} OR co.name ILIKE $${i} OR
          cr.battery_id ILIKE $${i} OR cr.battery_model_id ILIKE $${i} OR b.name ILIKE $${i})`
      );
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const { rows: [countRow] } = await pool.query(
      `SELECT count(*)::int AS total ${recordFromSql} ${whereSql}`,
      params
    );
    const total = Number(countRow?.total || 0);

    const fieldMap = {
      createdAt: "cr.created_at",
      updatedAt: "cr.updated_at",
      expiryDate: "cr.expiry_date",
      issueDate: "cr.issue_date",
      complianceDeadline: "cr.compliance_deadline",
      status: "cr.status",
      complianceType: "cr.compliance_type",
      companyName: "co.name",
      batteryModelId: "cr.battery_model_id",
      batteryId: "cr.battery_id",
    };
    const orderCol = fieldMap[sort] || "cr.created_at";
    const orderSql = String(order).toLowerCase() === "desc" ? "DESC" : "ASC";

    const dataParams = [...params, limit, (page - 1) * limit];
    const { rows } = await pool.query(
      `SELECT ${recordSelectSql()} ${recordFromSql} ${whereSql}
       ORDER BY ${orderCol} ${orderSql}, cr.id ${orderSql}
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams
    );

    return { data: rows.map(mapRecordRow), pagination: buildPagination(page, limit, total) };
  }

  async function getComplianceRecordById(id) {
    const { rows } = await pool.query(
      `SELECT ${recordSelectSql()} ${recordFromSql} WHERE cr.id = $1 LIMIT 1`,
      [Number(id)]
    );
    return mapRecordRow(rows[0]);
  }

  /* A record is a duplicate when the same company already has the same
     type at the same scope carrying the same certificate/registration
     number. Matching the scope exactly is what stops one model-level
     certificate from being re-registered per battery. */
  async function findDuplicateComplianceRecord({
    companyId,
    batteryModelId = null,
    batteryId = null,
    complianceType,
    certificateNumber = null,
    registrationNumber = null,
    excludeId = null,
  }) {
    // $1 company, $2 type, $3 excludeId, then the scope value, then the
    // certificate/registration numbers.
    const params = [Number(companyId), String(complianceType), excludeId ? Number(excludeId) : null];

    let scopeClause;
    if (batteryId) {
      params.push(String(batteryId));
      scopeClause = `battery_id = $${params.length}`;
    } else if (batteryModelId) {
      params.push(String(batteryModelId));
      scopeClause = `battery_id IS NULL AND battery_model_id = $${params.length}`;
    } else {
      scopeClause = "battery_id IS NULL AND battery_model_id IS NULL";
    }

    const numberClauses = [];
    if (certificateNumber) {
      params.push(String(certificateNumber));
      numberClauses.push(`LOWER(certificate_number) = LOWER($${params.length})`);
    }
    if (registrationNumber) {
      params.push(String(registrationNumber));
      numberClauses.push(`LOWER(registration_number) = LOWER($${params.length})`);
    }
    if (!numberClauses.length) return null;

    const where = [
      "company_id = $1",
      "compliance_type = $2",
      "($3::int IS NULL OR id <> $3)",
      scopeClause,
      `(${numberClauses.join(" OR ")})`,
    ];

    const { rows } = await pool.query(
      `SELECT id, certificate_number, registration_number, battery_model_id, battery_id
       FROM compliance_records WHERE ${where.join(" AND ")} LIMIT 1`,
      params
    );
    return rows[0]
      ? {
          id: rows[0].id,
          certificateNumber: rows[0].certificate_number,
          registrationNumber: rows[0].registration_number,
          batteryModelId: rows[0].battery_model_id,
          batteryId: rows[0].battery_id,
        }
      : null;
  }

  async function createComplianceRecord(input, createdBy = null) {
    const { columns, params } = buildAssignments(input, RECORD_WRITABLE_COLUMNS, 1);
    params.push(createdBy);
    const { rows } = await pool.query(
      `INSERT INTO compliance_records (${columns.join(", ")}, created_by)
       VALUES (${placeholders(columns.length)}, $${params.length})
       RETURNING id`,
      params
    );
    return store.getComplianceRecordById(rows[0].id);
  }

  async function updateComplianceRecord(id, fields) {
    const { sets, params } = buildAssignments(fields, RECORD_WRITABLE_COLUMNS, 2);
    if (sets.length) {
      await pool.query(`UPDATE compliance_records SET ${sets.join(", ")}, updated_at = now() WHERE id = $1`, [
        Number(id),
        ...params,
      ]);
    }
    return store.getComplianceRecordById(id);
  }

  /* Verification is a dedicated audited action, so last_verified_at and
     verified_by can only ever be written together with a status. */
  async function verifyComplianceRecord(
    id,
    { status, verifiedBy, notes = null, nextReviewDate = null, lastVerifiedAt = null }
  ) {
    const { rows } = await pool.query(
      `UPDATE compliance_records
       SET status = $2,
           verified_by = $3,
           verified_by_notes = $4,
           last_verified_at = COALESCE($5::timestamptz, now()),
           next_review_date = COALESCE($6::date, next_review_date),
           updated_at = now()
       WHERE id = $1 RETURNING id`,
      [Number(id), status, verifiedBy ? String(verifiedBy) : null, notes, lastVerifiedAt, nextReviewDate]
    );
    return rows[0] ? store.getComplianceRecordById(rows[0].id) : null;
  }

  async function deleteComplianceRecord(id) {
    const { rows } = await pool.query("DELETE FROM compliance_records WHERE id = $1 RETURNING id", [Number(id)]);
    return rows.length > 0 ? Number(rows[0].id) : false;
  }

  /* Every record that applies to one battery: its own record, plus the
     model-level and company-level records that cover it. This is the one
     query behind the customer passport, so the inheritance rules live in
     exactly one place. Development/reference rows are excluded unless
     the caller explicitly asks for them, so illustrative data can never
     be shown to a customer as legal evidence. */
  async function listComplianceRecordsForBattery(batteryId, { includeDevelopmentData = false } = {}) {
    const params = [String(batteryId)];
    let modelId = null;
    if (hasBatteryModelLink) {
      const { rows } = await pool.query(`SELECT ${modelKey} AS model_id FROM batteries WHERE ${batteryKey} = $1 LIMIT 1`, [
        String(batteryId),
      ]);
      modelId = rows[0]?.model_id || null;
    }
    if (modelId) params.push(String(modelId));

    const companySubquery = hasModelsTable
      ? `SELECT bm.company_id FROM batteries b2 JOIN battery_models bm ON bm.model_id = b2.${modelKey} WHERE b2.${batteryKey} = $1`
      : "SELECT NULL::int";

    const coverage = [
      `cr.battery_id = $1`,
      `(
         cr.battery_id IS NULL
         AND (
           ${modelId ? `cr.battery_model_id = $2` : "false"}
           OR (
             cr.battery_model_id IS NULL
             AND cr.company_id = (${companySubquery})
           )
         )
       )`,
    ];
    const where = [`(${coverage.join(" OR ")})`];
    if (!includeDevelopmentData) where.push(`cr.is_development_data = false`);

    const { rows } = await pool.query(
      `SELECT cr.*, co.name AS company_name,
              ${hasModelsTable ? modelLabel : "NULL::text"} AS battery_model_name,
              b.name AS battery_name,
              (SELECT count(*)::int FROM compliance_documents cd
                 WHERE cd.compliance_id = cr.id AND cd.visibility = 'Customer') AS document_count
       FROM compliance_records cr
       JOIN companies co ON co.id = cr.company_id
       LEFT JOIN batteries b ON b.${batteryKey} = cr.battery_id
       ${modelJoin}
       WHERE ${where.join(" AND ")}
       ORDER BY cr.compliance_type ASC, cr.id ASC`,
      params
    );
    return rows.map(mapRecordRow);
  }

  /* "Related batteries": the operational blast radius of a record. */
  async function listRelatedBatteriesForRecord(id, { page = 1, limit = 50, search = "" } = {}) {
    const record = await store.getComplianceRecordById(id);
    if (!record) return { data: [], pagination: buildPagination(page, limit, 0) };

    // Parameters are pushed only for the branch that actually uses them:
    // an unused $1 would leave Postgres unable to infer its type.
    const params = [];
    let scope;
    if (record.batteryId) {
      params.push(String(record.batteryId));
      scope = `b.${batteryKey} = $${params.length}`;
    } else if (record.batteryModelId) {
      params.push(String(record.batteryModelId));
      scope = `b.${modelKey} = $${params.length}`;
    } else if (hasModelsTable) {
      params.push(Number(id));
      scope = `bm.company_id = (SELECT company_id FROM compliance_records WHERE id = $${params.length}::int)`;
    } else {
      scope = "false";
    }

    const q = String(search || "").trim();
    let extra = "";
    if (q) {
      params.push(`%${q}%`);
      const i = params.length;
      extra = `AND (b.${batteryKey}::text ILIKE $${i} OR b.name ILIKE $${i} OR b.barcode ILIKE $${i} OR b.serial_number ILIKE $${i})`;
    }

    const from = `FROM batteries b
      ${hasModelsTable ? `LEFT JOIN battery_models bm ON bm.model_id = b.${modelKey}` : ""}
      WHERE ${scope} ${extra}`;

    const { rows: [countRow] } = await pool.query(`SELECT count(*)::int AS total ${from}`, params);
    const total = Number(countRow?.total || 0);

    const dataParams = [...params, limit, (page - 1) * limit];
    const { rows } = await pool.query(
      `SELECT b.${batteryKey}::text AS battery_id, b.name, b.barcode, b.serial_number,
              b.${modelKey} AS model_id, b.overall_status AS status, b.owner_id AS owner_id
       ${from}
       ORDER BY b.${batteryKey} ASC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams
    );

    return {
      data: rows.map((row) => ({
        batteryId: row.battery_id,
        name: row.name || null,
        barcode: row.barcode || null,
        serialNumber: row.serial_number || null,
        modelId: row.model_id || null,
        status: row.status || null,
        ownerId: row.owner_id || null,
      })),
      pagination: buildPagination(page, limit, total),
    };
  }

  /* ============================================================
     dashboard
     ============================================================ */

  async function getComplianceDashboard({ companyId = null, restrictToCompanyId = null, settings = null } = {}) {
    const warningDays = Number(settings?.expiryWarningDays ?? 90);
    const deadlineDays = Number(settings?.deadlineSoonDays ?? 30);
    const reviewDays = Number(settings?.reviewIntervalDays ?? 180);
    const showDev = settings?.showDevelopmentData ?? true;

    // $1 expiry warning, $2 deadline-soon, $3 review interval, $4+ scope.
    const headScope = companyPredicate(companyId, restrictToCompanyId, 4);
    const { rows: [totals] } = await pool.query(
      `SELECT
         count(*)::int AS total,
         count(*) FILTER (WHERE applicability = 'Not Applicable')::int AS not_applicable,
         count(*) FILTER (WHERE battery_id IS NOT NULL)::int AS level_battery,
         count(*) FILTER (WHERE battery_id IS NULL AND battery_model_id IS NOT NULL)::int AS level_model,
         count(*) FILTER (WHERE battery_id IS NULL AND battery_model_id IS NULL)::int AS level_company,
         count(*) FILTER (WHERE is_development_data)::int AS development_data,
         count(DISTINCT company_id)::int AS companies_covered,
         count(*) FILTER (WHERE status = 'Compliant')::int AS stored_compliant,
         count(*) FILTER (WHERE status = 'Pending')::int AS pending,
         count(*) FILTER (WHERE status = 'Under Review')::int AS under_review,
         count(*) FILTER (WHERE status = 'Attention Required')::int AS attention,
         count(*) FILTER (WHERE status = 'Expired')::int AS stored_expired,
         /* Expired is derived, so it matches computeComplianceTiming():
            a "Compliant" record whose certificate has lapsed is expired. */
         count(*) FILTER (
           WHERE expiry_date IS NOT NULL AND applicability <> 'Not Applicable'
             AND expiry_date < CURRENT_DATE
         )::int AS expired,
         count(*) FILTER (
           WHERE expiry_date IS NOT NULL AND applicability <> 'Not Applicable'
             AND expiry_date >= CURRENT_DATE
             AND expiry_date <= CURRENT_DATE + ($1::int)
         )::int AS expiring_soon,
         count(*) FILTER (
           WHERE compliance_deadline IS NOT NULL AND applicability <> 'Not Applicable'
             AND compliance_deadline < CURRENT_DATE
         )::int AS deadline_overdue,
         count(*) FILTER (
           WHERE compliance_deadline IS NOT NULL AND applicability <> 'Not Applicable'
             AND compliance_deadline >= CURRENT_DATE
             AND compliance_deadline <= CURRENT_DATE + ($2::int)
         )::int AS deadline_soon,
         count(*) FILTER (
           WHERE expiry_date IS NULL AND applicability <> 'Not Applicable'
             AND last_verified_at IS NOT NULL
             AND last_verified_at < now() - ($3::int || ' days')::interval
         )::int AS review_overdue,
         count(*) FILTER (
           WHERE test_lab IS NULL AND applicability <> 'Not Applicable'
             AND compliance_type IN (SELECT code FROM compliance_types WHERE requires_test_report)
         )::int AS missing_test_lab,
         count(*) FILTER (
           WHERE (certificate_number IS NULL AND registration_number IS NULL)
             AND applicability <> 'Not Applicable'
             AND compliance_type IN (SELECT code FROM compliance_types WHERE requires_certificate)
             AND battery_id IS NULL
         )::int AS company_certificate_gaps
       FROM compliance_records cr ${headScope.clauses.length ? `WHERE ${headScope.clauses.join(" AND ")}` : ""}`,
      [warningDays, deadlineDays, reviewDays, ...headScope.params]
    );

    // The remaining dashboard queries have no reserved threshold slots, so
    // their company scope starts at $1 again.
    const scope = companyPredicate(companyId, restrictToCompanyId, 1);
    const { rows: byType } = await pool.query(
      `SELECT cr.compliance_type,
              COALESCE(t.label, cr.compliance_type) AS type_label,
              count(*)::int AS total,
              count(*) FILTER (WHERE cr.status = 'Compliant')::int AS compliant,
              count(*) FILTER (WHERE cr.status IN ('Pending', 'Under Review'))::int AS pending,
              count(*) FILTER (WHERE cr.status = 'Attention Required')::int AS attention,
              count(*) FILTER (WHERE cr.expiry_date IS NOT NULL AND cr.expiry_date < CURRENT_DATE)::int AS expired,
              count(*) FILTER (WHERE cr.applicability = 'Not Applicable')::int AS not_applicable
       FROM compliance_records cr
       LEFT JOIN compliance_types t ON t.code = cr.compliance_type
       ${scope.clauses.length ? `WHERE ${scope.clauses.join(" AND ")}` : ""}
       GROUP BY cr.compliance_type, t.label
       ORDER BY count(*) DESC, cr.compliance_type ASC`,
      scope.params
    );

    /* Upcoming expiry + overdue deadlines: the actionable worklist.
       $1 is the threshold, so the company scope starts at $2. */
    const windowScope = companyPredicate(companyId, restrictToCompanyId, 2);
    const { rows: expiring } = await pool.query(
      `SELECT ${recordSelectSql()} ${recordFromSql}
       WHERE cr.expiry_date IS NOT NULL
         AND cr.applicability <> 'Not Applicable'
         AND cr.expiry_date <= CURRENT_DATE + ($1::int)
         ${windowScope.clauses.length ? `AND ${windowScope.clauses.join(" AND ")}` : ""}
       ORDER BY cr.expiry_date ASC NULLS LAST, cr.id ASC
       LIMIT 200`,
      [warningDays, ...windowScope.params]
    );

    const { rows: deadlines } = await pool.query(
      `SELECT ${recordSelectSql()} ${recordFromSql}
       WHERE cr.compliance_deadline IS NOT NULL
         AND cr.applicability <> 'Not Applicable'
         AND cr.compliance_deadline <= CURRENT_DATE + ($1::int)
         ${windowScope.clauses.length ? `AND ${windowScope.clauses.join(" AND ")}` : ""}
       ORDER BY cr.compliance_deadline ASC NULLS LAST, cr.id ASC
       LIMIT 200`,
      [deadlineDays, ...windowScope.params]
    );

    const { rows: byCompany } = await pool.query(
      `SELECT cr.company_id, co.name AS company_name, co.code AS company_code,
              count(*)::int AS total,
              count(*) FILTER (
                WHERE (cr.expiry_date IS NOT NULL AND cr.expiry_date < CURRENT_DATE
                       AND cr.applicability <> 'Not Applicable')
                   OR cr.status = 'Attention Required'
              )::int AS needs_attention
       FROM compliance_records cr
       JOIN companies co ON co.id = cr.company_id
       ${scope.clauses.length ? `WHERE ${scope.clauses.join(" AND ")}` : ""}
       GROUP BY cr.company_id, co.name, co.code
       ORDER BY needs_attention DESC, total DESC`,
      scope.params
    );

    const { rows: [companyTotals] } = await pool.query(
      `SELECT count(*)::int AS companies,
              count(*) FILTER (WHERE status = 'Active')::int AS active_companies,
              count(*) FILTER (WHERE is_development_data)::int AS development_companies
       FROM companies ${restrictToCompanyId ? "WHERE id = $1" : ""}`,
      restrictToCompanyId ? [Number(restrictToCompanyId)] : []
    );

    const expired = Number(totals.expired || 0);
    // A stored "Compliant" that is actually expired must not be counted twice.
    const effectiveCompliant = Math.max(0, Number(totals.stored_compliant || 0) - expired);

    return {
      settings: {
        expiryWarningDays: warningDays,
        deadlineSoonDays: deadlineDays,
        reviewIntervalDays: reviewDays,
        showDevelopmentData: showDev,
      },
      counts: {
        totalRecords: Number(totals.total || 0),
        notApplicable: Number(totals.not_applicable || 0),
        byLevel: {
          COMPANY: Number(totals.level_company || 0),
          BATTERY_MODEL: Number(totals.level_model || 0),
          BATTERY: Number(totals.level_battery || 0),
        },
        developmentData: Number(totals.development_data || 0),
        companiesCovered: Number(totals.companies_covered || 0),
        companies: Number(companyTotals?.companies || 0),
        activeCompanies: Number(companyTotals?.active_companies || 0),
        developmentCompanies: Number(companyTotals?.development_companies || 0),
        pending: Number(totals.pending || 0),
        underReview: Number(totals.under_review || 0),
        storedCompliant: Number(totals.stored_compliant || 0),
        storedExpired: Number(totals.stored_expired || 0),
        reviewOverdue: Number(totals.review_overdue || 0),
        companyCertificateGaps: Number(totals.company_certificate_gaps || 0),
        missingTestLab: Number(totals.missing_test_lab || 0),
        effective: {
          compliant: effectiveCompliant,
          expired,
          attentionRequired: Number(totals.attention || 0),
          needsAttention: expired + Number(totals.attention || 0) + Number(totals.deadline_overdue || 0),
        },
        expiringSoon: Number(totals.expiring_soon || 0),
        deadlineSoon: Number(totals.deadline_soon || 0),
        deadlineOverdue: Number(totals.deadline_overdue || 0),
      },
      byType: byType.map(mapTypeStatsRow),
      byCompany: byCompany.map((row) => ({
        companyId: row.company_id,
        companyName: row.company_name,
        companyCode: row.company_code || null,
        total: Number(row.total || 0),
        needsAttention: Number(row.needs_attention || 0),
      })),
      expiringSoon: expiring.map(mapRecordRow),
      overdueDeadlines: deadlines.map(mapRecordRow),
    };
  }

  /* ============================================================
     documents attached to a compliance record
     ============================================================ */

  async function listComplianceRecordDocuments({ complianceId = null, visibility = "", restrictToCompanyId = null } = {}) {
    const params = [];
    const where = [];
    if (complianceId) {
      params.push(Number(complianceId));
      where.push(`cd.compliance_id = $${params.length}`);
    }
    if (visibility) {
      params.push(visibility);
      where.push(`cd.visibility = $${params.length}`);
    }
    if (restrictToCompanyId) {
      params.push(Number(restrictToCompanyId));
      where.push(`cr.company_id = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const { rows } = await pool.query(
      `SELECT cd.*, cr.compliance_type, cr.battery_id AS cr_battery_id, cr.battery_model_id AS cr_battery_model_id
       FROM compliance_documents cd
       LEFT JOIN compliance_records cr ON cr.id = cd.compliance_id
       ${whereSql}
       ORDER BY cd.created_at DESC, cd.id DESC`,
      params
    );
    return rows.map((row) => ({
      ...mapRecordDocumentRow(row),
      complianceLevel: row.cr_battery_id ? "BATTERY" : row.cr_battery_model_id ? "BATTERY_MODEL" : "COMPANY",
    }));
  }

  async function getComplianceRecordDocumentById(id) {
    const { rows } = await pool.query(
      "SELECT * FROM compliance_documents WHERE id = $1 LIMIT 1",
      [Number(id)]
    );
    return mapRecordDocumentRow(rows[0]);
  }

  async function createComplianceRecordDocument(input) {
    const { rows } = await pool.query(
      `INSERT INTO compliance_documents (
         battery_id, producer_id, compliance_id, document_type, document_name, document_number,
         issued_by, issued_on, expires_on, status, notes, file_name, storage_ref, uploaded_by, visibility
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        input.batteryId || null,
        input.producerId ?? null,
        input.complianceId ?? null,
        input.documentType || "Other",
        input.documentName,
        input.documentNumber || null,
        input.issuedBy || null,
        input.issuedOn || null,
        input.expiresOn || null,
        input.status || "Pending Review",
        input.notes || null,
        input.fileName || null,
        input.storageRef || null,
        input.uploadedBy || null,
        input.visibility || "Internal",
      ]
    );
    return mapRecordDocumentRow(rows[0]);
  }

  async function deleteComplianceRecordDocument(id) {
    const { rows } = await pool.query("DELETE FROM compliance_documents WHERE id = $1 RETURNING *", [Number(id)]);
    return rows.length > 0 ? mapRecordDocumentRow(rows[0]) : false;
  }

  /* ============================================================
     audit trail
     ============================================================ */

  async function listComplianceRecordEvents({ complianceId = null, eventType = "", limit = 200 } = {}) {
    const params = [];
    const where = ["ce.compliance_id IS NOT NULL"];
    if (complianceId) {
      params.push(Number(complianceId));
      where.push(`ce.compliance_id = $${params.length}`);
    }
    if (eventType) {
      params.push(eventType);
      where.push(`ce.event_type = $${params.length}`);
    }
    params.push(Number(limit) || 200);
    const { rows } = await pool.query(
      `SELECT ce.*, cr.compliance_type
       FROM compliance_events ce
       LEFT JOIN compliance_records cr ON cr.id = ce.compliance_id
       WHERE ${where.join(" AND ")}
       ORDER BY ce.created_at DESC, ce.id DESC
       LIMIT $${params.length}`,
      params
    );
    return rows.map(mapRecordEventRow);
  }

  async function addComplianceRecordEvent({
    complianceId = null,
    eventType,
    eventDescription = "",
    oldValue = null,
    newValue = null,
    reason = null,
    createdBy = null,
  }) {
    const { rows } = await pool.query(
      `INSERT INTO compliance_events (compliance_id, event_type, event_description, old_value, new_value, reason, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [complianceId ?? null, eventType, eventDescription, oldValue, newValue, reason, createdBy]
    );
    return mapRecordEventRow(rows[0]);
  }

  /* ============================================================
     import
     ============================================================ */

  /* A dry run is executed inside a transaction that is rolled back, so
     the preview the admin approves is validated by exactly the same SQL
     that later inserts. */
  async function runComplianceImport(rows, { actorId = null, dryRun = true } = {}) {
    const created = [];
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const item of rows) {
        const { columns, params } = buildAssignments(item, RECORD_WRITABLE_COLUMNS, 1);
        params.push(actorId);
        const { rows: inserted } = await client.query(
          `INSERT INTO compliance_records (${columns.join(", ")}, created_by)
           VALUES (${placeholders(columns.length)}, $${params.length})
           RETURNING id`,
          params
        );
        created.push(inserted[0]?.id);
      }

      if (dryRun) {
        await client.query("ROLLBACK");
        return { inserted: 0, rolledBack: true, recordIds: [] };
      }

      await client.query(
        `INSERT INTO compliance_events (compliance_id, event_type, event_description, new_value, created_by)
         SELECT id, 'record_imported', $1, NULL, $2
         FROM compliance_records WHERE id = ANY($3::int[])`,
        [`${created.length} compliance record(s) imported from a spreadsheet.`, actorId, created]
      );
      await client.query("COMMIT");
      return { inserted: created.length, rolledBack: false, recordIds: created };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  return {
    listCompanies,
    getCompanyById,
    findCompanyByName,
    findCompanyByCode,
    isCompanyNameUnique,
    isCompanyCodeUnique,
    createCompany,
    updateCompany,
    deleteCompany,
    listCompanyModels,
    getBatteryModelById,
    countBatteriesForModel,
    countBatteriesForCompany,
    setModelCompany,
    listComplianceTypes,
    getComplianceTypeById,
    getComplianceTypeByCode,
    findComplianceType,
    isComplianceTypeCodeUnique,
    createComplianceType,
    updateComplianceType,
    deleteComplianceType,
    getComplianceSettings,
    updateComplianceSettings,
    listComplianceRecords,
    getComplianceRecordById,
    findDuplicateComplianceRecord,
    createComplianceRecord,
    updateComplianceRecord,
    verifyComplianceRecord,
    deleteComplianceRecord,
    listComplianceRecordsForBattery,
    listRelatedBatteriesForRecord,
    getComplianceDashboard,
    listComplianceRecordDocuments,
    getComplianceRecordDocumentById,
    createComplianceRecordDocument,
    deleteComplianceRecordDocument,
    listComplianceRecordEvents,
    addComplianceRecordEvent,
    runComplianceImport,
  };
};

export {
  mapRecordRow,
  mapCompanyRow,
  mapTypeRow,
  mapSettingsRow,
  mapRecordDocumentRow,
  mapRecordEventRow,
  toDateString,
  buildAssignments,
  placeholders,
};
