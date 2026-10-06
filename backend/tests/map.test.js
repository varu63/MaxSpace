/* MaxSpace Global Battery & Compliance Map unit tests.
   Run: npm test  (from backend/) — no database or live server required.
   Exercises the map validation layer, the derivation helpers, and the
   in-memory store's location + map surfaces. Security cases (USER A
   cannot see USER B's located batteries, EMPLOYEE only sees assigned
   services) are asserted against the mock store. */
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { withOptionalTestDatabase, testPool } from "./helpers/testDatabase.js";
import {
  parseMapFilters,
  parseLocationPayload,
  parseLocationPatch,
} from "../utils/mapValidation.js";
import {
  deriveHealthStatus,
  deriveLifecycle,
  complianceToBucket,
  deriveServiceBucket,
  LOCATION_TYPES,
} from "../constants/mapConfig.js";
import {
  parseBatteryCompliancePayload,
} from "../utils/complianceValidation.js";

describe("map validation", () => {
  test("parses and cleans map filters", () => {
    const filters = parseMapFilters({
      complianceStatus: "compliant",
      batteryStatus: "in_service",
      serviceStatus: "active",
      healthStatus: "healthy",
      country: " India ",
      state: "Karnataka",
      city: "Bengaluru",
      site: "Plant-1",
      locationType: "Warehouse",
      search: "MVAE",
      page: "2",
      limit: "50",
    });
    assert.equal(filters.complianceStatus, "compliant");
    assert.equal(filters.batteryStatus, "in_service");
    assert.equal(filters.serviceStatus, "active");
    assert.equal(filters.healthStatus, "healthy");
    assert.equal(filters.country, "India");
    assert.equal(filters.page, 2);
    assert.equal(filters.limit, 50);
    assert.equal(filters.offset, 50);
    assert.equal(filters.bbox, null);
  });

  test("parses a valid bounding box", () => {
    const filters = parseMapFilters({
      minLat: "8.0", minLng: "68.0", maxLat: "37.0", maxLng: "97.0",
    });
    assert.deepEqual(filters.bbox, {
      minLat: 8, minLng: 68, maxLat: 37, maxLng: 97,
    });
  });

  test("rejects an unknown complianceStatus", () => {
    assert.throws(
      () => parseMapFilters({ complianceStatus: "legal" }),
      /complianceStatus .* is not valid/
    );
  });

  test("rejects an unknown batteryStatus", () => {
    assert.throws(
      () => parseMapFilters({ batteryStatus: "Recycled" }),
      /batteryStatus .* is not valid/
    );
  });

  test("rejects a malformed bounding box", () => {
    assert.throws(
      () => parseMapFilters({ minLat: "abc", minLng: "68", maxLat: "37", maxLng: "97" }),
      /bbox requires numeric/
    );
    assert.throws(
      () => parseMapFilters({ minLat: "40", minLng: "68", maxLat: "37", maxLng: "97" }),
      /minLat <= maxLat/
    );
  });

  /* A bad bbox or an unknown filter value is caller input, not a server
     fault: the controller runs these parsers before it sets a status, so
     without an explicit statusCode the error middleware answers 500 and a
     typo looks like a broken backend. This pins the 400 contract. */
  const asError = (fn) => {
    try {
      fn();
    } catch (error) {
      return error;
    }
    assert.fail("expected the parser to reject the input");
  };

  test("map validation failures carry statusCode 400 and code 'validation'", () => {
    const cases = [
      ["non-numeric bbox", () => parseMapFilters({ minLat: "abc", minLng: "68", maxLat: "37", maxLng: "97" })],
      ["inverted bbox", () => parseMapFilters({ minLat: "40", minLng: "68", maxLat: "37", maxLng: "97" })],
      ["unknown complianceStatus", () => parseMapFilters({ complianceStatus: "Bogus" })],
      ["unknown batteryStatus", () => parseMapFilters({ batteryStatus: "Bogus" })],
      ["latitude without longitude", () => parseLocationPayload({ latitude: 28.6 })],
      ["out-of-range latitude", () => parseLocationPayload({ latitude: 991, longitude: 77.2 })],
      ["unknown locationType", () => parseLocationPayload({ address: "1 MG Road", locationType: "Elsewhere" })],
    ];
    for (const [label, fn] of cases) {
      const error = asError(fn);
      assert.equal(error.statusCode, 400, `${label} should be a 400, not a 500`);
      assert.equal(error.code, "validation", `${label} should be tagged as a validation failure`);
    }
  });

  test("accepts a complete location payload with coordinates and address", () => {
    const value = parseLocationPayload({
      latitude: 28.6139,
      longitude: 77.209,
      address: "1 MG Road",
      city: "New Delhi",
      state: "Delhi",
      country: "India",
      siteName: "Central Warehouse",
      locationType: "Warehouse",
      reason: "moved after dispatch",
    });
    assert.equal(value.latitude, 28.6139);
    assert.equal(value.country, "India");
    assert.equal(value.locationType, "Warehouse");
    assert.equal(value.reason, "moved after dispatch");
  });

  test("rejects latitude without longitude", () => {
    assert.throws(
      () => parseLocationPayload({ latitude: 28.6 }),
      /must be provided together/
    );
  });

  test("rejects a payload with no locating hint", () => {
    assert.throws(
      () => parseLocationPayload({ city: "New Delhi", state: "Delhi" }),
      /coordinates and\/or an address/
    );
  });

  test("rejects coordinates out of range", () => {
    assert.throws(
      () => parseLocationPayload({ latitude: 95, longitude: 77, address: "x" }),
      /latitude must be between/
    );
  });

  test("rejects an unknown locationType", () => {
    assert.throws(
      () => parseLocationPayload({ latitude: 1, longitude: 2, locationType: "Home" }),
      /locationType .* is not valid/
    );
  });

  test("patch returns only provided fields", () => {
    const value = parseLocationPatch({ latitude: 1, longitude: 2, hacked: true });
    assert.deepEqual(Object.keys(value).sort(), [
      "latitude", "longitude",
    ].sort());
  });
});

describe("map derivation helpers", () => {
  test("health buckets reuse the app's SoH thresholds", () => {
    assert.equal(deriveHealthStatus(94.5).key, "healthy");
    assert.equal(deriveHealthStatus(90).key, "healthy");
    assert.equal(deriveHealthStatus(85).key, "warning");
    assert.equal(deriveHealthStatus(80).key, "warning");
    assert.equal(deriveHealthStatus(74.2).key, "critical");
    assert.equal(deriveHealthStatus(null).key, "unknown");
    assert.equal(deriveHealthStatus(undefined).key, "unknown");
  });

  test("lifecycle derives only from real stored fields", () => {
    assert.equal(deriveLifecycle("PROD", false).key, "in_service");
    assert.equal(deriveLifecycle("FG PENDING", false).key, "fg_pending");
    assert.equal(deriveLifecycle("PROD", true).key, "defect_hold");
    assert.equal(deriveLifecycle(undefined, false).key, "unknown");
  });

  test("compliance buckets + not-tracked default", () => {
    assert.equal(complianceToBucket("Compliant").key, "compliant");
    assert.equal(complianceToBucket("Pending").key, "pending");
    assert.equal(complianceToBucket("In Progress").key, "under_review");
    assert.equal(complianceToBucket("Non-Compliant").key, "non_compliant");
    assert.equal(complianceToBucket("Exempt").key, "not_applicable");
    assert.deepEqual(complianceToBucket(null), {
      key: "not_tracked", label: "Not Tracked", tone: "neutral",
    });
  });

  test("service buckets only use real service statuses", () => {
    assert.equal(deriveServiceBucket("In Progress").key, "active");
    assert.equal(deriveServiceBucket("Completed").key, "completed");
    assert.equal(deriveServiceBucket("Cancelled").key, "none");
    assert.equal(deriveServiceBucket(null).key, "none");
  });
});


/* ------------------------------------------------------------------
   The location + map surface against the real PostgreSQL repository.
   These run in a throwaway database built from schema.sql, so they
   exercise the actual tables, constraints and queries. They create the
   rows they assert on: there is no seeded fake dataset any more.
   ------------------------------------------------------------------ */
const db = await withOptionalTestDatabase(import.meta.url);

describe(
  "postgres - locations + map surface",
  { skip: db ? false : "no PostgreSQL database available" },
  async () => {
  const { store, teardown } = db;
  const pool = await testPool();

  const createModel = async () => {
    await pool.query(
      `INSERT INTO battery_models
         (model_id, category, series_count, parallel_count, cell_type, welding_type)
       VALUES ('map-model-1', 'Test', 4, 2, 'NMC', 'LASER')`
    );
  };

  const createUser = (id, name) =>
    store.createUser({
      id,
      name,
      email: `${id}@example.test`,
      password: "Test-passw0rd!",
      role: "USER",
      createdAt: new Date().toISOString(),
    });

  const createBattery = async (id, ownerId) => {
    const b = await store.createBattery({
      modelId: "map-model-1",
      name: `Map Battery ${id}`,
      modelName: "Map Model",
      barcode: `MAP${id}`,
      serialNumber: `MAPSN${id}`,
      ownerId,
    });
    return b.id;
  };

let b1;
  let b2;
  let b3;

  const locate = (batteryId, over = {}) =>
    store.saveBatteryLocation(
      batteryId,
      {
        latitude: 28.6139,
        longitude: 77.209,
        address: "1 MG Road",
        city: "New Delhi",
        state: "Delhi",
        country: "India",
        siteName: "Central Warehouse",
        locationType: "Warehouse",
        ...over,
      },
      { actorId: "user-1", reason: "initial recording" }
    );

  test("empty database means an honest empty map", async () => {
    const { data, summary } = await store.listMapBatteries({ page: 1, limit: 50 });
    assert.equal(data.length, 0);
    assert.equal(summary.total, 0);
    assert.equal(summary.plotted, 0);
    assert.equal(summary.byCompliance.notTracked, 0);
  });

  test("setup: one model, two users, two batteries", async () => {
    await createModel();
    await createUser("user-1", "User One");
    await createUser("user-2", "User Two");
    b1 = await createBattery("0001", "user-1");
    b2 = await createBattery("0002", "user-1");
    assert.ok(b1 && b2);
  });

  test("recording a location surfaces a marker + summary", async () => {
    await locate(b1);
    const { data, summary } = await store.listMapBatteries({ page: 1, limit: 50 });
    assert.equal(data.length, 1);
    assert.equal(summary.total, 1);
    assert.equal(summary.plotted, 1);
    const marker = data[0];
    assert.equal(marker.batteryId, b1);
    assert.equal(marker.location.country, "India");
    assert.equal(marker.location.latitude, 28.6139);
    // a battery with no compliance record is not tracked, never compliant
    assert.equal(marker.compliance.bucket.key, "not_tracked");
    assert.equal(summary.byCompliance.notTracked, 1);
    assert.equal(summary.byCountry.length, 1);
    assert.equal(summary.byCountry[0].name, "India");
  });

  test("health/lifecycle/service filters use real stored values", async () => {
    await locate(b2, { siteName: "Solar Farm" });
    await store.updateBattery(b1, { overallStatus: "PROD", stateOfHealth: 95 });
    await store.updateBattery(b2, { overallStatus: "FG PENDING", stateOfHealth: 55 });
    await store.createBatteryCompliance(
      parseBatteryCompliancePayload(
        {
          batteryId: b1,
          complianceStatus: "Compliant",
          verifiedInApp: true,
          batteryCategory: "Medium",
        },
        { requireBatteryId: true }
      )
    );

    const healthy = await store.listMapBatteries({ healthStatus: "healthy", page: 1, limit: 50 });
    assert.equal(healthy.data.length, 1);
    assert.equal(healthy.data[0].batteryId, b1);
    assert.equal(healthy.summary.byHealth.healthy, 1);

    const critical = await store.listMapBatteries({ healthStatus: "critical", page: 1, limit: 50 });
    assert.equal(critical.data.length, 1);
    assert.equal(critical.data[0].batteryId, b2);

    const inService = await store.listMapBatteries({ batteryStatus: "in_service", page: 1, limit: 50 });
    assert.equal(inService.data.length, 1);
    assert.equal(inService.data[0].batteryId, b1);

    const compliant = await store.listMapBatteries({ complianceStatus: "compliant", page: 1, limit: 50 });
    assert.equal(compliant.data.length, 1);
    assert.equal(compliant.summary.byCompliance.compliant, 1);

    const notApplicable = await store.listMapBatteries({ complianceStatus: "not_applicable", page: 1, limit: 50 });
    assert.equal(notApplicable.data.length, 1);
    assert.equal(notApplicable.data[0].batteryId, b2);
  });

  test("service status filters use the assigned-service system", async () => {
    await store.createService({
      id: "srv-map-1",
      ticketNumber: "SRV-MAP-0001",
      batteryId: b1,
      serviceType: "On-site repair",
      center: "Delhi Center",
      scheduledDate: "2026-09-30",
      scheduledTime: "10:00",
      mobileNumber: "9800000000",
      status: "In Progress",
      priority: "High",
      customerId: "user-1",
      assignedServicePersonId: null,
      createdAt: "2026-09-25T08:00:00.000Z",
      history: [],
    });
    const active = await store.listMapBatteries({ serviceStatus: "active", page: 1, limit: 50 });
    assert.equal(active.data.length, 1);
    assert.equal(active.data[0].batteryId, b1);
    assert.equal(active.data[0].service.status, "In Progress");
    assert.equal(active.summary.byService.active, 1);
    // b2 has a location but no service, so it is the only "none" marker
    const none = await store.listMapBatteries({ serviceStatus: "none", page: 1, limit: 50 });
    assert.equal(none.data.length, 1);
    assert.equal(none.data[0].batteryId, b2);
    assert.equal(none.summary.byService.none, 1);
  });

  test("owner isolation: USER A never sees USER B's located batteries", async () => {
    // user-2 owns nothing - its map must be empty even though the fleet has markers
    const forUserB = await store.listMapBatteries({ ownerId: "user-2", page: 1, limit: 50 });
    assert.equal(forUserB.data.length, 0);
    assert.equal(forUserB.summary.total, 0);
    const forUserA = await store.listMapBatteries({ ownerId: "user-1", page: 1, limit: 50 });
    assert.ok(forUserA.data.length >= 1);
  });

  test("employee scope shows only batteries with a service assigned to them", async () => {
    await store.createServicePerson({
      id: "person-9",
      technicianId: "T-9",
      name: "Tech Nine",
      email: "tech9@example.test",
      phone: "9800000009",
      certification: "NMC",
      specializations: ["Repair"],
      createdAt: "2026-09-01",
    });
    b3 = await createBattery("0003", "user-1");
    await locate(b3);
    await store.createService({
      id: "srv-map-2",
      ticketNumber: "SRV-MAP-0002",
      batteryId: b3,
      serviceType: "Inspection",
      center: "Delhi Center",
      scheduledDate: "2026-09-30",
      scheduledTime: "11:00",
      mobileNumber: "9800000000",
      status: "Assigned",
      priority: "Normal",
      customerId: "user-1",
      assignedServicePersonId: "person-9",
      createdAt: "2026-09-25T08:00:00.000Z",
      history: [],
    });
    const forTech = await store.listMapBatteries({ employeePersonId: "person-9", page: 1, limit: 50 });
    assert.equal(forTech.data.length, 1);
    assert.equal(forTech.data[0].batteryId, b3);
  });

  test("bbox filter returns only batteries inside the area", async () => {
    const inside = await store.listMapBatteries({
      bbox: { minLat: 25, minLng: 70, maxLat: 35, maxLng: 85 },
      page: 1,
      limit: 50,
    });
    assert.ok(inside.data.length >= 1);
    const outside = await store.listMapBatteries({
      bbox: { minLat: 5, minLng: 60, maxLat: 10, maxLng: 70 },
      page: 1,
      limit: 50,
    });
    assert.equal(outside.data.length, 0);
    assert.equal(outside.summary.total, 0);
  });

test("search matches battery id, site, city, producer and owner", async () => {
    const producer = await store.createComplianceProducer({
      producerName: "GreenCycle Pvt Ltd",
      registrationNumber: "CPCB/BAT/2026/0001",
    });
    // b1 already carries a compliance row from the filter test; the schema
    // allows exactly one per battery, so this updates it in place.
    assert.ok(await store.getBatteryCompliance(b1), "b1 should already be tracked");
    await store.updateBatteryCompliance(b1, {
      producerId: producer.id,
      complianceStatus: "Pending",
    });

    /* Assert which batteries matched, not just how many. Earlier versions of
       this test counted rows, which silently went stale once another test
       added a battery at the same site. */
    const matched = async (search) =>
      (await store.listMapBatteries({ search, page: 1, limit: 50 })).data
        .map((marker) => marker.batteryId)
        .sort();

    assert.deepEqual(await matched(b1), [b1]);
    assert.deepEqual(await matched("Central"), [b1, b3].sort());
    assert.deepEqual(await matched("New Delhi"), [b1, b2, b3].sort());
    assert.deepEqual(await matched("GreenCycle"), [b1]);
    assert.deepEqual(await matched("Solar Farm"), [b2]);
    assert.deepEqual(await matched("does-not-exist"), []);
  });

  test("saving a location writes history; unchanged saves do not", async () => {
    const batteryId = b2;
    const before = (await store.getBatteryLocationHistory(batteryId)).length;

    await locate(batteryId, { city: "Mumbai", state: "Maharashtra", country: "India", siteName: "West Hub" });
    const history = await store.getBatteryLocationHistory(batteryId);
    assert.equal(history.length, before + 1);
    assert.equal(history[0].previousLocation.city, "New Delhi");
    assert.equal(history[0].newLocation.city, "Mumbai");
    assert.equal(history[0].reason, "initial recording");

    // same payload -> no new history entry
    await locate(batteryId, { city: "Mumbai", state: "Maharashtra", country: "India", siteName: "West Hub" });
    assert.equal((await store.getBatteryLocationHistory(batteryId)).length, before + 1);
  });

  test("admin location registry list, filter, delete", async () => {
    const batteryId = b2;
    const { data, pagination } = await store.listBatteryLocations({ search: batteryId, page: 1, limit: 10 });
    assert.equal(data.length, 1);
    assert.equal(data[0].batteryName, (await store.getBatteryById(batteryId)).name);
    assert.equal(pagination.total, 1);

    const filtered = await store.listBatteryLocations({ country: "India" });
    assert.ok(filtered.data.length >= 1);
    const empty = await store.listBatteryLocations({ country: "Nigeria" });
    assert.equal(empty.data.length, 0);

    assert.equal(await store.deleteBatteryLocation(batteryId), true);
    assert.equal(await store.getBatteryLocation(batteryId), null);
    const { summary } = await store.listMapBatteries({ page: 1, limit: 50 });
    assert.ok(summary.total < 3, "a deleted location should leave the map");
  });

  test("summary aggregates update with filters", async () => {
    const batteryId = b2;
    await locate(batteryId);
    await store.updateBattery(batteryId, { overallStatus: "PROD", stateOfHealth: 72 });
    await store.createBatteryCompliance({ batteryId, complianceStatus: "In Progress" });

    const { summary } = await store.listMapBatteries({
      complianceStatus: "under_review",
      page: 1,
      limit: 50,
    });
    assert.equal(summary.total, 1);
    assert.equal(summary.byCompliance.underReview, 1);
    assert.equal(summary.byCompliance.notTracked, 0);
    assert.equal(summary.byHealth.critical, 1);
    assert.equal(summary.byLifecycle.inService, 1);
    assert.equal(summary.byService.none, 1);
  });

  test("LOCATION_TYPES vocabulary is validated and exhaustive", () => {
    assert.ok(LOCATION_TYPES.length >= 6);
    assert.ok(LOCATION_TYPES.includes("Customer Site"));
  });

test("teardown drops the throwaway database", async () => {
    await pool.end().catch(() => {});
    await teardown();
  });
  }
);

