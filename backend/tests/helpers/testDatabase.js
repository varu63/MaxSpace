/* ============================================================
   ISOLATED TEST DATABASE HARNESS

   The tests that used to run against the in-memory mock store now run
   against a real PostgreSQL database, because the mock store no longer
   exists — PostgreSQL is the only data source.

   Each test file gets its own throwaway database, created from the
   authoritative schema.sql, and dropped on exit. Nothing here touches
   dev or maxvolt_prod, and no test needs a seeded fake dataset: the
   tests create the rows they assert on.

   Usage (must run before importing the store, because the store reads
   DATABASE_URL at import time):

     import { withTestDatabase } from "./helpers/testDatabase.js";
     const store = await withTestDatabase(import.meta.url);

   The returned value is the default export of data/index.js, already
   bound to the throwaway database.
   ============================================================ */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const backendRoot = path.resolve(__dirname, "../../");
const SCHEMA_FILE = path.join(backendRoot, "sql/schema.sql");

/* Reuse the configured admin connection (host/port/user/password) but
   always target a fresh database. */
const loadEnv = () => {
  const envPath = fs.existsSync(path.join(backendRoot, ".env"))
    ? path.join(backendRoot, ".env")
    : path.resolve(process.cwd(), "backend/.env");
  dotenv.config({ path: envPath });
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set; cannot derive a test database URL.");
  }
};

const readIntegration = async () => {
  try {
    return await import("pg");
  } catch {
    return { default: require("pg") };
  }
};

const dbNameFor = (label) => {
  const base = path.basename(label).replace(/\.test\.js$/, "").replace(/[^a-z0-9]+/gi, "_");
  return `maxspace_test_${base}_${crypto.randomBytes(4).toString("hex")}`.toLowerCase().slice(0, 63);
};

/* schema.sql ends with VACUUM ANALYZE, which cannot run inside a
   transaction; the runner in scripts/migrate.js handles the split. */
const splitSchema = (sql) => {
  const ddl = [];
  const maintenance = [];
  for (const line of sql.split("\n")) {
    if (/^\s*(BEGIN|COMMIT|ROLLBACK|START\s+TRANSACTION)\s*;\s*$/i.test(line)) continue;
    if (/^\s*(VACUUM|ANALYZE|REINDEX)\b/i.test(line)) {
      maintenance.push(line.trim());
      continue;
    }
    ddl.push(line);
  }
  return { ddl: ddl.join("\n"), maintenance };
};

export const withTestDatabase = async (label) => {
  loadEnv();
  const { default: pg } = await readIntegration();

  const adminUrl = process.env.DATABASE_URL;
  const url = new URL(adminUrl);
  const name = dbNameFor(label);
  url.pathname = `/${name}`;

  const admin = new pg.Pool({ connectionString: adminUrl, max: 1 });
  const cleanup = async () => {
    try {
      await admin.query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
          WHERE datname = $1 AND pid <> pg_backend_pid()`,
        [name]
      );
      await admin.query(`DROP DATABASE IF EXISTS ${name}`);
      console.error(`[test-db] dropped ${name}`);
    } catch (error) {
      console.error(`[test-db] WARNING: could not drop ${name}: ${error.message}`);
    } finally {
      await admin.end();
    }
  };

  try {
    await admin.query(`CREATE DATABASE ${name}`);
  } catch (error) {
    await admin.end();
    throw new Error(`[test-db] could not create ${name}: ${error.message}`);
  }
  console.error(`[test-db] created ${name}`);

  /* Apply the authoritative schema to the throwaway database so the tests
     exercise the real tables, constraints and enums. */
  const { ddl, maintenance } = splitSchema(fs.readFileSync(SCHEMA_FILE, "utf8"));
  const seed = new pg.Pool({ connectionString: url.toString(), max: 1 });
  try {
    await seed.query("BEGIN");
    await seed.query(ddl);
    await seed.query("COMMIT");
    for (const statement of maintenance) await seed.query(statement);
  } catch (error) {
    await seed.end().catch(() => {});
    await admin.end().catch(() => {});
    throw new Error(`[test-db] could not apply schema.sql to ${name}: ${error.message}`);
  } finally {
    await seed.end().catch(() => {});
  }
  console.error(`[test-db] schema.sql applied to ${name}`);

  /* Set before the store module is imported: the store reads
     DATABASE_URL once, at import time. */
  process.env.DATABASE_URL = url.toString();
  /* config/app.js may already have been evaluated before this harness ran
     (a static import of utils/auth.js is enough to pull it in), which
     freezes the original DATABASE_URL into config.db.databaseUrl. The data
     layer reads that field, not the env var, so sync it too — otherwise the
     store silently connects to dev while the harness operates on the
     throwaway database. */
  const { default: config } = await import("../../config/app.js");
  config.db.databaseUrl = url.toString();
  const { default: store } = await import("../../data/index.js");

  const teardown = async () => {
    try {
      if (typeof store.close === "function") await store.close();
    } catch {
      /* the pool may already be closed */
    }
    await cleanup();
  };

  return { store, dbName: name, databaseUrl: url.toString(), teardown };
};

/* Optional variant of withTestDatabase.

   A database that simply is not reachable right now (Postgres stopped, Docker
   not started, DATABASE_URL unset) is an *environment* problem, not a broken
   assertion. Returning null lets the caller mark the suite as skipped so
   `npm test` reports "skipped" instead of a confusing failure that looks like
   a code defect.

   A schema that *does* apply badly is a real bug and is re-thrown, never
   swallowed: that means sql/schema.sql disagrees with the code under test. */
export const withOptionalTestDatabase = async (label) => {
  if (!process.env.DATABASE_URL) loadEnv();
  try {
    return await withTestDatabase(label);
  } catch (error) {
    const unavailable =
      /DATABASE_URL is not set/.test(error.message) ||
      /could not create /.test(error.message);
    if (!unavailable) throw error;
    console.error(
      `[test-db] skipping database-backed suite for ${path.basename(label)}: ${error.message}`
    );
    return null;
  }
};

/* Convenience for tests that need raw SQL against the same throwaway
   database the store is using. */
export const testPool = async () => {
  const { default: pg } = await readIntegration();
  return new pg.Pool({ connectionString: process.env.DATABASE_URL });
};
