/* ============================================================
   BATTERY PASSPORT LIFECYCLE — PostgreSQL store methods

   Everything the passport's *history* is made of lives here:
   the append-only event ledger, ownership transfers, data
   provenance, derived telemetry events, firmware history,
   end-of-life partner assignments and second-life assessments.

   Production shape notes (verified against the live schema)
   -------------------------------------------------------
     • batteries                : PK `battery_id`; identity columns
                                  (barcode, serial_number, modal_id,
                                  qr_code) and manufacturer-authoritative
                                  columns (model_id, manufacture_date)
                                  are protected by a database trigger.
     • battery_models           : `bms_model` records the BMS model a
                                  pack was BUILT with; firmware versions
                                  live in battery_firmware_updates.
     • compliance_producers     : SERIAL id; reused as the external
                                  collection/recycling partner entity.
     • organization_locations   : `key` is the TEXT id used by
                                  `location_key`.
     • users / service_persons  : TEXT ids.

   Design notes
   ------------
   • Appends are serialized per battery by taking a row lock on the
     batteries row (`FOR UPDATE`) inside the same transaction. Two
     concurrent writers for one battery therefore queue instead of
     reading the same previous hash and forking the chain.
   • The chain is verified by RE-DERIVING each hash from the stored row
     with the same function that wrote it. Verification never trusts a
     stored prev_hash.
   • Nothing here fabricates data. Telemetry events are derived from
     real stored readings; provenance records what is actually known;
     a missing fact stays missing.
   ============================================================ */

import {
  GENESIS_HASH,
  LIFECYCLE_EVENTS,
  LIFECYCLE_STAGES,
  PROVENANCE_CLASSIFICATIONS,
  PROVENANCE_FIELD_RULES,
  PROVENANCE_SOURCES,
  assertProvenanceNotDowngrade,
  computeLifecycleHash,
  isTransitionAllowed,
  normalizeStage,
  stageFromOverallStatus,
} from "../../utils/lifecycleLedger.js";

const toIso = (value) => (value instanceof Date ? value.toISOString() : value);
const num = (value) => (value === null || value === undefined ? null : Number(value));

const validationError = (message, extra = {}) =>
  Object.assign(new Error(message), { code: "validation", statusCode: 400, ...extra });

const notFoundError = (message) =>
  Object.assign(new Error(message), { code: "not_found", statusCode: 404 });

const forbiddenError = (message) =>
  Object.assign(new Error(message), { code: "forbidden", statusCode: 403 });

/* ---------- row mappers ---------- */

const mapEventRow = (row) => ({
  id: String(row.id),
  batteryId: row.battery_id,
  eventType: row.event_type,
  eventCode: row.event_code,
  lifecycleStage: row.lifecycle_stage || null,
  occurredAt: toIso(row.occurred_at),
  recordedAt: toIso(row.recorded_at),
  actorId: row.actor_id || null,
  actorName: row.actor_name || null,
  actorRole: row.actor_role || null,
  source: row.source,
  serviceId: row.service_id || null,
  serviceTicket: row.ticket_number || null,
  previousValue: row.previous_value || null,
  newValue: row.new_value || null,
  previousState: row.previous_state || null,
  newState: row.new_state || null,
  notes: row.notes || null,
  evidenceDocumentId: row.evidence_document_id ?? null,
  partnerId: row.partner_id ?? null,
  partnerName: row.partner_name || null,
  metadata: row.metadata || {},
  prevHash: row.prev_hash,
  rowHash: row.row_hash,
});

const mapOwnershipRow = (row) => ({
  id: String(row.id),
  batteryId: row.battery_id,
  ownerId: row.owner_id || null,
  ownerOrganizationId: row.owner_organization_id ?? null,
  ownerName: row.owner_name || null,
  ownerEmail: row.owner_email || null,
  ownershipType: row.ownership_type,
  responsibility: row.responsibility || null,
  acquiredAt: toIso(row.acquired_at),
  releasedAt: toIso(row.released_at),
  isCurrent: row.released_at === null,
  transferReference: row.transfer_reference || null,
  notes: row.notes || null,
  source: row.source,
  recordedBy: row.recorded_by || null,
  recordedAt: toIso(row.recorded_at),
});

const mapProvenanceRow = (row) => ({
  id: String(row.id),
  batteryId: row.battery_id,
  fieldName: row.field_name,
  classification: row.classification,
  source: row.source,
  sourceRef: row.source_ref || null,
  recordedAt: toIso(row.recorded_at),
  recordedBy: row.recorded_by || null,
  recordedByName: row.recorded_by_name || null,
  supersededAt: toIso(row.superseded_at),
  isCurrent: row.superseded_at === null,
  notes: row.notes || null,
});

const mapTelemetryEventRow = (row) => ({
  id: String(row.id),
  batteryId: row.battery_id,
  telemetryId: row.telemetry_id === null || row.telemetry_id === undefined ? null : String(row.telemetry_id),
  eventType: row.event_type,
  severity: row.severity,
  occurredAt: toIso(row.occurred_at),
  detectedAt: toIso(row.detected_at),
  measuredValue: num(row.measured_value),
  thresholdValue: num(row.threshold_value),
  unit: row.unit || null,
  startAt: toIso(row.start_at),
  endAt: toIso(row.end_at),
  details: row.details || {},
});

const mapFirmwareRow = (row) => ({
  id: String(row.id),
  batteryId: row.battery_id,
  bmsModel: row.bms_model || null,
  firmwareVersion: row.firmware_version,
  previousVersion: row.previous_version || null,
  installedAt: toIso(row.installed_at),
  installedBy: row.installed_by || null,
  installedByName: row.installed_by_name || null,
  servicePersonId: row.service_person_id || null,
  result: row.result,
  notes: row.notes || null,
  source: row.source,
  recordedAt: toIso(row.recorded_at),
});

const mapEolAssignmentRow = (row) => ({
  id: String(row.id),
  batteryId: row.battery_id,
  partnerId: row.partner_id,
  partnerName: row.partner_name || null,
  partnerCategory: row.partner_category || null,
  partnerRegistrationNumber: row.partner_registration_number || null,
  partnerRole: row.partner_role,
  status: row.status,
  assignedAt: toIso(row.assigned_at),
  assignedBy: row.assigned_by || null,
  accessExpiresAt: toIso(row.access_expires_at),
  completedAt: toIso(row.completed_at),
  collectionAddress: row.collection_address || null,
  locationKey: row.location_key || null,
  locationName: row.location_name || null,
  contactReference: row.contact_reference || null,
  notes: row.notes || null,
});

const mapAssessmentRow = (row) => ({
  id: String(row.id),
  batteryId: row.battery_id,
  lifecycleEventId: row.lifecycle_event_id === null ? null : String(row.lifecycle_event_id),
  partnerId: row.partner_id ?? null,
  partnerName: row.partner_name || null,
  assessorUserId: row.assessor_user_id || null,
  assessorName: row.assessor_name || null,
  assessedAt: toIso(row.assessed_at),
  healthPercent: num(row.health_percent),
  capacityPercent: num(row.capacity_percent),
  safetyAssessment: row.safety_assessment || null,
  safetyPassed: row.safety_passed === null || row.safety_passed === undefined ? null : Boolean(row.safety_passed),
  grade: row.grade || null,
  decision: row.decision,
  decisionNotes: row.decision_notes || null,
  evidenceDocumentId: row.evidence_document_id ?? null,
  source: row.source,
  recordedAt: toIso(row.recorded_at),
});

const EVENT_SELECT = `
  SELECT e.*, s.ticket_number, p.producer_name AS partner_name
  FROM battery_lifecycle_events e
  LEFT JOIN services s ON s.id = e.service_id
  LEFT JOIN compliance_producers p ON p.id = e.partner_id`;

/* The stages that require an explicit EOL authorisation for the partner
   performing them. Anything else a partner claims is refused: a partner
   account exists to move a battery along the collection/recycling path,
   not to rewrite its service history. */
const PARTNER_PERMITTED_EVENTS = new Set([
  "collected",
  "collection_arranged",
  "second_life_assessment",
  "refurbished",
  "second_life_deployed",
  "recycled",
  "epr_evidence_recorded",
  "note",
  "document_uploaded",
]);

export const createBatteryLifecycleStore = ({ pool, batteryKey = "battery_id" }) => {
  /* Verify the chain for one battery by re-deriving every hash from the
     stored row. Returns the first broken link rather than a bare false,
     so the operator knows WHICH event was altered. */
  async function verifyLifecycleChain(batteryId) {
    const { rows } = await pool.query(
      `${EVENT_SELECT} WHERE e.${batteryKey} = $1 ORDER BY e.id ASC`,
      [batteryId]
    );

    if (rows.length === 0) {
      return { batteryId, valid: true, eventsChecked: 0, brokenAt: null, reason: null };
    }

    let expectedPrev = GENESIS_HASH;
    for (const row of rows) {
      if (row.prev_hash !== expectedPrev) {
        return {
          batteryId,
          valid: false,
          eventsChecked: rows.length,
          brokenAt: String(row.id),
          reason: "prev_hash does not match the preceding event (an earlier event was altered or removed)",
        };
      }
      const expected = computeLifecycleHash(row, expectedPrev);
      if (expected !== row.row_hash) {
        return {
          batteryId,
          valid: false,
          eventsChecked: rows.length,
          brokenAt: String(row.id),
          reason: "row contents do not match the stored hash (this event was modified)",
        };
      }
      expectedPrev = row.row_hash;
    }

    return { batteryId, valid: true, eventsChecked: rows.length, brokenAt: null, reason: null };
  }

  /* Append one event to the ledger.
     `client` may be supplied so a caller that is already inside a
     transaction (an ownership transfer, say) can include the event in
     the same atomic unit. */
  async function appendLifecycleEvent(input, client = null) {
    const db = client || pool;
    const {
      batteryId,
      eventCode,
      eventType = null,
      occurredAt = null,
      actor = null,
      source = "admin",
      serviceId = null,
      previousValue = null,
      newValue = null,
      previousState = null,
      newState = null,
      notes = null,
      evidenceDocumentId = null,
      partnerId = null,
      metadata = {},
    } = input;

    if (!batteryId) throw validationError("batteryId is required");
    const definition = LIFECYCLE_EVENTS[eventCode];
    if (!definition) {
      throw validationError(`Unknown lifecycle event "${eventCode}"`, { field: "eventCode" });
    }
    if (definition.sources && !definition.sources.includes(source)) {
      throw validationError(
        `A "${source}" source may not record the "${eventCode}" lifecycle event`,
        { field: "source" }
      );
    }
    if (source === "partner" && !PARTNER_PERMITTED_EVENTS.has(eventCode)) {
      throw validationError(
        `A partner may not record the "${eventCode}" lifecycle event`,
        { field: "eventCode" }
      );
    }

    const targetStage = normalizeStage(definition.stage);
    const stageMoves = definition.stage ? targetStage : null;

    /* Row lock on the battery: concurrent appends for the same battery
       queue here instead of both reading the same previous hash. */
    const batteryResult = await db.query(
      `SELECT ${batteryKey}, lifecycle_stage FROM batteries WHERE ${batteryKey} = $1 FOR UPDATE`,
      [batteryId]
    );
    const battery = batteryResult.rows[0];
    if (!battery) throw notFoundError(`Battery ${batteryId} not found`);

    const currentStage = normalizeStage(battery.lifecycle_stage);
    if (stageMoves && !isTransitionAllowed(currentStage, stageMoves)) {
      throw validationError(
        `Cannot move a battery from "${currentStage}" to "${stageMoves}"`,
        { field: "eventCode" }
      );
    }

    const prevResult = await db.query(
      `SELECT row_hash FROM battery_lifecycle_events WHERE ${batteryKey} = $1 ORDER BY id DESC LIMIT 1`,
      [batteryId]
    );
    const prevHash = prevResult.rows[0]?.row_hash || GENESIS_HASH;

    const occurred = occurredAt ? new Date(occurredAt) : new Date();
    if (Number.isNaN(occurred.getTime())) {
      throw validationError("occurredAt is not a valid date", { field: "occurredAt" });
    }
    const recorded = new Date();

    const event = {
      batteryId,
      eventCode,
      lifecycleStage: stageMoves,
      occurredAt: occurred,
      recordedAt: recorded,
      actorId: actor?.id || null,
      actorName: actor?.name || null,
      actorRole: actor?.role || null,
      source,
      serviceId: serviceId || null,
      previousValue: previousValue === null || previousValue === undefined ? null : String(previousValue),
      newValue: newValue === null || newValue === undefined ? null : String(newValue),
      previousState,
      newState,
      notes,
      evidenceDocumentId: evidenceDocumentId ?? null,
      partnerId: partnerId ?? null,
      metadata: metadata || {},
    };
    const rowHash = computeLifecycleHash(event, prevHash);

    const inserted = await db.query(
      `INSERT INTO battery_lifecycle_events
         (${batteryKey}, event_type, event_code, lifecycle_stage, occurred_at, recorded_at,
          actor_id, actor_name, actor_role, source, service_id, previous_value, new_value,
          previous_state, new_state, notes, evidence_document_id, partner_id,
          metadata, prev_hash, row_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
       RETURNING *`,
      [
        batteryId,
        eventType || definition.label,
        eventCode,
        stageMoves,
        occurred,
        recorded,
        event.actorId,
        event.actorName,
        event.actorRole,
        source,
        event.serviceId,
        event.previousValue,
        event.newValue,
        previousState,
        newState,
        notes,
        event.evidenceDocumentId,
        event.partnerId,
        JSON.stringify(event.metadata),
        prevHash,
        rowHash,
      ]
    );

    if (stageMoves) {
      await db.query(
        `UPDATE batteries SET lifecycle_stage = $2, last_lifecycle_event_at = $3 WHERE ${batteryKey} = $1`,
        [batteryId, stageMoves, occurred]
      );
    }

    return mapEventRow(inserted.rows[0]);
  }

  async function listLifecycleEvents(batteryId, options = {}) {
    const { limit = 100, offset = 0, eventType = "", from = null, to = null } = options;
    const params = [batteryId];
    const where = [`e.${batteryKey} = $1`];

    if (eventType) {
      params.push(eventType);
      where.push(`e.event_type = $${params.length}`);
    }
    if (from) {
      params.push(new Date(from));
      where.push(`e.occurred_at >= $${params.length}`);
    }
    if (to) {
      params.push(new Date(to));
      where.push(`e.occurred_at <= $${params.length}`);
    }

    const { rows } = await pool.query(
      `${EVENT_SELECT} WHERE ${where.join(" AND ")} ORDER BY e.occurred_at DESC, e.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, Math.max(1, Math.min(Number(limit) || 100, 500)), Math.max(0, Number(offset) || 0)]
    );
    return rows.map(mapEventRow);
  }

  /* Initialise the ledger for a battery that predates it. Idempotent:
     re-running adds nothing once an event exists. The stage is mapped
     from the plant's existing overall_status rather than asserted, and
     registration_origin is recorded as a legacy import because that is
     exactly what it was.

     The whole thing is one transaction, and the existence check happens
     again while holding a lock on this battery. Without both, two
     concurrent runs (the backfill script and an operator clicking "seed
     ledger" in the admin panel at the same moment) would both see an
     empty ledger and each append a genesis event -- two "manufactured"
     facts for one battery, and the second one's hash parent would be a
     chain that the second writer did not expect. */
  async function initialiseLifecycleFromBattery(batteryId, actor = null) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        `lifecycle-init:${batteryKey}:${batteryId}`,
      ]);

      const existing = await client.query(
        `SELECT 1 FROM battery_lifecycle_events WHERE ${batteryKey} = $1 LIMIT 1`,
        [batteryId]
      );
      if (existing.rows.length > 0) {
        await client.query("COMMIT");
        return null;
      }

      const { rows } = await client.query(
        `SELECT ${batteryKey}, barcode, serial_number, overall_status, manufacture_date, lifecycle_stage, registration_origin
         FROM batteries WHERE ${batteryKey} = $1`,
        [batteryId]
      );
      const battery = rows[0];
      if (!battery) {
        await client.query("ROLLBACK");
        throw notFoundError(`Battery ${batteryId} not found`);
      }

      const stage = stageFromOverallStatus(battery.overall_status);
      await client.query(
        `UPDATE batteries
           SET lifecycle_stage = $2,
               registration_origin = COALESCE(registration_origin, 'legacy_import'),
               registration_recorded_at = COALESCE(registration_recorded_at, now())
         WHERE ${batteryKey} = $1`,
        [batteryId, stage]
      );

      const event = await appendLifecycleEvent(
        {
          batteryId,
          eventCode: "manufacturing_record",
          source: "legacy_registration",
          actor,
          newValue: stage,
          notes: "Backfilled from the pre-existing manufacturing record. No historical events were invented.",
          metadata: { backfill: true, overallStatus: battery.overall_status || null },
        },
        client
      );
      await client.query("COMMIT");
      return event;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  /* ============================================================
     OWNERSHIP
     ============================================================ */

  async function listOwnershipHistory(batteryId) {
    const { rows } = await pool.query(
      `SELECT h.*, c.name AS organization_name
       FROM battery_ownership_history h
       LEFT JOIN companies c ON c.id = h.owner_organization_id
       WHERE h.${batteryKey} = $1
       ORDER BY h.acquired_at DESC, h.id DESC`,
      [batteryId]
    );
    return rows.map(mapOwnershipRow);
  }

  async function getCurrentOwnership(batteryId) {
    const { rows } = await pool.query(
      `SELECT h.* FROM battery_ownership_history h
       WHERE h.${batteryKey} = $1 AND h.released_at IS NULL
       LIMIT 1`,
      [batteryId]
    );
    return rows[0] ? mapOwnershipRow(rows[0]) : null;
  }

  /* Transfer custody: close the open period, open a new one, move the
     batteries row, and record the ledger event — all in one transaction,
     so the current-state row and the history can never disagree. */
  async function transferOwnership(input) {
    const {
      batteryId,
      newOwnerId = null,
      newOwnerOrganizationId = null,
      ownershipType = "transfer",
      responsibility = null,
      transferReference = null,
      notes = null,
      source = "admin",
      actor = null,
      occurredAt = null,
      releasePrevious = true,
    } = input;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const batteryResult = await client.query(
        `SELECT ${batteryKey}, owner_id FROM batteries WHERE ${batteryKey} = $1 FOR UPDATE`,
        [batteryId]
      );
      const battery = batteryResult.rows[0];
      if (!battery) throw notFoundError(`Battery ${batteryId} not found`);

      let previousOwner = null;
      if (releasePrevious) {
        const openResult = await client.query(
          `SELECT * FROM battery_ownership_history WHERE ${batteryKey} = $1 AND released_at IS NULL FOR UPDATE`,
          [batteryId]
        );
        const open = openResult.rows[0];
        if (open) {
          previousOwner = { id: open.owner_id, name: open.owner_name };
          await client.query(
            `UPDATE battery_ownership_history SET released_at = $2 WHERE id = $1`,
            [open.id, occurredAt ? new Date(occurredAt) : new Date()]
          );
        }
      }

      let ownerName = null;
      let ownerEmail = null;
      if (newOwnerId) {
        const ownerResult = await client.query(
          `SELECT name, email FROM users WHERE id = $1`,
          [newOwnerId]
        );
        if (!ownerResult.rows[0]) throw notFoundError(`Owner ${newOwnerId} not found`);
        ownerName = ownerResult.rows[0].name;
        ownerEmail = ownerResult.rows[0].email;
      }

      const acquired = occurredAt ? new Date(occurredAt) : new Date();
      const inserted = await client.query(
        `INSERT INTO battery_ownership_history
           (${batteryKey}, owner_id, owner_organization_id, owner_name, owner_email,
            ownership_type, responsibility, acquired_at, transfer_reference, notes, source, recorded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING *`,
        [
          batteryId,
          newOwnerId,
          newOwnerOrganizationId,
          ownerName,
          ownerEmail,
          ownershipType,
          responsibility,
          acquired,
          transferReference,
          notes,
          source,
          actor?.id || null,
        ]
      );

      await client.query(
        `UPDATE batteries SET owner_id = $2, owner_organization_id = $3 WHERE ${batteryKey} = $1`,
        [batteryId, newOwnerId, newOwnerOrganizationId]
      );

      const event = await appendLifecycleEvent(
        {
          batteryId,
          eventCode: "ownership_transferred",
          source,
          actor,
          occurredAt: acquired,
          previousValue: previousOwner?.name || previousOwner?.id || battery.owner_id || null,
          newValue: ownerName || newOwnerId || null,
          notes: notes || (transferReference ? `Transfer reference ${transferReference}` : null),
          metadata: {
            newOwnerId: newOwnerId || null,
            newOwnerOrganizationId: newOwnerOrganizationId ?? null,
            ownershipType,
            transferReference: transferReference || null,
            responsibility: responsibility || null,
          },
        },
        client
      );

      await client.query("COMMIT");
      return { ownership: mapOwnershipRow(inserted.rows[0]), event };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  /* ============================================================
     PROVENANCE
     ============================================================ */

  async function listProvenance(batteryId, { currentOnly = false } = {}) {
    const { rows } = await pool.query(
      `SELECT p.*, u.name AS recorded_by_name
       FROM battery_data_provenance p
       LEFT JOIN users u ON u.id = p.recorded_by
       WHERE p.${batteryKey} = $1
       ${currentOnly ? "AND p.superseded_at IS NULL" : ""}
       ORDER BY p.field_name ASC, p.recorded_at DESC, p.id DESC`,
      [batteryId]
    );
    return rows.map(mapProvenanceRow);
  }

  /* Assert where a field's current value came from, superseding any
     earlier assertion for the same field. Pass `client` to join a
     transaction the caller already owns. */
  async function assertProvenance(input, client = null) {
    const {
      batteryId,
      fieldName,
      classification = "unclassified_legacy",
      source = "legacy_unknown",
      sourceRef = null,
      recordedBy = null,
      notes = null,
    } = input;

    if (!batteryId) throw validationError("batteryId is required");
    if (!fieldName) throw validationError("fieldName is required", { field: "fieldName" });
    if (!PROVENANCE_CLASSIFICATIONS.includes(classification)) {
      throw validationError(`Unknown provenance classification "${classification}"`, { field: "classification" });
    }
    if (!PROVENANCE_SOURCES.includes(source)) {
      throw validationError(`Unknown provenance source "${source}"`, { field: "source" });
    }

    const ownsTransaction = !client;
    const db = client || (await pool.connect());
    try {
      if (ownsTransaction) await db.query("BEGIN");
      const batteryResult = await db.query(
        `SELECT 1 FROM batteries WHERE ${batteryKey} = $1 FOR UPDATE`,
        [batteryId]
      );
      if (!batteryResult.rows[0]) throw notFoundError(`Battery ${batteryId} not found`);

      await db.query(
        `UPDATE battery_data_provenance
         SET superseded_at = now()
         WHERE ${batteryKey} = $1 AND field_name = $2 AND superseded_at IS NULL`,
        [batteryId, fieldName]
      );

      const inserted = await db.query(
        `INSERT INTO battery_data_provenance
           (${batteryKey}, field_name, classification, source, source_ref, recorded_by, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING *`,
        [batteryId, fieldName, classification, source, sourceRef, recordedBy, notes]
      );
      if (ownsTransaction) await db.query("COMMIT");
      return mapProvenanceRow(inserted.rows[0]);
    } catch (error) {
      if (ownsTransaction) await db.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      if (ownsTransaction) db.release();
    }
  }

  /* The one supported way to change a manufacturer-authoritative field.

     `batteries_identity_immutable` refuses model_id / manufacture_date
     changes outright, and no ordinary request can lift that: the flag
     below is set with SET LOCAL, so it exists only for the length of this
     transaction and is scoped to this connection. Every correction is
     recorded as a lifecycle event and re-asserts provenance on each field
     it moves, so the passport shows what the value was before, who
     changed it, and why. */
  async function correctManufacturerFields(input) {
    const { batteryId, modelId = null, modelName = null, manufactureDate = null, actor = null, reason } = input;

    if (!batteryId) throw validationError("batteryId is required");
    if (!modelId && modelName === null && manufactureDate === null) {
      throw validationError("Nothing to correct", { field: "modelId" });
    }
    if (!reason || !String(reason).trim()) {
      throw validationError("A reason is required for a manufacturer correction.", { field: "reason" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const before = await client.query(
        `SELECT ${batteryKey}, model_id, model_name, manufacture_date
         FROM batteries WHERE ${batteryKey} = $1 FOR UPDATE`,
        [batteryId]
      );
      const current = before.rows[0];
      if (!current) throw notFoundError(`Battery ${batteryId} not found`);

      if (modelId && modelId !== current.model_id) {
        const modelExists = await client.query(`SELECT 1 FROM battery_models WHERE model_id = $1`, [modelId]);
        if (!modelExists.rows[0]) throw notFoundError(`Model ${modelId} not found`);
      }

      await client.query("SET LOCAL maxspace.allow_identity_change = 'on'");
      await client.query(
        `UPDATE batteries
         SET model_id = COALESCE($2, model_id),
             model_name = COALESCE($3, model_name),
             manufacture_date = COALESCE($4, manufacture_date)
         WHERE ${batteryKey} = $1`,
        [batteryId, modelId, modelName, manufactureDate]
      );

      const changes = [];
      if (modelId && modelId !== current.model_id) changes.push({ field: "modelId", from: current.model_id, to: modelId });
      if (modelName !== null && modelName !== current.model_name) changes.push({ field: "modelName", from: current.model_name, to: modelName });
      if (manufactureDate && manufactureDate !== current.manufacture_date) {
        changes.push({ field: "manufactureDate", from: current.manufacture_date, to: manufactureDate });
      }

      /* One event per field, so the timeline reads as a list of specific
         corrections rather than one opaque entry. */
      for (const change of changes) {
        await appendLifecycleEvent(
          {
            batteryId,
            eventCode: "note",
            source: "admin",
            actor,
            previousValue: change.from === null || change.from === undefined ? null : String(change.from),
            newValue: change.to === null || change.to === undefined ? null : String(change.to),
            notes: `Manufacturer field corrected: ${reason}`,
            metadata: { correction: true, field: change.field, reason },
          },
          client
        );
      }

      if (changes.length === 0) {
        throw validationError("The correction does not change any value.");
      }

      if (modelId || modelName !== null) {
        await assertProvenance(
          {
            batteryId,
            fieldName: "modelName",
            classification: "authoritative",
            source: "admin",
            sourceRef: `correction:${actor?.id || "unknown"}`,
            recordedBy: actor?.id || null,
            notes: reason,
          },
          client
        );
      }
      if (manufactureDate) {
        await assertProvenance(
          {
            batteryId,
            fieldName: "manufactureDate",
            classification: "authoritative",
            source: "admin",
            sourceRef: `correction:${actor?.id || "unknown"}`,
            recordedBy: actor?.id || null,
            notes: reason,
          },
          client
        );
      }

      await client.query("COMMIT");
      return { batteryId, changes, reason };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  /* Read the live assertion for one field, if any. */
  async function getLiveProvenance(batteryId, fieldName) {
    const { rows } = await pool.query(
      `SELECT p.*, u.name AS recorded_by_name
       FROM battery_data_provenance p
       LEFT JOIN users u ON u.id = p.recorded_by
       WHERE p.${batteryKey} = $1 AND p.field_name = $2 AND p.superseded_at IS NULL
       LIMIT 1`,
      [batteryId, fieldName]
    );
    return rows[0] ? mapProvenanceRow(rows[0]) : null;
  }

  /* Would writing this field at this classification replace a stronger
     record? Throws when it would. Called BEFORE the row is written, so
     a refused downgrade never reaches the batteries table. */
  async function assertProvenanceWritable({ batteryId, fieldName, classification, source }) {
    if (!PROVENANCE_FIELD_RULES[fieldName]) {
      throw validationError(`"${fieldName}" is not a provenance-tracked field`, { field: fieldName });
    }
    const current = await getLiveProvenance(batteryId, fieldName);
    assertProvenanceNotDowngrade({ fieldName, incoming: classification, current });
    return { fieldName, current, source };
  }

  /* ============================================================
     DERIVED TELEMETRY EVENTS
     ============================================================ */

  /* Default thresholds. These are STARTING VALUES, not calibrated
     limits: they are overridable per call so a fleet operator can tune
     them to its own chemistry, and every derived event stores the
     threshold it was compared against so a reviewer can reproduce the
     verdict. */
  const DEFAULT_THRESHOLDS = {
    temperatureHighC: 45,
    temperatureLowC: 0,
    deepDischargeSoc: 5,
    sessionGapMinutes: 30,
    minSessionSamples: 3,
  };

  const resolveThresholds = (overrides = {}) => {
    const resolved = { ...DEFAULT_THRESHOLDS };
    for (const [key, value] of Object.entries(overrides || {})) {
      if (!(key in DEFAULT_THRESHOLDS) || value === null || value === undefined || value === "") continue;
      const n = Number(value);
      if (Number.isFinite(n)) resolved[key] = n;
    }
    return resolved;
  };

  async function listTelemetryEvents(batteryId, options = {}) {
    const { limit = 100, offset = 0, eventType = "", severity = "" } = options;
    const params = [batteryId];
    const where = [`${batteryKey} = $1`];
    if (eventType) {
      params.push(eventType);
      where.push(`event_type = $${params.length}`);
    }
    if (severity) {
      params.push(severity);
      where.push(`severity = $${params.length}`);
    }
    const { rows } = await pool.query(
      `SELECT * FROM battery_telemetry_events WHERE ${where.join(" AND ")}
       ORDER BY occurred_at DESC, id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, Math.max(1, Math.min(Number(limit) || 100, 500)), Math.max(0, Number(offset) || 0)]
    );
    return rows.map(mapTelemetryEventRow);
  }

  /* Derive events from readings that are actually stored.
     Only readings with a measured value qualify — a missing temperature
     is not a cold pack. Every candidate is keyed on the reading it came
     from, so re-running detection over the same window is a no-op. */
  async function detectTelemetryEvents(batteryId, options = {}) {
    const thresholds = resolveThresholds(options.thresholds);
    const since = options.since ? new Date(options.since) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const until = options.until ? new Date(options.until) : new Date();
    if (Number.isNaN(since.getTime()) || Number.isNaN(until.getTime())) {
      throw validationError("since/until must be valid dates", { field: "since" });
    }

    const { rows: readings } = await pool.query(
      `SELECT id, recorded_at, temperature_c, soc, charging_status, fault_status, voltage, soh
       FROM battery_telemetry
       WHERE ${batteryKey} = $1 AND recorded_at BETWEEN $2 AND $3
       ORDER BY recorded_at ASC`,
      [batteryId, since, until]
    );

    const candidates = [];
    for (const reading of readings) {
      if (reading.temperature_c !== null && reading.temperature_c !== undefined) {
        const temp = Number(reading.temperature_c);
        if (temp > thresholds.temperatureHighC) {
          candidates.push({
            eventType: "temperature_excursion",
            severity: "critical",
            occurredAt: reading.recorded_at,
            measuredValue: temp,
            thresholdValue: thresholds.temperatureHighC,
            unit: "C",
            details: { direction: "high", telemetryId: String(reading.id) },
          });
        } else if (temp < thresholds.temperatureLowC) {
          candidates.push({
            eventType: "temperature_excursion",
            severity: "warning",
            occurredAt: reading.recorded_at,
            measuredValue: temp,
            thresholdValue: thresholds.temperatureLowC,
            unit: "C",
            details: { direction: "low", telemetryId: String(reading.id) },
          });
        }
      }

      if (reading.soc !== null && reading.soc !== undefined && Number(reading.soc) <= thresholds.deepDischargeSoc) {
        candidates.push({
          eventType: "deep_discharge",
          severity: "warning",
          occurredAt: reading.recorded_at,
          measuredValue: Number(reading.soc),
          thresholdValue: thresholds.deepDischargeSoc,
          unit: "%",
          details: { telemetryId: String(reading.id) },
        });
      }

      const fault = String(reading.fault_status || "").trim();
      if (fault && fault.toLowerCase() !== "none" && fault.toLowerCase() !== "ok") {
        const isBms = /^bms/i.test(fault);
        candidates.push({
          eventType: isBms ? "bms_event" : "abnormal_event",
          severity: /critical|severe|fatal/i.test(fault) ? "critical" : "warning",
          occurredAt: reading.recorded_at,
          unit: null,
          details: { faultStatus: fault, telemetryId: String(reading.id) },
        });
      }
    }

    /* Charge / discharge sessions: contiguous runs of one charging
       status, split where the gap between readings exceeds the session
       gap. Runs shorter than the minimum sample count are discarded so
       a single stray reading cannot be presented as a session. */
    const sessions = detectSessions(readings, thresholds);

    const created = [];
    const skipped = [];
    for (const candidate of [...candidates, ...sessions]) {
      const dedupeKey = `${batteryId}|${candidate.eventType}|${candidate.dedupePart}`;
      try {
        const { rows } = await pool.query(
          `INSERT INTO battery_telemetry_events
             (${batteryKey}, telemetry_id, event_type, severity, occurred_at,
              measured_value, threshold_value, unit, start_at, end_at, details, dedupe_key)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           ON CONFLICT (${batteryKey}, dedupe_key) DO NOTHING
           RETURNING *`,
          [
            batteryId,
            candidate.telemetryId ?? null,
            candidate.eventType,
            candidate.severity,
            candidate.occurredAt,
            candidate.measuredValue ?? null,
            candidate.thresholdValue ?? null,
            candidate.unit ?? null,
            candidate.startAt ?? null,
            candidate.endAt ?? null,
            JSON.stringify(candidate.details || {}),
            dedupeKey,
          ]
        );
        if (rows[0]) created.push(mapTelemetryEventRow(rows[0]));
        else skipped.push(dedupeKey);
      } catch (error) {
        // A concurrent detector inserting the same key is expected, not a failure.
        if (error.code === "23505") {
          skipped.push(dedupeKey);
          continue;
        }
        throw error;
      }
    }

    return {
      batteryId,
      readingsScanned: readings.length,
      window: { since: since.toISOString(), until: until.toISOString() },
      thresholds,
      created,
      skippedDuplicates: skipped.length,
    };
  }

  /* Gaps-and-islands over consecutive readings, done in JavaScript so
     the rule is readable and testable: a new run starts when the status
     changes or the time gap exceeds `sessionGapMinutes`. */
  function detectSessions(readings, thresholds) {
    const gapMs = Math.max(1, thresholds.sessionGapMinutes) * 60 * 1000;
    const relevant = readings.filter((r) => {
      const status = String(r.charging_status || "").toLowerCase();
      return status === "charging" || status === "discharging";
    });

    const runs = [];
    let current = null;
    for (const reading of relevant) {
      const status = String(reading.charging_status).toLowerCase();
      const at = new Date(reading.recorded_at).getTime();
      if (
        current &&
        current.status === status &&
        at - new Date(current.lastAt).getTime() <= gapMs
      ) {
        current.samples += 1;
        current.lastAt = reading.recorded_at;
        current.lastId = reading.id;
      } else {
        if (current) runs.push(current);
        current = { status, samples: 1, firstAt: reading.recorded_at, lastAt: reading.recorded_at, firstId: reading.id, lastId: reading.id };
      }
    }
    if (current) runs.push(current);

    const sessions = [];
    for (const run of runs) {
      if (run.samples < Math.max(1, thresholds.minSessionSamples)) continue;
      const eventType = run.status === "charging" ? "charge_session" : "discharge_session";
      const startAt = new Date(run.firstAt);
      const endAt = new Date(run.lastAt);
      sessions.push({
        eventType,
        severity: "info",
        occurredAt: endAt,
        telemetryId: run.lastId ?? null,
        unit: null,
        startAt,
        endAt,
        details: {
          chargingStatus: run.status,
          samples: run.samples,
          durationMinutes: Math.round((endAt.getTime() - startAt.getTime()) / 60000),
          maxGapMinutes: thresholds.sessionGapMinutes,
        },
        dedupePart: `${new Date(startAt).toISOString()}|${eventType}`,
      });
    }
    return sessions;
  }

  /* ============================================================
     FIRMWARE
     ============================================================ */

  async function listFirmwareUpdates(batteryId) {
    const { rows } = await pool.query(
      `SELECT f.*, u.name AS installed_by_name
       FROM battery_firmware_updates f
       LEFT JOIN users u ON u.id = f.installed_by
       WHERE f.${batteryKey} = $1
       ORDER BY f.installed_at DESC, f.id DESC`,
      [batteryId]
    );
    return rows.map(mapFirmwareRow);
  }

  async function getCurrentFirmware(batteryId) {
    const history = await listFirmwareUpdates(batteryId);
    return history.length > 0 ? history[0] : null;
  }

  async function recordFirmwareUpdate(input) {
    const {
      batteryId,
      firmwareVersion,
      previousVersion = null,
      installedAt = null,
      installedBy = null,
      servicePersonId = null,
      result = "Success",
      notes = null,
      source = "admin",
      actor = null,
    } = input;

    if (!batteryId) throw validationError("batteryId is required");
    if (!firmwareVersion) throw validationError("firmwareVersion is required", { field: "firmwareVersion" });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const batteryResult = await client.query(
        `SELECT ${batteryKey} FROM batteries WHERE ${batteryKey} = $1 FOR UPDATE`,
        [batteryId]
      );
      if (!batteryResult.rows[0]) throw notFoundError(`Battery ${batteryId} not found`);

      const modelResult = await client.query(
        `SELECT bm.bms_model
         FROM batteries b JOIN battery_models bm ON bm.model_id = b.model_id
         WHERE b.${batteryKey} = $1`,
        [batteryId]
      );

      const inserted = await client.query(
        `INSERT INTO battery_firmware_updates
           (${batteryKey}, bms_model, firmware_version, previous_version, installed_at,
            installed_by, service_person_id, result, notes, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING *`,
        [
          batteryId,
          modelResult.rows[0]?.bms_model || null,
          firmwareVersion,
          previousVersion,
          installedAt ? new Date(installedAt) : new Date(),
          installedBy,
          servicePersonId,
          result,
          notes,
          source,
        ]
      );

      /* Only a successful install is a lifecycle fact worth recording;
         a failed attempt is still kept in the firmware history. */
      if (result === "Success" || result === "Rolled Back") {
        await appendLifecycleEvent(
          {
            batteryId,
            eventCode: "firmware_updated",
            source,
            actor,
            previousValue: previousVersion,
            newValue: firmwareVersion,
            notes,
            metadata: { result, servicePersonId: servicePersonId || null },
          },
          client
        );
      }

      await client.query("COMMIT");
      return mapFirmwareRow(inserted.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  /* ============================================================
     END-OF-LIFE PARTNER ASSIGNMENTS
     ============================================================ */

  async function listEolAssignments(batteryId) {
    const { rows } = await pool.query(
      `SELECT a.*, p.producer_name AS partner_name, p.producer_category AS partner_category,
              p.registration_number AS partner_registration_number, l.name AS location_name
       FROM battery_eol_assignments a
       JOIN compliance_producers p ON p.id = a.partner_id
       LEFT JOIN organization_locations l ON l.key = a.location_key
       WHERE a.${batteryKey} = $1
       ORDER BY a.assigned_at DESC, a.id DESC`,
      [batteryId]
    );
    return rows.map(mapEolAssignmentRow);
  }

  async function listPartnerAssignments(partnerId, options = {}) {
    const { limit = 100, offset = 0, status = "active" } = options;
    const params = [partnerId];
    const where = [`a.partner_id = $1`];
    if (status) {
      params.push(status);
      where.push(`a.status = $${params.length}`);
    }
    const { rows } = await pool.query(
      `SELECT a.*, p.producer_name AS partner_name, p.producer_category AS partner_category,
              p.registration_number AS partner_registration_number, l.name AS location_name
       FROM battery_eol_assignments a
       JOIN compliance_producers p ON p.id = a.partner_id
       LEFT JOIN organization_locations l ON l.key = a.location_key
       WHERE ${where.join(" AND ")}
       ORDER BY a.assigned_at DESC, a.id DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, Math.max(1, Math.min(Number(limit) || 100, 500)), Math.max(0, Number(offset) || 0)]
    );
    return rows.map(mapEolAssignmentRow);
  }

  /* The authorisation a partner acts on: an ACTIVE assignment for this
     partner and this battery, not expired. Returns null rather than
     throwing so callers can decide between 403 and 404. */
  async function getActiveEolAssignment(batteryId, partnerId) {
    const { rows } = await pool.query(
      `SELECT a.*, p.producer_name AS partner_name, p.producer_category AS partner_category,
              p.registration_number AS partner_registration_number, l.name AS location_name
       FROM battery_eol_assignments a
       JOIN compliance_producers p ON p.id = a.partner_id
       LEFT JOIN organization_locations l ON l.key = a.location_key
       WHERE a.${batteryKey} = $1
         AND a.partner_id = $2
         AND a.status = 'active'
         AND (a.access_expires_at IS NULL OR a.access_expires_at > now())
       ORDER BY a.assigned_at DESC
       LIMIT 1`,
      [batteryId, partnerId]
    );
    return rows[0] ? mapEolAssignmentRow(rows[0]) : null;
  }

  async function assignEolPartner(input) {
    const {
      batteryId,
      partnerId,
      partnerRole = "recycler",
      accessExpiresAt = null,
      collectionAddress = null,
      locationKey = null,
      contactReference = null,
      notes = null,
      actor = null,
    } = input;

    if (!batteryId) throw validationError("batteryId is required");
    if (!partnerId) throw validationError("partnerId is required", { field: "partnerId" });

    const partnerResult = await pool.query(
      `SELECT id, producer_name FROM compliance_producers WHERE id = $1`,
      [partnerId]
    );
    if (!partnerResult.rows[0]) throw notFoundError(`Partner ${partnerId} not found`);

    if (locationKey) {
      const locationResult = await pool.query(
        `SELECT key FROM organization_locations WHERE key = $1`,
        [locationKey]
      );
      if (!locationResult.rows[0]) throw notFoundError(`Location ${locationKey} not found`);
    }

    const { rows } = await pool.query(
      `INSERT INTO battery_eol_assignments
         (${batteryKey}, partner_id, partner_role, assigned_by, access_expires_at,
          collection_address, location_key, contact_reference, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        batteryId,
        partnerId,
        partnerRole,
        actor?.id || null,
        accessExpiresAt ? new Date(accessExpiresAt) : null,
        collectionAddress,
        locationKey,
        contactReference,
        notes,
      ]
    );
    return mapEolAssignmentRow(rows[0]);
  }

  async function completeEolAssignment(assignmentId, { completedAt = null, notes = null } = {}) {
    const { rows } = await pool.query(
      `UPDATE battery_eol_assignments
       SET status = 'completed', completed_at = COALESCE($2, now()), notes = COALESCE($3, notes)
       WHERE id = $1 AND status = 'active'
       RETURNING *`,
      [assignmentId, completedAt ? new Date(completedAt) : null, notes]
    );
    if (!rows[0]) throw notFoundError(`Active EOL assignment ${assignmentId} not found`);
    return mapEolAssignmentRow(rows[0]);
  }

  async function revokeEolAssignment(assignmentId, { notes = null } = {}) {
    const { rows } = await pool.query(
      `UPDATE battery_eol_assignments
       SET status = 'revoked', completed_at = now(), notes = COALESCE($2, notes)
       WHERE id = $1 AND status = 'active'
       RETURNING *`,
      [assignmentId, notes]
    );
    if (!rows[0]) throw notFoundError(`Active EOL assignment ${assignmentId} not found`);
    return mapEolAssignmentRow(rows[0]);
  }

  /* A partner's view of one battery: only reachable through an active
     assignment, and deliberately narrower than the owner's passport —
     a recycler needs the EOL facts, not the customer's service history. */
  async function getPartnerBattery(batteryId, partnerId) {
    const assignment = await getActiveEolAssignment(batteryId, partnerId);
    if (!assignment) return null;

    const { rows } = await pool.query(
      `SELECT b.${batteryKey}, b.barcode, b.serial_number, b.overall_status, b.hang_status,
              b.lifecycle_stage, b.manufacture_date, b.model_id, b.model_name, b.weight_kg,
              b.owner_id, bm.bms_model
       FROM batteries b
       LEFT JOIN battery_models bm ON bm.model_id = b.model_id
       WHERE b.${batteryKey} = $1`,
      [batteryId]
    );
    const battery = rows[0];
    if (!battery) return null;

    return {
      batteryId: battery[batteryKey],
      barcode: battery.barcode,
      serialNumber: battery.serial_number,
      overallStatus: battery.overall_status,
      hangStatus: battery.hang_status === null ? null : Boolean(battery.hang_status),
      lifecycleStage: normalizeStage(battery.lifecycle_stage),
      manufactureDate: battery.manufacture_date,
      modelId: battery.model_id,
      modelName: battery.model_name || null,
      bmsModel: battery.bms_model || null,
      weightKg: num(battery.weight_kg),
      ownerId: battery.owner_id || null,
      assignment,
    };
  }

  /* A partner records what it actually did to the battery. Requires an
     active assignment, and can optionally attach the evidence it holds:
     the document is linked to the lifecycle event so the passport shows
     "this certificate, for this event, from this partner". */
  async function recordPartnerEolAction(input) {
    const {
      batteryId,
      partnerId,
      eventCode,
      newValue = null,
      notes = null,
      weightKg = null,
      processingOutcome = null,
      evidenceDocumentId = null,
      occurredAt = null,
      actor = null,
      completeAssignment = false,
    } = input;

    if (!PARTNER_PERMITTED_EVENTS.has(eventCode)) {
      throw validationError(`A partner may not record the "${eventCode}" lifecycle event`, { field: "eventCode" });
    }
    const assignment = await getActiveEolAssignment(batteryId, partnerId);
    if (!assignment) {
      throw forbiddenError("This battery is not assigned to your organisation for end-of-life handling.");
    }
    if (weightKg !== null && weightKg !== undefined && !(Number(weightKg) >= 0)) {
      throw validationError("weightKg must be zero or greater", { field: "weightKg" });
    }
    if (
      processingOutcome &&
      !["recycled", "refurbished", "reused", "rejected", "partially_processed"].includes(processingOutcome)
    ) {
      throw validationError(`Unknown processing outcome "${processingOutcome}"`, { field: "processingOutcome" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const event = await appendLifecycleEvent(
        {
          batteryId,
          eventCode,
          source: "partner",
          actor,
          partnerId,
          occurredAt,
          newValue,
          notes,
          evidenceDocumentId,
          metadata: {
            assignmentId: String(assignment.id),
            partnerRole: assignment.partnerRole,
            weightKg: weightKg === null || weightKg === undefined ? null : Number(weightKg),
            processingOutcome: processingOutcome || null,
            collectionAddress: assignment.collectionAddress || null,
            locationKey: assignment.locationKey || null,
          },
        },
        client
      );

      /* Evidence columns live on the existing compliance_documents row:
         the file is not duplicated, it is annotated with what it proves. */
      if (evidenceDocumentId) {
        const docResult = await client.query(
          `UPDATE compliance_documents
           SET lifecycle_event_id = $2,
               partner_id = $3,
               weight_kg = COALESCE($4, weight_kg),
               processing_outcome = COALESCE($5, processing_outcome),
               updated_at = now()
           WHERE id = $1
           RETURNING id`,
          [evidenceDocumentId, event.id, partnerId, weightKg, processingOutcome]
        );
        if (!docResult.rows[0]) {
          throw notFoundError(`Evidence document ${evidenceDocumentId} not found`);
        }
      }

      if (completeAssignment) {
        await client.query(
          `UPDATE battery_eol_assignments
           SET status = 'completed', completed_at = COALESCE($2, now())
           WHERE id = $1 AND status = 'active'`,
          [assignment.id, occurredAt ? new Date(occurredAt) : null]
        );
      }

      await client.query("COMMIT");
      return event;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  /* ============================================================
     SECOND LIFE
     ============================================================ */

  async function listSecondLifeAssessments(batteryId) {
    const { rows } = await pool.query(
      `SELECT a.*, p.producer_name AS partner_name
       FROM battery_second_life_assessments a
       LEFT JOIN compliance_producers p ON p.id = a.partner_id
       WHERE a.${batteryKey} = $1
       ORDER BY a.assessed_at DESC, a.id DESC`,
      [batteryId]
    );
    return rows.map(mapAssessmentRow);
  }

  /* A grade and a decision are both required, and both must come from an
     authorised assessor. Nothing here infers suitability from telemetry
     or from the battery being retired — an automatic "this one is fine
     for second life" is exactly the claim a passport must not make. */
  async function recordSecondLifeAssessment(input) {
    const {
      batteryId,
      partnerId = null,
      assessorUserId = null,
      assessorName = null,
      assessedAt = null,
      healthPercent = null,
      capacityPercent = null,
      safetyAssessment = null,
      safetyPassed = null,
      grade = null,
      decision,
      decisionNotes = null,
      evidenceDocumentId = null,
      source = "admin",
      actor = null,
    } = input;

    if (!batteryId) throw validationError("batteryId is required");
    if (!decision) throw validationError("decision is required", { field: "decision" });
    if (!grade) throw validationError("grade is required", { field: "grade" });
    if (!LIFECYCLE_EVENTS.second_life_assessment.sources.includes(source)) {
      throw validationError(`A "${source}" source may not record a second life assessment`, { field: "source" });
    }

    for (const [field, value] of [["healthPercent", healthPercent], ["capacityPercent", capacityPercent]]) {
      if (value !== null && value !== undefined) {
        const n = Number(value);
        if (!Number.isFinite(n) || n < 0 || n > 100) {
          throw validationError(`${field} must be between 0 and 100`, { field });
        }
      }
    }

    if (source === "partner" && partnerId) {
      const assignment = await getActiveEolAssignment(batteryId, partnerId);
      if (!assignment) {
        throw forbiddenError("This battery is not assigned to your organisation for end-of-life handling.");
      }
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const event = await appendLifecycleEvent(
        {
          batteryId,
          eventCode: "second_life_assessment",
          source,
          actor,
          partnerId,
          occurredAt: assessedAt,
          newValue: `${grade} / ${decision}`,
          notes: decisionNotes || safetyAssessment || null,
          evidenceDocumentId,
          metadata: {
            grade,
            decision,
            healthPercent: healthPercent === null ? null : Number(healthPercent),
            capacityPercent: capacityPercent === null ? null : Number(capacityPercent),
            safetyPassed,
          },
        },
        client
      );

      const inserted = await client.query(
        `INSERT INTO battery_second_life_assessments
           (${batteryKey}, lifecycle_event_id, partner_id, assessor_user_id, assessor_name,
            assessed_at, health_percent, capacity_percent, safety_assessment, safety_passed,
            grade, decision, decision_notes, evidence_document_id, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         RETURNING *`,
        [
          batteryId,
          event.id,
          partnerId,
          assessorUserId || actor?.id || null,
          assessorName || actor?.name || null,
          assessedAt ? new Date(assessedAt) : new Date(),
          healthPercent,
          capacityPercent,
          safetyAssessment,
          safetyPassed,
          grade,
          decision,
          decisionNotes,
          evidenceDocumentId,
          source,
        ]
      );
      await client.query("COMMIT");
      return { assessment: mapAssessmentRow(inserted.rows[0]), event };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  /* ============================================================
     PASSPORT AGGREGATE
     ============================================================ */

  async function getLifecycleSummary(batteryId) {
    const { rows } = await pool.query(
      `SELECT b.${batteryKey}, b.lifecycle_stage, b.registration_origin, b.registration_recorded_at,
              b.last_lifecycle_event_at, b.owner_organization_id,
              (SELECT count(*) FROM battery_lifecycle_events e WHERE e.${batteryKey} = b.${batteryKey}) AS event_count,
              (SELECT count(*) FROM battery_telemetry_events t WHERE t.${batteryKey} = b.${batteryKey}) AS telemetry_event_count,
              (SELECT count(*) FROM battery_firmware_updates f WHERE f.${batteryKey} = b.${batteryKey}) AS firmware_update_count
       FROM batteries b WHERE b.${batteryKey} = $1`,
      [batteryId]
    );
    const row = rows[0];
    if (!row) throw notFoundError(`Battery ${batteryId} not found`);

    const integrity = await verifyLifecycleChain(batteryId);

    return {
      batteryId: row[batteryKey],
      lifecycleStage: normalizeStage(row.lifecycle_stage),
      registrationOrigin: row.registration_origin || null,
      registrationRecordedAt: toIso(row.registration_recorded_at),
      lastLifecycleEventAt: toIso(row.last_lifecycle_event_at),
      ownerOrganizationId: row.owner_organization_id ?? null,
      eventCount: Number(row.event_count || 0),
      telemetryEventCount: Number(row.telemetry_event_count || 0),
      firmwareUpdateCount: Number(row.firmware_update_count || 0),
      chain: integrity,
    };
  }

  /* Everything the passport timeline needs, in one round of queries
     rather than one per section. */
  async function getPassportLifecycle(batteryId) {
    const [summary, events, ownership, provenance, telemetryEvents, firmware, assignments, assessments] =
      await Promise.all([
        getLifecycleSummary(batteryId),
        listLifecycleEvents(batteryId, { limit: 200 }),
        listOwnershipHistory(batteryId),
        listProvenance(batteryId, { currentOnly: true }),
        listTelemetryEvents(batteryId, { limit: 100 }),
        listFirmwareUpdates(batteryId),
        listEolAssignments(batteryId),
        listSecondLifeAssessments(batteryId),
      ]);

    return {
      summary,
      events,
      ownership,
      provenance,
      telemetryEvents,
      firmware,
      currentFirmware: firmware.length > 0 ? firmware[0] : null,
      eolAssignments: assignments,
      activeEolAssignment: assignments.find((a) => a.status === "active") || null,
      secondLifeAssessments: assessments,
      latestAssessment: assessments.length > 0 ? assessments[0] : null,
    };
  }

  return {
    // vocabulary / integrity
    LIFECYCLE_STAGES,
    DEFAULT_THRESHOLDS,
    verifyLifecycleChain,
    getLifecycleSummary,
    // ledger
    appendLifecycleEvent,
    listLifecycleEvents,
    initialiseLifecycleFromBattery,
    // ownership
    transferOwnership,
    listOwnershipHistory,
    getCurrentOwnership,
    // provenance
    assertProvenance,
    assertProvenanceWritable,
    correctManufacturerFields,
    getLiveProvenance,
    listProvenance,
    // telemetry
    detectTelemetryEvents,
    listTelemetryEvents,
    // firmware
    recordFirmwareUpdate,
    listFirmwareUpdates,
    getCurrentFirmware,
    // end of life
    assignEolPartner,
    listEolAssignments,
    listPartnerAssignments,
    getActiveEolAssignment,
    completeEolAssignment,
    revokeEolAssignment,
    getPartnerBattery,
    recordPartnerEolAction,
    // second life
    recordSecondLifeAssessment,
    listSecondLifeAssessments,
    // aggregate
    getPassportLifecycle,
  };
};