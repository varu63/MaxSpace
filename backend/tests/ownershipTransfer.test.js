/* One-time QR ownership transfer tests.

   The feature's whole contract is in these assertions: the token is a
   bearer secret that exists only in the QR (only its SHA-256 is
   stored), it lives ten minutes, one battery has at most one live code,
   and acceptance is a single atomic swap — custody, the batteries row
   and the ledger either all move or none of them does.

   Also covers the shared ownership rules (utils/batteryAccess.js) the
   rest of the fleet API now leans on, because a broken denial there
   would silently widen who can touch a battery. */
import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import { withOptionalTestDatabase } from "./helpers/testDatabase.js";
import {
  BATTERY_ACCESS_DENIED_MESSAGE,
  assertBatteryAccess,
  assertBatteryWriteAccess,
  canAccessBattery,
} from "../utils/batteryAccess.js";

const db = await withOptionalTestDatabase(import.meta.url);

const rejectsWith = (statusCode, code) => (error) => {
  assert.equal(error.statusCode, statusCode, `expected ${statusCode}, got ${error.statusCode}: ${error.message}`);
  if (code) assert.equal(error.code, code, `expected code ${code}, got ${error.code}`);
  return true;
};

describe(
  "one-time QR ownership transfer",
  { skip: db ? false : "no PostgreSQL database available" },
  async () => {
    const store = db.store;
    const { testPool } = await import("./helpers/testDatabase.js");
    const pool = await testPool();

    after(async () => {
      await pool.end().catch(() => {});
      await db.teardown();
    });

    const sha256 = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");

    const createUser = (id, name) =>
      store.createUser({
        id,
        name,
        email: `${id}@example.test`,
        password: "Test-passw0rd!",
        role: "USER",
        createdAt: new Date().toISOString(),
      });

    const seedModel = async () => {
      await pool.query(
        `INSERT INTO battery_models (model_id, category, series_count, parallel_count, cell_type, welding_type)
         VALUES ('xfer-model', 'Test', 3, 2, 'NMC', 'LASER')
         ON CONFLICT (model_id) DO NOTHING`
      );
    };

    const mintBattery = (id, ownerId) =>
      store.createBattery({
        modelId: "xfer-model",
        name: `Transfer Battery ${id}`,
        modelName: "Xfer Model",
        barcode: `XFER-${id}`,
        serialNumber: `XFER-SN-${id}`,
        ownerId,
      });

    let owner;
    let receiver;
    let stranger;

    test("setup: accounts and a battery owned by the first account", async () => {
      await seedModel();
      owner = await createUser("xfer-owner", "Olive Owner");
      receiver = await createUser("xfer-receiver", "Ravi Receiver");
      stranger = await createUser("xfer-stranger", "Sam Stranger");
      assert.ok(owner.id && receiver.id && stranger.id);
    });

    /* ---------- minting ---------- */

    test("minting stores only the hash of the token, never the token", async () => {
      const battery = await mintBattery("m1", owner.id);
      const { token, transfer } = await store.createOwnershipTransfer({
        batteryId: battery.id,
        previousOwnerId: owner.id,
      });

      assert.match(token, /^[A-Za-z0-9_-]{43}$/, "32 random bytes, base64url");
      assert.equal(transfer.status, "pending");

      const row = await pool.query(
        `SELECT token_hash, status, previous_owner_id FROM battery_ownership_transfers WHERE id = $1`,
        [transfer.id]
      );
      assert.equal(row.rows[0].token_hash, sha256(token));
      assert.notEqual(row.rows[0].token_hash, token);
      assert.equal(row.rows[0].previous_owner_id, owner.id);
    });

    test("a non-owner cannot mint a transfer for someone else's battery", async () => {
      const battery = await mintBattery("m2", owner.id);
      await assert.rejects(
        store.createOwnershipTransfer({ batteryId: battery.id, previousOwnerId: receiver.id }),
        rejectsWith(403, "forbidden")
      );
    });

    test("an unowned battery has nothing to transfer", async () => {
      const battery = await mintBattery("m3", null);
      await assert.rejects(
        store.createOwnershipTransfer({ batteryId: battery.id, previousOwnerId: owner.id }),
        rejectsWith(400, "validation")
      );
    });

    /* ---------- reading ---------- */

    test("reading by token returns the transfer; an unknown token is 404", async () => {
      const battery = await mintBattery("r1", owner.id);
      const { token } = await store.createOwnershipTransfer({
        batteryId: battery.id,
        previousOwnerId: owner.id,
      });

      const seen = await store.getOwnershipTransferByToken(token);
      assert.equal(seen.status, "pending");
      assert.equal(seen.batteryId, battery.id);
      assert.equal(seen.batteryModel, "Xfer Model");
      assert.equal(seen.previousOwnerId, owner.id);

      await assert.rejects(
        store.getOwnershipTransferByToken("not-a-real-token"),
        rejectsWith(404, "not_found")
      );
    });

    test("reading does not consume the code", async () => {
      const battery = await mintBattery("r2", owner.id);
      const { token } = await store.createOwnershipTransfer({
        batteryId: battery.id,
        previousOwnerId: owner.id,
      });

      const first = await store.getOwnershipTransferByToken(token);
      const second = await store.getOwnershipTransferByToken(token);
      assert.equal(first.status, "pending");
      assert.equal(second.status, "pending");
    });

    /* ---------- expiry ---------- */

    test("an expired code reads as expired and cannot be accepted", async () => {
      const battery = await mintBattery("e1", owner.id);
      const { token } = await store.createOwnershipTransfer({
        batteryId: battery.id,
        previousOwnerId: owner.id,
        ttlMs: -1000,
      });

      const seen = await store.getOwnershipTransferByToken(token);
      assert.equal(seen.status, "expired");
      const persisted = await pool.query(
        `SELECT status FROM battery_ownership_transfers WHERE token_hash = $1`,
        [sha256(token)]
      );
      assert.equal(persisted.rows[0].status, "expired");

      await assert.rejects(
        store.acceptOwnershipTransfer({ token, newOwnerId: receiver.id }),
        rejectsWith(410, "transfer_expired")
      );
      const after = await pool.query(`SELECT owner_id FROM batteries WHERE battery_id = $1`, [battery.id]);
      assert.equal(after.rows[0].owner_id, owner.id, "ownership must be untouched");
    });

    /* ---------- one live code per battery ---------- */

    test("a second mint supersedes the first, and the old code is dead", async () => {
      const battery = await mintBattery("s1", owner.id);
      const first = await store.createOwnershipTransfer({
        batteryId: battery.id,
        previousOwnerId: owner.id,
      });
      const second = await store.createOwnershipTransfer({
        batteryId: battery.id,
        previousOwnerId: owner.id,
      });

      const pending = await pool.query(
        `SELECT status FROM battery_ownership_transfers WHERE battery_id = $1 AND status = 'pending'`,
        [battery.id]
      );
      assert.equal(pending.rowCount, 1, "the partial unique index allows one live code");

      await assert.rejects(
        store.acceptOwnershipTransfer({ token: first.token, newOwnerId: receiver.id }),
        rejectsWith(409, "transfer_cancelled")
      );
      assert.ok(second.token && second.token !== first.token);
    });

    /* ---------- acceptance ---------- */

    test("accepting swaps custody atomically and writes the audit trail", async () => {
      const battery = await mintBattery("a1", owner.id);
      /* Batteries minted through createBattery have no custody period yet —
         one is opened when custody is first recorded (admin transfer,
         claim with history). Seed the owner's open period the same way
         those paths do, so the close-the-old / open-the-new pair is what
         is under test. */
      await pool.query(
        `INSERT INTO battery_ownership_history
           (battery_id, owner_id, owner_name, owner_email, ownership_type, acquired_at, source)
         VALUES ($1, $2, $3, $4, 'first_owner', now() - interval '7 days', 'admin')`,
        [battery.id, owner.id, owner.name, `${owner.id}@example.test`]
      );
      const { token } = await store.createOwnershipTransfer({
        batteryId: battery.id,
        previousOwnerId: owner.id,
      });

      const result = await store.acceptOwnershipTransfer({ token, newOwnerId: receiver.id });

      // The batteries row is the current-state authority.
      const row = await pool.query(
        `SELECT owner_id, owner_organization_id, lifecycle_stage FROM batteries WHERE battery_id = $1`,
        [battery.id]
      );
      assert.equal(row.rows[0].owner_id, receiver.id);
      assert.equal(row.rows[0].lifecycle_stage, "OwnershipTransferred");

      // Custody: the old period is closed, the new one is open.
      const periods = await pool.query(
        `SELECT owner_id, released_at, ownership_type, source
           FROM battery_ownership_history WHERE battery_id = $1 ORDER BY acquired_at`,
        [battery.id]
      );
      assert.equal(periods.rowCount, 2);
      assert.equal(periods.rows[0].owner_id, owner.id);
      assert.ok(periods.rows[0].released_at, "previous custody period must be closed");
      assert.equal(periods.rows[1].owner_id, receiver.id);
      assert.equal(periods.rows[1].released_at, null);
      assert.equal(periods.rows[1].ownership_type, "transfer");
      assert.equal(periods.rows[1].source, "user");

      // The transfer row itself is the record of who gave it away.
      assert.equal(result.transfer.status, "accepted");
      assert.equal(result.transfer.previousOwnerId, owner.id);
      assert.equal(result.transfer.newOwnerId, receiver.id);
      assert.equal(result.transfer.acceptedBy, receiver.id);
      assert.ok(result.transfer.acceptedAt);

      // The ledger records the event and its hash chain still verifies.
      assert.equal(result.event.eventCode, "ownership_transferred");
      assert.equal((await store.verifyLifecycleChain(battery.id)).valid, true);
      assert.equal(result.ownership.ownerId, receiver.id);
    });

    test("a spent code cannot be used twice", async () => {
      const battery = await mintBattery("a2", owner.id);
      const { token } = await store.createOwnershipTransfer({
        batteryId: battery.id,
        previousOwnerId: owner.id,
      });

      await store.acceptOwnershipTransfer({ token, newOwnerId: receiver.id });
      await assert.rejects(
        store.acceptOwnershipTransfer({ token, newOwnerId: stranger.id }),
        rejectsWith(409, "transfer_already_used")
      );

      const row = await pool.query(`SELECT owner_id FROM batteries WHERE battery_id = $1`, [battery.id]);
      assert.equal(row.rows[0].owner_id, receiver.id, "the second accept must change nothing");
    });

    test("the starting owner cannot accept their own transfer", async () => {
      const battery = await mintBattery("a3", owner.id);
      const { token } = await store.createOwnershipTransfer({
        batteryId: battery.id,
        previousOwnerId: owner.id,
      });

      await assert.rejects(
        store.acceptOwnershipTransfer({ token, newOwnerId: owner.id }),
        rejectsWith(403, "own_transfer")
      );
      const row = await pool.query(`SELECT owner_id FROM batteries WHERE battery_id = $1`, [battery.id]);
      assert.equal(row.rows[0].owner_id, owner.id);
    });

    test("a battery that changed hands since the mint cannot be accepted", async () => {
      const battery = await mintBattery("a4", owner.id);
      const { token } = await store.createOwnershipTransfer({
        batteryId: battery.id,
        previousOwnerId: owner.id,
      });

      // Somebody else takes custody between mint and accept (admin action,
      // a claim, anything) — the QR must not still work.
      await pool.query(`UPDATE batteries SET owner_id = $1 WHERE battery_id = $2`, [
        stranger.id,
        battery.id,
      ]);

      await assert.rejects(
        store.acceptOwnershipTransfer({ token, newOwnerId: receiver.id }),
        rejectsWith(409, "ownership_conflict")
      );
      const row = await pool.query(`SELECT owner_id FROM batteries WHERE battery_id = $1`, [battery.id]);
      assert.equal(row.rows[0].owner_id, stranger.id, "conflict must not overwrite the new owner");
    });

    /* ---------- cancellation ---------- */

    test("only the owner who minted it can cancel, and a cancelled code is dead", async () => {
      const battery = await mintBattery("c1", owner.id);
      const { token } = await store.createOwnershipTransfer({
        batteryId: battery.id,
        previousOwnerId: owner.id,
      });

      await assert.rejects(
        store.cancelOwnershipTransfer({ token, userId: receiver.id }),
        rejectsWith(403, "forbidden")
      );

      const cancelled = await store.cancelOwnershipTransfer({ token, userId: owner.id });
      assert.equal(cancelled.status, "cancelled");
      assert.ok(cancelled.cancelledAt);

      await assert.rejects(
        store.acceptOwnershipTransfer({ token, newOwnerId: receiver.id }),
        rejectsWith(409, "transfer_cancelled")
      );
      await assert.rejects(
        store.cancelOwnershipTransfer({ token, userId: owner.id }),
        rejectsWith(409, "transfer_cancelled")
      );
    });

    /* ---------- shared ownership rules ---------- */

    describe("ownership rules", () => {
      const owned = { id: "batt-1", ownerId: "user-a" };
      const unowned = { id: "batt-2", ownerId: null };
      const placeholder = { id: "batt-3", ownerId: "user-maxvolt" };

      test("anonymous is the public passport flow", () => {
        assert.equal(canAccessBattery({ user: undefined }, owned), true);
      });

      test("operators see the fleet", () => {
        assert.equal(canAccessBattery({ user: { id: "op", role: "ADMIN" } }, owned), true);
        assert.equal(canAccessBattery({ user: { id: "op", role: "EMPLOYEE" } }, owned), true);
      });

      test("the owner is allowed, anyone else is not", () => {
        assert.equal(canAccessBattery({ user: { id: "user-a", role: "USER" } }, owned), true);
        assert.equal(canAccessBattery({ user: { id: "user-b", role: "USER" } }, owned), false);
      });

      test("unclaimed and placeholder batteries stay open to customers", () => {
        const customer = { user: { id: "user-b", role: "USER" } };
        assert.equal(canAccessBattery(customer, unowned), true);
        assert.equal(canAccessBattery(customer, placeholder), true);
      });

      test("an external partner never inherits access through ownership", () => {
        const partner = { user: { id: "ptr-1", role: "PARTNER" } };
        assert.equal(canAccessBattery(partner, owned), false);
        assert.equal(canAccessBattery(partner, unowned), false);
      });

      test("a denial names what actually happened", () => {
        assert.throws(
          () => assertBatteryAccess({ user: { id: "user-b", role: "USER" } }, owned),
          (error) =>
            error.statusCode === 403 &&
            error.code === "forbidden" &&
            error.message === BATTERY_ACCESS_DENIED_MESSAGE
        );
      });

      test("writes are stricter: an unclaimed battery belongs to nobody", () => {
        const customer = { user: { id: "user-b", role: "USER" } };
        assert.throws(() => assertBatteryWriteAccess(customer, unowned));

        const owner = { user: { id: "user-a", role: "USER" } };
        assert.equal(assertBatteryWriteAccess(owner, owned), owned, "the owner may write");
        assert.throws(() => assertBatteryWriteAccess(owner, unowned));

        const admin = { user: { id: "op", role: "ADMIN" } };
        assert.equal(assertBatteryWriteAccess(admin, unowned), unowned, "operators may write");
      });
    });
  }
);
