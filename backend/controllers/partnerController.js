/* ============================================================
   EPR PARTNER PORTAL — HTTP surface

   What an external collection centre / recycler / refurbisher /
   auditor can do with a MaxVolt battery passport.

   Deliberately small
   ------------------
   A partner's job is to collect, process and evidence. It is not a
   customer of the service module and not a member of the owner's fleet,
   so this surface exposes:

     • the batteries assigned to that partner, and why
     • one battery's identity and its end-of-life record
     • the act of recording what the partner actually did, with the
       evidence it holds

   It does NOT expose the owner's service history, ownership chain,
   provenance ledger or notes. Those are the customer's data; the
   partner's authorisation to handle a battery does not extend to the
   customer's relationship with it.

   Authorisation is per-battery and time-boxed: an ACTIVE
   `battery_eol_assignments` row for THIS partner. Every read and write
   here resolves the battery through that assignment, so there is no
   code path by which a partner can reach the fleet.
   ============================================================ */

import store from "../data/index.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { normalizeBatteryIdentifier } from "../utils/batteryIdentifier.js";
import { assertCanReadPartnerBattery, assertPartnerAccount, partnerIdFor } from "../utils/partnerAccess.js";
import { LIFECYCLE_EVENTS } from "../utils/lifecycleLedger.js";

const actorFrom = (req) => ({
  id: req.user.id,
  name: req.user.name,
  role: req.user.role,
});

/* The only lifecycle events a partner may record, served from the same
   source the store validates against. */
const partnerEventCodes = () =>
  ["collected", "collection_arranged", "second_life_assessment", "refurbished", "second_life_deployed", "recycled", "epr_evidence_recorded", "note", "document_uploaded"]
    .filter((code) => LIFECYCLE_EVENTS[code])
    .map((code) => ({ code, label: LIFECYCLE_EVENTS[code].label, stage: LIFECYCLE_EVENTS[code].stage }));

/* Resolve the battery in the path THROUGH the assignment check, so an
   unassigned battery is simply "not found for your organisation" —
   never a confirmation that it exists. */
const resolveAssignedBattery = async (req) => {
  const identifier = normalizeBatteryIdentifier(req.params.id);
  if (!identifier) {
    throw Object.assign(new Error("A battery identifier is required"), { code: "validation", statusCode: 400 });
  }

  const battery = await store.getPartnerBattery(identifier, partnerIdFor(req.user));
  return assertCanReadPartnerBattery(battery);
};

// GET /api/partner/assignments
export const listMyAssignments = asyncHandler(async (req, res) => {
  assertPartnerAccount(req.user);
  const assignments = await store.listPartnerAssignments(partnerIdFor(req.user), {
    status: req.query.status || "active",
    limit: req.query.limit,
    offset: req.query.offset,
  });
  res.json({ partnerId: partnerIdFor(req.user), assignments });
});

// GET /api/partner/assignments/:id/battery
export const getAssignmentBattery = asyncHandler(async (req, res) => {
  assertPartnerAccount(req.user);
  const assignment = await store.listPartnerAssignments(partnerIdFor(req.user), { status: "" })
    .then((list) => list.find((a) => Number(a.id) === Number(req.params.id)));

  if (!assignment) {
    throw Object.assign(new Error("Assignment not found for your organisation."), { code: "not_found", statusCode: 404 });
  }

  const battery = await store.getPartnerBattery(assignment.batteryId, partnerIdFor(req.user));
  res.json({ battery: assertCanReadPartnerBattery(battery) });
});

// GET /api/partner/batteries/:id
export const getPartnerBatteryPassport = asyncHandler(async (req, res) => {
  assertPartnerAccount(req.user);
  const battery = await resolveAssignedBattery(req);

  const [events, assignments, assessments] = await Promise.all([
    store.listLifecycleEvents(battery.batteryId, { limit: 100 }),
    store.listEolAssignments(battery.batteryId),
    store.listSecondLifeAssessments(battery.batteryId),
  ]);

  /* End-of-life projection of the timeline: manufacturing and collection
     facts plus this partner's own actions. Service and ownership events
     are filtered out rather than summarised, so nothing the partner is
     not entitled to see is even loaded for the response. */
  const eolEvents = events.filter((event) => {
    if (event.partnerId && Number(event.partnerId) === partnerIdFor(req.user)) return true;
    return ["manufactured", "manufacturing_record", "commissioned", "retired", "collected", "recycled", "refurbished", "epr_evidence_recorded"].includes(
      event.eventCode
    );
  });

  res.json({
    battery: {
      batteryId: battery.batteryId,
      barcode: battery.barcode,
      serialNumber: battery.serialNumber,
      lifecycleStage: battery.lifecycleStage,
      modelName: battery.modelName,
      bmsModel: battery.bmsModel,
      weightKg: battery.weightKg,
      manufactureDate: battery.manufactureDate,
    },
    assignment: battery.assignment,
    assignments: assignments.filter((a) => Number(a.partnerId) === partnerIdFor(req.user)),
    eolEvents,
    secondLifeAssessments: assessments.filter((a) => a.partnerId && Number(a.partnerId) === partnerIdFor(req.user)),
    permittedEvents: partnerEventCodes(),
    generatedAt: new Date().toISOString(),
  });
});

// POST /api/partner/batteries/:id/eol-action
export const recordPartnerAction = asyncHandler(async (req, res) => {
  assertPartnerAccount(req.user);
  const battery = await resolveAssignedBattery(req);
  const body = req.body || {};

  const event = await store.recordPartnerEolAction({
    batteryId: battery.batteryId,
    partnerId: partnerIdFor(req.user),
    eventCode: body.eventCode,
    newValue: body.newValue ?? null,
    notes: body.notes ?? null,
    weightKg: body.weightKg ?? null,
    processingOutcome: body.processingOutcome ?? null,
    evidenceDocumentId: body.evidenceDocumentId ?? null,
    occurredAt: body.occurredAt || null,
    actor: actorFrom(req),
    completeAssignment: Boolean(body.completeAssignment),
  });

  res.status(201).json({ event });
});

// POST /api/partner/batteries/:id/second-life
export const recordPartnerSecondLife = asyncHandler(async (req, res) => {
  assertPartnerAccount(req.user);
  const battery = await resolveAssignedBattery(req);
  const body = req.body || {};

  const result = await store.recordSecondLifeAssessment({
    batteryId: battery.batteryId,
    partnerId: partnerIdFor(req.user),
    assessorUserId: req.user.id,
    assessorName: req.user.name,
    assessedAt: body.assessedAt || null,
    healthPercent: body.healthPercent ?? null,
    capacityPercent: body.capacityPercent ?? null,
    safetyAssessment: body.safetyAssessment || null,
    safetyPassed: body.safetyPassed ?? null,
    grade: body.grade || null,
    decision: body.decision,
    decisionNotes: body.decisionNotes || null,
    evidenceDocumentId: body.evidenceDocumentId ?? null,
    source: "partner",
    actor: actorFrom(req),
  });

  res.status(201).json(result);
});