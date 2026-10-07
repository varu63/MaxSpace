/* ============================================================
   BATTERY PASSPORT LIFECYCLE — HTTP surface

   Adds the history the passport was missing to `batteryController.js`:
   the lifecycle ledger, ownership transfers, provenance, derived
   telemetry events, firmware history, end-of-life partner
   assignments and second-life assessments.

   Access model (every handler resolves it the same way)
   -----------------------------------------------------
     ADMIN / EMPLOYEE  whole fleet, and may write.
     USER              only batteries they own (ownerScopeFor), read.
     PARTNER           handled in partnerController.js instead: this
                       router is not mounted for partner accounts,
                       because a partner's view is deliberately narrower
                       than a customer's passport and is gated on an
                       active EOL assignment.

   Partner actors may also write through the generic event endpoint
   ONLY for the event codes they are allowed to record, and only for a
   battery assigned to them — enforced in the store, not here.
   ============================================================ */

import store from "../data/index.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { normalizeBatteryIdentifier, resolveBatteryByIdentifier } from "../utils/batteryIdentifier.js";
import { ownerScopeFor } from "../utils/ownerScope.js";
import { assertBatteryAccess } from "../utils/batteryAccess.js";
import {
  LIFECYCLE_EVENTS,
  LIFECYCLE_STAGES,
  LIFECYCLE_STAGE_LABELS,
  PROVENANCE_FIELD_RULES,
  assertProvenanceNotDowngrade,
} from "../utils/lifecycleLedger.js";

/* Resolve the battery named in the path, applying the caller's owner
   scope. The scope and the shared ownership rules are asked in turn:
   an anonymous caller is the public passport flow and passes, an
   operator passes, and anyone else is told 403 + "you no longer own
   this battery" rather than being left to guess why a battery they
   held before the transfer went missing. */
const resolveScopedBattery = async (req) => {
  const identifier = normalizeBatteryIdentifier(req.params.id);
  if (!identifier) {
    throw Object.assign(new Error("A battery identifier is required"), { code: "validation", statusCode: 400 });
  }

  const battery = await resolveBatteryByIdentifier(store, identifier);
  if (!battery) {
    throw Object.assign(new Error("Battery not found"), { code: "not_found", statusCode: 404 });
  }

  const scopeOwnerId = ownerScopeFor(req);
  if (scopeOwnerId && battery.ownerId !== scopeOwnerId) {
    assertBatteryAccess(req, battery);
  }

  return battery;
};

const requireOperator = (req) => {
  if (!req.user || (req.user.role !== "ADMIN" && req.user.role !== "EMPLOYEE")) {
    throw Object.assign(new Error("Access denied. Admin or employee privileges required."), {
      code: "forbidden",
      statusCode: 403,
    });
  }
  return true;
};

const actorFrom = (req) => ({
  id: req.user?.id || null,
  name: req.user?.name || null,
  role: req.user?.role || null,
});

/* The event code list is served from the same catalogue the store
   validates against, so the UI can never offer an event the API would
   reject. */
export const getLifecycleVocabulary = asyncHandler(async (req, res) => {
  res.json({
    stages: LIFECYCLE_STAGES.map((stage) => ({ code: stage, label: LIFECYCLE_STAGE_LABELS[stage] })),
    events: Object.entries(LIFECYCLE_EVENTS).map(([code, definition]) => ({
      code,
      label: definition.label,
      stage: definition.stage,
      sources: definition.sources,
    })),
    provenanceFields: Object.entries(PROVENANCE_FIELD_RULES).map(([field, rule]) => ({
      field,
      column: rule.column,
      ownerEditable: Boolean(rule.ownerEditable),
      measured: Boolean(rule.measured),
    })),
  });
});

// GET /api/batteries/:id/lifecycle
export const getBatteryLifecycle = asyncHandler(async (req, res) => {
  const battery = await resolveScopedBattery(req);
  const lifecycle = await store.getPassportLifecycle(battery.batteryId || battery.id);
  res.json({ batteryId: lifecycle.summary.batteryId, ...lifecycle, generatedAt: new Date().toISOString() });
});

// GET /api/batteries/:id/lifecycle/verify
export const verifyBatteryLifecycle = asyncHandler(async (req, res) => {
  const battery = await resolveScopedBattery(req);
  const chain = await store.verifyLifecycleChain(battery.batteryId || battery.id);
  res.json(chain);
});

// GET /api/batteries/:id/lifecycle/events
export const listBatteryEvents = asyncHandler(async (req, res) => {
  const battery = await resolveScopedBattery(req);
  const events = await store.listLifecycleEvents(battery.batteryId || battery.id, {
    limit: req.query.limit,
    offset: req.query.offset,
    eventType: req.query.eventType || "",
    from: req.query.from || null,
    to: req.query.to || null,
  });
  res.json({ events });
});

// POST /api/batteries/:id/lifecycle/events
// Admin / employee only, except for the event codes a partner account
// is permitted to record (the store re-checks the assignment).
export const appendBatteryEvent = asyncHandler(async (req, res) => {
  const battery = await resolveScopedBattery(req);
  const body = req.body || {};
  requireOperator(req);

  const event = await store.appendLifecycleEvent({
    batteryId: battery.batteryId || battery.id,
    eventCode: body.eventCode,
    source: body.source || "admin",
    occurredAt: body.occurredAt || null,
    actor: actorFrom(req),
    serviceId: body.serviceId || null,
    previousValue: body.previousValue ?? null,
    newValue: body.newValue ?? null,
    notes: body.notes ?? null,
    evidenceDocumentId: body.evidenceDocumentId ?? null,
    partnerId: body.partnerId ?? null,
    metadata: body.metadata || {},
  });

  await store.logActivity(req.user.id, "Battery Lifecycle Event", `Recorded "${event.eventType}" on ${event.batteryId}`, "general");
  res.status(201).json({ event });
});

// POST /api/batteries/:id/lifecycle/backfill
// One-time: seeds the ledger for a battery created before the passport
// existed. Idempotent, and it records a single backfilled manufacturing
// event rather than inventing a plausible history.
export const backfillBatteryLifecycle = asyncHandler(async (req, res) => {
  const battery = await resolveScopedBattery(req);
  requireOperator(req);

  const event = await store.initialiseLifecycleFromBattery(battery.batteryId || battery.id, actorFrom(req));
  if (!event) {
    return res.json({ seeded: false, message: "This battery already has lifecycle events." });
  }
  res.status(201).json({ seeded: true, event });
});

// GET /api/batteries/:id/ownership-history
export const getOwnershipHistory = asyncHandler(async (req, res) => {
  const battery = await resolveScopedBattery(req);
  const history = await store.listOwnershipHistory(battery.batteryId || battery.id);
  const current = await store.getCurrentOwnership(battery.batteryId || battery.id);
  res.json({ history, current });
});

// POST /api/batteries/:id/transfer-ownership
export const transferBatteryOwnership = asyncHandler(async (req, res) => {
  const battery = await resolveScopedBattery(req);
  requireOperator(req);
  const body = req.body || {};

  const result = await store.transferOwnership({
    batteryId: battery.batteryId || battery.id,
    newOwnerId: body.newOwnerId || null,
    newOwnerOrganizationId: body.newOwnerOrganizationId ?? null,
    ownershipType: body.ownershipType || "transfer",
    responsibility: body.responsibility || null,
    transferReference: body.transferReference || null,
    notes: body.notes || null,
    source: body.source || "admin",
    actor: actorFrom(req),
    occurredAt: body.occurredAt || null,
  });

  await store.logActivity(
    req.user.id,
    "Battery Ownership Transfer",
    `Transferred ${result.ownership.batteryId} to ${result.ownership.ownerName || result.ownership.ownerId || "unassigned"}`,
    "general"
  );
  res.status(201).json(result);
});

// GET /api/batteries/:id/provenance
export const getBatteryProvenance = asyncHandler(async (req, res) => {
  const battery = await resolveScopedBattery(req);
  const current = req.query.history === "true" ? false : true;
  const provenance = await store.listProvenance(battery.batteryId || battery.id, { currentOnly: current });
  res.json({ provenance });
});

// GET /api/batteries/:id/telemetry-events
export const getBatteryTelemetryEvents = asyncHandler(async (req, res) => {
  const battery = await resolveScopedBattery(req);
  const events = await store.listTelemetryEvents(battery.batteryId || battery.id, {
    limit: req.query.limit,
    offset: req.query.offset,
    eventType: req.query.eventType || "",
    severity: req.query.severity || "",
  });
  res.json({ events });
});

// POST /api/batteries/:id/telemetry-events/detect
// Derives events from readings that are already stored. Idempotent.
export const detectBatteryTelemetryEvents = asyncHandler(async (req, res) => {
  const battery = await resolveScopedBattery(req);
  requireOperator(req);
  const body = req.body || {};

  const result = await store.detectTelemetryEvents(battery.batteryId || battery.id, {
    since: body.since || null,
    until: body.until || null,
    thresholds: body.thresholds || {},
  });
  res.json(result);
});

// GET /api/batteries/:id/firmware
export const getBatteryFirmware = asyncHandler(async (req, res) => {
  const battery = await resolveScopedBattery(req);
  const history = await store.listFirmwareUpdates(battery.batteryId || battery.id);
  res.json({ history, current: history[0] || null });
});

// POST /api/batteries/:id/firmware
export const recordBatteryFirmware = asyncHandler(async (req, res) => {
  const battery = await resolveScopedBattery(req);
  requireOperator(req);
  const body = req.body || {};

  const record = await store.recordFirmwareUpdate({
    batteryId: battery.batteryId || battery.id,
    firmwareVersion: body.firmwareVersion,
    previousVersion: body.previousVersion || null,
    installedAt: body.installedAt || null,
    servicePersonId: body.servicePersonId || null,
    result: body.result || "Success",
    notes: body.notes || null,
    source: req.user.role === "EMPLOYEE" ? "service_technician" : "admin",
    actor: actorFrom(req),
    installedBy: req.user.id,
  });
  res.status(201).json({ firmware: record });
});

// GET /api/batteries/:id/eol-assignments
export const getBatteryEolAssignments = asyncHandler(async (req, res) => {
  const battery = await resolveScopedBattery(req);
  const assignments = await store.listEolAssignments(battery.batteryId || battery.id);
  res.json({ assignments });
});

// POST /api/batteries/:id/eol-assignments
export const assignBatteryEolPartner = asyncHandler(async (req, res) => {
  const battery = await resolveScopedBattery(req);
  requireOperator(req);
  const body = req.body || {};

  const assignment = await store.assignEolPartner({
    batteryId: battery.batteryId || battery.id,
    partnerId: body.partnerId,
    partnerRole: body.partnerRole || "recycler",
    accessExpiresAt: body.accessExpiresAt || null,
    collectionAddress: body.collectionAddress || null,
    locationKey: body.locationKey || null,
    contactReference: body.contactReference || null,
    notes: body.notes || null,
    actor: actorFrom(req),
  });

  await store.logActivity(
    req.user.id,
    "Battery EOL Assignment",
    `Assigned ${assignment.batteryId} to ${assignment.partnerName} as ${assignment.partnerRole}`,
    "general"
  );
  res.status(201).json({ assignment });
});

// POST /api/batteries/:id/eol-assignments/:assignmentId/complete
// POST /api/batteries/:id/eol-assignments/:assignmentId/revoke
export const updateBatteryEolAssignment = asyncHandler(async (req, res) => {
  const battery = await resolveScopedBattery(req);
  requireOperator(req);

  const assignmentId = Number(req.params.assignmentId);
  if (!Number.isInteger(assignmentId)) {
    throw Object.assign(new Error("Invalid assignment id"), { code: "validation", statusCode: 400 });
  }

  const existing = (await store.listEolAssignments(battery.batteryId || battery.id)).find(
    (a) => Number(a.id) === assignmentId
  );
  if (!existing) {
    throw Object.assign(new Error("EOL assignment not found"), { code: "not_found", statusCode: 404 });
  }

  const action = req.params.action;
  const assignment =
    action === "revoke"
      ? await store.revokeEolAssignment(assignmentId, { notes: req.body?.notes || null })
      : await store.completeEolAssignment(assignmentId, { notes: req.body?.notes || null });

  res.json({ assignment });
});

// GET /api/batteries/:id/second-life
export const getBatterySecondLife = asyncHandler(async (req, res) => {
  const battery = await resolveScopedBattery(req);
  const assessments = await store.listSecondLifeAssessments(battery.batteryId || battery.id);
  res.json({ assessments });
});

// POST /api/batteries/:id/second-life
export const recordBatterySecondLife = asyncHandler(async (req, res) => {
  const battery = await resolveScopedBattery(req);
  requireOperator(req);
  const body = req.body || {};

  const result = await store.recordSecondLifeAssessment({
    batteryId: battery.batteryId || battery.id,
    partnerId: body.partnerId ?? null,
    assessedAt: body.assessedAt || null,
    healthPercent: body.healthPercent ?? null,
    capacityPercent: body.capacityPercent ?? null,
    safetyAssessment: body.safetyAssessment || null,
    safetyPassed: body.safetyPassed ?? null,
    grade: body.grade || null,
    decision: body.decision,
    decisionNotes: body.decisionNotes || null,
    evidenceDocumentId: body.evidenceDocumentId ?? null,
    source: "admin",
    actor: actorFrom(req),
    assessorUserId: req.user.id,
    assessorName: req.user.name,
  });
  res.status(201).json(result);
});

/* ============================================================
   MANUFACTURER FIELD GOVERNANCE
   ============================================================ */

/* Grade an ordinary battery update against the provenance already on
   record. Refused writes raise BEFORE the batteries row is touched, so
   a downgrade cannot half-apply. Returns the assertions the caller
   should record once the update succeeds. */
const planProvenanceAssertions = async (batteryId, current, updates, { role }) => {
  const assertions = [];

  for (const [field, value] of Object.entries(updates)) {
    const rule = PROVENANCE_FIELD_RULES[field];
    if (!rule) continue;
    if (JSON.stringify(current?.[field] ?? null) === JSON.stringify(value ?? null)) continue;

    const live = await store.getLiveProvenance(batteryId, field);
    const incoming = role === "ADMIN" ? (rule.measured ? "measured" : "authoritative") : "user_supplied";

    if (role === "USER" && rule.ownerEditable === false) {
      throw Object.assign(
        new Error(`"${field}" is recorded by MaxVolt and cannot be edited from the customer passport.`),
        {
          code: "field_locked",
          statusCode: 400,
          field,
          fieldErrors: { [field]: "This field is recorded by MaxVolt" },
        }
      );
    }

    assertProvenanceNotDowngrade({ fieldName: field, incoming, current: live });

    assertions.push({
      field,
      classification: incoming,
      source: role === "ADMIN" ? "admin" : "user",
    });
  }

  return assertions;
};

/* PATCH /api/batteries/:id/provenance-fields
   Records where a value came from without changing the value. */
export const recordBatteryProvenance = asyncHandler(async (req, res) => {
  const battery = await resolveScopedBattery(req);
  requireOperator(req);
  const body = req.body || {};

  if (!PROVENANCE_FIELD_RULES[body.fieldName]) {
    throw Object.assign(new Error(`"${body.fieldName}" is not a provenance-tracked field`), {
      code: "validation",
      statusCode: 400,
      field: "fieldName",
    });
  }

  const live = await store.getLiveProvenance(battery.batteryId || battery.id, body.fieldName);
  const classification = body.classification || "authoritative";
  assertProvenanceNotDowngrade({ fieldName: body.fieldName, incoming: classification, current: live });

  const assertion = await store.assertProvenance({
    batteryId: battery.batteryId || battery.id,
    fieldName: body.fieldName,
    classification,
    source: body.source || "admin",
    sourceRef: body.sourceRef || null,
    recordedBy: req.user.id,
    notes: body.notes || null,
  });
  res.status(201).json({ assertion });
});

export { planProvenanceAssertions, resolveScopedBattery, requireOperator, actorFrom };