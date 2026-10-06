/* Battery Passport lifecycle unit tests.
   Run: npm test  (from backend/) — no database required.

   Covers the parts that must be right for the ledger to mean anything:
   the canonical hash (including the write/read symmetry that makes
   verification meaningful), the transition rules, the provenance
   downgrade guard, and the telemetry session detector — the last one
   exercised through a stub pool, because "a stray reading must not
   become a charge session" is a rule worth pinning down. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  GENESIS_HASH,
  LIFECYCLE_EVENTS,
  LIFECYCLE_STAGES,
  PROVENANCE_STRENGTH,
  assertProvenanceNotDowngrade,
  computeLifecycleHash,
  isTransitionAllowed,
  normalizeStage,
  stageFromOverallStatus,
} from "../utils/lifecycleLedger.js";
import { createBatteryLifecycleStore } from "../data/postgres/lifecycle.js";

const baseEvent = {
  batteryId: "BATT-001",
  eventCode: "retired",
  lifecycleStage: "Retired",
  occurredAt: new Date("2026-01-02T03:04:05.000Z"),
  recordedAt: new Date("2026-01-02T03:04:06.000Z"),
  actorId: "admin-1",
  actorName: "Ada Admin",
  actorRole: "ADMIN",
  source: "admin",
  serviceId: null,
  previousValue: "In Service",
  newValue: "Retired",
  previousState: null,
  newState: null,
  notes: "End of service life",
  evidenceDocumentId: null,
  partnerId: null,
  metadata: { reason: "age" },
};

describe("lifecycle hash chain", () => {
  test("is deterministic and independent of key insertion order", () => {
    const a = computeLifecycleHash({ ...baseEvent, notes: "x" }, GENESIS_HASH);
    const reordered = {
      metadata: { reason: "age" },
      partnerId: null,
      evidenceDocumentId: null,
      notes: "x",
      newState: null,
      previousState: null,
      newValue: "Retired",
      previousValue: "In Service",
      serviceId: null,
      source: "admin",
      actorRole: "ADMIN",
      actorName: "Ada Admin",
      actorId: "admin-1",
      recordedAt: baseEvent.recordedAt,
      occurredAt: baseEvent.occurredAt,
      lifecycleStage: "Retired",
      eventCode: "retired",
      batteryId: "BATT-001",
    };
    assert.equal(computeLifecycleHash(reordered, GENESIS_HASH), a);
  });

  test("reads a snake_case row back to the same hash it wrote", () => {
    // The verifier re-derives hashes from database rows, so the camelCase
    // write path and the snake_case read path MUST agree.
    const written = computeLifecycleHash(baseEvent, GENESIS_HASH);
    const row = {
      battery_id: baseEvent.batteryId,
      event_code: baseEvent.eventCode,
      lifecycle_stage: baseEvent.lifecycleStage,
      occurred_at: baseEvent.occurredAt,
      recorded_at: baseEvent.recordedAt,
      actor_id: baseEvent.actorId,
      actor_name: baseEvent.actorName,
      actor_role: baseEvent.actorRole,
      source: baseEvent.source,
      service_id: baseEvent.serviceId,
      previous_value: baseEvent.previousValue,
      new_value: baseEvent.newValue,
      previous_state: baseEvent.previousState,
      new_state: baseEvent.newState,
      notes: baseEvent.notes,
      evidence_document_id: baseEvent.evidenceDocumentId,
      partner_id: baseEvent.partnerId,
      metadata: baseEvent.metadata,
    };
    assert.equal(computeLifecycleHash(row, GENESIS_HASH), written);
  });

  test("changes when any hashed field changes", () => {
    const base = computeLifecycleHash(baseEvent, GENESIS_HASH);
    assert.notEqual(computeLifecycleHash({ ...baseEvent, notes: "tampered" }, GENESIS_HASH), base);
    assert.notEqual(computeLifecycleHash({ ...baseEvent, newValue: "Recycled" }, GENESIS_HASH), base);
    assert.notEqual(computeLifecycleHash({ ...baseEvent, metadata: {} }, GENESIS_HASH), base);
  });

  test("does not depend on the human-readable label", () => {
    // event_type is display text; re-wording it must not look like forgery.
    const a = computeLifecycleHash(baseEvent, GENESIS_HASH);
    const b = computeLifecycleHash({ ...baseEvent, eventType: "Retired from service (wording change)" }, GENESIS_HASH);
    assert.equal(a, b);
  });

  test("depends on the previous hash, so the chain is order-sensitive", () => {
    const first = computeLifecycleHash(baseEvent, GENESIS_HASH);
    const chained = computeLifecycleHash({ ...baseEvent, eventCode: "collected" }, first);
    assert.notEqual(chained, computeLifecycleHash({ ...baseEvent, eventCode: "collected" }, GENESIS_HASH));
  });

  test("treats empty strings and null as the same absence", () => {
    assert.equal(
      computeLifecycleHash({ ...baseEvent, notes: null }, GENESIS_HASH),
      computeLifecycleHash({ ...baseEvent, notes: "" }, GENESIS_HASH)
    );
  });
});

describe("chain verification", () => {
  const chain = (rows) => ({ rows });

  /* Minimal pool stub: verifyLifecycleChain issues one query. */
  const storeWithRows = (rows) =>
    createBatteryLifecycleStore({ pool: { query: () => Promise.resolve(chain(rows)) }, batteryKey: "battery_id" });

  /* Build the snake_case row a database would hold for `baseEvent`. */
  const rowFor = (event, prevHash) => ({
    id: "1",
    battery_id: event.batteryId,
    event_code: event.eventCode,
    event_type: "Retired from service",
    lifecycle_stage: event.lifecycleStage,
    occurred_at: event.occurredAt,
    recorded_at: event.recordedAt,
    actor_id: event.actorId,
    actor_name: event.actorName,
    actor_role: event.actorRole,
    source: event.source,
    service_id: event.serviceId,
    previous_value: event.previousValue,
    new_value: event.newValue,
    previous_state: event.previousState,
    new_state: event.newState,
    notes: event.notes,
    evidence_document_id: event.evidenceDocumentId,
    partner_id: event.partnerId,
    metadata: event.metadata,
    prev_hash: prevHash,
    row_hash: computeLifecycleHash(event, prevHash),
  });

  test("reports a battery with no events as valid", async () => {
    const result = await storeWithRows([]).verifyLifecycleChain("BATT-001");
    assert.equal(result.valid, true);
    assert.equal(result.eventsChecked, 0);
  });

  test("accepts an untouched chain", async () => {
    const row = rowFor(baseEvent, GENESIS_HASH);
    const result = await storeWithRows([row]).verifyLifecycleChain("BATT-001");
    assert.equal(result.valid, true);
    assert.equal(result.eventsChecked, 1);
  });

  test("detects an edited event and names it", async () => {
    const row = { ...rowFor(baseEvent, GENESIS_HASH), new_value: "Recycled" };
    const result = await storeWithRows([row]).verifyLifecycleChain("BATT-001");
    assert.equal(result.valid, false);
    assert.equal(result.brokenAt, "1");
    assert.match(result.reason, /modified/);
  });

  test("detects a removed earlier event", async () => {
    // Deleting event 1 leaves event 2 chaining from a hash that nothing in
    // the table produces any more, so the prev_hash comparison catches it.
    const orphaned = {
      ...rowFor(baseEvent, GENESIS_HASH),
      id: "2",
      prev_hash: "f".repeat(64),
      row_hash: computeLifecycleHash({ ...baseEvent, eventCode: "collected" }, "f".repeat(64)),
    };
    const result = await storeWithRows([orphaned]).verifyLifecycleChain("BATT-001");
    assert.equal(result.valid, false);
    assert.equal(result.brokenAt, "2");
    assert.match(result.reason, /altered or removed/);
  });
});

describe("stage transitions", () => {
  test("allows progress along the lifecycle", () => {
    assert.equal(isTransitionAllowed("InService", "Serviced"), true);
    assert.equal(isTransitionAllowed("Serviced", "Retired"), true);
    assert.equal(isTransitionAllowed("Retired", "Collected"), true);
    assert.equal(isTransitionAllowed("Collected", "UnderAssessment"), true);
    assert.equal(isTransitionAllowed("UnderAssessment", "Refurbished"), true);
    assert.equal(isTransitionAllowed("Recycled", "FinalEvidenceRecorded"), true);
  });

  test("always allows staying put", () => {
    assert.equal(isTransitionAllowed("Serviced", "Serviced"), true);
  });

  test("refuses nonsense moves", () => {
    assert.equal(isTransitionAllowed("Recycled", "InService"), false);
    assert.equal(isTransitionAllowed("FinalEvidenceRecorded", "Retired"), false);
  });

  test("normalizes an unknown stage rather than throwing on read", () => {
    assert.equal(normalizeStage("Bogus"), "Unknown");
    assert.equal(normalizeStage(undefined), "Unknown");
    assert.equal(normalizeStage("Retired"), "Retired");
  });

  test("every catalogue stage is a legal stage value", () => {
    for (const definition of Object.values(LIFECYCLE_EVENTS)) {
      if (definition.stage === null) continue;
      assert.ok(LIFECYCLE_STAGES.includes(definition.stage), `${definition.stage} is not in LIFECYCLE_STAGES`);
    }
  });

  test("maps the plant's own status to a starting stage", () => {
    assert.equal(stageFromOverallStatus("PROD"), "InService");
    assert.equal(stageFromOverallStatus(" prod "), "InService");
    assert.equal(stageFromOverallStatus("FG PENDING"), "Manufactured");
    assert.equal(stageFromOverallStatus(null), "Unknown");
    assert.equal(stageFromOverallStatus("SOMETHING ELSE"), "Unknown");
  });
});

describe("provenance governance", () => {
  test("allows filling a field with nothing on record", () => {
    assert.equal(assertProvenanceNotDowngrade({ fieldName: "manufacturer", incoming: "user_supplied", current: null }), "user_supplied");
  });

  test("allows a user to correct their own earlier value", () => {
    assert.doesNotThrow(() =>
      assertProvenanceNotDowngrade({
        fieldName: "manufacturer",
        incoming: "user_supplied",
        current: { classification: "user_supplied", source: "user" },
      })
    );
  });

  test("refuses a user overwriting a measured value", () => {
    assert.throws(
      () =>
        assertProvenanceNotDowngrade({
          fieldName: "stateOfHealth",
          incoming: "user_supplied",
          current: { classification: "measured", source: "bms_telemetry" },
        }),
      (error) => error.statusCode === 400 && error.field === "stateOfHealth"
    );
  });

  test("allows an authoritative value to replace a weaker one", () => {
    assert.doesNotThrow(() =>
      assertProvenanceNotDowngrade({
        fieldName: "manufacturer",
        incoming: "authoritative",
        current: { classification: "user_supplied", source: "user" },
      })
    );
  });

  test("ranks classifications so measured beats a typed guess", () => {
    assert.ok(PROVENANCE_STRENGTH.measured > PROVENANCE_STRENGTH.user_supplied);
    assert.ok(PROVENANCE_STRENGTH.authoritative > PROVENANCE_STRENGTH.measured);
    assert.ok(PROVENANCE_STRENGTH.user_supplied > PROVENANCE_STRENGTH.unclassified_legacy);
  });
});

describe("telemetry event detection", () => {
  /* Query-aware pool stub. detectTelemetryEvents issues a SELECT for the
     readings and then one INSERT per candidate; a real driver returns the
     inserted row for the INSERT (RETURNING) and nothing when
     ON CONFLICT DO NOTHING skips it. The stub mirrors that, and records
     what was written so idempotency can be asserted directly. */
  const storeWithReadings = (readings, { seenKeys = null } = {}) => {
    const pool = {
      query: (sql, params = []) => {
        if (/^\s*INSERT INTO battery_telemetry_events/.test(sql)) {
          const dedupeKey = params[11];
          if (seenKeys?.has(dedupeKey)) {
            return Promise.resolve({ rows: [] });
          }
          seenKeys?.add(dedupeKey);
          return Promise.resolve({
            rows: [
              {
                id: String(seenKeys ? seenKeys.size : 1),
                battery_id: params[0],
                telemetry_id: params[1],
                event_type: params[2],
                severity: params[3],
                occurred_at: params[4],
                detected_at: new Date("2026-01-02T00:00:00.000Z"),
                measured_value: params[5],
                threshold_value: params[6],
                unit: params[7],
                start_at: params[8],
                end_at: params[9],
                details: JSON.parse(params[10]),
                dedupe_key: dedupeKey,
              },
            ],
          });
        }
        return Promise.resolve({ rows: readings });
      },
    };
    return createBatteryLifecycleStore({ pool, batteryKey: "battery_id" });
  };

  const reading = (over = {}) => ({
    id: 1,
    recorded_at: new Date("2026-01-01T00:00:00.000Z"),
    temperature_c: null,
    soc: null,
    charging_status: null,
    fault_status: null,
    voltage: null,
    soh: null,
    ...over,
  });

  test("a clean battery produces no events", async () => {
    const result = await storeWithReadings([reading({ temperature_c: 25, soc: 60 })]).detectTelemetryEvents("BATT-001");
    assert.equal(result.created.length, 0);
    assert.equal(result.readingsScanned, 1);
  });

  test("a missing reading is not an excursion", async () => {
    // No temperature in the payload must never be reported as a cold pack.
    const result = await storeWithReadings([reading({ temperature_c: null, soc: 50 })]).detectTelemetryEvents("BATT-001");
    assert.equal(result.created.length, 0);
  });

  test("reports only readings that breach a threshold", async () => {
    const result = await storeWithReadings([
      reading({ id: 1, temperature_c: 25 }),
      reading({ id: 2, temperature_c: 60 }),
      reading({ id: 3, soc: 2 }),
    ]).detectTelemetryEvents("BATT-001");

    const types = result.created.map((event) => `${event.eventType}:${event.measuredValue}`);
    assert.deepEqual(types, ["temperature_excursion:60", "deep_discharge:2"]);
    // The threshold that produced the verdict travels with it.
    assert.equal(result.created[0].thresholdValue, 45);
    assert.equal(result.created[1].thresholdValue, 5);
  });

  test("honours overridden thresholds", async () => {
    const result = await storeWithReadings([reading({ id: 1, temperature_c: 40 })]).detectTelemetryEvents("BATT-001", {
      thresholds: { temperatureHighC: 35 },
    });
    assert.equal(result.created.length, 1);
    assert.equal(result.thresholds.temperatureHighC, 35);
  });

  test("ignores a blank or non-numeric threshold override", async () => {
    const result = await storeWithReadings([reading({ id: 1, temperature_c: 40 })]).detectTelemetryEvents("BATT-001", {
      thresholds: { temperatureHighC: "", bogusKey: 1 },
    });
    assert.equal(result.created.length, 0);
    assert.equal(result.thresholds.temperatureHighC, 45);
  });

  test("does not turn a single stray reading into a charge session", async () => {
    const result = await storeWithReadings([
      reading({ id: 1, charging_status: "charging" }),
    ]).detectTelemetryEvents("BATT-001");
    assert.equal(result.created.length, 0);
  });

  test("reports a real charge run once, keyed on its window", async () => {
    const seenKeys = new Set();
    const readings = [
      reading({ id: 1, recorded_at: new Date("2026-01-01T10:00:00.000Z"), charging_status: "charging" }),
      reading({ id: 2, recorded_at: new Date("2026-01-01T10:10:00.000Z"), charging_status: "charging" }),
      reading({ id: 3, recorded_at: new Date("2026-01-01T10:20:00.000Z"), charging_status: "charging" }),
    ];
    const store = storeWithReadings(readings, { seenKeys });

    const first = await store.detectTelemetryEvents("BATT-001");
    assert.equal(first.created.length, 1);
    assert.equal(first.created[0].eventType, "charge_session");
    assert.equal(first.created[0].details.samples, 3);

    // Re-running over the same window must not duplicate anything.
    const second = await store.detectTelemetryEvents("BATT-001");
    assert.equal(second.created.length, 0);
    assert.equal(second.skippedDuplicates, 1);
  });

  test("splits sessions across a long idle gap", async () => {
    const result = await storeWithReadings([
      reading({ id: 1, recorded_at: new Date("2026-01-01T10:00:00.000Z"), charging_status: "charging" }),
      reading({ id: 2, recorded_at: new Date("2026-01-01T10:05:00.000Z"), charging_status: "charging" }),
      reading({ id: 3, recorded_at: new Date("2026-01-01T10:10:00.000Z"), charging_status: "charging" }),
      reading({ id: 4, recorded_at: new Date("2026-01-01T14:00:00.000Z"), charging_status: "charging" }),
      reading({ id: 5, recorded_at: new Date("2026-01-01T14:05:00.000Z"), charging_status: "charging" }),
      reading({ id: 6, recorded_at: new Date("2026-01-01T14:10:00.000Z"), charging_status: "charging" }),
    ]).detectTelemetryEvents("BATT-001");
    assert.equal(result.created.length, 2);
  });

  test("classifies a BMS fault separately from a pack fault", async () => {
    const result = await storeWithReadings([
      reading({ id: 1, fault_status: "BMS_COMMS_LOSS" }),
      reading({ id: 2, fault_status: "cell_overvoltage" }),
    ]).detectTelemetryEvents("BATT-001");

    const byType = Object.fromEntries(result.created.map((e) => [e.eventType, e.severity]));
    assert.equal(byType.bms_event, "warning");
    assert.equal(byType.abnormal_event, "warning");
  });

  test("treats a 'none' fault status as no fault", async () => {
    const result = await storeWithReadings([reading({ id: 1, fault_status: "none" })]).detectTelemetryEvents("BATT-001");
    assert.equal(result.created.length, 0);
  });
});

describe("partner authorisation vocabulary", () => {
  test("no manufacturing event is open to a partner source", () => {
    const partnerRecordable = Object.entries(LIFECYCLE_EVENTS)
      .filter(([, definition]) => definition.sources.includes("partner"))
      .map(([code]) => code);

    for (const forbidden of ["manufacturing_record", "manufactured", "commissioned", "first_owner_registered"]) {
      assert.ok(!partnerRecordable.includes(forbidden), `${forbidden} must not be partner-recordable`);
    }
  });

  test("ownership transfer is never open to a partner source", () => {
    // A partner handles a battery after collection. Letting it record an
    // ownership transfer would let an external EPR company rewrite the
    // custody chain of a battery it was only assigned to dispose of.
    assert.ok(!LIFECYCLE_EVENTS.ownership_transferred.sources.includes("partner"));
  });

  test("every partner-source event sits on the end-of-life path", () => {
    const partnerRecordable = Object.entries(LIFECYCLE_EVENTS)
      .filter(([, definition]) => definition.sources.includes("partner"))
      .map(([code]) => code);

    const eolPath = new Set([
      "collection_arranged",
      "collected",
      "second_life_assessment",
      "refurbished",
      "second_life_deployed",
      "recycled",
      "epr_evidence_recorded",
      // Neither moves the battery: a partner may leave a note or attach the
      // paperwork for the job it was actually assigned.
      "note",
      "document_uploaded",
    ]);

    for (const code of partnerRecordable) {
      assert.ok(eolPath.has(code), `${code} must not be partner-recordable`);
    }
  });
});