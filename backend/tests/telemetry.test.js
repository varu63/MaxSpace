/* MaxSpace telemetry unit tests (Node's built-in test runner).
   Run: npm test  (from backend/) — no database or live server required.
   These are read-only with respect to any database: telemetry reading
   validation and the in-memory store are exercised in isolation. */
import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  validateTelemetryReading,
  CHARGING_STATUSES,
  TELEMETRY_SOURCES,
  TELEMETRY_LIMITS,
  MAX_RECORD_FUTURE_MS,
  BatteryTelemetryService,
  setTelemetryStore,
} from "../services/batteryTelemetryService.js";
import mockStore from "../data/store.js";

/* A tiny fake store that mirrors the interface the service expects,
   so tests never depend on the seeded dataset. */
const makeFakeStore = () => {
  const rows = [];
  const batteries = new Set();
  return {
    rows,
    batteries,
    async getBatteryById(id) {
      return batteries.has(id) ? { id } : null;
    },
    async addBatteryTelemetry(reading) {
      const row = { id: rows.length + 1, ...reading };
      rows.push(row);
      return row;
    },
    async getLatestBatteryTelemetry(batteryId) {
      const mine = rows
        .filter((r) => r.batteryId === batteryId)
        .sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));
      return mine[mine.length - 1] || null;
    },
    async getBatteryTelemetryHistory(batteryId, { limit = 100, from, to } = {}) {
      let mine = rows
        .filter((r) => r.batteryId === batteryId)
        .sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));
      if (from) mine = mine.filter((r) => new Date(r.recordedAt) >= new Date(from));
      if (to) mine = mine.filter((r) => new Date(r.recordedAt) <= new Date(to));
      return mine.slice(-Math.min(limit, 500));
    },
  };
};

describe("validateTelemetryReading", () => {
  test("accepts a complete valid reading", () => {
    const { ok, errors, value } = validateTelemetryReading({
      batteryId: "batt-1",
      voltage: 48.2,
      current: -3.5,
      temperatureC: 28.4,
      soc: 87,
      soh: 95,
      cycleCount: 212,
      chargingStatus: "discharging",
      faultStatus: null,
      source: "manual",
      recordedAt: new Date().toISOString(),
    });
    assert.equal(ok, true);
    assert.equal(errors.length, 0);
    assert.equal(value.batteryId, "batt-1");
    assert.equal(value.source, "manual");
    assert.ok(value.recordedAt);
  });

  test("rejects a missing batteryId", () => {
    const { ok, errors } = validateTelemetryReading({ soc: 50 });
    assert.equal(ok, false);
    assert.ok(errors.some((e) => e.includes("batteryId")));
  });

  test("rejects out-of-range numeric fields", () => {
    const cases = [
      { key: "voltage", bad: -1, good: TELEMETRY_LIMITS.voltage.min },
      { key: "soc", bad: 150, good: 100 },
      { key: "soh", bad: -5, good: 0 },
      { key: "temperatureC", bad: 9999, good: 300 },
    ];
    for (const { key, bad, good } of cases) {
      const badResult = validateTelemetryReading({ batteryId: "x", [key]: bad });
      assert.equal(badResult.ok, false, `${key}: ${bad} should fail`);
      assert.ok(
        badResult.errors.some((e) => e.includes(key)),
        `${key} error mentions the field`
      );
      const goodResult = validateTelemetryReading({ batteryId: "x", [key]: good });
      assert.equal(goodResult.ok, true, `${key}: ${good} should pass`);
    }
  });

  test("rejects non-numeric numerics", () => {
    const { ok, errors } = validateTelemetryReading({ batteryId: "x", soc: "NaN" });
    assert.equal(ok, false);
    assert.ok(errors.some((e) => e.includes("soc")));
  });

  test("rejects unknown chargingStatus", () => {
    const { ok, errors } = validateTelemetryReading({
      batteryId: "x",
      chargingStatus: "overheating",
    });
    assert.equal(ok, false);
    assert.ok(errors.some((e) => e.includes("chargingStatus")));
  });

  test("rejects unknown source", () => {
    const { ok, errors } = validateTelemetryReading({ batteryId: "x", source: "hacker" });
    assert.equal(ok, false);
    assert.ok(errors.some((e) => e.includes("source")));
  });

  test("rejects unparseable recordedAt", () => {
    const { ok, errors } = validateTelemetryReading({
      batteryId: "x",
      recordedAt: "not-a-date",
    });
    assert.equal(ok, false);
    assert.ok(errors.some((e) => e.includes("recordedAt")));
  });

  test("rejects future-recordedAt beyond clock skew", () => {
    const farFuture = new Date(Date.now() + MAX_RECORD_FUTURE_MS + 1000).toISOString();
    const { ok, errors } = validateTelemetryReading({ batteryId: "x", recordedAt: farFuture });
    assert.equal(ok, false);
    assert.ok(errors.some((e) => e.includes("future")));
  });

  test("defaults missing recordedAt / source", () => {
    const { ok, value } = validateTelemetryReading({ batteryId: "x", voltage: 12 });
    assert.equal(ok, true);
    assert.equal(value.source, "api");
    assert.ok(value.recordedAt);
  });

  test("accepts epoch-millisecond recordedAt", () => {
    const ms = Math.floor(Date.now() / 1000) * 1000 - 5000; // whole seconds
    const { ok, value } = validateTelemetryReading({ batteryId: "x", recordedAt: ms });
    assert.equal(ok, true);
    assert.equal(new Date(value.recordedAt).getTime(), ms); // round-trips losslessly
  });

  test("vocabularies are non-empty and stable", () => {
    assert.ok(CHARGING_STATUSES.includes("charging"));
    assert.ok(TELEMETRY_SOURCES.includes("api"));
    assert.deepEqual(TELEMETRY_LIMITS.soc, { min: 0, max: 100 });
  });
});

describe("BatteryTelemetryService", () => {
  let fakeStore;
  let service;

  beforeEach(() => {
    fakeStore = makeFakeStore();
    service = new BatteryTelemetryService(fakeStore);
  });

  afterEach(() => {
    setTelemetryStore(null);
  });

  test("records a validated reading", async () => {
    fakeStore.batteries.add("batt-1");
    const row = await service.record({
      batteryId: "batt-1",
      soc: 90,
      voltage: 48,
      source: "bms",
    });
    assert.ok(row);
    assert.equal(row.soc, 90);
    assert.equal(fakeStore.rows.length, 1);
  });

  test("record() returns null for a missing battery", async () => {
    const row = await service.record({ batteryId: "ghost", soc: 50 });
    assert.equal(row, null);
    assert.equal(fakeStore.rows.length, 0);
  });

  test("record() throws a 400 validation error on bad payload", async () => {
    fakeStore.batteries.add("batt-1");
    await assert.rejects(
      () => service.record({ batteryId: "batt-1", soc: 250 }),
      (err) => err.statusCode === 400 && err.code === "validation"
    );
    assert.equal(fakeStore.rows.length, 0); // nothing persisted on failure
  });

  test("latest() returns the newest reading only", async () => {
    fakeStore.batteries.add("batt-1");
    await service.record({ batteryId: "batt-1", soc: 10, recordedAt: new Date(Date.now() - 5000).toISOString() });
    await service.record({ batteryId: "batt-1", soc: 20, recordedAt: new Date().toISOString() });
    const latest = await service.getLatest("batt-1");
    assert.equal(latest.soc, 20);
  });

  test("getHistory() returns rows oldest→newest within the window", async () => {
    fakeStore.batteries.add("batt-1");
    await service.record({ batteryId: "batt-1", soc: 10, recordedAt: new Date("2026-01-01T00:00:00Z").toISOString() });
    await service.record({ batteryId: "batt-1", soc: 20, recordedAt: new Date("2026-01-02T00:00:00Z").toISOString() });
    await service.record({ batteryId: "batt-1", soc: 30, recordedAt: new Date("2026-01-03T00:00:00Z").toISOString() });
    const all = await service.getHistory("batt-1");
    assert.deepEqual(all.map((r) => r.soc), [10, 20, 30]);

    const windowed = await service.getHistory("batt-1", {
      from: new Date("2026-01-01T12:00:00Z").toISOString(),
      to: new Date("2026-01-02T12:00:00Z").toISOString(),
    });
    assert.deepEqual(windowed.map((r) => r.soc), [20]);
  });

  test("getHistory() limit is respected and bounded", async () => {
    fakeStore.batteries.add("batt-1");
    for (let i = 0; i < 10; i++) {
      await service.record({
        batteryId: "batt-1",
        soc: i,
        recordedAt: new Date(2026, 0, i + 1).toISOString(),
      });
    }
    const few = await service.getHistory("batt-1", { limit: 3 });
    assert.equal(few.length, 3);
    assert.deepEqual(few.map((r) => r.soc), [7, 8, 9]); // newest last
  });
});

/* The real seeded mock store must expose the telemetry surface too. */
describe("mock store telemetry integration", () => {
  beforeEach(() => setTelemetryStore(mockStore));

  test("addBatteryTelemetry / getLatestBatteryTelemetry / getBatteryTelemetryHistory work end-to-end", () => {
    const batteryId = mockStore.batteries[0].id;
    const a = mockStore.addBatteryTelemetry({
      batteryId,
      soc: 55,
      recordedAt: new Date(Date.now() - 1000).toISOString(),
    });
    const b = mockStore.addBatteryTelemetry({
      batteryId,
      soc: 56,
      recordedAt: new Date().toISOString(),
    });
    assert.ok(a.id);
    assert.ok(b.id);
    assert.equal(mockStore.getLatestBatteryTelemetry(batteryId).soc, 56);
    const history = mockStore.getBatteryTelemetryHistory(batteryId);
    assert.equal(history.length, 2);
    assert.deepEqual(history.map((r) => r.id), [a.id, b.id]);
  });

  test("service wired to the seeded mock store can record", async () => {
    const batteryId = mockStore.batteries[0].id;
    const svc = new BatteryTelemetryService(mockStore);
    const row = await svc.record({ batteryId, soc: 42, source: "other" });
    assert.ok(row);
    assert.equal(row.batteryId, batteryId);
  });
});