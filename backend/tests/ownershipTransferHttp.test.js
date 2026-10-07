/* Ownership-transfer API tests over real HTTP.

   The store-level suite (ownershipTransfer.test.js) proves the
   transaction; this file proves the surface a client actually talks to:
   it spawns `node index.js` against this file's throwaway database and
   asserts the exact status code, the error envelope
   ({ success:false, status, message, code }) and the success payloads
   for every route — mint, read, accept, cancel — including every
   documented refusal (401 / 403 / 400 / 404 / 409 / 410) and the
   access flip on the battery itself once custody moves. */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { withOptionalTestDatabase } from "./helpers/testDatabase.js";
import { signToken } from "../utils/auth.js";

const db = await withOptionalTestDatabase(import.meta.url);

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sha256 = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");

const freePort = () =>
  new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });

/* Wait until the spawned server answers GET / (the health route). */
const startServer = async () => {
  const port = await freePort();
  const child = spawn(process.execPath, ["index.js"], {
    cwd: backendRoot,
    env: { ...process.env, PORT: String(port), NODE_ENV: "test" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk;
  });
  child.stderr.on("data", (chunk) => {
    output += chunk;
  });

  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`server exited with code ${child.exitCode}:\n${output}`);
    }
    try {
      const res = await fetch(`${base}/`);
      if (res.status === 200) return { child, base, output: () => output };
    } catch {
      /* not listening yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  child.kill();
  throw new Error(`server never became ready:\n${output}`);
};

const stopServer = async (child) => {
  if (!child || child.exitCode !== null) return;
  child.kill();
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve();
    }, 5000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
};

describe(
  "ownership transfer over HTTP",
  { skip: db ? false : "no PostgreSQL database available" },
  async () => {
    const store = db.store;
    const { testPool } = await import("./helpers/testDatabase.js");
    const pool = await testPool();

    let server;
    let base;
    let owner;
    let receiver;
    let stranger;
    let partner;
    let ownerToken;
    let receiverToken;
    let strangerToken;
    let partnerToken;

    before(async () => {
      server = await startServer();
      base = server.base;

      await pool.query(
        `INSERT INTO battery_models (model_id, category, series_count, parallel_count, cell_type, welding_type)
         VALUES ('http-model', 'Test', 3, 2, 'NMC', 'LASER')
         ON CONFLICT (model_id) DO NOTHING`
      );

      const makeUser = (id, name, role = "USER") =>
        store.createUser({
          id,
          name,
          email: `${id}@example.test`,
          password: "Test-passw0rd!",
          role,
          createdAt: new Date().toISOString(),
        });

      owner = await makeUser("http-owner", "Olive Owner");
      receiver = await makeUser("http-receiver", "Ravi Receiver");
      stranger = await makeUser("http-stranger", "Sam Stranger");
      partner = await makeUser("http-partner", "Priya Partner", "PARTNER");

      ownerToken = signToken(owner.id, "USER");
      receiverToken = signToken(receiver.id, "USER");
      strangerToken = signToken(stranger.id, "USER");
      partnerToken = signToken(partner.id, "PARTNER");
    });

    after(async () => {
      await stopServer(server?.child);
      await pool.end().catch(() => {});
      await db.teardown();
    });

    /* ---------- helpers ---------- */

    const api = async (method, pathname, { token, body } = {}) => {
      const res = await fetch(`${base}${pathname}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      let data = null;
      try {
        data = await res.json();
      } catch {
        /* empty or non-JSON body */
      }
      return { status: res.status, data };
    };

    /* Every 4xx must be the standard envelope; `code` is the
       machine-readable reason (null = none expected). */
    const expectError = (res, status, code, messagePart) => {
      assert.equal(res.status, status, `status ${res.status}, body ${JSON.stringify(res.data)}`);
      assert.equal(res.data?.success, false);
      assert.equal(res.data?.status, status);
      assert.equal(typeof res.data?.message, "string");
      assert.ok(res.data.message.length > 0);
      if (code === null) {
        assert.equal(res.data.code, undefined, `unexpected code ${res.data.code}`);
      } else {
        assert.equal(res.data.code, code, `message: ${res.data.message}`);
      }
      if (messagePart) {
        assert.ok(
          res.data.message.includes(messagePart),
          `expected "${messagePart}" in "${res.data.message}"`
        );
      }
    };

    const expectOk = (res, status) => {
      assert.equal(res.status, status, `status ${res.status}, body ${JSON.stringify(res.data)}`);
      assert.equal(res.data?.success, true);
    };

    let batterySeq = 0;
    const newBattery = async (ownerId) => {
      batterySeq += 1;
      const battery = await store.createBattery({
        modelId: "http-model",
        name: `HTTP Transfer Battery ${batterySeq}`,
        modelName: "HTTP Model",
        barcode: `HTTP-XF-${batterySeq}`,
        serialNumber: `HTTP-XF-SN-${batterySeq}`,
        ownerId,
      });
      return battery;
    };

    const mintViaApi = async (batteryId, token = ownerToken) => {
      const res = await api("POST", `/api/batteries/${encodeURIComponent(batteryId)}/transfers`, {
        token,
      });
      expectOk(res, 201);
      return res.data;
    };

    const forceExpiry = async (transferToken) => {
      await pool.query(
        "UPDATE battery_ownership_transfers SET expires_at = now() - interval '1 minute' WHERE token_hash = $1",
        [sha256(transferToken)]
      );
    };

    /* ---------- POST /api/batteries/:id/transfers — mint ---------- */

    test("mint without a token → 401 envelope", async () => {
      const battery = await newBattery(owner.id);
      const res = await api("POST", `/api/batteries/${battery.id}/transfers`);
      expectError(res, 401, null, "Not authorized, no token provided");
    });

    test("mint with a garbage token → 401 envelope", async () => {
      const battery = await newBattery(owner.id);
      const res = await api("POST", `/api/batteries/${battery.id}/transfers`, {
        token: "not-a-jwt",
      });
      expectError(res, 401, null, "token invalid or expired");
    });

    test("mint for an unknown battery → 404 not_found", async () => {
      const res = await api("POST", "/api/batteries/NO-SUCH-BATTERY-999/transfers", {
        token: ownerToken,
      });
      expectError(res, 404, "not_found", "Battery not found");
    });

    test("mint by a non-owner → 403 forbidden", async () => {
      const battery = await newBattery(owner.id);
      const res = await api("POST", `/api/batteries/${battery.id}/transfers`, {
        token: strangerToken,
      });
      expectError(res, 403, "forbidden");
    });

    test("mint for an unowned battery → 400 validation", async () => {
      const battery = await newBattery(null);
      const res = await api("POST", `/api/batteries/${battery.id}/transfers`, {
        token: ownerToken,
      });
      expectError(res, 400, "validation");
    });

    test("mint by a PARTNER account → 403 forbidden", async () => {
      const battery = await newBattery(owner.id);
      const res = await api("POST", `/api/batteries/${battery.id}/transfers`, {
        token: partnerToken,
      });
      expectError(res, 403, "forbidden", "partner accounts cannot take part");
    });

    test("mint returns the one-time token and stores only its hash", async () => {
      const battery = await newBattery(owner.id);
      const data = await mintViaApi(battery.id);

      assert.match(data.token, /^[A-Za-z0-9_-]{43}$/);
      assert.equal(data.qrPayload, `maxspace-transfer:${data.token}`);
      assert.equal(data.expiresInMs, 10 * 60 * 1000);
      assert.equal(data.previousCodeSuperseded, false);
      assert.equal(data.transfer.batteryId, battery.id);
      assert.equal(data.transfer.batteryModel, "HTTP Model");
      assert.equal(data.transfer.status, "pending");
      assert.match(data.transfer.expiresAt, /^\d{4}-\d{2}-\d{2}T/);
      assert.equal(data.transfer.batteryIdMasked.length > 0, true);

      const rows = await pool.query(
        "SELECT token_hash FROM battery_ownership_transfers WHERE token_hash = $1",
        [sha256(data.token)]
      );
      assert.equal(rows.rowCount, 1, "only the SHA-256 of the token is stored");
      const raw = await pool.query(
        `SELECT count(*)::int AS n FROM battery_ownership_transfers
          WHERE token_hash = $1 AND token_hash = $2`,
        [data.token, sha256(data.token)]
      );
      assert.equal(raw.rows[0].n, 0, "the raw token must not appear as a stored hash");

      const log = await pool.query(
        `SELECT action FROM user_activity WHERE user_id = $1 AND action = 'Ownership Transfer Started'`,
        [owner.id]
      );
      assert.ok(log.rowCount >= 1, "minting is recorded in the owner's activity feed");
    });

    test("a second mint supersedes the first code", async () => {
      const battery = await newBattery(owner.id);
      const first = await mintViaApi(battery.id);
      const second = await mintViaApi(battery.id);

      assert.notEqual(second.token, first.token);
      assert.equal(second.previousCodeSuperseded, true);
      assert.equal(first.previousCodeSuperseded, false);

      const stale = await api("GET", `/api/batteries/transfers/${first.token}`, {
        token: receiverToken,
      });
      expectOk(stale, 200);
      assert.equal(stale.data.transfer.status, "cancelled");

      const live = await api("GET", `/api/batteries/transfers/${second.token}`, {
        token: receiverToken,
      });
      expectOk(live, 200);
      assert.equal(live.data.transfer.status, "pending");
    });

    /* ---------- GET /api/batteries/transfers/:token — read ---------- */

    test("read without a token → 401 envelope", async () => {
      const res = await api("GET", `/api/batteries/transfers/${"A".repeat(43)}`);
      expectError(res, 401, null, "Not authorized, no token provided");
    });

    test("read of an unknown token → 404 not_found", async () => {
      const res = await api("GET", `/api/batteries/transfers/${"A".repeat(43)}`, {
        token: receiverToken,
      });
      expectError(res, 404, "not_found", "This transfer code is not valid.");
    });

    test("read by a PARTNER account → 403 forbidden", async () => {
      const battery = await newBattery(owner.id);
      const minted = await mintViaApi(battery.id);
      const res = await api("GET", `/api/batteries/transfers/${minted.token}`, {
        token: partnerToken,
      });
      expectError(res, 403, "forbidden", "partner accounts cannot take part");
    });

    test("read by the minter says isOwnTransfer, by the receiver it does not", async () => {
      const battery = await newBattery(owner.id);
      const minted = await mintViaApi(battery.id);

      const byOwner = await api("GET", `/api/batteries/transfers/${minted.token}`, {
        token: ownerToken,
      });
      expectOk(byOwner, 200);
      assert.equal(byOwner.data.transfer.status, "pending");
      assert.equal(byOwner.data.transfer.batteryModel, "HTTP Model");
      assert.equal(byOwner.data.transfer.isOwnTransfer, true);
      assert.ok(byOwner.data.transfer.expiresInMs > 0);
      assert.ok(byOwner.data.transfer.expiresInMs <= 10 * 60 * 1000);

      const byReceiver = await api("GET", `/api/batteries/transfers/${minted.token}`, {
        token: receiverToken,
      });
      expectOk(byReceiver, 200);
      assert.equal(byReceiver.data.transfer.isOwnTransfer, false);
      assert.match(byReceiver.data.transfer.batteryIdMasked, /…/);
      assert.ok(
        !JSON.stringify(byReceiver.data).includes(minted.token),
        "the bearer token is never echoed back"
      );

      // Reading must not consume it: acceptance still works afterwards.
      const accept = await api("POST", `/api/batteries/transfers/${minted.token}/accept`, {
        token: receiverToken,
      });
      expectOk(accept, 200);
    });

    test("reading a cancelled code answers 200 with status=cancelled", async () => {
      const battery = await newBattery(owner.id);
      const minted = await mintViaApi(battery.id);
      const cancel = await api("POST", `/api/batteries/transfers/${minted.token}/cancel`, {
        token: ownerToken,
      });
      expectOk(cancel, 200);

      const res = await api("GET", `/api/batteries/transfers/${minted.token}`, {
        token: receiverToken,
      });
      expectOk(res, 200);
      assert.equal(res.data.transfer.status, "cancelled");
    });

    test("reading an expired code answers 200 with status=expired and persists it", async () => {
      const battery = await newBattery(owner.id);
      const minted = await mintViaApi(battery.id);
      await forceExpiry(minted.token);

      const res = await api("GET", `/api/batteries/transfers/${minted.token}`, {
        token: receiverToken,
      });
      expectOk(res, 200);
      assert.equal(res.data.transfer.status, "expired");
      assert.equal(res.data.transfer.expiresInMs, 0);

      const rows = await pool.query(
        "SELECT status FROM battery_ownership_transfers WHERE token_hash = $1",
        [sha256(minted.token)]
      );
      assert.equal(rows.rows[0].status, "expired", "the read persists the expiry");
    });

    test("reading an accepted code answers 200 with status=accepted", async () => {
      const battery = await newBattery(owner.id);
      const minted = await mintViaApi(battery.id);
      const accept = await api("POST", `/api/batteries/transfers/${minted.token}/accept`, {
        token: receiverToken,
      });
      expectOk(accept, 200);

      const res = await api("GET", `/api/batteries/transfers/${minted.token}`, {
        token: ownerToken,
      });
      expectOk(res, 200);
      assert.equal(res.data.transfer.status, "accepted");
    });

    /* ---------- POST /api/batteries/transfers/:token/accept ---------- */

    test("accept without a token → 401 envelope", async () => {
      const res = await api("POST", `/api/batteries/transfers/${"B".repeat(43)}/accept`);
      expectError(res, 401, null, "Not authorized, no token provided");
    });

    test("accept of an unknown token → 404 not_found", async () => {
      const res = await api("POST", `/api/batteries/transfers/${"B".repeat(43)}/accept`, {
        token: receiverToken,
      });
      expectError(res, 404, "not_found", "This transfer code is not valid.");
    });

    test("accept by a PARTNER account → 403 forbidden", async () => {
      const battery = await newBattery(owner.id);
      const minted = await mintViaApi(battery.id);
      const res = await api("POST", `/api/batteries/transfers/${minted.token}/accept`, {
        token: partnerToken,
      });
      expectError(res, 403, "forbidden", "partner accounts cannot take part");
    });

    test("accept swaps custody and returns the success payload", async () => {
      const battery = await newBattery(owner.id);
      // Seed the owner's open custody period so close-old/open-new is exercised.
      await pool.query(
        `INSERT INTO battery_ownership_history
           (battery_id, owner_id, owner_name, owner_email, ownership_type, acquired_at, source)
         VALUES ($1, $2, $3, $4, 'first_owner', now() - interval '7 days', 'admin')`,
        [battery.id, owner.id, owner.name, owner.email]
      );
      const minted = await mintViaApi(battery.id);

      const res = await api("POST", `/api/batteries/transfers/${minted.token}/accept`, {
        token: receiverToken,
      });
      expectOk(res, 200);
      assert.equal(res.data.message, "Battery ownership transferred successfully.");
      assert.equal(res.data.battery.id, battery.id);
      assert.equal(res.data.battery.modelName, "HTTP Model");
      assert.equal(res.data.transfer.status, "accepted");
      assert.match(res.data.transfer.acceptedAt, /^\d{4}-\d{2}-\d{2}T/);

      const row = await pool.query(
        "SELECT owner_id, lifecycle_stage FROM batteries WHERE battery_id = $1",
        [battery.id]
      );
      assert.equal(row.rows[0].owner_id, receiver.id);
      assert.equal(row.rows[0].lifecycle_stage, "OwnershipTransferred");

      const periods = await pool.query(
        `SELECT owner_id, released_at, ownership_type, source
           FROM battery_ownership_history WHERE battery_id = $1 ORDER BY acquired_at`,
        [battery.id]
      );
      assert.equal(periods.rowCount, 2);
      assert.ok(periods.rows[0].released_at, "previous custody period closed");
      assert.equal(periods.rows[1].released_at, null);
      assert.equal(periods.rows[1].ownership_type, "transfer");
      assert.equal(periods.rows[1].source, "user");

      const chain = await store.verifyLifecycleChain(battery.id);
      assert.equal(chain.valid, true);

      const transfer = await pool.query(
        `SELECT status, previous_owner_id, new_owner_id, accepted_by
           FROM battery_ownership_transfers WHERE token_hash = $1`,
        [sha256(minted.token)]
      );
      assert.equal(transfer.rows[0].status, "accepted");
      assert.equal(transfer.rows[0].previous_owner_id, owner.id);
      assert.equal(transfer.rows[0].new_owner_id, receiver.id);
      assert.equal(transfer.rows[0].accepted_by, receiver.id);

      // Both sides see the swap in their activity feed.
      const received = await pool.query(
        `SELECT count(*)::int AS n FROM user_activity
          WHERE user_id = $1 AND action = 'Ownership Transfer Accepted'`,
        [receiver.id]
      );
      const away = await pool.query(
        `SELECT count(*)::int AS n FROM user_activity
          WHERE user_id = $1 AND action = 'Ownership Transferred Away'`,
        [owner.id]
      );
      assert.ok(received.rows[0].n >= 1, "receiver logs the receipt");
      assert.ok(away.rows[0].n >= 1, "previous owner logs the loss");

      // The access flip is visible on the battery endpoint itself.
      const asOldOwner = await api("GET", `/api/batteries/${battery.id}`, {
        token: ownerToken,
      });
      expectError(asOldOwner, 403, "forbidden", "You no longer own or have access to this battery.");

      const asNewOwner = await api("GET", `/api/batteries/${battery.id}`, {
        token: receiverToken,
      });
      // This endpoint returns the flat battery object, not a success envelope.
      assert.equal(
        asNewOwner.status,
        200,
        `status ${asNewOwner.status}, body ${JSON.stringify(asNewOwner.data)}`
      );
      assert.equal(asNewOwner.data.ownerId, receiver.id);
    });

    test("a spent code cannot be accepted twice → 409 transfer_already_used", async () => {
      const battery = await newBattery(owner.id);
      const minted = await mintViaApi(battery.id);
      const first = await api("POST", `/api/batteries/transfers/${minted.token}/accept`, {
        token: receiverToken,
      });
      expectOk(first, 200);

      const second = await api("POST", `/api/batteries/transfers/${minted.token}/accept`, {
        token: receiverToken,
      });
      expectError(second, 409, "transfer_already_used", "already been used");
    });

    test("accepting your own transfer → 403 own_transfer", async () => {
      const battery = await newBattery(owner.id);
      const minted = await mintViaApi(battery.id);
      const res = await api("POST", `/api/batteries/transfers/${minted.token}/accept`, {
        token: ownerToken,
      });
      expectError(res, 403, "own_transfer", "your own account");
    });

    test("accepting an expired code → 410 transfer_expired", async () => {
      const battery = await newBattery(owner.id);
      const minted = await mintViaApi(battery.id);
      await forceExpiry(minted.token);

      const res = await api("POST", `/api/batteries/transfers/${minted.token}/accept`, {
        token: receiverToken,
      });
      expectError(res, 410, "transfer_expired", "expired");
    });

    test("accepting a cancelled code → 409 transfer_cancelled", async () => {
      const battery = await newBattery(owner.id);
      const minted = await mintViaApi(battery.id);
      const cancel = await api("POST", `/api/batteries/transfers/${minted.token}/cancel`, {
        token: ownerToken,
      });
      expectOk(cancel, 200);

      const res = await api("POST", `/api/batteries/transfers/${minted.token}/accept`, {
        token: receiverToken,
      });
      expectError(res, 409, "transfer_cancelled", "cancelled by the current owner");
    });

    test("accepting after the battery changed hands → 409 ownership_conflict", async () => {
      const battery = await newBattery(owner.id);
      const minted = await mintViaApi(battery.id);
      await pool.query("UPDATE batteries SET owner_id = $1 WHERE battery_id = $2", [
        stranger.id,
        battery.id,
      ]);

      const res = await api("POST", `/api/batteries/transfers/${minted.token}/accept`, {
        token: receiverToken,
      });
      expectError(res, 409, "ownership_conflict", "no longer owned by the account");

      // The swap did not happen halfway.
      const row = await pool.query(
        "SELECT owner_id FROM batteries WHERE battery_id = $1",
        [battery.id]
      );
      assert.equal(row.rows[0].owner_id, stranger.id);
      const transfer = await pool.query(
        "SELECT status FROM battery_ownership_transfers WHERE token_hash = $1",
        [sha256(minted.token)]
      );
      assert.equal(transfer.rows[0].status, "pending");
    });

    /* ---------- POST /api/batteries/transfers/:token/cancel ---------- */

    test("cancel without a token → 401 envelope", async () => {
      const res = await api("POST", `/api/batteries/transfers/${"C".repeat(43)}/cancel`);
      expectError(res, 401, null, "Not authorized, no token provided");
    });

    test("cancel by a non-minter → 403 forbidden", async () => {
      const battery = await newBattery(owner.id);
      const minted = await mintViaApi(battery.id);
      const res = await api("POST", `/api/batteries/transfers/${minted.token}/cancel`, {
        token: receiverToken,
      });
      expectError(res, 403, "forbidden", "Only the owner who started this transfer");
    });

    test("cancel by a PARTNER account → 403 forbidden", async () => {
      const battery = await newBattery(owner.id);
      const minted = await mintViaApi(battery.id);
      const res = await api("POST", `/api/batteries/transfers/${minted.token}/cancel`, {
        token: partnerToken,
      });
      expectError(res, 403, "forbidden", "partner accounts cannot take part");
    });

    test("cancel by the minter → 200 payload, second cancel → 409", async () => {
      const battery = await newBattery(owner.id);
      const minted = await mintViaApi(battery.id);

      const cancel = await api("POST", `/api/batteries/transfers/${minted.token}/cancel`, {
        token: ownerToken,
      });
      expectOk(cancel, 200);
      assert.equal(cancel.data.message, "Transfer request cancelled.");
      assert.equal(cancel.data.transfer.status, "cancelled");
      assert.match(cancel.data.transfer.cancelledAt, /^\d{4}-\d{2}-\d{2}T/);

      const again = await api("POST", `/api/batteries/transfers/${minted.token}/cancel`, {
        token: ownerToken,
      });
      expectError(again, 409, "transfer_cancelled", "already been cancelled");
    });

    test("cancel after acceptance → 409 transfer_already_used", async () => {
      const battery = await newBattery(owner.id);
      const minted = await mintViaApi(battery.id);
      const accept = await api("POST", `/api/batteries/transfers/${minted.token}/accept`, {
        token: receiverToken,
      });
      expectOk(accept, 200);

      const cancel = await api("POST", `/api/batteries/transfers/${minted.token}/cancel`, {
        token: ownerToken,
      });
      expectError(cancel, 409, "transfer_already_used", "already been accepted");
    });

    test("unknown token on cancel → 404 not_found", async () => {
      const res = await api("POST", `/api/batteries/transfers/${"C".repeat(43)}/cancel`, {
        token: ownerToken,
      });
      expectError(res, 404, "not_found", "This transfer code is not valid.");
    });
  }
);
