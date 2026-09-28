/* ============================================================
   COMPLIANCE MANAGEMENT SERVICE
   The business rules that sit between the admin HTTP routes and the
   data stores (PostgreSQL in production, the in-memory store in
   development).

   Everything in this file is deliberately store-agnostic: it only
   talks to the store methods, so the exact same rules run whether the
   app is backed by PostgreSQL or by mock data. That is what keeps the
   development experience honest.

   THE RULES THIS SERVICE OWNS
   ---------------------------
   1. SCOPE IS DERIVED, NEVER TRUSTED. A record's level (company /
      model / battery) comes from its link columns. The `level` in a
      request body is only ever used to cross-check the derivation.
   2. COMPLIANT IS EARNED, NOT TYPED. A record can never be created
      or patched into "Compliant"; only verifyRecord() may do that, and
      it always writes an audit event. The same holds for imports:
      an imported "Compliant" row is stored as Pending with a warning.
   3. DUPLICATES ARE REFUSED. The same certificate/registration number
      for the same company + scope + type is a data-entry error, not a
      second certificate.
   4. COMPANY SCOPING IS SERVER-SIDE. A company admin is pinned to its
      own company by utils/complianceAccess.js; nothing a client sends
      can widen that.
   5. THE PASSPORT ONLY SHOWS REAL EVIDENCE. Customer reads exclude
      development/reference rows and Internal-only documents.
   6. TIMING IS COMPUTED HERE, ON THE BACKEND. Every record that leaves
      this service carries its derived expiry/deadline state, so the
      UI never does date arithmetic and the same answer is produced for
      the list, the dashboard and the passport.
   ============================================================ */

import {
  COMPLIANCE_LEVELS,
  RECORD_STATUSES,
  APPLICABILITY_VALUES,
  KNOWN_AUTHORITIES,
} from "../constants/complianceManagement.js";
import {
  ComplianceValidationError,
  IMPORT_COLUMNS,
  assertTypeRequirements,
  mapImportRow,
  parseCompanyPatch,
  parseCompanyPayload,
  parseComplianceRecordPatch,
  parseComplianceRecordPayload,
  parseComplianceSettingsPayload,
  parseRecordDocumentPayload,
  parseVerificationPayload,
  requirementsFor,
  resolveLevel,
  validateImportHeaders,
} from "../utils/complianceRecordValidation.js";
import {
  ComplianceAccessError,
  adminCompanyId,
  assertCanEdit,
  assertCanRead,
  assertComplianceAdmin,
  assertPlatformOperator,
  isPlatformOperator,
  isPublishable,
  resolveCompanyScope,
} from "../utils/complianceAccess.js";
import {
  computeComplianceTiming,
  resolveSettings,
  suggestNextReviewDate,
} from "../utils/complianceExpiry.js";
import { parseSpreadsheetBuffer } from "../utils/spreadsheet.js";

const notFound = (what = "Compliance record") =>
  new ComplianceAccessError(`${what} not found.`, 404, "NOT_FOUND");

const conflict = (message, code, extra = {}) =>
  Object.assign(new ComplianceAccessError(message, 409, code), extra);

export class ComplianceManagementService {
  constructor({ store }) {
    if (!store) throw new Error("ComplianceManagementService requires a data store");
    this.store = store;
  }

  /* ============================================================
     settings — read once per request pass, because every derived
     timing answer depends on the configured thresholds.
     ============================================================ */

  async settings() {
    return resolveSettings(await this.store.getComplianceSettings());
  }

  /* Attach the derived timing block to a record row. Internal comments
     are stripped here: they must never reach a customer-facing payload. */
  async present(record, settings, { includeInternal = false } = {}) {
    if (!record) return null;
    const timing = computeComplianceTiming(record, settings);
    const out = { ...record, ...timing };
    if (!includeInternal) delete out.internalComments;
    return out;
  }

  async presentAll(records, settings, options) {
    return Promise.all(records.map((r) => this.present(r, settings, options)));
  }

  /* ============================================================
     companies
     ============================================================ */

  async listCompanies(user, query = {}) {
    assertComplianceAdmin(user);
    const scope = resolveCompanyScope(user, query.companyId);
    return this.store.listCompanies({
      search: query.search || "",
      status: query.status || "",
      restrictToCompanyId: scope.companyId,
      includeDevelopmentData: query.includeDevelopmentData !== false,
    });
  }

  async getCompany(user, id) {
    assertComplianceAdmin(user);
    const company = await this.store.getCompanyById(id);
    const scoped = adminCompanyId(user);
    if (!company || (scoped !== null && company.id !== scoped)) throw notFound("Company");
    const settings = await this.settings();
    const records = await this.store.listComplianceRecords({
      companyId: company.id,
      limit: 200,
      includeDevelopmentData: true,
    });
    const models = await this.store.listCompanyModels(company.id);
    return {
      ...company,
      models,
      summary: {
        records: records.pagination.total,
        byLevel: records.data.reduce((acc, r) => {
          acc[r.level] = (acc[r.level] || 0) + 1;
          return acc;
        }, { COMPANY: 0, BATTERY_MODEL: 0, BATTERY: 0 }),
        needsAttention: (await this.store.getComplianceDashboard({
          companyId: company.id,
          settings,
        })).counts.needsAttention,
      },
    };
  }

  async createCompany(user, body) {
    assertComplianceAdmin(user);
    // Only MaxSpace staff may add a company; a company admin cannot
    // invent a new tenant.
    assertPlatformOperator(user, "create companies");
    const payload = parseCompanyPayload(body);
    await this.assertCompanyUnique(payload, null);
    return this.store.createCompany(payload);
  }

  async updateCompany(user, id, body) {
    assertComplianceAdmin(user);
    const existing = await this.store.getCompanyById(id);
    const scoped = adminCompanyId(user);
    if (!existing || (scoped !== null && existing.id !== scoped)) throw notFound("Company");
    if (scoped !== null) assertCanEdit(user, existing.id);
    const patch = parseCompanyPatch(body);
    if (patch.name || patch.code) {
      await this.assertCompanyUnique(
        { name: patch.name ?? existing.name, code: patch.code ?? existing.code },
        existing.id
      );
    }
    return this.store.updateCompany(existing.id, patch);
  }

  /* A company can only be removed while it is still empty: its records
     and documents are the compliance history and must not vanish. */
  async deleteCompany(user, id) {
    assertComplianceAdmin(user);
    assertPlatformOperator(user, "delete companies");
    const existing = await this.store.getCompanyById(id);
    if (!existing) throw notFound("Company");
    const records = await this.store.listComplianceRecords({ companyId: existing.id, limit: 1 });
    if (records.pagination.total > 0) {
      throw conflict(
        `This company still has ${records.pagination.total} compliance record(s). Delete or reassign them first.`,
        "COMPANY_IN_USE",
        { inUse: records.pagination.total }
      );
    }
    /* users.company_id == NULL means "platform operator, may act for any
       company". If deleting a company were allowed to null that column
       (ON DELETE SET NULL), every admin assigned to it would silently
       become a platform operator. Refuse the delete instead. */
    const assigned = (await this.store.getAllUsers()).filter(
      (u) => u.companyId !== null && u.companyId !== undefined && Number(u.companyId) === Number(existing.id)
    );
    if (assigned.length) {
      throw conflict(
        `This company still has ${assigned.length} assigned user(s). Reassign or deactivate them first.`,
        "COMPANY_HAS_USERS",
        { assignedUsers: assigned.length }
      );
    }
    await this.store.deleteCompany(existing.id);
    return { deleted: true, id: existing.id };
  }

  async assertCompanyUnique({ name, code }, excludeId) {
    if (name && !(await this.store.isCompanyNameUnique(name, excludeId))) {
      throw conflict(`A company named "${name}" already exists.`, "COMPANY_NAME_TAKEN", { field: "name" });
    }
    if (code && !(await this.store.isCompanyCodeUnique(code, excludeId))) {
      throw conflict(`Company code "${code}" is already in use.`, "COMPANY_CODE_TAKEN", { field: "code" });
    }
    return true;
  }

  /* ---------- models ↔ company ---------- */

  async listModels(user, companyId) {
    assertComplianceAdmin(user);
    const scope = resolveCompanyScope(user, companyId);
    return this.store.listCompanyModels(scope.companyId);
  }

  /* Assigning a model to a company is a platform decision: it defines
     whose certificates apply to every battery of that model. */
  async setModelCompany(user, modelId, companyId) {
    assertComplianceAdmin(user);
    assertPlatformOperator(user, "reassign a battery model's company");
    const model = await this.store.getBatteryModelById(modelId);
    if (!model) throw notFound("Battery model");
    if (companyId !== null && companyId !== undefined && companyId !== "") {
      const company = await this.store.getCompanyById(companyId);
      if (!company) throw notFound("Company");
    }
    const changed = await this.store.setModelCompany(model.modelId, companyId ?? null);
    if (!changed) throw notFound("Battery model");
    /* Return the refreshed model rather than a bare boolean, so the admin
       UI can render the new owner without a second round trip. */
    return this.store.getBatteryModelById(model.modelId);
  }

  /* ============================================================
     compliance types (the catalogue)
     ============================================================ */

  async listTypes() {
    return this.store.listComplianceTypes({ includeInactive: true });
  }

  async createType(user, body) {
    assertComplianceAdmin(user);
    const payload = this.parseTypePayload(body);
    if (!(await this.store.isComplianceTypeCodeUnique(payload.code, null))) {
      throw conflict(`Compliance type "${payload.code}" already exists.`, "TYPE_CODE_TAKEN", { field: "code" });
    }
    return this.store.createComplianceType(payload);
  }

  async updateType(user, id, body) {
    assertComplianceAdmin(user);
    const existing = await this.store.getComplianceTypeById(id);
    if (!existing) throw notFound("Compliance type");
    const payload = this.parseTypePayload(body, existing);
    if (payload.code && payload.code !== existing.code) {
      if (!(await this.store.isComplianceTypeCodeUnique(payload.code, existing.id))) {
        throw conflict(`Compliance type "${payload.code}" already exists.`, "TYPE_CODE_TAKEN", { field: "code" });
      }
    }
    return this.store.updateComplianceType(existing.id, payload);
  }

  async deleteType(user, id) {
    assertComplianceAdmin(user);
    const result = await this.store.deleteComplianceType(id);
    if (!result.deleted) {
      throw conflict(
        `This type is still used by ${result.inUse} compliance record(s), so it cannot be deleted. Deactivate it instead.`,
        "TYPE_IN_USE",
        { inUse: result.inUse }
      );
    }
    return result;
  }

  parseTypePayload(body, existing = null) {
    const source = body || {};
    const text = (key, max = 200) => {
      if (!Object.prototype.hasOwnProperty.call(source, key)) return undefined;
      const v = source[key];
      return v === null || v === "" ? null : String(v).trim().slice(0, max);
    };
    const bool = (key) => {
      if (!Object.prototype.hasOwnProperty.call(source, key)) return undefined;
      return Boolean(source[key]);
    };
    const code = text("code", 60)?.toUpperCase() ?? existing?.code;
    if (!code) throw new ComplianceValidationError("code is required.", { field: "code", code: "REQUIRED" });
    const label = text("label", 200) ?? existing?.label;
    if (!label) throw new ComplianceValidationError("label is required.", { field: "label", code: "REQUIRED" });

    const defaultLevel = text("defaultLevel", 20) ?? existing?.defaultLevel ?? "COMPANY";
    if (!COMPLIANCE_LEVELS.includes(defaultLevel)) {
      throw new ComplianceValidationError(`defaultLevel must be one of: ${COMPLIANCE_LEVELS.join(", ")}.`, {
        field: "defaultLevel",
        code: "INVALID_ENUM",
      });
    }
    const defaultApplicability = text("defaultApplicability", 30) ?? existing?.defaultApplicability ?? "Applicable";
    if (!APPLICABILITY_VALUES.includes(defaultApplicability)) {
      throw new ComplianceValidationError(
        `defaultApplicability must be one of: ${APPLICABILITY_VALUES.join(", ")}.`,
        { field: "defaultApplicability", code: "INVALID_ENUM" }
      );
    }
    const authority = text("authority", 200) ?? existing?.authority ?? null;
    if (authority && !KNOWN_AUTHORITIES.includes(authority)) {
      throw new ComplianceValidationError(`authority must be one of: ${KNOWN_AUTHORITIES.join(", ")}.`, {
        field: "authority",
        code: "INVALID_ENUM",
      });
    }
    const sortOrder = source.sortOrder === undefined ? existing?.sortOrder ?? 50 : Number(source.sortOrder);

    return {
      code,
      label,
      description: text("description", 1000) ?? existing?.description ?? null,
      authority,
      regulationName: text("regulationName", 300) ?? existing?.regulationName ?? null,
      defaultLevel,
      defaultApplicability,
      requiresCertificate: bool("requiresCertificate") ?? existing?.requiresCertificate ?? false,
      requiresTestReport: bool("requiresTestReport") ?? existing?.requiresTestReport ?? false,
      requiresCapacity: bool("requiresCapacity") ?? existing?.requiresCapacity ?? false,
      requiresExpiry: bool("requiresExpiry") ?? existing?.requiresExpiry ?? true,
      isActive: bool("isActive") ?? existing?.isActive ?? true,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : 50,
      isDevelopmentData: bool("isDevelopmentData") ?? existing?.isDevelopmentData ?? false,
    };
  }

  /* ============================================================
     compliance records
     ============================================================ */

  async listRecords(user, query = {}) {
    assertComplianceAdmin(user);
    const settings = await this.settings();
    const scope = resolveCompanyScope(user, query.companyId);
    const result = await this.store.listComplianceRecords({
      ...query,
      companyId: scope.companyId,
      restrictToCompanyId: scope.companyId,
      // Development rows are only ever hidden from customer reads, so
      // the admin list keeps them unless the caller opts out.
      includeDevelopmentData: query.includeDevelopmentData !== false,
      /* The expiry/deadline windows are OPT-IN. Defaulting them to the
         configured thresholds here would silently hide every long-dated
         record from the admin list — the dashboard already owns the
         "expiring soon" worklist. */
      expiringWithinDays: query.expiringWithinDays ?? null,
      deadlineWithinDays: query.deadlineWithinDays ?? null,
    });
    return {
      ...result,
      data: await this.presentAll(result.data, settings, { includeInternal: true }),
    };
  }

  async getRecord(user, id) {
    assertComplianceAdmin(user);
    const record = assertCanRead(user, await this.store.getComplianceRecordById(id));
    const settings = await this.settings();
    const [presented, documents, events] = await Promise.all([
      this.present(record, settings, { includeInternal: true }),
      this.store.listComplianceRecordDocuments({ complianceId: record.id }),
      this.store.listComplianceRecordEvents({ complianceId: record.id }),
    ]);
    return { ...presented, documents, events };
  }

  async createRecord(user, body) {
    assertComplianceAdmin(user);
    const companyId = Number(body?.companyId) || null;
    if (!companyId) {
      throw new ComplianceValidationError("companyId is required — every compliance record belongs to a company.", {
        field: "companyId",
        code: "REQUIRED",
      });
    }
    assertCanEdit(user, companyId);
    const company = await this.store.getCompanyById(companyId);
    if (!company) throw notFound("Company");

    const type = await this.resolveType(body?.complianceType);
    const payload = parseComplianceRecordPayload(body, {
      level: body?.level || null,
      type,
    });

    /* Cross-company integrity: a model-level record may only be filed
       against the company that actually owns the model. */
    if (payload.batteryModelId) {
      const model = await this.store.getBatteryModelById(payload.batteryModelId);
      if (!model) {
        throw new ComplianceValidationError(
          `Battery model "${payload.batteryModelId}" is not registered in the production database.`,
          { field: "batteryModelId", code: "UNKNOWN_MODEL" }
        );
      }
      if (model.companyId && model.companyId !== companyId) {
        const owner = await this.store.getCompanyById(model.companyId);
        throw new ComplianceValidationError(
          `Battery model "${payload.batteryModelId}" belongs to ${owner?.name || "another company"}.`,
          { field: "batteryModelId", code: "MODEL_OWNED_BY_OTHER_COMPANY" }
        );
      }
    }
    if (payload.batteryId) {
      const battery = await this.store.getBatteryById(payload.batteryId);
      if (!battery) {
        throw new ComplianceValidationError(`Battery "${payload.batteryId}" was not found by that Battery ID.`, {
          field: "batteryId",
          code: "UNKNOWN_BATTERY",
        });
      }
    }

    await this.assertNoDuplicate(payload, null);

    const record = await this.store.createComplianceRecord(
      { ...payload, level: resolveLevel(payload) },
      user?.username || user?.email || null
    );
    await this.store.addComplianceRecordEvent({
      complianceId: record.id,
      eventType: "record_created",
      eventDescription: `Created a ${record.level.toLowerCase().replace("_", "-")} ${type.label} record.`,
      newValue: record.status,
      createdBy: user?.username || user?.email || null,
    });
    const settings = await this.settings();
    return this.present(record, settings, { includeInternal: true });
  }

  async updateRecord(user, id, body) {
    assertComplianceAdmin(user);
    const existing = assertCanRead(user, await this.store.getComplianceRecordById(id));
    assertCanEdit(user, existing.companyId);

    const type = await this.resolveType(body?.complianceType || existing.complianceType);
    const patch = parseComplianceRecordPatch(body, { type });

    /* Scope may not be silently rewritten: moving a record to another
       company, model or battery is a deliberate re-filing. */
    if (patch.companyId !== undefined && patch.companyId !== existing.companyId) {
      assertCanEdit(user, patch.companyId);
    }
    const nextModel = patch.batteryModelId !== undefined ? patch.batteryModelId : existing.batteryModelId;
    const nextBattery = patch.batteryId !== undefined ? patch.batteryId : existing.batteryId;
    resolveLevel({ batteryModelId: nextModel, batteryId: nextBattery });

    const merged = { ...existing, ...patch };
    await this.assertTypeStillSatisfied(merged, type, existing);
    await this.assertNoDuplicate(merged, existing.id);

    const record = await this.store.updateComplianceRecord(existing.id, patch);
    await this.recordDiff(existing, record, user, "record_updated");
    const settings = await this.settings();
    return this.present(record, settings, { includeInternal: true });
  }

  /* The audited path to "Compliant". Everything that makes a record
     compliant in the real world — checking the certificate, the test
     report, the measured capacity — is recorded here. */
  async verifyRecord(user, id, body) {
    assertComplianceAdmin(user);
    const existing = assertCanRead(user, await this.store.getComplianceRecordById(id));
    assertCanEdit(user, existing.companyId);
    const parsed = parseVerificationPayload(body);

    const type = await this.resolveType(existing.complianceType);
    if (parsed.status === "Compliant" || parsed.status === "Expired" || parsed.status === "Attention Required") {
      /* Verifying to Compliant means asserting the evidence is present,
         so the type's own requirements are re-checked at this moment. */
      assertTypeRequirements(
        {
          ...existing,
          applicability: parsed.applicability ?? existing.applicability,
          certificateNumber: existing.certificateNumber,
          registrationNumber: existing.registrationNumber,
          testLab: existing.testLab,
          declaredCapacityAh: existing.declaredCapacityAh,
          verifiedCapacityAh: existing.verifiedCapacityAh,
        },
        type,
        existing.level
      );
    }

    const settings = await this.settings();
    const status = parsed.status || "Compliant";
    const nextReviewDate = suggestNextReviewDate(
      { ...existing, nextReviewDate: null, lastVerifiedAt: null },
      settings
    );

    const record = await this.store.verifyComplianceRecord(existing.id, {
      status,
      verifiedBy: user?.username || user?.email || null,
      notes: parsed.notes ?? null,
      nextReviewDate,
    });
    await this.store.addComplianceRecordEvent({
      complianceId: existing.id,
      eventType: "record_verified",
      eventDescription: parsed.reason || parsed.notes || `Status set to ${status}.`,
      oldValue: existing.status,
      newValue: status,
      reason: parsed.reason || null,
      createdBy: user?.username || user?.email || null,
    });
    return this.present(record, settings, { includeInternal: true });
  }

  async deleteRecord(user, id) {
    assertComplianceAdmin(user);
    const existing = assertCanRead(user, await this.store.getComplianceRecordById(id));
    assertCanEdit(user, existing.companyId);
    await this.store.deleteComplianceRecord(existing.id);
    return { deleted: true, id: existing.id };
  }

  /* "What does this record actually cover?" — the blast radius shown
     before a company- or model-wide change is committed. */
  async relatedBatteries(user, id, query = {}) {
    assertComplianceAdmin(user);
    const record = assertCanRead(user, await this.store.getComplianceRecordById(id));
    return this.store.listRelatedBatteriesForRecord(record.id, query);
  }

  async listEvents(user, query = {}) {
    assertComplianceAdmin(user);
    if (query.complianceId) {
      const record = assertCanRead(user, await this.store.getComplianceRecordById(query.complianceId));
      return this.store.listComplianceRecordEvents({ ...query, complianceId: record.id });
    }
    const scope = resolveCompanyScope(user, query.companyId);
    if (scope.companyId) {
      const records = await this.store.listComplianceRecords({ companyId: scope.companyId, limit: 500 });
      const ids = records.data.map((r) => r.id);
      const all = await this.store.listComplianceRecordEvents({ eventType: query.eventType || "", limit: query.limit });
      return all.filter((e) => ids.includes(e.complianceId));
    }
    return this.store.listComplianceRecordEvents(query);
  }

  /* ============================================================
     documents
     ============================================================ */

  async listDocuments(user, query = {}) {
    assertComplianceAdmin(user);
    if (query.complianceId) {
      const record = assertCanRead(user, await this.store.getComplianceRecordById(query.complianceId));
      return this.store.listComplianceRecordDocuments({
        complianceId: record.id,
        visibility: query.visibility || "",
      });
    }
    const scope = resolveCompanyScope(user, query.companyId);
    return this.store.listComplianceRecordDocuments({
      visibility: query.visibility || "",
      restrictToCompanyId: scope.companyId,
    });
  }

  /* Only the metadata is stored: fileName + storageRef point at object
     storage. The PDF itself is never read into the database. */
  async attachDocument(user, body) {
    assertComplianceAdmin(user);
    const payload = parseRecordDocumentPayload(body, { requireComplianceId: true });
    const record = assertCanRead(user, await this.store.getComplianceRecordById(payload.complianceId));
    assertCanEdit(user, record.companyId);
    const document = await this.store.createComplianceRecordDocument({
      ...payload,
      uploadedBy: user?.username || user?.email || null,
    });
    await this.store.addComplianceRecordEvent({
      complianceId: record.id,
      eventType: "document_attached",
      eventDescription: `${document.documentType}: ${document.documentName}`,
      newValue: document.visibility,
      createdBy: user?.username || user?.email || null,
    });
    return document;
  }

  async detachDocument(user, id) {
    assertComplianceAdmin(user);
    const document = await this.store.getComplianceRecordDocumentById(id);
    if (!document) throw notFound("Document");
    if (document.complianceId) {
      const record = assertCanRead(user, await this.store.getComplianceRecordById(document.complianceId));
      assertCanEdit(user, record.companyId);
    }
    await this.store.deleteComplianceRecordDocument(document.id);
    return { deleted: true, id: document.id };
  }

  /* ============================================================
     dashboard
     ============================================================ */

  async dashboard(user, query = {}) {
    assertComplianceAdmin(user);
    const settings = await this.settings();
    const scope = resolveCompanyScope(user, query.companyId);
    const result = await this.store.getComplianceDashboard({
      companyId: scope.companyId,
      restrictToCompanyId: scope.companyId,
      settings,
    });
    return {
      ...result,
      types: await this.store.listComplianceTypes({ includeInactive: false }),
      events: await this.listEvents(user, { limit: 25 }),
      scope: { companyId: scope.companyId, isPlatform: scope.isPlatform },
    };
  }

  async updateSettings(user, body) {
    assertComplianceAdmin(user);
    assertPlatformOperator(user, "change global compliance settings");
    const patch = parseComplianceSettingsPayload(body);
    const updated = await this.store.updateComplianceSettings(patch, user?.username || user?.email || null);
    return resolveSettings(updated);
  }

  /* ============================================================
     import
     ============================================================ */

  /* Parses the uploaded file and validates every row, then either
     previews the result (dryRun) or commits it. Rows are never
     partially applied: a file with errors imports nothing. */
  async importSpreadsheet(user, { buffer, fileName, dryRun = true, companyId = null } = {}) {
    assertComplianceAdmin(user);
    if (!buffer || !Buffer.isBuffer(buffer)) {
      throw new ComplianceValidationError("No spreadsheet file was uploaded.", { field: "file", code: "REQUIRED" });
    }

    let parsed;
    try {
      parsed = parseSpreadsheetBuffer(buffer);
    } catch (error) {
      throw new ComplianceValidationError(error.message, { field: "file", code: "UNREADABLE_FILE" });
    }
    const headerCheck = validateImportHeaders(parsed.headers);
    if (headerCheck.missing.length) {
      throw new ComplianceValidationError(
        `The spreadsheet is missing required column(s): ${headerCheck.missing.join(", ")}.`,
        { field: "headers", code: "MISSING_COLUMNS" }
      );
    }
    if (!parsed.rows.length) {
      throw new ComplianceValidationError("The spreadsheet has a header row but no data rows.", {
        field: "rows",
        code: "NO_ROWS",
      });
    }

    const scope = resolveCompanyScope(user, companyId);
    const companies = await this.store.listCompanies({ restrictToCompanyId: scope.companyId });
    const companyByName = new Map(companies.map((c) => [c.name.toLowerCase(), c]));
    const types = await this.store.listComplianceTypes({ includeInactive: false });
    const typeByKey = new Map();
    for (const t of types) {
      typeByKey.set(t.code.toLowerCase(), t);
      if (t.label) typeByKey.set(t.label.toLowerCase(), t);
    }
    const models = new Map((await this.store.listCompanyModels(null)).map((m) => [String(m.modelId).toLowerCase(), m]));

    const batteryIds = new Set();
    for (const row of parsed.rows) {
      const id = row.values.battery_id;
      if (id) batteryIds.add(String(id).trim());
    }
    const batteries = new Map();
    for (const id of batteryIds) {
      const battery = await this.store.getBatteryById(id);
      if (battery) batteries.set(String(battery.batteryId ?? battery.id).toLowerCase(), battery);
    }

    const resolvers = {
      findCompany: (name) => companyByName.get(String(name).trim().toLowerCase()) || null,
      findType: (value) => typeByKey.get(String(value).trim().toLowerCase()) || null,
      findModel: (modelId) => models.get(String(modelId).trim().toLowerCase()) || null,
      findBattery: (batteryId) => batteries.get(String(batteryId).trim().toLowerCase()) || null,
      typeOptions: () => types.map((t) => t.code),
      findDuplicate: (args) => this.store.findDuplicateComplianceRecord(args),
    };

    const evaluated = await Promise.all(parsed.rows.map((row) => mapImportRow(row, resolvers)));
    /* A company admin may only import into its own company. Its company
       resolver only ever sees its own company, so a row naming another
       tenant arrives here unresolved — replace that generic "does not
       exist" error with the accurate reason. This runs BEFORE the report
       is aggregated, so the counts and messages the admin sees always
       describe the final state of the rows. */
    if (!isPlatformOperator(user) && scope.companyId) {
      const allCompanies = new Map(
        (await this.store.listCompanies({})).map((c) => [c.name.toLowerCase(), c])
      );
      for (const row of evaluated) {
        const name = String(row.companyName || "").toLowerCase();
        if (!name) continue;
        const foreign = allCompanies.get(name);
        if (!foreign || foreign.id === scope.companyId) continue;
        row.errors = row.errors.filter((e) => e.field !== "company");
        row.errors.push({
          field: "company",
          message: `"${foreign.name}" is not your company. You can only import records for your own company.`,
        });
        row.payload.companyId = null;
      }
    }

    /* Duplicates WITHIN one file. The per-row probe above asks the
       database, but when a spreadsheet repeats the same certificate twice
       neither copy exists yet, so both look unique and both would be
       inserted. The first occurrence wins; every later row with the same
       company + scope + type + certificate/registration number is refused
       with the offending row number. */
    const fileSeen = new Map();
    for (const row of evaluated) {
      if (row.duplicateOf) continue; // already a duplicate in the database
      const p = row.payload || {};
      const number = p.certificateNumber || p.registrationNumber || null;
      if (!number || !p.companyId) continue;
      const key = [
        p.companyId,
        p.batteryModelId || "",
        p.batteryId || "",
        p.complianceType || "",
        String(number).trim().toLowerCase(),
      ].join("|");
      const first = fileSeen.get(key);
      if (first) {
        row.errors.push({
          field: "certificate_number",
          message: `Duplicate of row ${first.rowNumber} in the same file (${number}).`,
          duplicateRowNumber: first.rowNumber,
        });
        row.duplicateOf = { id: null, certificateNumber: number, rowNumber: first.rowNumber };
      } else {
        fileSeen.set(key, { rowNumber: row.rowNumber, certificateNumber: number });
      }
    }

    const errors = evaluated.flatMap((r) => r.errors.map((e) => ({ ...e, rowNumber: r.rowNumber })));
    const warnings = evaluated.flatMap((r) => r.warnings.map((w) => ({ ...w, rowNumber: r.rowNumber })));
    const duplicates = evaluated
      .filter((r) => r.duplicateOf)
      .map((r) => ({
        rowNumber: r.rowNumber,
        recordId: r.duplicateOf.id ?? null,
        certificateNumber: r.duplicateOf.certificateNumber,
        source: r.duplicateOf.rowNumber ? "file" : "database",
        duplicateRowNumber: r.duplicateOf.rowNumber ?? null,
      }));

    const summary = {
      fileName: fileName || null,
      totalRows: evaluated.length,
      validRows: evaluated.filter((r) => !r.errors.length).length,
      errorCount: errors.length,
      warningCount: warnings.length,
      duplicateCount: duplicates.length,
      columns: IMPORT_COLUMNS.map((c) => ({ ...c, recognized: headerCheck.recognized.includes(c.key) })),
      unknownColumns: headerCheck.unknown,
    };

    if (errors.length) {
      return { ok: false, dryRun: true, committed: false, summary, rows: evaluated, errors, warnings, duplicates };
    }

    if (dryRun) {
      return { ok: true, dryRun: true, committed: false, summary, rows: evaluated, errors, warnings, duplicates };
    }

    const actor = user?.username || user?.email || null;
    const result = await this.store.runComplianceImport(
      evaluated.map((r) => ({ ...r.payload, status: r.payload.status === "Compliant" ? "Pending" : r.payload.status })),
      { actorId: actor, dryRun: false }
    );
    return {
      ok: true,
      dryRun: false,
      committed: true,
      summary: { ...summary, inserted: result.inserted },
      rows: evaluated,
      errors: [],
      warnings,
      duplicates,
      recordIds: result.recordIds,
    };
  }

  /* ============================================================
     customer passport
     ============================================================ */

  /* Everything a battery's passport shows, in one call. Development
     rows and Internal documents are filtered out here, in the service,
     so no route can forget to. */
  async batteryPassport(batteryId, { includeInternal = false } = {}) {
    const settings = await this.settings();
    const records = (await this.store.listComplianceRecordsForBattery(batteryId)).filter((r) =>
      isPublishable(r)
    );
    const presented = await this.presentAll(records, settings);

    /* Documents can hang off several inherited records; gather them all,
       but only ever the Customer-visible ones. */
    const documents = [];
    for (const record of records) {
      const docs = await this.store.listComplianceRecordDocuments({
        complianceId: record.id,
        visibility: "Customer",
      });
      const list = Array.isArray(docs) ? docs : docs.data || [];
      for (const doc of list) documents.push({ ...doc, complianceId: record.id });
    }

    return {
      batteryId,
      records: presented,
      documents,
      settings: includeInternal ? settings : { ...settings, showDevelopmentData: false },
      counts: {
        records: presented.length,
        compliant: presented.filter((r) => r.effectiveStatus === "Compliant").length,
        needsAttention: presented.filter((r) => r.needsAttention).length,
        notApplicable: presented.filter((r) => r.applicability === "Not Applicable").length,
      },
    };
  }

  /* ============================================================
     internal helpers
     ============================================================ */

  async resolveType(codeOrLabel) {
    if (!codeOrLabel) {
      throw new ComplianceValidationError("complianceType is required.", {
        field: "complianceType",
        code: "REQUIRED",
      });
    }
    const type =
      (await this.store.getComplianceTypeByCode(String(codeOrLabel))) ||
      (await this.store.getComplianceTypeByCode(String(codeOrLabel).toUpperCase()));
    if (!type) {
      throw new ComplianceValidationError(
        `"${codeOrLabel}" is not a configured compliance type.`,
        { field: "complianceType", code: "UNKNOWN_TYPE" }
      );
    }
    return type;
  }

  /* Same company + same scope + same type + same number = the same
     certificate entered twice. */
  async assertNoDuplicate(payload, excludeId) {
    const duplicate = await this.store.findDuplicateComplianceRecord({
      companyId: payload.companyId,
      batteryModelId: payload.batteryModelId || null,
      batteryId: payload.batteryId || null,
      complianceType: payload.complianceType,
      certificateNumber: payload.certificateNumber || null,
      registrationNumber: payload.registrationNumber || null,
      excludeId,
    });
    if (duplicate) {
      throw conflict(
        `This certificate/registration number already exists on record #${duplicate.id} for the same company, scope and type.`,
        "DUPLICATE_RECORD",
        { field: "certificateNumber", duplicateRecordId: duplicate.id }
      );
    }
    return true;
  }

  /* An edit that would strip evidence a type requires is refused, so a
     record can never drift into a state the catalogue forbids. */
  async assertTypeStillSatisfied(merged, type, existing) {
    if (merged.applicability === "Not Applicable") return true;
    const req = requirementsFor(type);
    const level = resolveLevel(merged);
    if (req.certificate && level !== "COMPANY") {
      const stillHasNumber = merged.certificateNumber || merged.registrationNumber;
      const lostIt =
        !stillHasNumber && (existing.certificateNumber || existing.registrationNumber);
      if (lostIt) {
        throw new ComplianceValidationError(
          `${type.label} is a certification type, so a certificate or registration number is required.`,
          { field: "certificateNumber", code: "TYPE_REQUIREMENT" }
        );
      }
    }
    if (req.capacity && (merged.declaredCapacityAh === null || merged.verifiedCapacityAh === null)) {
      throw new ComplianceValidationError(
        `${type.label} requires both declared and verified capacity in Ah.`,
        { field: "verifiedCapacityAh", code: "TYPE_REQUIREMENT" }
      );
    }
    if (req.testReport && !merged.testLab && existing.testLab) {
      throw new ComplianceValidationError(`${type.label} requires a test laboratory.`, {
        field: "testLab",
        code: "TYPE_REQUIREMENT",
      });
    }
    return true;
  }

  /* Writes one audit event describing what actually changed, so the
     history is a narrative rather than a stack of raw payloads. */
  async recordDiff(before, after, user, eventType = "record_updated") {
    const tracked = [
      "status",
      "applicability",
      "expiryDate",
      "complianceDeadline",
      "nextReviewDate",
      "certificateNumber",
      "registrationNumber",
      "testLab",
      "testDate",
      "verifiedCapacityAh",
    ];
    const changes = tracked
      .filter((key) => String(before?.[key] ?? "") !== String(after?.[key] ?? ""))
      .map((key) => ({ field: key, from: before?.[key] ?? null, to: after?.[key] ?? null }));
    if (!changes.length) return null;
    return this.store.addComplianceRecordEvent({
      complianceId: after.id,
      eventType,
      eventDescription: changes.map((c) => `${c.field}: ${c.from ?? "—"} → ${c.to ?? "—"}`).join("; "),
      oldValue: before?.status ?? null,
      newValue: after?.status ?? null,
      createdBy: user?.username || user?.email || null,
    });
  }
}

export const createComplianceManagementService = ({ store }) => new ComplianceManagementService({ store });
