/* ============================================================
   COMPLIANCE MANAGEMENT — HTTP CONTROLLER
   Thin transport layer over ComplianceManagementService.

   It deliberately contains NO business rules: every decision about
   scope, status, duplicates, evidence and visibility already lives in
   the service, so the same rules apply whether a record arrives from
   this API, an import file, or a future public API.

   Route prefix: /api/admin/compliance/...
   (the sibling /compliance/* routes belong to the legacy India
   BWMR 2022 module and are intentionally untouched)

   Every route is additionally guarded by protect + requireAdmin at the
   router level; the service re-checks the admin role and the company
   scope itself, so a route mounted elsewhere cannot bypass it.
   ============================================================ */

import store from "../data/index.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { parsePagination } from "../utils/pagination.js";
import {
  APPLICABILITY_VALUES,
  COMPLIANCE_LEVELS,
  DEADLINE_STATES,
  DOCUMENT_VISIBILITY_VALUES,
  EXPIRY_STATES,
  KNOWN_AUTHORITIES,
  RECORD_DOCUMENT_TYPES,
  RECORD_EVENT_TYPES,
  RECORD_STATUSES,
} from "../constants/complianceManagement.js";
import { IMPORT_COLUMNS } from "../utils/complianceRecordValidation.js";
import { createComplianceManagementService } from "../services/complianceManagementService.js";
import { resolveBatteryByIdentifier } from "../utils/batteryIdentifier.js";
import { ownerScopeFor } from "../utils/ownerScope.js";

const service = createComplianceManagementService({ store });

const listWindow = (req) => {
  const { page, limit } = parsePagination(req.query);
  return { page, limit };
};

/* Query-string booleans: only an explicit true/false counts, so an
   absent parameter never silently flips a filter. */
const boolParam = (value) => {
  if (value === undefined || value === null || value === "") return undefined;
  return ["1", "true", "yes"].includes(String(value).toLowerCase());
};

const intParam = (value) => {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : undefined;
};

/* A malformed :id in the path is "no such resource", not a server fault.
   The stores pass ids straight to PostgreSQL as integers, so without this
   guard Number("abc") becomes NaN and the driver raises
   "invalid input syntax for type integer", surfacing as a 500. */
const resourceId = (raw, label) => {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    const err = new Error(`${label} not found`);
    err.statusCode = 404;
    err.code = "NOT_FOUND";
    throw err;
  }
  return n;
};

/* Battery model ids are text identifiers (e.g. "MX-100"), not row ids, so
   they must not be coerced to a number. */
const modelKey = (raw) => {
  const value = String(raw ?? "").trim();
  if (!value) {
    const err = new Error("Battery model not found");
    err.statusCode = 404;
    err.code = "NOT_FOUND";
    throw err;
  }
  return value;
};

/* ============================================================
   vocabulary — the UI builds its dropdowns from this so the
   frontend never hardcodes a status or authority list.
   ============================================================ */

// GET /api/admin/compliance/options
export const getComplianceOptions = asyncHandler(async (req, res) => {
  const [types, settings] = await Promise.all([service.listTypes(), service.settings()]);
  res.json({
    success: true,
    data: {
      levels: COMPLIANCE_LEVELS,
      statuses: RECORD_STATUSES,
      applicability: APPLICABILITY_VALUES,
      authorities: KNOWN_AUTHORITIES,
      documentTypes: RECORD_DOCUMENT_TYPES,
      documentVisibility: DOCUMENT_VISIBILITY_VALUES,
      eventTypes: RECORD_EVENT_TYPES,
      expiryStates: EXPIRY_STATES,
      deadlineStates: DEADLINE_STATES,
      types,
      settings,
      importColumns: IMPORT_COLUMNS,
    },
  });
});

/* ============================================================
   companies
   ============================================================ */

// GET /api/admin/compliance/companies
export const listComplianceCompanies = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.listCompanies(req.user, req.query) });
});

// GET /api/admin/compliance/companies/:id
export const getComplianceCompany = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.getCompany(req.user, resourceId(req.params.id, "Company")) });
});

/* Note on style: every handler awaits the service *before* touching
   res.status(). errorHandler prefers an already-set status code, so
   setting 201 up-front would report validation and conflict failures
   (400/403/404/409) as successful creates. */

// POST /api/admin/compliance/companies
export const createComplianceCompany = asyncHandler(async (req, res) => {
  const data = await service.createCompany(req.user, req.body);
  res.status(201).json({ success: true, data });
});

// PATCH /api/admin/compliance/companies/:id
export const updateComplianceCompany = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.updateCompany(req.user, resourceId(req.params.id, "Company"), req.body) });
});

// DELETE /api/admin/compliance/companies/:id
export const deleteComplianceCompany = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.deleteCompany(req.user, resourceId(req.params.id, "Company")) });
});

// GET /api/admin/compliance/companies/:id/models
export const listComplianceCompanyModels = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.listModels(req.user, resourceId(req.params.id, "Company")) });
});

/* ---------- models ↔ company ---------- */

// GET /api/admin/compliance/models
export const listComplianceModels = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.listModels(req.user, intParam(req.query.companyId) ?? null) });
});

// PATCH /api/admin/compliance/models/:modelId/company
export const setComplianceModelCompany = asyncHandler(async (req, res) => {
  const modelId = modelKey(req.params.modelId);
  const raw = req.body?.companyId;
  const companyId = raw === undefined || raw === null || raw === "" ? null : resourceId(raw, "Company");
  const data = await service.setModelCompany(req.user, modelId, companyId);
  res.json({ success: true, data });
});

/* ============================================================
   compliance types
   ============================================================ */

// GET /api/admin/compliance/types
export const listComplianceTypes = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.listTypes() });
});

// POST /api/admin/compliance/types
export const createComplianceType = asyncHandler(async (req, res) => {
  const data = await service.createType(req.user, req.body);
  res.status(201).json({ success: true, data });
});

// PATCH /api/admin/compliance/types/:id
export const updateComplianceType = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.updateType(req.user, resourceId(req.params.id, "Compliance type"), req.body) });
});

// DELETE /api/admin/compliance/types/:id
export const deleteComplianceType = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.deleteType(req.user, resourceId(req.params.id, "Compliance type")) });
});

/* ============================================================
   compliance records
   ============================================================ */

// GET /api/admin/compliance/records
export const listComplianceRecords = asyncHandler(async (req, res) => {
  const { page, limit } = listWindow(req);
  const result = await service.listRecords(req.user, {
    ...req.query,
    page,
    limit,
    includeDevelopmentData: boolParam(req.query.includeDevelopmentData) ?? true,
    expiringWithinDays: intParam(req.query.expiringWithinDays),
    deadlineWithinDays: intParam(req.query.deadlineWithinDays),
  });
  res.json({ success: true, data: result.data, pagination: result.pagination });
});

// GET /api/admin/compliance/records/:id
export const getComplianceRecord = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.getRecord(req.user, resourceId(req.params.id, "Compliance record")) });
});

// POST /api/admin/compliance/records
export const createComplianceRecord = asyncHandler(async (req, res) => {
  const data = await service.createRecord(req.user, req.body);
  res.status(201).json({ success: true, data });
});

// PATCH /api/admin/compliance/records/:id
export const updateComplianceRecord = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.updateRecord(req.user, resourceId(req.params.id, "Compliance record"), req.body) });
});

/* The only way a record becomes Compliant. */
export const verifyComplianceRecord = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await service.verifyRecord(req.user, resourceId(req.params.id, "Compliance record"), req.body || {}),
  });
});

// DELETE /api/admin/compliance/records/:id
export const deleteComplianceRecord = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.deleteRecord(req.user, resourceId(req.params.id, "Compliance record")) });
});

/* "Which batteries does this record actually cover?" — the blast radius
   an admin sees before committing a company- or model-wide change. */
export const listComplianceRecordBatteries = asyncHandler(async (req, res) => {
  const { page, limit } = listWindow(req);
  const result = await service.relatedBatteries(req.user, resourceId(req.params.id, "Compliance record"), {
    page,
    limit,
    search: req.query.search || "",
  });
  res.json({ success: true, data: result.data, pagination: result.pagination });
});

// GET /api/admin/compliance/records/:id/events
export const listComplianceRecordEvents = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await service.listEvents(req.user, {
      complianceId: resourceId(req.params.id, "Compliance record"),
      eventType: req.query.eventType || "",
      limit: intParam(req.query.limit) || 200,
    }),
  });
});

/* ============================================================
   record documents (metadata only — the file lives in object storage)
   ============================================================ */

// GET /api/admin/compliance/record-documents
export const listComplianceRecordDocuments = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.listDocuments(req.user, req.query) });
});

// POST /api/admin/compliance/record-documents
export const attachComplianceRecordDocument = asyncHandler(async (req, res) => {
  const data = await service.attachDocument(req.user, req.body);
  res.status(201).json({ success: true, data });
});

// DELETE /api/admin/compliance/record-documents/:id
export const detachComplianceRecordDocument = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.detachDocument(req.user, resourceId(req.params.id, "Document")) });
});

/* ============================================================
   dashboard, settings, events
   ============================================================ */

// GET /api/admin/compliance/dashboard
export const getComplianceDashboard = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.dashboard(req.user, req.query) });
});

// GET /api/admin/compliance/settings
export const getComplianceSettings = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.settings() });
});

// PATCH /api/admin/compliance/settings
export const updateComplianceSettings = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.updateSettings(req.user, req.body) });
});

// GET /api/admin/compliance/record-events
// Named "record-events" because the legacy module already owns
// GET /api/admin/compliance/events.
export const listComplianceEvents = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await service.listEvents(req.user, {
      companyId: req.query.companyId,
      eventType: req.query.eventType || "",
      limit: intParam(req.query.limit) || 200,
    }),
  });
});

/* ============================================================
   import
   ============================================================ */

// POST /api/admin/compliance/import
// Accepts the file as the raw request body (text/csv or xlsx) or as
// { csv } in JSON, so no multipart dependency is required.
export const importComplianceRecords = asyncHandler(async (req, res) => {
  const buffer = Buffer.isBuffer(req.body) ? req.body : req.body?.csv ? Buffer.from(req.body.csv, "utf8") : null;
  const dryRun = boolParam(req.query.dryRun ?? req.body?.dryRun) ?? true;
  const fileName = req.get("x-file-name") || req.body?.fileName || null;
  const rawCompany = req.query.companyId || req.body?.companyId || null;
  const companyId = rawCompany === null || rawCompany === "" ? null : resourceId(rawCompany, "Company");

  const result = await service.importSpreadsheet(req.user, { buffer, fileName, dryRun, companyId });
  res.status(result.committed ? 201 : 200).json({ success: result.ok, data: result });
});

/* A ready-to-fill template, generated from the same column contract the
   importer validates against — so the file always matches the parser. */
export const getComplianceImportTemplate = asyncHandler(async (req, res) => {
  const header = IMPORT_COLUMNS.map((c) => c.label).join(",");
  const example = [
    "Acme Battery Industries",
    "",
    "BIS_CRS",
    "BIS",
    "",
    "EXAMPLE-CERT-001",
    "Pending",
    "Applicable",
    "2025-01-01",
    "2030-01-01",
    "",
    "",
    "",
    "",
    "",
    "",
    "Issued by an accredited lab",
    "No internal note",
    "no",
  ].join(",");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="compliance-import-template.csv"');
  res.send(`${header}\n${example}\n`);
});

/* ============================================================
   customer passport (owner-scoped, read-only)
   ============================================================ */

// GET /api/batteries/:id/compliance-passport
export const getBatteryCompliancePassport = asyncHandler(async (req, res) => {
  const battery = await resolveBatteryByIdentifier(store, req.params.id, ownerScopeFor(req));
  if (!battery) {
    res.status(404);
    throw new Error("Battery not found");
  }
  const passport = await service.batteryPassport(battery.id ?? battery.batteryId);
  /* `available: false` lets the UI render an honest "not yet tracked"
     state instead of inventing compliance data. */
  res.json({ success: true, available: passport.counts.records > 0, data: passport });
});

export { service as complianceManagementService };
