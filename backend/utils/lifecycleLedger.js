/* ============================================================
   BATTERY LIFECYCLE LEDGER — shared vocabulary and hash chain

   This module holds everything that must be identical on both sides
   of the ledger: the stage vocabulary, the event catalogue, the
   transition rules, and the hash computation. The store writes rows
   with `computeLifecycleHash`, and the verifier re-derives them with
   `computeLifecycleHash` from the stored row — the same function on
   both paths, so a mismatch can only mean the row changed, never that
   the two sides disagree about how to hash.

   Tamper evidence, not tamper proofing
   ------------------------------------
   Each event stores row_hash = SHA-256(event content ‖ previous
   row_hash for the same battery). Editing or removing an event breaks
   the chain from that point on, and verifyLifecycleChain reports the
   first broken link. An administrator with direct table access can
   recompute the whole chain, so this is deliberately *detectable*
   tampering rather than impossible tampering. That is the honest
   guarantee: no cryptography here can stop a superuser, and pretending
   otherwise would be worse than saying so.

   `event_code` is hashed; `event_type` (the human label) is not. The
   label is display text that may be re-worded, and a re-word must not
   look like a forged row.
   ============================================================ */

import crypto from "node:crypto";

/* The hash a battery's first event chains from. */
export const GENESIS_HASH = "0".repeat(64);

/* ---------- stage vocabulary ----------
   Kept in sync with `batteries_lifecycle_stage_check` in sql/schema.sql;
   the service layer validates against this list so an unknown stage is
   rejected before it can reach the CHECK constraint. */

export const LIFECYCLE_STAGES = [
  "Unknown",
  "Manufactured",
  "Commissioned",
  "InService",
  "OwnershipTransferred",
  "Serviced",
  "Retired",
  "Collected",
  "UnderAssessment",
  "Refurbished",
  "SecondLife",
  "Recycled",
  "FinalEvidenceRecorded",
];

export const LIFECYCLE_STAGE_LABELS = {
  Unknown: "Not yet classified",
  Manufactured: "Manufactured",
  Commissioned: "Commissioned",
  InService: "In service",
  OwnershipTransferred: "Ownership transferred",
  Serviced: "Serviced",
  Retired: "Retired",
  Collected: "Collected",
  UnderAssessment: "Under assessment",
  Refurbished: "Refurbished",
  SecondLife: "In second life",
  Recycled: "Recycled",
  FinalEvidenceRecorded: "EPR evidence recorded",
};

/* ---------- event catalogue ----------
   `stage: null` means the event is recorded in the timeline but does
   not move the battery (a note, a document upload). `sources` lists the
   actor kinds allowed to create it; the store rejects any other source
   so, for example, a partner device cannot forge a manufacturing
   record. */

export const LIFECYCLE_EVENTS = {
  manufacturing_record: {
    label: "Manufacturing record created",
    stage: "Manufactured",
    sources: ["manufacturer_system", "manufacturing_record", "import", "legacy_registration"],
  },
  manufactured: { label: "Manufactured", stage: "Manufactured", sources: ["admin", "manufacturer_system", "manufacturing_record", "import"] },
  commissioned: { label: "Commissioned", stage: "Commissioned", sources: ["admin", "manufacturer_system", "service_technician"] },
  dispatched: { label: "Dispatched to customer", stage: "Commissioned", sources: ["admin", "manufacturer_system", "manufacturing_record", "import"] },
  first_owner_registered: { label: "First owner registered", stage: "InService", sources: ["admin", "user", "manufacturer_system", "import", "legacy_registration"] },
  // No "partner" source: a partner handles a battery after collection and
  // may not rewrite who owns it (see PARTNER_PERMITTED_EVENTS).
  ownership_transferred: { label: "Ownership transferred", stage: "OwnershipTransferred", sources: ["admin", "user"] },
  service_scheduled: { label: "Service scheduled", stage: "Serviced", sources: ["user", "admin", "service_technician"] },
  service_started: { label: "Service started", stage: "Serviced", sources: ["admin", "service_technician"] },
  service_completed: { label: "Service completed", stage: "Serviced", sources: ["admin", "service_technician"] },
  service_cancelled: { label: "Service cancelled", stage: null, sources: ["user", "admin"] },
  firmware_updated: { label: "Firmware updated", stage: null, sources: ["admin", "service_technician", "manufacturer_system"] },
  health_event: { label: "Battery health event", stage: null, sources: ["bms_telemetry", "derived_calculated", "admin"] },
  retired: { label: "Retired from service", stage: "Retired", sources: ["admin", "user", "service_technician"] },
  collection_arranged: { label: "Collection arranged", stage: "Collected", sources: ["admin", "partner"] },
  collected: { label: "Collected for end of life", stage: "Collected", sources: ["admin", "partner"] },
  second_life_assessment: { label: "Second life assessed", stage: "UnderAssessment", sources: ["admin", "partner", "inspection"] },
  refurbished: { label: "Refurbished", stage: "Refurbished", sources: ["admin", "partner"] },
  second_life_deployed: { label: "Redeployed in second life", stage: "SecondLife", sources: ["admin", "partner"] },
  recycled: { label: "Recycled", stage: "Recycled", sources: ["admin", "partner"] },
  epr_evidence_recorded: { label: "EPR evidence recorded", stage: "FinalEvidenceRecorded", sources: ["admin", "partner"] },
  note: { label: "Note added", stage: null, sources: ["admin", "user", "service_technician", "partner"] },
  document_uploaded: { label: "Document uploaded", stage: null, sources: ["admin", "user", "service_technician", "partner"] },
};

/* ---------- transition rules ----------
   The lifecycle is not a straight line (a collected battery can still
   be assessed, and a serviced battery returns to service), so the legal
   moves are enumerated rather than derived from a rank. Self-transitions
   are always allowed: several events legitimately leave the stage alone.
   `isTransitionAllowed` is a guard against nonsense writes (recycled →
   in service), not a workflow engine — the caller still decides whether
   the actor is allowed to make the move at all. */

const STAGE_TRANSITIONS = {
  Unknown: ["Manufactured", "Commissioned", "InService", "Retired"],
  Manufactured: ["Commissioned", "InService", "Retired"],
  Commissioned: ["InService", "OwnershipTransferred", "Retired"],
  InService: ["Serviced", "OwnershipTransferred", "Retired", "InService"],
  OwnershipTransferred: ["Serviced", "Retired", "InService"],
  Serviced: ["Serviced", "InService", "Retired"],
  Retired: ["Collected", "UnderAssessment", "Recycled"],
  Collected: ["UnderAssessment", "Recycled", "Refurbished"],
  UnderAssessment: ["Refurbished", "SecondLife", "Recycled"],
  Refurbished: ["SecondLife", "Recycled", "InService"],
  SecondLife: ["Serviced", "Retired", "InService"],
  Recycled: ["FinalEvidenceRecorded"],
  FinalEvidenceRecorded: [],
};

export const isTransitionAllowed = (from, to) => {
  if (!to) return true;
  if (!from || from === to) return true;
  return (STAGE_TRANSITIONS[from] || []).includes(to);
};

/* The stored stage can only be one of the known values; anything else
   is treated as "not yet classified" rather than failing a read. */
export const normalizeStage = (stage) =>
  LIFECYCLE_STAGES.includes(stage) ? stage : "Unknown";

/* Derive an initial stage from the pre-existing manufacturing columns.
   `overall_status` is what the plant writes: 'PROD' means the pack is
   out on the road, 'FG PENDING' means it is built and waiting. This is
   a mapping of data that already exists — it is not a claim that a
   lifecycle event was ever recorded, which is why
   `last_lifecycle_event_at` stays NULL until a real event is appended. */
export const stageFromOverallStatus = (overallStatus) => {
  const value = String(overallStatus || "").trim().toUpperCase();
  if (value === "PROD") return "InService";
  if (value === "FG PENDING") return "Manufactured";
  return "Unknown";
};

/* ---------- provenance vocabulary ---------- */

export const PROVENANCE_CLASSIFICATIONS = [
  "authoritative",
  "measured",
  "derived",
  "service",
  "user_supplied",
  "unclassified_legacy",
];

export const PROVENANCE_SOURCES = [
  "manufacturer_system",
  "manufacturing_record",
  "bms_telemetry",
  "service_technician",
  "inspection",
  "admin",
  "user",
  "derived_calculated",
  "import",
  "legacy_registration",
  "legacy_unknown",
];

/* Which passport fields are governed, and by what rule.

   The point is that a customer typing a manufacturer name and a value
   measured on the pack test bench must not look alike. Each tracked
   field carries the classification that a *measured* value would get, so
   an update can be graded against whatever already asserts that field.

     authoritative → the plant's record; not editable by an owner
     measured      → instrument reading; not editable by an owner
     user_supplied → an owner may set this, but only if nothing stronger
                     already asserts it

   `manufactureDate`/`modelName`/`model` are not listed as owner-editable
   at all: they are manufacturer-authoritative and are additionally
   protected by a database trigger, so they can only be changed through
   the audited admin correction path. */
export const PROVENANCE_FIELD_RULES = {
  manufacturer: { column: "manufacturer", ownerEditable: true },
  chemistry: { column: "chemistry", ownerEditable: true },
  type: { column: "type", ownerEditable: true },
  capacity: { column: "capacity", ownerEditable: true },
  capacityKwh: { column: "capacity_kwh", ownerEditable: true, measured: true },
  nominalVoltage: { column: "nominal_voltage", ownerEditable: true },
  voltage: { column: "voltage", ownerEditable: true },
  weightKg: { column: "weight_kg", ownerEditable: true },
  dimensionsMm: { column: "dimensions_mm", ownerEditable: true },
  assemblyLocation: { column: "assembly_location", ownerEditable: true },
  stateOfHealth: { column: "state_of_health", ownerEditable: false, measured: true },
  stateOfCharge: { column: "state_of_charge", ownerEditable: false, measured: true },
  cycleCount: { column: "cycle_count", ownerEditable: false, measured: true },
  internalResistanceMOhms: { column: "internal_resistance_mohms", ownerEditable: false, measured: true },
  manufactureDate: { column: "manufacture_date", ownerEditable: false },
  modelName: { column: "model_name", ownerEditable: false },
};

/* Fields an owner may never change through the ordinary update path.
   They are manufacturer-authoritative and guarded by the
   `batteries_identity_immutable` trigger; the only supported way to
   change one is the audited admin correction. */
export const MANUFACTURER_LOCKED_FIELDS = ["manufactureDate", "modelName", "model"];

/* How much a classification is trusted. An owner-supplied value may
   replace anything weaker than `service`; a stronger source may replace
   anything, and records that it did. */
export const PROVENANCE_STRENGTH = {
  unclassified_legacy: 0,
  user_supplied: 1,
  derived: 2,
  service: 2,
  measured: 3,
  authoritative: 4,
};

/* Refuse a write that would replace a better-sourced value with a
   weaker one. Returns the incoming classification when the write is
   allowed, or throws with the offending field. */
export const assertProvenanceNotDowngrade = ({ fieldName, incoming, current }) => {
  if (!current) return incoming;
  const incomingStrength = PROVENANCE_STRENGTH[incoming] ?? 0;
  const currentStrength = PROVENANCE_STRENGTH[current.classification] ?? 0;
  if (incomingStrength >= currentStrength) return incoming;
  throw Object.assign(
    new Error(
      `"${fieldName}" is recorded as ${current.classification} (from ${current.source}) and cannot be replaced with a ${incoming} value.`
    ),
    { code: "provenance_conflict", statusCode: 400, field: fieldName, fieldErrors: { [fieldName]: `Recorded as ${current.classification}` } }
  );
};

/* ---------- canonical serialisation ---------- */

/* Deterministic JSON: object keys sorted, so two processes hashing the
   same logical event always produce the same bytes. Plain
   JSON.stringify would order keys by insertion, which differs between
   a freshly built object and a row read back from PostgreSQL. */
const canonical = (value) => {
  if (value === null || value === undefined) return "null";
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object") {
    const keys = Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
};

/* Hashed columns, as [camelCase, snake_case] pairs. `event_type` is
   absent on purpose — see the header note. */
const HASHED_FIELDS = [
  ["batteryId", "battery_id"],
  ["eventCode", "event_code"],
  ["lifecycleStage", "lifecycle_stage"],
  ["occurredAt", "occurred_at"],
  ["recordedAt", "recorded_at"],
  ["actorId", "actor_id"],
  ["actorName", "actor_name"],
  ["actorRole", "actor_role"],
  ["source", "source"],
  ["serviceId", "service_id"],
  ["previousValue", "previous_value"],
  ["newValue", "new_value"],
  ["previousState", "previous_state"],
  ["newState", "new_state"],
  ["notes", "notes"],
  ["evidenceDocumentId", "evidence_document_id"],
  ["partnerId", "partner_id"],
  ["metadata", "metadata"],
];

const normalizeHashValue = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return value.toISOString();
  return value;
};

/* Compute the chain hash for one event.
   Accepts either the camelCase object the caller is about to insert or a
   snake_case row read back from the database, so writing and verifying
   provably use identical inputs. */
export const computeLifecycleHash = (event, prevHash = GENESIS_HASH) => {
  const pick = (camel, snake) =>
    event[camel] !== undefined ? event[camel] : event[snake];

  const payload = {};
  for (const [camel, snake] of HASHED_FIELDS) {
    payload[camel] = normalizeHashValue(pick(camel, snake));
  }

  return crypto
    .createHash("sha256")
    .update(canonical(payload))
    .update("|prev:")
    .update(String(prevHash || GENESIS_HASH))
    .digest("hex");
};