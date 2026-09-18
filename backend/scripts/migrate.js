/* ============================================================
   DATABASE MIGRATION RUNNER
   Applies pending *.sql files from backend/sql/migrations/ in
   name order and records each applied migration in the
   schema_migrations table so runs are idempotent.

   Usage:
     node backend/scripts/migrate.js            # apply pending
     node backend/scripts/migrate.js --status   # list applied/pending
     node backend/scripts/migrate.js --resync   # rebuild schema_migrations from disk (for manual applies)

   Requires DATABASE_URL (from backend/.env). Migrations are
   intentionally idempotent (IF NOT EXISTS / ADD CONSTRAINT IF
   NOT EXISTS) and safe to run against existing populated data.
============================================================ */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
dotenv.config({ path: path.resolve(process.cwd(), "backend/.env") });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, "../sql/migrations");

const readIntegration = async () => {
  try {
    return await import("pg");
  } catch {
    return { default: require("pg") };
  }
};

const main = async () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set. Refusing to run migrations.");
    process.exit(1);
  }

  const { default: pg } = await readIntegration();
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const mode = process.argv[2] || "up";

  try {
    await pool.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         name        TEXT PRIMARY KEY,
         applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
       )`
    );

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    const { rows } = await pool.query("SELECT name FROM schema_migrations");
    const applied = new Set(rows.map((r) => r.name));

    if (mode === "--status") {
      console.log("Migration status:");
      for (const file of files) {
        console.log(`${applied.has(file) ? "[APPLIED]" : "[PENDING]"}  ${file}`);
      }
      return;
    }

    if (mode === "--resync") {
      await pool.query("DELETE FROM schema_migrations");
      for (const file of files) {
        await pool.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
      }
      console.log(`Resynced schema_migrations for ${files.length} files.`);
      return;
    }

    let appliedCount = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
      console.log(`Applying ${file} ...`);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${file} failed: ${error.message}`);
      } finally {
        client.release();
      }
      appliedCount += 1;
    }

    console.log(appliedCount ? `Applied ${appliedCount} migration(s).` : "Database is up to date.");
  } finally {
    await pool.end();
  }
};

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});