/* ============================================================
   DATABASE SCHEMA APPLIER

   The v2 design is a single authoritative schema file
   (backend/sql/schema.sql) rather than an ordered list of
   incremental migrations. This script applies it and records the
   version in the schema_version table.

   There is deliberately no incremental migration history: the
   original 001–008 migration chain is folded into schema.sql, and
   keeping two sources of truth is how schemas drift apart. The file
   is written to be re-runnable (IF NOT EXISTS / ON CONFLICT DO
   NOTHING), so applying it to an existing database is safe and
   brings in any newly added table, index or reference row.

   IMPORTANT: CREATE TABLE IF NOT EXISTS will not ALTER an existing
   table. If you change the definition of a column in schema.sql,
   either write the ALTER explicitly or drop and re-create the
   database. Use --check to verify without writing.

   Usage:
     node backend/scripts/migrate.js            # apply schema.sql
     node backend/scripts/migrate.js --status   # report version + object counts
     node backend/scripts/migrate.js --check    # apply inside a rolled-back transaction

   Requires DATABASE_URL (from backend/.env).
   ============================================================ */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const envPath = fs.existsSync(path.resolve(process.cwd(), ".env"))
  ? path.resolve(process.cwd(), ".env")
  : path.resolve(process.cwd(), "backend/.env");
dotenv.config({ path: envPath });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_FILE = path.resolve(__dirname, "../sql/schema.sql");

/* Kept in step with the `version` written by migrate_legacy_to_v2.sql.
   v3: services gained the customer service-location columns
   (address, city, state, pincode, latitude, longitude). */
const SCHEMA_VERSION = 3;

const readIntegration = async () => {
  try {
    return await import("pg");
  } catch {
    return { default: require("pg") };
  }
};

const countObjects = async (pool) => {
  const { rows } = await pool.query(
    `SELECT
       (SELECT count(*) FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_type = 'BASE TABLE')       AS tables,
       (SELECT count(*) FROM pg_indexes
         WHERE schemaname = 'public')            AS indexes,
       (SELECT count(*) FROM pg_constraint c
         JOIN pg_namespace n ON n.oid = c.connamespace
        WHERE n.nspname = 'public'
          AND c.contype = 'f')                  AS foreign_keys,
       (SELECT count(*) FROM pg_constraint c
         JOIN pg_namespace n ON n.oid = c.connamespace
        WHERE n.nspname = 'public'
          AND c.contype = 'c')                  AS check_constraints`
  );
  return rows[0];
};

const report = async (pool, label) => {
  const v = await pool.query(
    `SELECT version, applied_at FROM schema_version ORDER BY version DESC LIMIT 1`
  ).catch(() => ({ rows: [] }));
  const c = await countObjects(pool).catch(() => null);
  console.log(`\n${label}`);
  console.log(`  schema version : ${v.rows[0] ? v.rows[0].version : "(none recorded)"}`);
  if (v.rows[0]?.applied_at) {
    console.log(`  applied at     : ${new Date(v.rows[0].applied_at).toISOString()}`);
  }
  if (c) {
    console.log(`  tables         : ${c.tables}`);
    console.log(`  indexes        : ${c.indexes}`);
    console.log(`  foreign keys   : ${c.foreign_keys}`);
    console.log(`  checks         : ${c.check_constraints}`);
  }
};

/* schema.sql manages its own transaction (BEGIN ... COMMIT) and finishes
   with VACUUM ANALYZE, which PostgreSQL refuses to run inside a
   transaction block. Sending the whole file as one simple-query message
   also wraps it in an implicit transaction block, so VACUUM fails there
   too. The runner therefore owns the transaction:
     - the DDL is applied inside an explicit BEGIN/COMMIT,
     - maintenance statements (VACUUM / ANALYZE / REINDEX) run afterwards
       in autocommit, preserving the file's intent of keeping them outside
       the transaction.
   Anything stripped is reported, never silently dropped. */
const TRANSACTION_CONTROL = /^\s*(BEGIN|COMMIT|ROLLBACK|START\s+TRANSACTION)\s*;\s*$/i;
const MAINTENANCE = /^\s*(VACUUM|ANALYZE|REINDEX)\b/i;

/* Splits the file into transaction-safe DDL and post-commit maintenance.
   Returns { ddl, maintenance, stripped }. */
const splitForApply = (sql) => {
  const ddl = [];
  const maintenance = [];
  const stripped = [];
  for (const line of sql.split("\n")) {
    if (TRANSACTION_CONTROL.test(line)) {
      stripped.push(line.trim());
      continue;
    }
    if (MAINTENANCE.test(line)) {
      maintenance.push(line.trim());
      continue;
    }
    ddl.push(line);
  }
  return { ddl: ddl.join("\n"), maintenance, stripped };
};

const main = async () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set. Refusing to run.");
    process.exit(1);
  }
  if (!fs.existsSync(SCHEMA_FILE)) {
    console.error(`Schema file not found: ${SCHEMA_FILE}`);
    process.exit(1);
  }

  const mode = process.argv[2] || "up";
  const sql = fs.readFileSync(SCHEMA_FILE, "utf8");

  const { default: pg } = await readIntegration();
  const pool = new pg.Pool({ connectionString: databaseUrl });

  try {
    const target = (await pool.query("SELECT current_database() AS db")).rows[0].db;
    console.log(`Target database: ${target}`);
    console.log(`Schema file   : ${SCHEMA_FILE}`);

    if (mode === "--status") {
      await report(pool, "Current schema status:");
      return;
    }

    const { ddl, maintenance, stripped } = splitForApply(sql);
    if (stripped.length) {
      console.log(
        `Runner owns the transaction; ignoring in-file transaction control: ${stripped.join(", ")}`
      );
    }

    if (mode === "--check") {
      /* Apply the DDL, then roll back: proves the file is valid and would
         apply cleanly without leaving any change behind. */
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(ddl);
        await client.query(
          `INSERT INTO schema_version (version, applied_at)
           VALUES ($1, now()) ON CONFLICT (version) DO NOTHING`,
          [SCHEMA_VERSION]
        );
        await report(client, "Schema applies cleanly (dry run, rolled back):");
        await client.query("ROLLBACK");
        if (maintenance.length) {
          console.log(`  (skipped post-commit maintenance: ${maintenance.join(", ")})`);
        }
        console.log("\nOK: schema.sql applies cleanly. Nothing was written.");
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`Dry run failed: ${error.message}`);
      } finally {
        client.release();
      }
      return;
    }

    if (mode !== "up") {
      console.error(`Unknown option "${mode}". Use: up | --status | --check`);
      process.exit(1);
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(ddl);
      await client.query(
        `INSERT INTO schema_version (version, applied_at)
         VALUES ($1, now()) ON CONFLICT (version) DO NOTHING`,
        [SCHEMA_VERSION]
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw new Error(`Applying schema.sql failed: ${error.message}`);
    } finally {
      client.release();
    }

    /* Autocommit, outside the transaction, as the schema file intends. */
    for (const statement of maintenance) {
      await pool.query(statement);
    }
    if (maintenance.length) {
      console.log(`Ran post-commit maintenance: ${maintenance.join(", ")}`);
    }
    console.log("\nSchema applied.");
    await report(pool, "Schema status:");
  } finally {
    await pool.end();
  }
};

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
