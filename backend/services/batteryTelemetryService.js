/* ============================================================
   BATTERY TELEMETRY SERVICE
   The IoT/BMS integration seam for MaxSpace.

   Today the app has no connected hardware: batteries carry static
   passport fields with no live readings. This service is where real
   telemetry will flow in later (see "Future BMS / IoT Integration"
   in the README). It intentionally:

     • validates every reading before it touches the store,
     • treats recorded_at as the sample time (a gateway/EQ may batch
       older readings), rejecting only wildly-future timestamps,
     • returns plain "latest" and "history" accessors that read from
       the same store the rest of the backend uses,
     • exposes a TelemetryProvider contract so future adapters plug
       into BatteryTelemetryService.record().

   Only real device/API data is ever recorded here. Nothing is
   fabricated or simulated.
============================================================ */

/* Charge / fault state vocabularies shared by all providers. */
export const CHARGING_STATUSES = [
  "charging",
  "discharging",
  "idle",
  "standby",
  "unknown",
];

export const TELEMETRY_SOURCES = [
  "api",
  "bms",
  "mqtt",
  "can-bus",
  "rs485",
  "bluetooth",
  "manual",
  "other",
];

/* Physical bounds a sensible pack should stay within. A reading
   outside these is rejected as malformed, not persisted. */
export const TELEMETRY_LIMITS = {
  voltage: { min: 0, max: 2000 },
  current: { min: -5000, max: 5000 },
  temperatureC: { min: -100, max: 300 },
  soc: { min: 0, max: 100 },
  soh: { min: 0, max: 100 },
  cycleCount: { min: 0, max: 10_000_000 },
};

/* Maximum clock skew allowed on a reported recorded_at (sample time
   may be slightly in the future due to device clock drift). */
export const MAX_RECORD_FUTURE_MS = 30 * 1000;

const isFiniteNumber = (v) => typeof v === "number" && Number.isFinite(v);
const toNum = (v) => {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/* Forward reference: resolved later in this module so a subclass can
   call the Service. Kept as a function to avoid circular import time
   issues when providers are wired up in index.js. */
let activeStore = null;
export const setTelemetryStore = (store) => {
  activeStore = store;
};
export const getTelemetryStore = () => activeStore;

/* ============================================================
   TelemetryProvider — contract for future IoT/BMS adapters
   ------------------------------------------------------------
   Implementations bridge a physical source into the service:

     class MqttTelemetryProvider extends TelemetryProvider {}
     class BmsApiTelemetryProvider extends TelemetryProvider {}
     class CanBusTelemetryProvider extends TelemetryProvider {}
     class Rs485TelemetryProvider extends TelemetryProvider {}

   Required members:
     name        — short string identifying the source (stored as
                   the reading's `source` when not overridden).
     describe()  — returns { name, type, connected } for /health or
                   debug endpoints.
     start()     — connect the transport; reject if unavailable.
     stop()      — disconnect cleanly.
     poll()      — return the latest raw snapshot as a plain object
                   that Service.record() can validate:
                     { batteryId, voltage, current, temperatureC,
                       soc, soh, cycleCount, chargingStatus,
                       faultStatus, recordedAt }
                   Return null when no new sample is available.

   The Service is transport-agnostic: a provider simply calls
   BatteryTelemetryService.record(snapshot) (or the ingest API is used
   by an external gateway). No polling loop is started by this module.
============================================================ */
export class TelemetryProvider {
  constructor() {
    if (new.target === TelemetryProvider) {
      throw new Error(
        "TelemetryProvider is an interface. Implement it (or use a helper) rather than instantiating it directly."
      );
    }
  }
}

/* Named placeholder helpers (Documented-only, non-functional until a
   real transport is chosen; see README "Future BMS / IoT Integration"). */
export const describeTelemetryProvider = () => ({
  connected: false,
  transport: "not-configured",
  note: "MaxSpace has no IoT gateway connected yet. Telemetry appears here as soon as a real device pushes data.",
});

/* ============================================================
   Validation
============================================================ */
export const validateTelemetryReading = (reading = {}) => {
  const errors = [];
  const out = {};

  const batteryId = String(reading.batteryId ?? reading.battery_id ?? "").trim();
  if (!batteryId) {
    errors.push("batteryId is required");
  } else {
    out.batteryId = batteryId;
  }

  /* Numeric pack readings. */
  const fieldMap = [
    { key: "voltage", clamp: TELEMETRY_LIMITS.voltage },
    { key: "current", clamp: TELEMETRY_LIMITS.current },
    { key: "temperatureC", clamp: TELEMETRY_LIMITS.temperatureC },
    { key: "soc", clamp: TELEMETRY_LIMITS.soc },
    { key: "soh", clamp: TELEMETRY_LIMITS.soh },
  ];
  for (const { key, clamp } of fieldMap) {
    const raw = reading[key];
    if (raw === null || raw === undefined || raw === "") continue;
    const n = toNum(raw);
    if (n === undefined) {
      errors.push(`${key} must be a number`);
      continue;
    }
    if (n < clamp.min || n > clamp.max) {
      errors.push(`${key} must be between ${clamp.min} and ${clamp.max}`);
      continue;
    }
    out[key] = n;
  }

  const cycleCount = toNum(reading.cycleCount);
  if (cycleCount !== undefined) {
    if (!Number.isInteger(cycleCount) || cycleCount < 0) {
      errors.push("cycleCount must be a non-negative integer");
    } else {
      out.cycleCount = cycleCount;
    }
  }

  /* Charging status. */
  const chargingStatus = String(reading.chargingStatus ?? reading.charging_status ?? "").trim();
  if (chargingStatus) {
    if (!CHARGING_STATUSES.includes(chargingStatus)) {
      errors.push(
        `chargingStatus must be one of: ${CHARGING_STATUSES.join(", ")}`
      );
    } else {
      out.chargingStatus = chargingStatus;
    }
  }

  /* Fault status is free-form text (gateway encoder) — capped, not enum'd. */
  const faultStatus =
    reading.faultStatus !== undefined && reading.faultStatus !== null
      ? String(reading.faultStatus).trim()
      : "";
  if (faultStatus.length > 255) {
    errors.push("faultStatus must be 255 characters or fewer");
  } else {
    out.faultStatus = faultStatus || null;
  }

  /* Source. */
  const source = String(reading.source ?? "api").trim().toLowerCase();
  if (!TELEMETRY_SOURCES.includes(source)) {
    errors.push(`source must be one of: ${TELEMETRY_SOURCES.join(", ")}`);
  } else {
    out.source = source;
  }

  /* Timestamp: sample time as an ISO string or epoch milliseconds.
     Stored as an ISO string (TimeStampTZ column on postgres). */
  const rawTime =
    reading.recordedAt !== undefined
      ? reading.recordedAt
      : reading.recorded_at !== undefined
        ? reading.recorded_at
        : null;
  if (rawTime === null || rawTime === undefined || rawTime === "") {
    out.recordedAt = new Date().toISOString();
  } else {
    let date = null;
    if (typeof rawTime === "string") {
      date = new Date(rawTime);
      if (Number.isNaN(date.getTime()) && /^\d+$/.test(rawTime)) {
        date = new Date(Number(rawTime));
      }
    } else if (typeof rawTime === "number") {
      date = new Date(rawTime);
    }
    if (!date || Number.isNaN(date.getTime())) {
      errors.push("recordedAt must be an ISO-8601 string or epoch milliseconds");
    } else {
      const futureMs = date.getTime() - Date.now();
      if (futureMs > MAX_RECORD_FUTURE_MS) {
        errors.push("recordedAt cannot be in the future");
      } else {
        out.recordedAt = date.toISOString();
      }
    }
  }

  return { ok: errors.length === 0, errors, value: out };
};

/* ============================================================
   BatteryTelemetryService — the seam the controllers use.
============================================================ */
export class BatteryTelemetryService {
  constructor(store = null) {
    this.store = store || activeStore;
  }

  _store() {
    if (!this.store && activeStore) this.store = activeStore;
    if (!this.store) {
      throw new Error("BatteryTelemetryService has no data store — call setTelemetryStore(store) before use");
    }
    return this.store;
  }

  /* Persist a validated reading for a battery. Returns the stored row
     or null when the battery does not exist. */
  async record(readingOrBatteryId, reading = null) {
    let payload = reading;
    if (reading === null && typeof readingOrBatteryId === "object") {
      payload = readingOrBatteryId;
    } else if (typeof readingOrBatteryId === "string") {
      payload = { ...(reading || {}), batteryId: readingOrBatteryId };
    }
    if (!payload || typeof payload !== "object") {
      throw Object.assign(new Error("A reading is required"), { code: "validation", statusCode: 400 });
    }

    const { ok, errors, value } = validateTelemetryReading(payload);
    if (!ok) {
      throw Object.assign(new Error(errors.join("; ")), { code: "validation", statusCode: 400, fieldErrors: errors });
    }

    const store = this._store();
    const battery = await store.getBatteryById(value.batteryId);
    if (!battery) return null;

    return store.addBatteryTelemetry(value);
  }

  /* Most recent reading for a battery, or null. */
  async getLatest(batteryId) {
    const store = this._store();
    return store.getLatestBatteryTelemetry(batteryId);
  }

  /* Time-series for a battery, ordered oldest→newest.
     { limit (default 100, max 500), from, to } are optional. */
  async getHistory(batteryId, { limit = 100, from, to } = {}) {
    const store = this._store();
    return store.getBatteryTelemetryHistory(batteryId, { limit, from, to });
  }
}

export default new BatteryTelemetryService();