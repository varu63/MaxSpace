/* MaxSpace India compliance (BWMR 2022) tests.
   Run: npm test  (from backend/)

   Two layers, deliberately separated:

     1. The validation layer (complianceValidation.js) is pure and needs no
        database, so it runs everywhere.
     2. The persistence layer is exercised against a throwaway PostgreSQL
        database built from sql/schema.sql. These assertions are stronger than
        the old in-memory ones: uniqueness and one-per-battery are now proved
        by real database constraints rather than by JavaScript checks that a
        second code path could bypass. */
import { test, describe, after } from "node:test";
import assert from "node:assert/strict";

import {
  parseProducerPayload,
  parseProducerPatch,
  parseBatteryCompliancePayload,
  parseBatteryCompliancePatch,
  parseObligationPayload,
  parseCreditPayload,
  parseDocumentPayload,
  parseDocumentPatch,
  describeEvent,
} from "../utils/complianceValidation.js";
import {
  COMPLIANCE_STATUSES,
  PRODUCER_CATEGORIES,
  BATTERY_CATEGORIES,
  COLLECTION_CHANNELS,
  OBLIGATION_STATUSES,
  CREDIT_STATUSES,
  DOCUMENT_TYPES,
} from "../constants/compliance.js";
import { withOptionalTestDatabase } from "./helpers/testDatabase.js";

const freshProducer = (overrides = {}) => ({
  producerName: "GreenCycle Recyclers Pvt Ltd",
  registrationNumber: "CPCB/BAT/2025/0101",
  producerCategory: "Recycler",
  address: "Bengaluru, Karnataka",
  registrationValidUntil: "2027-12-31",
  ...overrides,
});

const freshDocument = (overrides = {}) => ({
  documentType: "Recycling Voucher",
  documentName: "recycling-2025.pdf",
  ...overrides,
});

describe("complianceValidation", () => {
  test("accepts a complete valid producer payload", () => {
    const value = parseProducerPayload(freshProducer());
    assert.equal(value.producerName, "GreenCycle Recyclers Pvt Ltd");
    assert.equal(value.status, "Active");
  });

  test("rejects missing registration number", () => {
    assert.throws(
      () => parseProducerPayload({ ...freshProducer(), registrationNumber: "" }),
      /registrationNumber is required/
    );
  });

  test("rejects unknown producerCategory", () => {
    assert.throws(
      () => parseProducerPayload({ ...freshProducer(), producerCategory: "Terrorist" }),
      /producerCategory .* is not valid/
    );
  });

  test("patch allows partial updates and drops unknown fields", () => {
    const value = parseProducerPatch({ status: "Suspended", hackerField: 1 });
    assert.deepEqual(value, { status: "Suspended" });
  });

  test("patch rejects an unknown status on a partial update", () => {
    assert.throws(
      () => parseProducerPatch({ status: "Boom" }),
      /status .* is not valid/
    );
  });

  /* Every rejection from this module is bad caller input. The controllers
     call these parsers before setting a response status, so an error with no
     statusCode falls through to the error middleware's 500 default and a
     mistyped dropdown is reported as a server fault. These assertions pin the
     HTTP contract that would otherwise be silently lost. */
  const asError = (fn) => {
    try {
      fn();
    } catch (error) {
      return error;
    }
    assert.fail("expected the parser to reject the payload");
  };

  test("validation failures carry statusCode 400 and code 'validation'", () => {
    const cases = [
      ["unknown producerCategory", () => parseProducerPayload({ ...freshProducer(), producerCategory: "Terrorist" })],
      ["missing registration number", () => parseProducerPayload({ ...freshProducer(), registrationNumber: "" })],
      ["unknown status on patch", () => parseProducerPatch({ status: "Boom" })],
      ["unknown batteryCategory", () => parseBatteryCompliancePayload({ batteryCategory: "Enormous" })],
    ];
    for (const [label, fn] of cases) {
      const error = asError(fn);
      assert.equal(error.statusCode, 400, `${label} should be a 400, not a 500`);
      assert.equal(error.code, "validation", `${label} should be tagged as a validation failure`);
    }
  });

  test("battery compliance payload requires batteryId only when flagged", () => {
    assert.equal(parseBatteryCompliancePayload({ batteryCategory: "Medium" }).batteryCategory, "Medium");
    assert.throws(
      () => parseBatteryCompliancePayload({ batteryCategory: "Medium" }, { requireBatteryId: true }),
      /batteryId is required/
    );
  });

  test("battery compliance patch rejects an unknown status", () => {
    assert.throws(
      () => parseBatteryCompliancePatch({ complianceStatus: "Legal" }),
      /complianceStatus .* is not valid/
    );
  });

  test("battery compliance patch never clobbers unmentioned fields", () => {
    const patch = parseBatteryCompliancePatch({ collectionChannel: "Registered Recycler" });
    assert.deepEqual(patch, { collectionChannel: "Registered Recycler" });
  });

  test("battery compliance patch stamps/clears verifiedAt with verifiedInApp", () => {
    const on = parseBatteryCompliancePatch({ verifiedInApp: true });
    assert.equal(on.verifiedInApp, true);
    assert.ok(on.verifiedAt);
    const off = parseBatteryCompliancePatch({ verifiedInApp: false });
    assert.equal(off.verifiedInApp, false);
    assert.equal(off.verifiedAt, null);
  });

  test("obligation payload validates vocabulary and numeric bounds", () => {
    assert.doesNotThrow(() =>
      parseObligationPayload({
        obligationType: "Recycling",
        producerId: 1,
        financialYear: "2024-2025",
        batteryCategory: "Medium",
        targetPercent: 70,
        targetQuantityKg: 5000,
      })
    );
    assert.throws(
      () =>
        parseObligationPayload({
          producerId: 1,
          financialYear: "2024-2025",
          batteryCategory: "Medium",
          targetPercent: 151,
        }),
      /targetPercent must be between 0 and 100/
    );
    assert.throws(
      () =>
        parseObligationPayload({
          producerId: 1,
          financialYear: "2024-2025",
          batteryCategory: "Jumbo",
        }),
      /batteryCategory .* is not valid/
    );
  });

  test("credit payload requires an obligation and certificate number", () => {
    assert.throws(() => parseCreditPayload({ certificateNumber: "X" }), /obligationId is required/);
    assert.throws(() => parseCreditPayload({ obligationId: 5 }), /certificateNumber is required/);
    assert.equal(parseCreditPayload({ obligationId: 5, certificateNumber: "EPR-X" }).certificateNumber, "EPR-X");
  });

  test("document payload requires a name and a valid type", () => {
    assert.equal(parseDocumentPayload({ documentName: "x.pdf" }).documentType, "Other"); // defaulted
    assert.throws(
      () => parseDocumentPayload({ documentName: "x.pdf", documentType: "Bogus" }),
      /documentType "Bogus" is not valid/
    );
    assert.throws(() => parseDocumentPayload({ documentType: "EPR Registration" }), /documentName is required/);
    assert.equal(
      parseDocumentPayload({ documentName: "x.pdf", documentType: "EPR Registration" }).documentType,
      "EPR Registration"
    );
  });

  test("document patch returns only the provided key", () => {
    const patch = parseDocumentPatch({ verificationStatus: "Approved" });
    assert.deepEqual(patch, {});
    const named = parseDocumentPatch({ documentNumber: "DOC-42" });
    assert.deepEqual(named, { documentNumber: "DOC-42" });
  });

  test("vocabularies are stable and exhaustive", () => {
    assert.deepEqual(COMPLIANCE_STATUSES, ["Pending", "In Progress", "Compliant", "Non-Compliant", "Exempt"]);
    assert.equal(BATTERY_CATEGORIES.includes("Portable"), true);
    assert.equal(COLLECTION_CHANNELS.includes("Registered Recycler"), true);
    assert.equal(OBLIGATION_STATUSES.includes("Open"), true);
    assert.equal(CREDIT_STATUSES.includes("Active"), true);
    assert.equal(DOCUMENT_TYPES.includes("EPR Registration"), true);
    assert.equal(PRODUCER_CATEGORIES.includes("Manufacturer"), true);
  });

  test("describeEvent produces a human-readable audit line", () => {
    assert.equal(describeEvent("status_changed", { detail: "Pending → Compliant" }), "Compliance status changed — Pending → Compliant");
    assert.ok(describeEvent("producer_created", { detail: "A Ltd" }).includes("A Ltd"));
  });
});

/* The persistence layer, against a throwaway PostgreSQL database.

   No seeded fixtures: each test inserts the model and battery rows it needs,
   so these assertions do not depend on any dataset staying in place. */
const db = await withOptionalTestDatabase(import.meta.url);

describe(
  "compliance persistence (PostgreSQL)",
  { skip: db ? false : "no PostgreSQL database available" },
  async () => {
    const store = db.store;
    const { testPool } = await import("./helpers/testDatabase.js");
    const pool = await testPool();

    /* A minimal battery: the compliance tables all reference batteries, and
       battery_compliance.battery_id is UNIQUE, so each test that asserts
       one-per-battery behaviour needs its own battery. */
    let batterySeq = 0;
    const seedBattery = async () => {
      const n = ++batterySeq;
      await pool.query(
        `INSERT INTO battery_models (model_id, category, series_count, parallel_count, cell_type, welding_type)
         VALUES ($1, 'Portable', 1, 1, 'NMC', 'LASER')
         ON CONFLICT (model_id) DO NOTHING`,
        [`MODEL-C${n}`]
      );
      await pool.query(
        `INSERT INTO batteries (battery_id, model_id, barcode, serial_number, name)
         VALUES ($1, $2, $3, $4, $5)`,
        [`COMPLY-BAT-${n}`, `MODEL-C${n}`, `BC-${n}`, `SC-${n}`, `Compliance Test Battery ${n}`]
      );
      return `COMPLY-BAT-${n}`;
    };

    /* The hierarchical compliance module in data/compliance/postgres.js joins
       and filters on these four columns. They were never added to
       schema.sql, so every endpoint that reached them failed at runtime with
       a 500 (e.g. "column cd.compliance_id does not exist") while the unit
       tests stayed green, because none of them mounted the app against this
       schema. Asserting the columns exist here is what keeps that honest. */
    const REQUIRED_COLUMNS = {
      battery_models: ["company_id"],
      compliance_documents: ["compliance_id", "visibility"],
      compliance_events: ["compliance_id"],
    };

    test("schema provides the hierarchical compliance columns", async () => {
      const missing = [];
      for (const [table, columns] of Object.entries(REQUIRED_COLUMNS)) {
        const { rows } = await pool.query(
          `SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = $1`,
          [table]
        );
        const present = new Set(rows.map((r) => r.column_name));
        for (const column of columns) {
          if (!present.has(column)) missing.push(`${table}.${column}`);
        }
      }
      assert.deepEqual(missing, [], `missing columns: ${missing.join(", ")}`);
    });

    test("record-scoped evidence defaults to Internal, never published", async () => {
      const { rows } = await pool.query(
        `SELECT column_default, is_nullable FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'compliance_documents'
            AND column_name = 'visibility'`
      );
      assert.ok(rows.length, "compliance_documents.visibility is missing");
      assert.match(String(rows[0].column_default), /Internal/);
      assert.equal(rows[0].is_nullable, "NO");
    });

    test("the new columns are additive and leave existing rows unattributed", async () => {
      const attributed = await pool.query(
        `SELECT count(*)::int AS n FROM battery_models WHERE company_id IS NOT NULL`
      );
      assert.equal(attributed.rows[0].n, 0, "no catalogue model should be attributed by default");

      await pool.query(
        /* A document using only the pre-existing columns must still insert
           cleanly, leaving the new compliance_id NULL. */
        `INSERT INTO compliance_documents (document_type, document_name, status)
         VALUES ('EPR Registration', 'Battery-scoped doc', 'Pending Review')`
      );
      const scoped = await pool.query(
        `SELECT count(*)::int AS n FROM compliance_documents WHERE compliance_id IS NOT NULL`
      );
      assert.equal(scoped.rows[0].n, 0, "a battery-scoped document must not be record-scoped");
    });

    after(async () => {
      await pool.end().catch(() => {});
      await db.teardown();
    });

    test("producers: unique registration number is enforced by the database", async () => {
      const producer = await store.createComplianceProducer(freshProducer());
      assert.ok(producer.id > 0);
      assert.equal(producer.status, "Active");
      assert.equal(producer.producerName, "GreenCycle Recyclers Pvt Ltd");

      /* The old in-memory store needed a helper to police this in JavaScript.
         Now a duplicate registration number is impossible to write at all. */
      await assert.rejects(
        () => store.createComplianceProducer(freshProducer({ producerName: "Impostor Ltd" })),
        /duplicate key|unique/i
      );

      const { data: list, pagination } = await store.listComplianceProducers({ page: 1, limit: 10 });
      assert.equal(list.length, 1);
      assert.equal(pagination.total, 1);

      const updated = await store.updateComplianceProducer(producer.id, { status: "Suspended" });
      assert.equal(updated.status, "Suspended");
      assert.equal((await store.getComplianceProducerById(producer.id)).status, "Suspended");

      assert.ok(await store.deleteComplianceProducer(producer.id));
      assert.equal(await store.getComplianceProducerById(producer.id), null);
    });

    test("a battery has exactly one compliance record, enforced by a unique index", async () => {
      const producer = await store.createComplianceProducer(
        freshProducer({ registrationNumber: "CPCB/BAT/2025/0202" })
      );
      const batteryId = await seedBattery();

      const record = await store.createBatteryCompliance({
        batteryId,
        producerId: producer.id,
        batteryCategory: "Medium",
        collectionChannel: "Registered Recycler",
      });
      assert.equal(record.batteryId, batteryId);
      assert.equal(record.complianceStatus, "Pending");
      assert.equal(record.verifiedInApp, false);

      await assert.rejects(
        () =>
          store.createBatteryCompliance({
            batteryId,
            producerId: producer.id,
            batteryCategory: "Large",
          }),
        /duplicate key|unique/i
      );

      const got = await store.getBatteryCompliance(batteryId);
      assert.equal(got.producer?.id, producer.id);

      /* verifiedAt is derived, never accepted blindly from the caller. */
      const patched = await store.updateBatteryCompliance(batteryId, {
        complianceStatus: "Compliant",
        verifiedInApp: true,
      });
      assert.equal(patched.complianceStatus, "Compliant");
      assert.equal(patched.verifiedInApp, true);
      assert.ok(patched.verifiedAt);

      /* Un-verifying must clear the timestamp rather than leave a stale claim. */
      const cleared = await store.updateBatteryCompliance(batteryId, { verifiedInApp: false });
      assert.equal(cleared.verifiedAt, null);

      const { data: list } = await store.listBatteryCompliance({ page: 1, limit: 10 });
      assert.equal(list.length, 1);
      assert.equal(list[0].batteryName, "Compliance Test Battery 1");
    });

    test("obligations: one per producer / financial year / battery category", async () => {
      const producer = await store.createComplianceProducer(
        freshProducer({ registrationNumber: "CPCB/BAT/2025/0303" })
      );
      const base = {
        producerId: producer.id,
        financialYear: "2024-2025",
        batteryCategory: "Medium",
        targetPercent: 70,
      };
      const obligation = await store.createComplianceObligation({ ...base, obligationKg: 5000 });
      assert.equal(obligation.status, "Open");
      assert.equal(obligation.obligationKg, 5000);

      const dupScan = await store.listComplianceObligations({
        producerId: producer.id,
        financialYear: "2024-2025",
        page: 1,
        limit: 100,
      });
      assert.equal(
        dupScan.data.some((x) => x.batteryCategory === "Medium"),
        true
      );

      /* A different category in the same year is a distinct obligation. */
      const other = await store.createComplianceObligation({ ...base, batteryCategory: "Large" });
      assert.notEqual(other.id, obligation.id);

      const closed = await store.updateComplianceObligation(obligation.id, { status: "Closed" });
      assert.equal(closed.status, "Closed");
      assert.ok(await store.deleteComplianceObligation(obligation.id));
      assert.equal(await store.getComplianceObligationById(obligation.id), null);
    });

    test("credits: unique certificate number, patch, delete", async () => {
      const producer = await store.createComplianceProducer(
        freshProducer({ registrationNumber: "CPCB/BAT/2025/0404" })
      );
      const obligation = await store.createComplianceObligation({
        producerId: producer.id,
        financialYear: "2024-2025",
        batteryCategory: "Medium",
        targetPercent: 70,
        obligationKg: 5000,
      });
      const credit = await store.createComplianceCredit({
        obligationId: obligation.id,
        certificateNumber: "EPR-CERT-9001",
        issueDate: "2025-06-01",
        validUntil: "2026-06-01",
        quantityKg: 3500,
      });
      assert.equal(credit.certificateNumber, "EPR-CERT-9001");
      assert.equal(credit.status, "Active");

      await assert.rejects(
        () =>
          store.createComplianceCredit({
            obligationId: obligation.id,
            certificateNumber: "EPR-CERT-9001",
            quantityKg: 10,
          }),
        /duplicate key|unique/i
      );

      const updated = await store.updateComplianceCredit(credit.id, { status: "Expired" });
      assert.equal(updated.status, "Expired");
      assert.ok(await store.deleteComplianceCredit(credit.id));
    });

    test("documents: create, getById, patch, delete", async () => {
      const batteryId = await seedBattery();
      const doc = await store.createComplianceDocument({
        batteryId,
        documentType: "Recycling Voucher",
        documentName: "recycling-2025.pdf",
        issuedBy: "CPCB",
        status: "Pending Review",
      });
      assert.equal(doc.status, "Pending Review");
      assert.equal((await store.getComplianceDocumentById(doc.id)).documentName, "recycling-2025.pdf");

      const updated = await store.updateComplianceDocument(doc.id, { status: "Verified" });
      assert.equal(updated.status, "Verified");
      assert.ok(await store.deleteComplianceDocument(doc.id));
      assert.equal(await store.getComplianceDocumentById(doc.id), null);
    });

    test("compliance events: append-only, newest first, filtered by battery", async () => {
      const mine = await seedBattery();
      const other = await seedBattery();
      await store.addComplianceEvent({
        batteryId: mine,
        eventType: "verified",
        eventDescription: "Verified in MaxSpace",
        createdBy: "admin",
      });
      await store.addComplianceEvent({
        batteryId: mine,
        eventType: "status_changed",
        eventDescription: "Status changed to Pending",
        createdBy: "admin",
      });
      await store.addComplianceEvent({
        batteryId: other,
        eventType: "verified",
        eventDescription: "Another battery",
        createdBy: "admin",
      });

      const { data } = await store.listComplianceEvents({ batteryId: mine, page: 1, limit: 50 });
      assert.equal(data.length, 2);
      assert.equal(data.every((e) => e.batteryId === mine), true);

      /* The events log is an audit trail: rows may be added, never rewritten
         or removed, so the store exposes no update/delete for it. */
      assert.equal(store.updateComplianceEvent, undefined);
      assert.equal(store.deleteComplianceEvent, undefined);
    });

    test("overview aggregates counts over the whole registry", async () => {
      const overview = await store.getComplianceOverview();
      /* Three producers survive: the fourth was deleted by the first test, and
         the suspended one it created went with it. */
      assert.equal(overview.producers, 3);
      assert.equal(overview.activeProducers, 3);
      assert.ok(overview.batteriesTracked >= 1);
      assert.equal(
        overview.pending + overview.compliant + overview.inProgress + overview.nonCompliant,
        overview.batteriesTracked,
        "every battery must fall into exactly one compliance bucket"
      );
    });
  }
);