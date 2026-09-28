/* ============================================================
   COMPLIANCE RECORD VALIDATION
   Field-level rules for the hierarchical compliance records, plus the
   import row mapper.

   Two ideas drive the design:

   1. REQUIRED FIELDS DEPEND ON THE COMPLIANCE TYPE.
      A BIS/CRS record needs a certificate number; a rated-capacity
      verification needs measured capacity, not a certificate; EPR is a
      company obligation and needs no model. Each catalogue type
      carries its own `requires_*` flags (compliance_types table), so
      validation is driven by data, never by a hard-coded if-chain.

   2. PATCH NEVER CLOBBERS.
      Only keys actually present in the request body are returned, so
      an update can never blank a field the caller did not mention —
      this is what protects historical compliance values.
   ============================================================ */

import {
  COMPLIANCE_LEVELS,
  RECORD_STATUSES,
  APPLICABILITY_VALUES,
  KNOWN_AUTHORITIES,
  RECORD_DOCUMENT_TYPES,
  DOCUMENT_VISIBILITY_VALUES,
  isInList,
} from "../constants/complianceManagement.js";
import { toDateString } from "./complianceExpiry.js";
import { normalizeHeaderKey } from "./spreadsheet.js";

/* ---------- primitives ---------- */

export class ComplianceValidationError extends Error {
  constructor(message, { field = null, code = "INVALID" } = {}) {
    super(message);
    this.name = "ComplianceValidationError";
    this.statusCode = 400;
    this.field = field;
    this.code = code;
  }
}

const fail = (message, field, code) => {
  throw new ComplianceValidationError(message, { field, code });
};

const cleanText = (value, max = 2000) =>
  value === undefined || value === null ? null : String(value).trim().slice(0, max) || null;

const cleanDate = (value, field) => {
  if (value === undefined || value === null || value === "") return null;
  const iso = toDateString(value);
  if (!iso) fail(`"${field}" is not a valid date. Use YYYY-MM-DD.`, field, "INVALID_DATE");
  return iso;
};

const cleanNumber = (value, field, { min = null, max = null } = {}) => {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(String(value).replace(/[, ]/g, ""));
  if (!Number.isFinite(n)) fail(`"${field}" must be a number.`, field, "INVALID_NUMBER");
  if (min !== null && n < min) fail(`"${field}" must be at least ${min}.`, field, "OUT_OF_RANGE");
  if (max !== null && n > max) fail(`"${field}" must be at most ${max}.`, field, "OUT_OF_RANGE");
  return n;
};

const cleanId = (value, field) => {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) fail(`"${field}" must be a positive id.`, field, "INVALID_ID");
  return n;
};

const requireText = (value, field, max = 2000) => {
  const text = cleanText(value, max);
  if (!text) fail(`${field} is required.`, field, "REQUIRED");
  return text;
};

const assertInList = (value, list, field) => {
  if (value === undefined || value === null || value === "") return;
  if (!isInList(value, list)) {
    fail(`"${field}" must be one of: ${list.join(", ")}.`, field, "INVALID_ENUM");
  }
};

/* ---------- level / scope ---------- */

/* Derive the level from the link columns, and enforce "at most one of
   model / battery". A record with neither is a COMPANY record. */
export const resolveLevel = ({ batteryModelId, batteryId }) => {
  if (batteryModelId && batteryId) {
    fail(
      'A compliance record applies to a battery model OR a single battery, not both. Leave "battery_model_id" empty for a company-wide record, or clear it for an individual battery record.',
      "batteryModelId",
      "CONFLICTING_SCOPE"
    );
  }
  if (batteryId) return "BATTERY";
  if (batteryModelId) return "BATTERY_MODEL";
  return "COMPANY";
};

const assertKnownLevel = (level) => {
  if (!isInList(level, COMPLIANCE_LEVELS)) {
    fail(`"level" must be one of: ${COMPLIANCE_LEVELS.join(", ")}.`, "level", "INVALID_ENUM");
  }
};

/* ---------- type-driven field requirements ---------- */

/* Requirements come from the compliance_types row, so a new type added
   in the database immediately gets correct validation. */
export const requirementsFor = (type) => ({
  certificate: Boolean(type?.requiresCertificate),
  testReport: Boolean(type?.requiresTestReport),
  capacity: Boolean(type?.requiresCapacity),
  expiry: type?.requiresExpiry !== false,
});

/* Enforce the type's own rules. Called after the plain payload parse so
   the error messages name the actual type. */
export const assertTypeRequirements = (payload, type, level) => {
  const req = requirementsFor(type);
  const code = type?.code || payload.complianceType;

  if (req.certificate && level !== "COMPANY" && payload.applicability !== "Not Applicable") {
    if (!payload.certificateNumber && !payload.registrationNumber) {
      fail(
        `"${code}" is a certification type, so a certificate number or a registration number is required before it can be verified.`,
        "certificateNumber",
        "MISSING_CERTIFICATE"
      );
    }
  }
  if (req.capacity && payload.applicability !== "Not Applicable") {
    if (payload.declaredCapacityAh === null || payload.verifiedCapacityAh === null) {
      fail(
        `"${code}" requires both a declared and a verified capacity (Ah).`,
        "declaredCapacityAh",
        "MISSING_CAPACITY"
      );
    }
  }
  if (req.testReport && payload.applicability !== "Not Applicable" && !payload.testLab) {
    fail(`"${code}" requires the test laboratory that produced the test report.`, "testLab", "MISSING_TEST_LAB");
  }
  if (req.expiry && payload.expiryDate && payload.issueDate) {
    if (payload.expiryDate < payload.issueDate) {
      fail("expiry_date cannot be earlier than issue_date.", "expiryDate", "INVALID_RANGE");
    }
  }
  if (payload.expiryDate && payload.status === "Compliant" && payload.verifiedAt === null) {
    // Not an error: the verification endpoint stamps verifiedAt. Kept as a
    // documented no-op so the rule stays visible in one place.
  }
};

/* ---------- create payload ---------- */

const RECORD_FIELDS = [
  "companyId",
  "batteryModelId",
  "batteryId",
  "complianceType",
  "authority",
  "regulationName",
  "standardNumber",
  "registrationNumber",
  "certificateNumber",
  "status",
  "applicability",
  "issueDate",
  "expiryDate",
  "complianceDeadline",
  "nextReviewDate",
  "testLab",
  "testDate",
  "testStandard",
  "testClause",
  "declaredCapacityAh",
  "verifiedCapacityAh",
  "testTemperatureC",
  "notes",
  "internalComments",
  "isDevelopmentData",
];

export const parseComplianceRecordPayload = (body = {}, { level = null, type = null } = {}) => {
  const source = body || {};

  const complianceType = requireText(source.complianceType, "complianceType", 100);
  const payload = {
    companyId: cleanId(source.companyId, "companyId"),
    batteryModelId: cleanText(source.batteryModelId, 300),
    batteryId: cleanText(source.batteryId, 200),
    complianceType,
    authority: cleanText(source.authority, 200),
    regulationName: cleanText(source.regulationName, 300),
    standardNumber: cleanText(source.standardNumber, 200),
    registrationNumber: cleanText(source.registrationNumber, 200),
    certificateNumber: cleanText(source.certificateNumber, 200),
    // A record NEVER arrives as Compliant: verification is a separate,
    // audited admin action (see verifyComplianceRecord).
    status: cleanText(source.status) || "Pending",
    applicability: cleanText(source.applicability) || "Applicable",
    issueDate: cleanDate(source.issueDate, "issueDate"),
    expiryDate: cleanDate(source.expiryDate, "expiryDate"),
    complianceDeadline: cleanDate(source.complianceDeadline, "complianceDeadline"),
    nextReviewDate: cleanDate(source.nextReviewDate, "nextReviewDate"),
    testLab: cleanText(source.testLab, 300),
    testDate: cleanDate(source.testDate, "testDate"),
    testStandard: cleanText(source.testStandard, 200),
    testClause: cleanText(source.testClause, 200),
    declaredCapacityAh: cleanNumber(source.declaredCapacityAh, "declaredCapacityAh", { min: 0 }),
    verifiedCapacityAh: cleanNumber(source.verifiedCapacityAh, "verifiedCapacityAh", { min: 0 }),
    testTemperatureC: cleanNumber(source.testTemperatureC, "testTemperatureC", { min: -100, max: 300 }),
    notes: cleanText(source.notes),
    internalComments: cleanText(source.internalComments),
    isDevelopmentData: Boolean(source.isDevelopmentData),
  };

  assertInList(payload.applicability, APPLICABILITY_VALUES, "applicability");

  // A Not Applicable record is a deliberate exemption, never a
  // certificate, so it may only be "not applicable" in status terms.
  if (payload.applicability === "Not Applicable") {
    payload.status = "Not Applicable";
  } else {
    assertInList(payload.status, RECORD_STATUSES, "status");
    if (payload.status === "Compliant") {
      fail(
        "A new compliance record cannot be created as Compliant. Save it as Pending, then use Verify Compliance once the evidence has been checked.",
        "status",
        "VERIFY_REQUIRED"
      );
    }
  }

  if (!payload.companyId) {
    fail("companyId is required — every compliance record belongs to a company.", "companyId", "REQUIRED");
  }

  const derivedLevel = resolveLevel(payload);
  if (level) {
    assertKnownLevel(level);
    if (level !== derivedLevel) {
      fail(
        `This record's level (${derivedLevel}) does not match the requested level (${level}).`,
        "level",
        "LEVEL_MISMATCH"
      );
    }
  }

  assertTypeRequirements(payload, type, derivedLevel);
  return payload;
};

/* ---------- patch payload ---------- */

export const parseComplianceRecordPatch = (body = {}, { type = null } = {}) => {
  const source = body || {};
  const out = {};
  const has = (key) => Object.prototype.hasOwnProperty.call(source, key);

  const textFields = [
    "batteryModelId",
    "complianceType",
    "authority",
    "regulationName",
    "standardNumber",
    "registrationNumber",
    "certificateNumber",
    "testLab",
    "testStandard",
    "testClause",
    "notes",
    "internalComments",
  ];
  for (const key of textFields) {
    if (has(key)) out[key] = cleanText(source[key], key === "batteryModelId" ? 300 : 2000);
  }

  const dateFields = ["issueDate", "expiryDate", "complianceDeadline", "nextReviewDate", "testDate"];
  for (const key of dateFields) {
    if (has(key)) out[key] = cleanDate(source[key], key);
  }

  const numberFields = {
    declaredCapacityAh: { min: 0 },
    verifiedCapacityAh: { min: 0 },
    testTemperatureC: { min: -100, max: 300 },
  };
  for (const [key, range] of Object.entries(numberFields)) {
    if (has(key)) out[key] = cleanNumber(source[key], key, range);
  }

  if (has("companyId")) out.companyId = cleanId(source.companyId, "companyId");
  if (has("batteryId")) out.batteryId = cleanText(source.batteryId, 200);
  if (has("isDevelopmentData")) out.isDevelopmentData = Boolean(source.isDevelopmentData);

  if (has("applicability")) {
    out.applicability = cleanText(source.applicability) || "Applicable";
    assertInList(out.applicability, APPLICABILITY_VALUES, "applicability");
    if (out.applicability === "Not Applicable") out.status = "Not Applicable";
  }
  if (has("status")) {
    const status = cleanText(source.status) || "Pending";
    if (out.applicability === "Not Applicable") {
      out.status = "Not Applicable";
    } else {
      assertInList(status, RECORD_STATUSES, "status");
      if (status === "Compliant") {
        fail(
          "Use Verify Compliance to mark a record Compliant, so the verification is attributed and audited.",
          "status",
          "VERIFY_REQUIRED"
        );
      }
      out.status = status;
    }
  }

  if (Object.keys(out).length === 0) {
    fail("No updatable fields were supplied.", null, "EMPTY_PATCH");
  }
  return out;
};

/* ---------- verification payload ---------- */

export const parseVerificationPayload = (body = {}) => {
  const source = body || {};
  const out = {};
  if (source.status !== undefined && source.status !== null && source.status !== "") {
    const status = cleanText(source.status);
    assertInList(status, RECORD_STATUSES, "status");
    out.status = status;
  }
  if (source.notes !== undefined) out.notes = cleanText(source.notes, 2000);
  if (source.reason !== undefined) out.reason = cleanText(source.reason, 2000);
  return out;
};

/* ---------- document payload ---------- */

export const parseRecordDocumentPayload = (body = {}, { requireComplianceId = false } = {}) => {
  const source = body || {};
  const complianceId = cleanId(source.complianceId, "complianceId");
  if (requireComplianceId && !complianceId) {
    fail("complianceId is required.", "complianceId", "REQUIRED");
  }
  const documentType = cleanText(source.documentType) || "Other";
  assertInList(documentType, RECORD_DOCUMENT_TYPES, "documentType");
  const visibility = cleanText(source.visibility) || "Internal";
  assertInList(visibility, DOCUMENT_VISIBILITY_VALUES, "visibility");
  const documentName = requireText(source.documentName, "documentName", 300);
  return {
    complianceId,
    documentType,
    documentName,
    documentNumber: cleanText(source.documentNumber, 200),
    issuedBy: cleanText(source.issuedBy, 300),
    issuedOn: cleanDate(source.issuedOn, "issuedOn"),
    expiresOn: cleanDate(source.expiresOn, "expiresOn"),
    status: cleanText(source.status) || "Pending Review",
    notes: cleanText(source.notes),
    fileName: cleanText(source.fileName, 300),
    storageRef: cleanText(source.storageRef, 500),
    visibility,
  };
};

/* ---------- company payload ---------- */

export const parseCompanyPayload = (body = {}) => {
  const source = body || {};
  return {
    name: requireText(source.name, "name", 200),
    code: cleanText(source.code, 60),
    legalName: cleanText(source.legalName, 200),
    registrationNumber: cleanText(source.registrationNumber, 100),
    authority: cleanText(source.authority, 200),
    country: cleanText(source.country, 60) || "India",
    contactEmail: cleanText(source.contactEmail, 200),
    contactPhone: cleanText(source.contactPhone, 60),
    address: cleanText(source.address),
    status: cleanText(source.status) || "Active",
    notes: cleanText(source.notes),
    isDevelopmentData: Boolean(source.isDevelopmentData),
  };
};

export const parseCompanyPatch = (body = {}) => {
  const source = body || {};
  const out = {};
  for (const key of ["code", "legalName", "registrationNumber", "authority", "contactEmail", "contactPhone", "address", "status", "notes"]) {
    if (Object.prototype.hasOwnProperty.call(source, key)) out[key] = cleanText(source[key], 300);
  }
  if (Object.prototype.hasOwnProperty.call(source, "name")) out.name = requireText(source.name, "name", 200);
  if (Object.prototype.hasOwnProperty.call(source, "isDevelopmentData")) out.isDevelopmentData = Boolean(source.isDevelopmentData);
  if (!Object.keys(out).length) fail("No updatable fields were supplied.", null, "EMPTY_PATCH");
  return out;
};

/* ---------- settings payload ---------- */

export const parseComplianceSettingsPayload = (body = {}) => {
  const source = body || {};
  const out = {};
  const int = (key) => {
    if (!Object.prototype.hasOwnProperty.call(source, key)) return;
    const n = Number(source[key]);
    if (!Number.isInteger(n) || n < 0 || n > 3650) {
      fail(`"${key}" must be a whole number of days between 0 and 3650.`, key, "OUT_OF_RANGE");
    }
    out[key] = n;
  };
  int("expiryWarningDays");
  int("deadlineSoonDays");
  int("reviewIntervalDays");
  if (Object.prototype.hasOwnProperty.call(source, "showDevelopmentData")) {
    out.showDevelopmentData = Boolean(source.showDevelopmentData);
  }
  if (!Object.keys(out).length) fail("No settings were supplied.", null, "EMPTY_PATCH");
  return out;
};

/* ============================================================
   IMPORT
   ============================================================ */

/* Documented column contract. `required` columns must be present in
   the header row; the rest are optional. Unknown columns are reported
   so a typo never silently drops data. */
export const IMPORT_COLUMNS = [
  { key: "company", label: "company", required: true, help: "Company name (must already exist in MaxSpace)." },
  { key: "battery_model", label: "battery_model", required: false, help: "Battery model id. Omit for a company-wide record; required for model-level rows." },
  { key: "battery_id", label: "battery_id", required: false, help: "Unique Battery ID. Only for genuinely battery-specific rows." },
  { key: "compliance_type", label: "compliance_type", required: true, help: "Type code (e.g. BIS_CRS) or label (e.g. BIS / CRS)." },
  { key: "authority", label: "authority", required: false, help: "Issuing authority, e.g. BIS / CPCB / AIS." },
  { key: "regulation_name", label: "regulation_name", required: false, help: "Regulation the requirement comes from." },
  { key: "standard_number", label: "standard_number", required: false, help: "Standard number, e.g. IS 16046 Part 2." },
  { key: "registration_number", label: "registration_number", required: false, help: "Registration number issued by the authority." },
  { key: "certificate_number", label: "certificate_number", required: false, help: "Certificate number." },
  { key: "status", label: "status", required: false, help: "Pending | Under Review | Compliant | Attention Required | Expired. Imported rows are forced to Pending unless explicitly verified." },
  { key: "applicability", label: "applicability", required: false, help: "Applicable | Not Applicable. Use Not Applicable to exempt a rule." },
  { key: "issue_date", label: "issue_date", required: false, help: "YYYY-MM-DD." },
  { key: "expiry_date", label: "expiry_date", required: false, help: "YYYY-MM-DD." },
  { key: "compliance_deadline", label: "compliance_deadline", required: false, help: "YYYY-MM-DD obligation date." },
  { key: "test_lab", label: "test_lab", required: false, help: "Test laboratory name." },
  { key: "test_date", label: "test_date", required: false, help: "YYYY-MM-DD." },
  { key: "test_standard", label: "test_standard", required: false, help: "Test standard reference." },
  { key: "test_clause", label: "test_clause", required: false, help: "Clause within the test standard." },
  { key: "declared_capacity_ah", label: "declared_capacity_ah", required: false, help: "Declared capacity in Ah." },
  { key: "verified_capacity_ah", label: "verified_capacity_ah", required: false, help: "Measured/verified capacity in Ah." },
  { key: "test_temperature_c", label: "test_temperature_c", required: false, help: "Test temperature in °C." },
  { key: "notes", label: "notes", required: false, help: "Customer-facing note." },
  { key: "internal_comments", label: "internal_comments", required: false, help: "Internal only; never shown on the passport." },
  { key: "is_development_data", label: "is_development_data", required: false, help: "yes/no — mark reference rows that are not real certificates." },
];

const IMPORT_KEYS = new Set(IMPORT_COLUMNS.map((c) => c.key));

/* Validate the header row against the documented contract. Returns the
   recognised columns, the missing required ones and any unknown ones. */
export const validateImportHeaders = (headers = []) => {
  const normalized = headers.map(normalizeHeaderKey);
  const recognized = [];
  const missing = [];
  const unknown = [];
  const seen = new Set();

  normalized.forEach((key, index) => {
    if (!key) return;
    if (IMPORT_KEYS.has(key)) {
      if (seen.has(key)) {
        unknown.push({ key, label: headers[index], reason: "duplicated column" });
        return;
      }
      seen.add(key);
      recognized.push(key);
      return;
    }
    unknown.push({ key, label: headers[index], reason: "not a recognised compliance column" });
  });

  for (const column of IMPORT_COLUMNS) {
    if (column.required && !seen.has(column.key)) missing.push(column.key);
  }

  return { recognized, missing, unknown };
};

const TRUTHY = new Set(["1", "true", "yes", "y"]);
const FALSY = new Set(["0", "false", "no", "n", ""]);

const parseBooleanCell = (value) => {
  const v = String(value ?? "").trim().toLowerCase();
  if (FALSY.has(v)) return false;
  if (TRUTHY.has(v)) return true;
  return null;
};

/* Map one parsed spreadsheet row into a compliance payload, collecting
   every problem instead of throwing on the first, so the admin sees a
   complete error report for the file in one pass.

   Async because the duplicate probe reads the store. The other
   resolvers are deliberately synchronous (the caller pre-resolves them
   into maps), so a row costs at most one database round trip. */
export const mapImportRow = async (row, resolvers) => {
  const values = row?.values || {};
  const errors = [];
  const warnings = [];
  const addError = (field, message) => errors.push({ field, message });

  const cell = (key) => {
    const v = values[key];
    return v === undefined || v === null ? "" : String(v).trim();
  };

  const companyName = cell("company");
  const modelId = cell("battery_model");
  const batteryId = cell("battery_id");

  if (!companyName) addError("company", "company is required.");
  if (!cell("compliance_type")) addError("compliance_type", "compliance_type is required.");
  if (modelId && batteryId) {
    addError(
      "battery_model",
      "Set either battery_model or battery_id, not both — a record is model-level or battery-level."
    );
  }

  const company = companyName ? resolvers.findCompany(companyName) : null;
  if (companyName && !company) {
    addError("company", `Company "${companyName}" does not exist in MaxSpace. Create it first, or fix the spelling.`);
  }

  const typeInput = cell("compliance_type");
  const type = typeInput ? resolvers.findType(typeInput) : null;
  if (typeInput && !type) {
    addError(
      "compliance_type",
      `"${typeInput}" is not a configured compliance type. Use one of: ${resolvers.typeOptions().join(", ")}.`
    );
  }

  const model = modelId ? resolvers.findModel(modelId) : null;
  if (modelId && !model) {
    addError("battery_model", `Battery model "${modelId}" is not registered in the production database.`);
  }

  const battery = batteryId ? resolvers.findBattery(batteryId) : null;
  if (batteryId && !battery) {
    addError("battery_id", `Battery "${batteryId}" was not found by that Battery ID.`);
  }
  if (battery && model && battery.modelId && String(battery.modelId).toLowerCase() !== String(modelId).toLowerCase()) {
    addError("battery_id", `Battery "${batteryId}" belongs to model "${battery.modelId}", not "${modelId}".`);
  }

  // Cross-company integrity: a model belongs to at most one company.
  if (company && model && model.companyId && model.companyId !== company.id) {
    addError(
      "company",
      `Battery model "${modelId}" is assigned to a different company. Assign the model to "${company.name}" first.`
    );
  }

  const level = batteryId ? "BATTERY" : modelId ? "BATTERY_MODEL" : "COMPANY";

  const applicabilityCell = cell("applicability");
  const applicability = applicabilityCell || "Applicable";
  if (!["Applicable", "Not Applicable"].includes(applicability)) {
    addError("applicability", `applicability must be "Applicable" or "Not Applicable" (got "${applicability}").`);
  }

  // Imported evidence is never trusted as verified.
  const statusCell = cell("status");
  if (statusCell && !RECORD_STATUSES.includes(statusCell)) {
    addError("status", `status must be one of: ${RECORD_STATUSES.join(", ")}.`);
  }
  if (statusCell === "Compliant") {
    warnings.push({
      field: "status",
      message: 'status "Compliant" is ignored on import — the row is stored as Pending and must be verified in the app.',
    });
  }

  const devCell = parseBooleanCell(cell("is_development_data"));
  if (devCell === null && cell("is_development_data") !== "") {
    addError("is_development_data", 'is_development_data must be "yes" or "no".');
  }
  // A row that claims to carry a real certificate but is not explicitly
  // marked as development data gets a review warning, never a silent pass.
  const isDevelopmentData = devCell === true;
  const carriesCertificate = Boolean(cell("certificate_number") || cell("registration_number"));
  if (carriesCertificate && !isDevelopmentData) {
    warnings.push({
      field: "is_development_data",
      message:
        "This row carries a certificate/registration number. Confirm it is a real, issued certificate — set is_development_data=yes for anything illustrative.",
    });
  }

  const issueDate = cell("issue_date");
  const expiryDate = cell("expiry_date");
  for (const [key, value] of [["issue_date", issueDate], ["expiry_date", expiryDate], ["compliance_deadline", cell("compliance_deadline")], ["test_date", cell("test_date")]]) {
    if (value && !toDateString(value)) addError(key, `${key} must be a valid YYYY-MM-DD date.`);
  }
  if (issueDate && expiryDate && toDateString(issueDate) && toDateString(expiryDate) && toDateString(expiryDate) < toDateString(issueDate)) {
    addError("expiry_date", "expiry_date cannot be earlier than issue_date.");
  }

  const numberOrError = (key) => {
    const value = cell(key);
    if (!value) return null;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) {
      addError(key, `${key} must be a non-negative number.`);
      return null;
    }
    return n;
  };
  const declaredCapacityAh = numberOrError("declared_capacity_ah");
  const verifiedCapacityAh = numberOrError("verified_capacity_ah");
  const testTemperatureC = numberOrError("test_temperature_c");

  // Type-driven requirements, reported the same way as the form.
  if (type && company && !errors.length) {
    const req = requirementsFor(type);
    const notApplicable = applicability === "Not Applicable";
    if (req.certificate && level !== "COMPANY" && !notApplicable && !cell("certificate_number") && !cell("registration_number")) {
      addError("certificate_number", `"${type.label}" is a certification type, so certificate_number or registration_number is required.`);
    }
    if (req.capacity && !notApplicable && (declaredCapacityAh === null || verifiedCapacityAh === null)) {
      addError("verified_capacity_ah", `"${type.label}" requires both declared_capacity_ah and verified_capacity_ah.`);
    }
    if (req.testReport && !notApplicable && !cell("test_lab")) {
      addError("test_lab", `"${type.label}" requires test_lab.`);
    }
  }

  const certificateNumber = cell("certificate_number") || null;
  const registrationNumber = cell("registration_number") || null;
  // AWAITED: an un-awaited promise is always truthy and would report every
  // row as a duplicate of a record that does not exist.
  const duplicateOf =
    company && (certificateNumber || registrationNumber)
      ? await resolvers.findDuplicate({
          companyId: company.id,
          batteryModelId: model ? model.modelId : null,
          batteryId: battery ? battery.id : null,
          complianceType: type?.code || typeInput,
          certificateNumber,
          registrationNumber,
        })
      : null;
  if (duplicateOf) {
    errors.push({
      field: "certificate_number",
      message: `Duplicate of existing record #${duplicateOf.id} (${duplicateOf.certificateNumber || duplicateOf.registrationNumber || "no number"}) for the same company, scope and type.`,
      duplicateRecordId: duplicateOf.id,
    });
  }

  const payload = {
    companyId: company?.id || null,
    batteryModelId: model ? model.modelId : null,
    batteryId: battery ? battery.id : null,
    level,
    complianceType: type?.code || typeInput || null,
    authority: cell("authority") || type?.authority || null,
    regulationName: cell("regulation_name") || type?.regulationName || null,
    standardNumber: cell("standard_number") || null,
    registrationNumber,
    certificateNumber,
    status: applicability === "Not Applicable" ? "Not Applicable" : "Pending",
    applicability,
    issueDate: issueDate ? toDateString(issueDate) : null,
    expiryDate: expiryDate ? toDateString(expiryDate) : null,
    complianceDeadline: cell("compliance_deadline") ? toDateString(cell("compliance_deadline")) : null,
    testLab: cell("test_lab") || null,
    testDate: cell("test_date") ? toDateString(cell("test_date")) : null,
    testStandard: cell("test_standard") || null,
    testClause: cell("test_clause") || null,
    declaredCapacityAh,
    verifiedCapacityAh,
    testTemperatureC,
    notes: cell("notes") || null,
    internalComments: cell("internal_comments") || null,
    isDevelopmentData,
  };

  return { rowNumber: row.__rowNumber, companyName, payload, errors, warnings, duplicateOf };
};

export { RECORD_FIELDS };
