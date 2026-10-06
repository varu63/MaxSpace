/* Battery registration / claim -> passport ledger tests.

   The interesting case is the distinction between "first recorded owner"
   and "ownership transferred". Getting it wrong would rewrite the history of
   a battery that predates the app. */
import { test, describe, after } from "node:test";
import assert from "node:assert/strict";

import {
  recordBatteryRegistration,
  recordBatteryClaim,
} from "../utils/batteryLifecycleBridge.js";
import { withOptionalTestDatabase } from "./helpers/testDatabase.js";

const db = await withOptionalTestDatabase(import.meta.url);

describe(
  "battery registration and claim recorded on the passport",
  { skip: db ? false : "no PostgreSQL database available" },
  async () => {
    const store = db.store;
    const { testPool } = await import("./helpers/testDatabase.js");
    const pool = await testPool();

    after(async () => {
      await pool.end().catch(() => {});
      await db.teardown();
    });

    const seedModel = async () => {
      await pool.query(
        `INSERT INTO battery_models (model_id, category, series_count, parallel_count, cell_type, welding_type)
         VALUES ('REG-MODEL', 'Test', 3, 2, 'NMC', 'LASER')
         ON CONFLICT (model_id) DO NOTHING`
      );
    };

    const mint = (id) =>
      store.createBattery({
        modelId: "REG-MODEL",
        name: `Registration Battery ${id}`,
        modelName: "Reg Model",
        barcode: `REGB-${id}`,
        serialNumber: `REGBSN-${id}`,
        ownerId: null,
      });

    test("a battery minted here records its origin as digital_passport", async () => {
      await seedModel();
      const battery = await mint("1");
      /* If this were left NULL, the legacy backfill could later assert the
         battery was imported from the manufacturing database — untrue. */
      const row = await pool.query(
        `SELECT registration_origin, lifecycle_stage FROM batteries WHERE battery_id = $1`,
        [battery.id]
      );
      assert.equal(row.rows[0].registration_origin, "digital_passport");
      assert.equal(row.rows[0].lifecycle_stage, "Unknown");
    });

    test("registration opens the ledger with first_owner_registered", async () => {
      const battery = await mint("2");
      const result = await recordBatteryRegistration({
        store,
        battery,
        actorName: "Owner One",
      });
      assert.equal(result.recorded, true);
      assert.equal(result.eventCode, "first_owner_registered");

      const events = await store.listLifecycleEvents(battery.id, { limit: 10 });
      assert.equal(events.length, 1);
      assert.equal(events[0].source, "user");
      assert.equal(events[0].metadata.automatic, true);
      assert.equal(events[0].metadata.channel, "registration");

      const integrity = await store.verifyLifecycleChain(battery.id);
      assert.equal(integrity.valid, true);

      /* A registered battery is in service with its owner. */
      const summary = await store.getLifecycleSummary(battery.id);
      assert.equal(summary.lifecycleStage, "InService");
    });

    test("claiming a battery with no history records a first owner", async () => {
      const battery = await mint("3");
      const result = await recordBatteryClaim({
        store,
        battery,
        previousOwnerId: null,
        actorName: "Owner Two",
      });
      assert.equal(result.eventCode, "first_owner_registered");
      assert.equal(result.recorded, true);
      assert.equal(result.event.metadata.hadPriorOwner, false);
    });

    test("claiming a battery that already has history records a transfer", async () => {
      const battery = await mint("4");

      /* A manufacturing record, as the backfill script or a manufacturer
         integration would have written. Note this is history but NOT
         ownership: the unit has never been owned by anyone in the ledger. */
      await store.appendLifecycleEvent({
        batteryId: battery.id,
        eventCode: "manufactured",
        source: "manufacturer_system",
        actor: "Factory",
        notes: "manufactured at plant",
      });

      const result = await recordBatteryClaim({
        store,
        battery,
        previousOwnerId: "user-maxvolt",
        newOwnerId: "owner-three",
        actorName: "Owner Three",
      });
      /* A manufacturing record is not a prior owner, so this is still the
         first owner — and "Manufactured -> OwnershipTransferred" is not even
         a legal stage move. */
      assert.equal(result.eventCode, "first_owner_registered");
      assert.equal(result.recorded, true);
      assert.equal(result.event.metadata.hadPriorOwner, false);

      const events = await store.listLifecycleEvents(battery.id, { limit: 10 });
      assert.deepEqual(
        events.map((e) => e.eventCode),
        ["first_owner_registered", "manufactured"]
      );
    });

    test("claiming a battery the ledger already attributes to someone is a transfer", async () => {
      const battery = await mint("5");

      /* Genuine prior custody recorded in the ledger's ownership history.
         The owner_id column has a foreign key, so the account must exist. */
      await store.createUser({
        id: "user-earlier",
        name: "Earlier Owner",
        email: "earlier@example.test",
        password: "Test-passw0rd!",
        role: "USER",
        createdAt: new Date().toISOString(),
      });
      await pool.query(
        `INSERT INTO battery_ownership_history
           (battery_id, owner_id, ownership_type, acquired_at, source)
         VALUES ($1, 'user-earlier', 'first_owner', now(), 'admin')`,
        [battery.id]
      );
      await store.appendLifecycleEvent({
        batteryId: battery.id,
        eventCode: "first_owner_registered",
        source: "admin",
        actor: "Admin",
      });

      const result = await recordBatteryClaim({
        store,
        battery,
        previousOwnerId: "user-earlier",
        newOwnerId: "owner-four",
        actorName: "Owner Four",
      });
      assert.equal(result.eventCode, "ownership_transferred");
      assert.equal(result.recorded, true);
      assert.equal(result.event.metadata.hadPriorOwner, true);
      assert.equal(result.event.previousState, "user-earlier");

      const events = await store.listLifecycleEvents(battery.id, { limit: 10 });
      assert.equal(events[0].eventCode, "ownership_transferred");
      assert.equal(
        (await store.verifyLifecycleChain(battery.id)).valid,
        true,
        "adding a claim must not break the chain"
      );
    });

    test("a battery with no identifier records nothing", async () => {
      const result = await recordBatteryRegistration({ store, battery: {} });
      assert.equal(result.recorded, false);
      assert.match(result.reason, /no identifier/);
    });

    test("a ledger rejection is reported, not thrown", async () => {
      const stub = {
        listLifecycleEvents: async () => [],
        appendLifecycleEvent: async () => {
          throw new Error("Battery nope not found");
        },
      };
      const result = await recordBatteryClaim({
        store: stub,
        battery: { id: "nope" },
      });
      assert.equal(result.recorded, false);
      assert.match(result.reason, /not found/);
    });
  }
);