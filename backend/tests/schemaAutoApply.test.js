/* Regression test for the production failure.

   Sign-up and Google sign-in returned HTTP 500 because a brand-new managed
   PostgreSQL database (a fresh Supabase project) had no `users` table — the
   schema was never applied. The store must now provision the authoritative
   schema itself at startup.

   This suite creates a throwaway database with NO schema and boots the real
   server (`node index.js`) against it. If schema auto-application regresses,
   the server refuses to start (or crashes) and these tests fail loudly
   instead of silently serving 500s. */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { withOptionalEmptyDatabase } from "./helpers/testDatabase.js";

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const db = await withOptionalEmptyDatabase(import.meta.url);
const describeDb = db ? describe : describe.skip;

const freePort = () =>
  new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });

const readPg = async () => {
  const mod = await import("pg");
  return mod.default ?? mod;
};

describeDb("schema auto-provisioning on an empty database", () => {
  let child;
  let base;
  let output = "";

  before(async () => {
    const port = await freePort();
    child = spawn(process.execPath, ["index.js"], {
      cwd: backendRoot,
      env: {
        ...process.env,
        DATABASE_URL: db.databaseUrl,
        PORT: String(port),
        NODE_ENV: "test",
        // assertStartupEnv() requires GOOGLE_CLIENT_ID before the server
        // will listen; it is never used to verify a real token here.
        GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "test-google-client-id",
        // Keep the sign-up response shape deterministic regardless of .env.
        EMAIL_VERIFICATION_ENABLED: "false",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    base = `http://127.0.0.1:${port}`;

    const deadline = Date.now() + 30_000;
    let ready = false;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) {
        throw new Error(`server exited with code ${child.exitCode}:\n${output}`);
      }
      try {
        const res = await fetch(`${base}/`);
        if (res.status === 200) {
          ready = true;
          break;
        }
      } catch {
        /* not listening yet */
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    if (!ready) {
      child.kill();
      throw new Error(`server never became ready against the empty database:\n${output}`);
    }
  });

  after(async () => {
    if (child && child.exitCode === null) child.kill();
    if (db) await db.drop();
  });

  test("the server started, which means it applied the schema on boot", () => {
    assert.equal(child.exitCode, null);
    assert.match(output, /Schema applied/);
  });

  test("the previously-empty database now has the users table and email constraint", async () => {
    const pg = await readPg();
    const client = new pg.Client({ connectionString: db.databaseUrl });
    await client.connect();
    try {
      const { rows } = await client.query("SELECT to_regclass('public.users') AS present");
      assert.equal(rows[0].present, "users");

      const constraint = await client.query(
        "SELECT 1 FROM pg_constraint WHERE conrelid='public.users'::regclass AND conname='users_email_key'"
      );
      assert.equal(constraint.rowCount, 1);
    } finally {
      await client.end();
    }
  });

  test("GET /api/health reports the database is reachable", async () => {
    const res = await fetch(`${base}/api/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
  });

  test("sign-up succeeds against the auto-provisioned schema", async () => {
    const res = await fetch(`${base}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Provisioned User",
        email: "provisioned@example.com",
        password: "secret123",
        confirmPassword: "secret123",
      }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.user.email, "provisioned@example.com");
    assert.ok(body.token, "sign-up should issue a token when verification is disabled");
  });
});
