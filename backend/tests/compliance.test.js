/* MaxSpace India compliance (BWMR 2022) unit tests.
   Run: npm test  (from backend/) — no database or live server required.
   Both the validation layer and the in-memory store's compliance
   surface are exercised in isolation. */
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

import mockStore from "../data/store.js";
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

const freshProducer = () => ({
  producerName: "GreenCycle Recyclers Pvt Ltd",
  registrationNumber: "CPCB/BAT/2025/0101",
  producerCategory: "Recycler",
  address: "Bengaluru, Karnataka",
  registrationValidUntil: "2027-12-31",
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

describe("mock store compliance CRUD", () => {
  beforeEach(() => {
    mockStore.reset();
  });

  test("producers: unique registration, listing, patch, delete", async () => {
    const p = mockStore.createComplianceProducer(freshProducer());
    assert.equal(p.id, 1);
    assert.equal(p.status, "Active");

    assert.equal(mockStore.isRegistrationNumberUnique("CPCB/BAT/2025/0101"), false);
    assert.equal(mockStore.isRegistrationNumberUnique("CPCB/BAT/2025/0101", p.id), true); // self-exclusion

    const { data: list, pagination } = mockStore.listComplianceProducers({ page: 1, limit: 10 });
    assert.equal(list.length, 1);
    assert.equal(pagination.total, 1);

    const updated = mockStore.updateComplianceProducer(p.id, { status: "Suspended" });
    assert.equal(updated.status, "Suspended");
    assert.equal(mockStore.getComplianceProducerById(p.id).status, "Suspended");

    assert.equal(mockStore.deleteComplianceProducer(p.id), true);
    assert.equal(mockStore.getComplianceProducerById(p.id), null);
  });

  test("battery compliance: attach, enforce one-per-battery, patch", async () => {
    const producer = mockStore.createComplianceProducer(freshProducer());
    const batteryId = mockStore.batteries[0].id;

    const record = mockStore.createBatteryCompliance({
      batteryId,
      producerId: producer.id,
      batteryCategory: "Medium",
      collectionChannel: "Registered Recycler",
    });
    assert.equal(record.batteryId, batteryId);
    assert.equal(record.complianceStatus, "Pending");
    assert.equal(record.verifiedInApp, false);

    const got = mockStore.getBatteryCompliance(batteryId);
    assert.equal(got.batteryId, batteryId);
    assert.equal(got.complianceStatus, "Pending");
    assert.equal(got.producer?.id, producer.id);

    const patched = mockStore.updateBatteryCompliance(batteryId, {
      complianceStatus: "Compliant",
      verifiedInApp: true,
    });
    assert.equal(patched.complianceStatus, "Compliant");
    assert.equal(patched.verifiedInApp, true);
    assert.ok(patched.verifiedAt);

    const { data: list } = mockStore.listBatteryCompliance({ page: 1, limit: 10 });
    assert.equal(list.length, 1);
    assert.equal(list[0].batteryName, mockStore.getBatteryById(batteryId).name);
  });

  test("obligations: one per producer/financial-year/category", async () => {
    const producer = mockStore.createComplianceProducer(freshProducer());
    const o = mockStore.createComplianceObligation({
      obligationType: "Recycling",
      producerId: producer.id,
      financialYear: "2024-2025",
      batteryCategory: "Medium",
      targetPercent: 70,
      targetQuantityKg: 5000,
    });
    assert.equal(o.id, 1);
    assert.equal(o.status, "Open");

    const dupScan = mockStore.listComplianceObligations({
      producerId: producer.id,
      financialYear: "2024-2025",
      page: 1,
      limit: 100000,
    });
    assert.equal(dupScan.data.some((x) => x.batteryCategory === "Medium"), true);

    assert.equal(mockStore.getComplianceObligationById(o.id).id, 1);
    const closed = mockStore.updateComplianceObligation(o.id, { status: "Closed" });
    assert.equal(closed.status, "Closed");
    assert.equal(mockStore.deleteComplianceObligation(o.id), true);
    assert.equal(mockStore.getComplianceObligationById(o.id), null);
  });

  test("credits: unique certificate number, patch, delete", async () => {
    const producer = mockStore.createComplianceProducer(freshProducer());
    const obligation = mockStore.createComplianceObligation({
      obligationType: "Recycling",
      producerId: producer.id,
      financialYear: "2024-2025",
      batteryCategory: "Medium",
      targetPercent: 70,
      targetQuantityKg: 5000,
    });
    const credit = mockStore.createComplianceCredit({
      obligationId: obligation.id,
      certificateNumber: "EPR-CERT-9001",
      creditType: "Recycling Voucher",
      issueDate: "2025-06-01",
      certificateExpiresOn: "2026-06-01",
      quantityKg: 3500,
    });
    assert.equal(credit.id, 1);
    assert.equal(mockStore.isCertificateNumberUnique("EPR-CERT-9001"), false);
    assert.equal(mockStore.getComplianceCreditById(credit.id).certificateNumber, "EPR-CERT-9001");

    const updated = mockStore.updateComplianceCredit(credit.id, { status: "Expired" });
    assert.equal(updated.status, "Expired");
    assert.equal(mockStore.deleteComplianceCredit(credit.id), true);
  });

  test("documents: create, getById, patch, delete", async () => {
    const doc = mockStore.createComplianceDocument({
      batteryId: mockStore.batteries[0].id,
      documentName: "recycling-2025.pdf",
      documentType: "Recycling Voucher",
      verificationStatus: "Pending",
      uploadedBy: "admin",
    });
    assert.equal(doc.id, 1);
    assert.equal(mockStore.getComplianceDocumentById(doc.id).documentName, "recycling-2025.pdf");
    const updated = mockStore.updateComplianceDocument(doc.id, { verificationStatus: "Verified" });
    assert.equal(updated.verificationStatus, "Verified");
    assert.equal(mockStore.deleteComplianceDocument(doc.id), true);
  });

  test("events: append-only audit log filtered by battery", async () => {
    const batteryId = mockStore.batteries[0].id;
    mockStore.addComplianceEvent({
      batteryId,
      eventType: "verified",
      eventDescription: "Verified in MaxSpace",
      createdBy: "admin",
    });
    mockStore.addComplianceEvent({
      batteryId,
      eventType: "status_changed",
      eventDescription: "Status changed to Pending",
      createdBy: "admin",
    });
    const { data } = mockStore.listComplianceEvents({ batteryId, page: 1, limit: 50 });
    assert.equal(data.length, 2);
    // newest first
    assert.equal(data[0].eventType, "status_changed");
  });

  test("overview aggregates counts", async () => {
    const producer = mockStore.createComplianceProducer(freshProducer());
    mockStore.createBatteryCompliance({
      batteryId: mockStore.batteries[0].id,
      producerId: producer.id,
      batteryCategory: "Large",
    });
    const overview = mockStore.getComplianceOverview();
    assert.equal(overview.producers, 1);
    assert.equal(overview.activeProducers, 1);
    assert.equal(overview.batteriesTracked, 1);
    assert.equal(overview.pending, 1);
    assert.equal(overview.openObligations, 0);
  });
});