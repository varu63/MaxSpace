/* ============================================================
   INDIA COMPLIANCE — ADMIN CONTROLLER
   Full CRUD for the compliance module (BWMR 2022): CPCB producer
   registrations, per-battery compliance records, EPR obligations
   and credits, document references and the append-only audit log.

   Every route is guarded by protect + requireAdmin at the router
   level. Vocabulary is validated against
   backend/constants/compliance.js via complianceValidation.js, so
   invalid values return clean 400s. Compliance events are recorded
   alongside every mutating operation (never fabricated by the API).
============================================================ */
import store from "../data/index.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { parsePagination } from "../utils/pagination.js";
import {
  parseProducerPayload,
  parseProducerPatch,
  parseBatteryCompliancePayload,
  parseBatteryCompliancePatch,
  parseObligationPayload,
  parseObligationPatch,
  parseCreditPayload,
  parseCreditPatch,
  parseDocumentPayload,
  parseDocumentPatch,
  describeEvent,
} from "../utils/complianceValidation.js";

/* Append a compliance audit event without ever failing the request. */
const logEvent = async (payload) => {
  try {
    await store.addComplianceEvent(payload);
  } catch {
    // Audit log is best-effort; the main write already succeeded.
  }
};

/* Respond with the standard paginated envelope, or the legacy plain
   array when the caller omitted page/limit (matches adminController). */
const sendList = (res, { data, pagination }, paginated) =>
  paginated
    ? res.json({ success: true, data, pagination })
    : res.json(data);

const listWindow = (req) => {
  const { page, limit } = parsePagination(req.query);
  return { page, limit, paginated: req.query.page !== undefined || req.query.limit !== undefined };
};

const producerExists = async (id) => {
  if (!id) return false;
  return Boolean(await store.getComplianceProducerById(id));
};

/* ---------------- Overview ---------------- */

// GET /api/admin/compliance/overview
export const getComplianceOverview = asyncHandler(async (req, res) => {
  const overview = await store.getComplianceOverview();
  res.json({ success: true, data: overview });
});

/* ---------------- Producers ---------------- */

// GET /api/admin/compliance/producers
export const listComplianceProducers = asyncHandler(async (req, res) => {
  const { page, limit, paginated } = listWindow(req);
  const results = await store.listComplianceProducers({
    status: req.query.status || "",
    search: req.query.search || "",
    sort: req.query.sort,
    order: req.query.order,
    page,
    limit,
  });
  sendList(res, results, paginated);
});

// GET /api/admin/compliance/producers/:id
export const getComplianceProducer = asyncHandler(async (req, res) => {
  const producer = await store.getComplianceProducerById(req.params.id);
  if (!producer) {
    res.status(404);
    throw new Error("Producer registration not found");
  }
  res.json({ success: true, data: producer });
});

// POST /api/admin/compliance/producers
export const createComplianceProducer = asyncHandler(async (req, res) => {
  const input = parseProducerPayload(req.body || {});
  if (!(await store.isRegistrationNumberUnique(input.registrationNumber))) {
    res.status(409);
    throw new Error(`A producer with registration number "${input.registrationNumber}" already exists.`);
  }
  const producer = await store.createComplianceProducer(input);
  await logEvent({
    producerId: producer.id,
    eventType: "producer_created",
    eventDescription: describeEvent("producer_created", { detail: producer.producerName }),
    createdBy: req.user.id,
  });
  res.status(201).json({ success: true, data: producer });
});

// PATCH /api/admin/compliance/producers/:id
export const updateComplianceProducer = asyncHandler(async (req, res) => {
  const existing = await store.getComplianceProducerById(req.params.id);
  if (!existing) {
    res.status(404);
    throw new Error("Producer registration not found");
  }
  const patch = parseProducerPatch(req.body || {});
  if (patch.registrationNumber &&
      !(await store.isRegistrationNumberUnique(patch.registrationNumber, existing.id))) {
    res.status(409);
    throw new Error(`A producer with registration number "${patch.registrationNumber}" already exists.`);
  }
  const producer = await store.updateComplianceProducer(existing.id, patch);
  await logEvent({
    producerId: existing.id,
    eventType: "producer_updated",
    eventDescription: describeEvent("producer_updated", { detail: producer.producerName }),
    createdBy: req.user.id,
  });
  res.json({ success: true, data: producer });
});

// DELETE /api/admin/compliance/producers/:id
export const deleteComplianceProducer = asyncHandler(async (req, res) => {
  const existing = await store.getComplianceProducerById(req.params.id);
  if (!existing) {
    res.status(404);
    throw new Error("Producer registration not found");
  }
  const deleted = await store.deleteComplianceProducer(existing.id);
  if (!deleted) {
    res.status(404);
    throw new Error("Producer registration not found");
  }
  res.json({ success: true, message: "Producer registration deleted." });
});

/* ---------------- Battery compliance records ---------------- */

// GET /api/admin/compliance/batteries
export const listBatteryCompliance = asyncHandler(async (req, res) => {
  const { page, limit, paginated } = listWindow(req);
  const results = await store.listBatteryCompliance({
    status: req.query.status || "",
    search: req.query.search || "",
    sort: req.query.sort,
    order: req.query.order,
    page,
    limit,
  });
  sendList(res, results, paginated);
});

// GET /api/admin/compliance/batteries/:batteryId
export const getBatteryCompliance = asyncHandler(async (req, res) => {
  const record = await store.getBatteryCompliance(req.params.batteryId);
  if (!record) {
    res.status(404);
    throw new Error("No compliance record exists for this battery yet.");
  }
  const { data: documents } = await store.listComplianceDocuments({
    batteryId: req.params.batteryId,
    page: 1,
    limit: 50,
  });
  const { data: events } = await store.listComplianceEvents({
    batteryId: req.params.batteryId,
    page: 1,
    limit: 50,
  });
  res.json({ success: true, data: { ...record, documents, events } });
});

// POST /api/admin/compliance/batteries/:batteryId
export const createBatteryCompliance = asyncHandler(async (req, res) => {
  const battery = await store.getBatteryById(req.params.batteryId);
  if (!battery) {
    res.status(404);
    throw new Error("Battery not found");
  }
  if (await store.getBatteryCompliance(battery.id)) {
    res.status(409);
    throw new Error("A compliance record already exists for this battery.");
  }
  const input = parseBatteryCompliancePayload(req.body || {}, { requireBatteryId: true });
  input.batteryId = battery.id;
  if (input.producerId && !(await producerExists(input.producerId))) {
    res.status(400);
    throw new Error("The selected producer registration does not exist.");
  }
  const record = await store.createBatteryCompliance(input);
  await logEvent({
    batteryId: battery.id,
    producerId: input.producerId || null,
    eventType: "battery_linked",
    eventDescription: describeEvent("battery_linked", { detail: battery.id }),
    createdBy: req.user.id,
  });
  const full = await store.getBatteryCompliance(battery.id);
  res.status(201).json({ success: true, data: full });
});

// PATCH /api/admin/compliance/batteries/:batteryId
export const updateBatteryCompliance = asyncHandler(async (req, res) => {
  const existing = await store.getBatteryCompliance(req.params.batteryId);
  if (!existing) {
    res.status(404);
    throw new Error("No compliance record exists for this battery yet.");
  }
  const patch = parseBatteryCompliancePatch(req.body || {});
  if (patch.producerId && !(await producerExists(patch.producerId))) {
    res.status(400);
    throw new Error("The selected producer registration does not exist.");
  }
  const previousStatus = existing.complianceStatus;
  const wasVerified = existing.verifiedInApp;
  const record = await store.updateBatteryCompliance(existing.batteryId, patch);
  if (patch.complianceStatus && patch.complianceStatus !== previousStatus) {
    await logEvent({
      batteryId: existing.batteryId,
      producerId: record.producerId || null,
      eventType: "status_changed",
      eventDescription: describeEvent("status_changed", { detail: `${previousStatus} → ${patch.complianceStatus}` }),
      createdBy: req.user.id,
    });
  }
  if (patch.verifiedInApp === true && !wasVerified) {
    await logEvent({
      batteryId: existing.batteryId,
      producerId: record.producerId || null,
      eventType: "verified",
      eventDescription: describeEvent("verified", { detail: existing.batteryId }),
      createdBy: req.user.id,
    });
  }
  if (!patch.complianceStatus && !patch.verifiedInApp) {
    await logEvent({
      batteryId: existing.batteryId,
      producerId: record.producerId || null,
      eventType: "battery_compliance_updated",
      eventDescription: describeEvent("battery_compliance_updated", { detail: existing.batteryId }),
      createdBy: req.user.id,
    });
  }
  const full = await store.getBatteryCompliance(existing.batteryId);
  res.json({ success: true, data: full });
});

/* ---------------- EPR obligations ---------------- */

// GET /api/admin/compliance/obligations
export const listComplianceObligations = asyncHandler(async (req, res) => {
  const { page, limit, paginated } = listWindow(req);
  const results = await store.listComplianceObligations({
    producerId: req.query.producerId || null,
    financialYear: req.query.financialYear || "",
    status: req.query.status || "",
    search: req.query.search || "",
    sort: req.query.sort,
    order: req.query.order,
    page,
    limit,
  });
  sendList(res, results, paginated);
});

// POST /api/admin/compliance/obligations
export const createComplianceObligation = asyncHandler(async (req, res) => {
  const input = parseObligationPayload(req.body || {});
  if (!(await producerExists(input.producerId))) {
    res.status(400);
    throw new Error("The selected producer registration does not exist.");
  }
  const { data: existing } = await store.listComplianceObligations({
    producerId: input.producerId,
    financialYear: input.financialYear,
    page: 1,
    limit: 100000,
  });
  if (existing.some((o) => o.batteryCategory === input.batteryCategory)) {
    res.status(409);
    throw new Error(
      `An obligation already exists for ${input.producerId} / ${input.financialYear} / ${input.batteryCategory}.`
    );
  }
  const obligation = await store.createComplianceObligation(input);
  await logEvent({
    producerId: input.producerId,
    eventType: "obligation_created",
    eventDescription: describeEvent("obligation_created", { detail: `${input.financialYear} ${input.batteryCategory}` }),
    createdBy: req.user.id,
  });
  res.status(201).json({ success: true, data: obligation });
});

// PATCH /api/admin/compliance/obligations/:id
export const updateComplianceObligation = asyncHandler(async (req, res) => {
  const patch = parseObligationPatch(req.body || {});
  const existing = await store.getComplianceObligationById(req.params.id);
  if (!existing) {
    res.status(404);
    throw new Error("EPR obligation not found");
  }
  if (patch.producerId && !(await producerExists(patch.producerId))) {
    res.status(400);
    throw new Error("The selected producer registration does not exist.");
  }
  const obligation = await store.updateComplianceObligation(existing.id, patch);
  await logEvent({
    producerId: obligation.producerId,
    eventType: patch.status === "Closed" ? "obligation_closed" : "obligation_updated",
    eventDescription: describeEvent(patch.status === "Closed" ? "obligation_closed" : "obligation_updated", {
      detail: `${obligation.financialYear} ${obligation.batteryCategory}`,
    }),
    createdBy: req.user.id,
  });
  res.json({ success: true, data: obligation });
});

// DELETE /api/admin/compliance/obligations/:id
export const deleteComplianceObligation = asyncHandler(async (req, res) => {
  const deleted = await store.deleteComplianceObligation(req.params.id);
  if (!deleted) {
    res.status(404);
    throw new Error("EPR obligation not found");
  }
  res.json({ success: true, message: "EPR obligation deleted." });
});

/* ---------------- EPR credits ---------------- */

// GET /api/admin/compliance/credits
export const listComplianceCredits = asyncHandler(async (req, res) => {
  const { page, limit, paginated } = listWindow(req);
  const results = await store.listComplianceCredits({
    obligationId: req.query.obligationId || null,
    status: req.query.status || "",
    sort: req.query.sort,
    order: req.query.order,
    page,
    limit,
  });
  sendList(res, results, paginated);
});

// POST /api/admin/compliance/credits
export const createComplianceCredit = asyncHandler(async (req, res) => {
  const input = parseCreditPayload(req.body || {});
  if (!(await store.isCertificateNumberUnique(input.certificateNumber))) {
    res.status(409);
    throw new Error(`An EPR certificate with number "${input.certificateNumber}" already exists.`);
  }
  if (!(await store.getComplianceObligationById(input.obligationId))) {
    res.status(400);
    throw new Error("The selected obligation does not exist.");
  }
  const credit = await store.createComplianceCredit(input);
  await logEvent({
    producerId: null,
    eventType: "credit_issued",
    eventDescription: describeEvent("credit_issued", { detail: `${input.certificateNumber} (${input.quantityKg} kg)` }),
    createdBy: req.user.id,
  });
  res.status(201).json({ success: true, data: credit });
});

// PATCH /api/admin/compliance/credits/:id
export const updateComplianceCredit = asyncHandler(async (req, res) => {
  const patch = parseCreditPatch(req.body || {});
  const existing = await store.getComplianceCreditById(req.params.id);
  if (!existing) {
    res.status(404);
    throw new Error("EPR credit / certificate not found");
  }
  if (patch.certificateNumber && !(await store.isCertificateNumberUnique(patch.certificateNumber, existing.id))) {
    res.status(409);
    throw new Error(`An EPR certificate with number "${patch.certificateNumber}" already exists.`);
  }
  const credit = await store.updateComplianceCredit(req.params.id, patch);
  await logEvent({
    eventType: "credit_updated",
    eventDescription: describeEvent("credit_updated", { detail: credit.certificateNumber }),
    createdBy: req.user.id,
  });
  res.json({ success: true, data: credit });
});

// DELETE /api/admin/compliance/credits/:id
export const deleteComplianceCredit = asyncHandler(async (req, res) => {
  const deleted = await store.deleteComplianceCredit(req.params.id);
  if (!deleted) {
    res.status(404);
    throw new Error("EPR credit / certificate not found");
  }
  res.json({ success: true, message: "EPR credit / certificate deleted." });
});

/* ---------------- Documents (metadata-only) ---------------- */

// GET /api/admin/compliance/documents
export const listComplianceDocuments = asyncHandler(async (req, res) => {
  const { page, limit, paginated } = listWindow(req);
  const results = await store.listComplianceDocuments({
    batteryId: req.query.batteryId || "",
    producerId: req.query.producerId || null,
    documentType: req.query.documentType || "",
    status: req.query.status || "",
    sort: req.query.sort,
    order: req.query.order,
    page,
    limit,
  });
  sendList(res, results, paginated);
});

// POST /api/admin/compliance/documents
export const createComplianceDocument = asyncHandler(async (req, res) => {
  const input = parseDocumentPayload(req.body || {});
  if (input.producerId && !(await producerExists(input.producerId))) {
    res.status(400);
    throw new Error("The selected producer registration does not exist.");
  }
  const doc = await store.createComplianceDocument(input);
  await logEvent({
    batteryId: doc.batteryId || null,
    producerId: doc.producerId || null,
    eventType: "document_uploaded",
    eventDescription: describeEvent("document_uploaded", { detail: doc.documentName }),
    createdBy: req.user.id,
  });
  res.status(201).json({ success: true, data: doc });
});

// PATCH /api/admin/compliance/documents/:id
export const updateComplianceDocument = asyncHandler(async (req, res) => {
  const existing = await store.getComplianceDocumentById(req.params.id);
  if (!existing) {
    res.status(404);
    throw new Error("Compliance document not found");
  }
  const patch = parseDocumentPatch(req.body || {});
  if (patch.producerId && !(await producerExists(patch.producerId))) {
    res.status(400);
    throw new Error("The selected producer registration does not exist.");
  }
  const doc = await store.updateComplianceDocument(req.params.id, patch);
  await logEvent({
    batteryId: doc.batteryId || null,
    producerId: doc.producerId || null,
    eventType: "document_updated",
    eventDescription: describeEvent("document_updated", { detail: doc.documentName }),
    createdBy: req.user.id,
  });
  res.json({ success: true, data: doc });
});

// DELETE /api/admin/compliance/documents/:id
export const deleteComplianceDocument = asyncHandler(async (req, res) => {
  const deleted = await store.deleteComplianceDocument(req.params.id);
  if (!deleted) {
    res.status(404);
    throw new Error("Compliance document not found");
  }
  res.json({ success: true, message: "Compliance document deleted." });
});

/* ---------------- Events (read-only audit log) ---------------- */

// GET /api/admin/compliance/events
export const listComplianceEvents = asyncHandler(async (req, res) => {
  const { page, limit, paginated } = listWindow(req);
  const results = await store.listComplianceEvents({
    batteryId: req.query.batteryId || "",
    producerId: req.query.producerId || null,
    eventType: req.query.eventType || "",
    sort: req.query.sort,
    order: req.query.order,
    page,
    limit,
  });
  sendList(res, results, paginated);
});