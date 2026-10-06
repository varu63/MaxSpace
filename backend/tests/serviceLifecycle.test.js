/* Service -> lifecycle projection tests.

   The pure mapping tests need nothing at all. The integration suite proves
   the thing that actually matters: an automatically recorded event is a
   first-class, chain-verified passport event, indistinguishable in the
   ledger from one an operator appended by hand. */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";

import {
  planServiceTransition,
  lifecycleEventForServiceStatus,
  lifecycleSourceForRole,
  recordServiceTransition,
} from "../utils/serviceLifecycle.js";
import { VALID_STATUSES } from "../constants/serviceStatuses.js";
import { LIFECYCLE_EVENTS } from "../utils/lifecycleLedger.js";
import { withOptionalTestDatabase } from "./helpers/testDatabase.js";

describe("service status -> lifecycle event mapping", () => {
  test("the four lifecycle-meaningful statuses map to events", () => {
    assert.equal(lifecycleEventForServiceStatus("Confirmed"), "service_scheduled");
    assert.equal(lifecycleEventForServiceStatus("In Progress"), "service_started");
    assert.equal(lifecycleEventForServiceStatus("Completed"), "service_completed");
    assert.equal(lifecycleEventForServiceStatus("Cancelled"), "service_cancelled");
  });

  test("workflow bookkeeping statuses stay silent", () => {
    /* These are about who is doing what, not about the battery's life.
       Writing events for them would bury the meaningful transitions. */
    for (const status of ["Accepted", "Assigned", "On The Way", "Waiting for Admin Approval"]) {
      assert.equal(lifecycleEventForServiceStatus(status), null, `${status} should be silent`);
    }
  });

  test("every VALID_STATUSES entry is deliberately accounted for", () => {
    /* Guards against a status being added to the shared constant and
       silently defaulting to "no event" with nobody noticing. */
    const mapped = new Set([
      "Confirmed",
      "In Progress",
      "Completed",
      "Cancelled",
      "Accepted",
      "Assigned",
      "On The Way",
      "Waiting for Admin Approval",
    ]);
    for (const status of VALID_STATUSES) {
      assert.equal(mapped.has(status), true, `unhandled service status "${status}"`);
    }
  });

  test("roles map to lifecycle sources", () => {
    assert.equal(lifecycleSourceForRole("ADMIN"), "admin");
    assert.equal(lifecycleSourceForRole("EMPLOYEE"), "service_technician");
    assert.equal(lifecycleSourceForRole("USER"), "user");
  });

  test("an unmapped role is refused rather than guessed", () => {
    const plan = planServiceTransition({
      fromStatus: "Assigned",
      toStatus: "Completed",
      actorRole: "PARTNER",
    });
    assert.equal(plan.eventCode, null);
    assert.match(plan.reason, /no lifecycle source/);
  });

  test("a user may cancel but may not complete their own service", () => {
    assert.equal(
      planServiceTransition({ fromStatus: "Assigned", toStatus: "Cancelled", actorRole: "USER" })
        .eventCode,
      "service_cancelled"
    );
    /* Defensive: serviceController blocks this at the HTTP layer, but the
       bridge must not be the thing that makes it possible. */
    const plan = planServiceTransition({
      fromStatus: "Assigned",
      toStatus: "Completed",
      actorRole: "USER",
    });
    assert.equal(plan.eventCode, null);
    assert.match(plan.reason, /may not record/);
  });

  test("an unchanged status writes nothing", () => {
    const plan = planServiceTransition({
      fromStatus: "Completed",
      toStatus: "Completed",
      actorRole: "ADMIN",
    });
    assert.equal(plan.eventCode, null);
    assert.equal(plan.reason, "status unchanged");
  });

  test("every planned event is permitted for the planned source", () => {
    for (const toStatus of ["Confirmed", "In Progress", "Completed", "Cancelled"]) {
      for (const actorRole of ["ADMIN", "EMPLOYEE", "USER"]) {
        const plan = planServiceTransition({ fromStatus: "Assigned", toStatus, actorRole });
        if (!plan.eventCode) continue;
        assert.ok(
          LIFECYCLE_EVENTS[plan.eventCode].sources.includes(plan.source),
          `${plan.eventCode} must accept ${plan.source}`
        );
      }
    }
  });
});

const db = await withOptionalTestDatabase(import.meta.url);

describe(
  "service transitions recorded on the passport",
  { skip: db ? false : "no PostgreSQL database available" },
  async () => {
    const store = db.store;
    const { testPool } = await import("./helpers/testDatabase.js");
    const pool = await testPool();

    const batteryId = "SVC-LIFE-BAT-1";
    const serviceId = "SVC-LIFE-1";

    before(async () => {
      await pool.query(
        `INSERT INTO battery_models (model_id, category, series_count, parallel_count, cell_type, welding_type)
         VALUES ('SVC-LIFE-MODEL', 'Test', 2, 1, 'NMC', 'LASER')`
      );
      await pool.query(
        `INSERT INTO batteries (battery_id, model_id, barcode, serial_number, name, registration_origin)
         VALUES ($1, 'SVC-LIFE-MODEL', 'SVCB1', 'SVCBN1', 'Service Lifecycle Battery', 'digital_passport')`,
        [batteryId]
      );

      /* A real service row: battery_lifecycle_events.service_id carries a
         foreign key, so the bridge can only link a service that exists. */
      await pool.query(
        `INSERT INTO services (id, ticket_number, battery_id, mobile_number, status, priority)
         VALUES ($1, 'SRV-LIFE-0001', $2, '', 'Confirmed', 'Normal')`,
        [serviceId, batteryId]
      );

      await store.appendLifecycleEvent({
        batteryId,
        eventCode: "first_owner_registered",
        source: "admin",
        actor: "test",
        notes: "genesis",
      });
    });

    after(async () => {
      await pool.end().catch(() => {});
      await db.teardown();
    });

    test("a full service run lands on the passport as a verified chain", async () => {
      const service = { id: serviceId, batteryId, ticketNumber: "SRV-LIFE-0001", serviceType: "Repair" };

      const scheduled = await recordServiceTransition({
        store,
        service,
        fromStatus: null,
        toStatus: "Confirmed",
        actorRole: "USER",
        actorName: "Customer",
      });
      assert.equal(scheduled.recorded, true);
      assert.equal(scheduled.eventCode, "service_scheduled");

      /* A silent status in the middle of the run must not add noise. */
      const accepted = await recordServiceTransition({
        store,
        service,
        fromStatus: "Confirmed",
        toStatus: "Accepted",
        actorRole: "ADMIN",
      });
      assert.equal(accepted.recorded, false);
      assert.equal(accepted.reason, "status has no lifecycle meaning");

      const started = await recordServiceTransition({
        store,
        service,
        fromStatus: "Accepted",
        toStatus: "In Progress",
        actorRole: "EMPLOYEE",
        actorName: "Tech Nine",
      });
      assert.equal(started.recorded, true);
      assert.equal(started.source, "service_technician");

      const completed = await recordServiceTransition({
        store,
        service,
        fromStatus: "In Progress",
        toStatus: "Completed",
        actorRole: "ADMIN",
        actorName: "Admin",
      });
      assert.equal(completed.recorded, true);

      const events = await store.listLifecycleEvents(batteryId, { limit: 100 });
      const codes = events.map((e) => e.eventCode);
      assert.deepEqual(codes, [
        "service_completed",
        "service_started",
        "service_scheduled",
        "first_owner_registered",
      ]);

      /* The automatic event is a real ledger entry: the hash chain verifies,
         and it links back to the service that caused it. */
      const integrity = await store.verifyLifecycleChain(batteryId);
      assert.equal(integrity.valid, true, `chain broken: ${JSON.stringify(integrity)}`);

      const completedEvent = events.find((e) => e.eventCode === "service_completed");
      assert.equal(completedEvent.serviceId, serviceId);
      assert.equal(completedEvent.previousState, "In Progress");
      assert.equal(completedEvent.newState, "Completed");
      assert.equal(completedEvent.source, "admin");
      assert.equal(completedEvent.metadata.automatic, true);
      assert.equal(completedEvent.metadata.ticketNumber, "SRV-LIFE-0001");
    });

    test("the stage advances to Serviced", async () => {
      const summary = await store.getLifecycleSummary(batteryId);
      assert.equal(summary.lifecycleStage, "Serviced");
      assert.equal(summary.eventCount, 4);
      assert.equal(summary.chain.valid, true);
    });

    test("a service with no battery records nothing", async () => {
      const result = await recordServiceTransition({
        store,
        service: { id: "SVC-NO-BAT", ticketNumber: "SRV-NO-BAT" },
        fromStatus: "Assigned",
        toStatus: "Completed",
        actorRole: "ADMIN",
      });
      assert.equal(result.recorded, false);
      assert.equal(result.reason, "service has no battery");
    });

    test("a ledger rejection is reported, not thrown, and leaves a visible gap", async () => {
      const history = [];
      const stubStore = {
        appendLifecycleEvent: async () => {
          throw new Error("battery not found");
        },
        addServiceHistory: async (id, entry) => history.push({ id, ...entry }),
      };

      const result = await recordServiceTransition({
        store: stubStore,
        service: { id: "SVC-BROKEN", batteryId: "does-not-exist", ticketNumber: "SRV-BROKEN" },
        fromStatus: "Assigned",
        toStatus: "Completed",
        actorRole: "ADMIN",
        actorName: "Admin",
      });

      assert.equal(result.recorded, false);
      assert.match(result.reason, /battery not found/);
      /* The gap must be visible to an operator, not just swallowed. */
      assert.equal(history.length, 1);
      assert.equal(history[0].action, "Lifecycle ledger gap");
      assert.match(history[0].notes, /service_completed/);
    });

    test("automatic events cannot be edited or deleted", async () => {
      const events = await store.listLifecycleEvents(batteryId, { limit: 100 });
      const automatic = events.find((e) => e.metadata?.automatic === true);
      assert.ok(automatic, "expected at least one automatic event");

      /* The database, not the API surface, is what makes this true. */
      await assert.rejects(
        () =>
          pool.query(
            `UPDATE battery_lifecycle_events SET event_code = 'note' WHERE id = $1`,
            [automatic.id]
          ),
        /append-only|immutable|cannot/i
      );
      await assert.rejects(
        () => pool.query(`DELETE FROM battery_lifecycle_events WHERE id = $1`, [automatic.id]),
        /append-only|immutable|cannot/i
      );
    });
  }
);