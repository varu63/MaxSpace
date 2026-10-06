/* ============================================================
   PASSPORT LIFECYCLE BACKFILL

   Seeds the lifecycle ledger for batteries that were manufactured
   before the digital passport existed.

   What this script does NOT do
   ----------------------------
   It does not reconstruct a plausible history. A battery created in
   2023 with no recorded events gets ONE event saying "this
   manufacturing record was imported", mapped from the stage its
   existing `overall_status` already implies. It does not invent a
   commissioning date, a first owner, a service history or a collection
   event, because none of those are in the database and a passport that
   guesses is worse than one that admits a gap.

   Provenance is only asserted where the source is genuinely known:
   the plant wrote `model_id` and `manufacture_date`, so those are
   attributed to the manufacturing record. Everything else is left as
   `unclassified_legacy` — which is a statement, not a gap.

   Usage:
     node backend/scripts/backfillPassport.js --dry-run   # report only
     node backend/scripts/backfillPassport.js             # apply
     node backend/scripts/backfillPassport.js --limit 100 # batch

   Idempotent: a battery that already has events, or that already has a
   provenance assertion for a field, is skipped.

   Requires DATABASE_URL (from backend/.env).
   ============================================================ */

import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const envPath = fs.existsSync(path.resolve(process.cwd(), ".env"))
  ? path.resolve(process.cwd(), ".env")
  : path.resolve(process.cwd(), "backend/.env");
dotenv.config({ path: envPath });

const readPg = async () => {
  try {
    return await import("pg");
  } catch {
    return { default: require("pg") };
  }
};

const { createBatteryLifecycleStore } = await import("../data/postgres/lifecycle.js");
const { stageFromOverallStatus } = await import("../utils/lifecycleLedger.js");

const arg = (name) => process.argv.includes(name);
const valueOf = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
};

/* Fields whose source is actually known from the manufacturing record,
   and the classification that implies. */
const ATTRIBUTABLE = [
  { fieldName: "manufactureDate", classification: "authoritative" },
  { fieldName: "modelName", classification: "authoritative" },
];

/* Fields that exist on imported rows but whose origin cannot be
   determined after the fact. Asserted as unclassified so the passport
   can say "unknown provenance" instead of implying a measured value. */
const UNCLASSIFIED = [
  "capacityKwh",
  "weightKg",
  "stateOfHealth",
  "stateOfCharge",
  "cycleCount",
  "internalResistanceMOhms",
  "chemistry",
];

const main = async () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set. Refusing to run.");
    process.exit(1);
  }

  const dryRun = arg("--dry-run");
  const limit = Number(valueOf("--limit")) || null;

  const { default: pg } = await readPg();
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const lifecycle = createBatteryLifecycleStore({ pool, batteryKey: "battery_id" });

  const stats = {
    batteries: 0,
    seeded: 0,
    skippedExisting: 0,
    provenanceAsserted: 0,
    stageCounts: {},
  };

  try {
    const target = (await pool.query("SELECT current_database() AS db")).rows[0].db;
    console.log(`Target database : ${target}`);
    console.log(`Mode            : ${dryRun ? "DRY RUN (nothing written)" : "APPLY"}`);
    console.log("");

    const { rows: batteries } = await pool.query(
      `SELECT b.battery_id, b.overall_status, b.model_name, b.manufacture_date,
              EXISTS (SELECT 1 FROM battery_lifecycle_events e
                       WHERE e.battery_id = b.battery_id) AS has_events
       FROM batteries b
       ORDER BY b.battery_id
       ${limit ? "LIMIT $1" : ""}`,
      limit ? [limit] : []
    );

    for (const battery of batteries) {
      stats.batteries += 1;
      const stage = stageFromOverallStatus(battery.overall_status);
      stats.stageCounts[stage] = (stats.stageCounts[stage] || 0) + 1;

      if (battery.has_events) {
        stats.skippedExisting += 1;
        continue;
      }

      if (!dryRun) {
        await lifecycle.initialiseLifecycleFromBattery(battery.battery_id, {
          id: null,
          name: "schema backfill",
          role: "SYSTEM",
        });

        /* Provenance: attributed where known, explicitly unknown where not. */
        const current = new Set(
          (await lifecycle.listProvenance(battery.battery_id, { currentOnly: true })).map((p) => p.fieldName)
        );

        for (const entry of ATTRIBUTABLE) {
          if (current.has(entry.fieldName)) continue;
          await lifecycle.assertProvenance({
            batteryId: battery.battery_id,
            fieldName: entry.fieldName,
            classification: entry.classification,
            source: "manufacturing_record",
            sourceRef: "legacy_import",
            notes: "Imported from the manufacturing record before the digital passport existed.",
          });
          stats.provenanceAsserted += 1;
        }

        for (const fieldName of UNCLASSIFIED) {
          if (current.has(fieldName)) continue;
          await lifecycle.assertProvenance({
            batteryId: battery.battery_id,
            fieldName,
            classification: "unclassified_legacy",
            source: "legacy_unknown",
            notes: "Present on the imported row; the source that produced it was not recorded.",
          });
          stats.provenanceAsserted += 1;
        }
      }

      stats.seeded += 1;
    }

    console.log("Batteries scanned      :", stats.batteries);
    console.log("Lifecycle events seeded:", stats.seeded);
    console.log("Already had events     :", stats.skippedExisting);
    console.log("Provenance assertions  :", stats.provenanceAsserted);
    console.log("\nStage mapping from existing overall_status:");
    for (const [stage, count] of Object.entries(stats.stageCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(stage).padEnd(16)} ${count}`);
    }

    if (dryRun) {
      console.log("\nDRY RUN: nothing was written.");
    } else {
      const integrity = await pool.query(
        `SELECT count(*) AS total,
                count(*) FILTER (WHERE prev_hash = '${"0".repeat(64)}') AS genesis
         FROM battery_lifecycle_events`
      );
      console.log(
        `\nLedger now holds ${integrity.rows[0].total} events (${integrity.rows[0].genesis} chain starts).`
      );
    }
  } finally {
    await pool.end();
  }
};

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});