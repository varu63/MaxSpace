import telemetryService, {
  validateTelemetryReading,
} from "../services/batteryTelemetryService.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { resolveBatteryByIdentifier } from "../utils/batteryIdentifier.js";
import { ownerScopeFor } from "../utils/ownerScope.js";

const maxLimit = 500;
const defaultLimit = 100;

const parseRange = (value) => {
  const t = new Date(value);
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
};

/* Bounded history window. */
const readHistoryWindow = (query = {}) => {
  const limit = Math.max(1, Math.min(Number(query.limit) || defaultLimit, maxLimit));
  return {
    limit,
    from: parseRange(query.from),
    to: parseRange(query.to),
  };
};

/* Resolve a battery identifier to a record, returning null when not found.
   Reads observe the same ownership isolation as the rest of the fleet APIs. */
const resolveBattery = async (req) => {
  const battery = await resolveBatteryByIdentifier(
    telemetryService._store(),
    req.params.id,
    ownerScopeFor(req)
  );
  if (!battery) return null;
  return battery;
};

// GET /api/batteries/:id/telemetry/latest
export const getLatestTelemetry = asyncHandler(async (req, res) => {
  const battery = await resolveBattery(req);
  if (!battery) {
    res.status(404);
    throw new Error("Battery not found");
  }
  const reading = await telemetryService.getLatest(battery.id);
  res.json({ success: true, data: reading || null, available: Boolean(reading) });
});

// GET /api/batteries/:id/telemetry/history
export const getTelemetryHistory = asyncHandler(async (req, res) => {
  const battery = await resolveBattery(req);
  if (!battery) {
    res.status(404);
    throw new Error("Battery not found");
  }
  const { limit, from, to } = readHistoryWindow(req.query);
  const history = await telemetryService.getHistory(battery.id, { limit, from, to });
  res.json({ success: true, data: history, count: history.length, limit });
});

// POST /api/batteries/:id/telemetry  (ingest from a real device/gateway)
export const submitTelemetry = asyncHandler(async (req, res) => {
  const battery = await resolveBattery(req);
  if (!battery) {
    res.status(404);
    throw new Error("Battery not found");
  }

  const status = await telemetryService.record(battery.id, req.body || {});
  if (!status) {
    res.status(404);
    throw new Error("Battery not found");
  }

  res.status(201).json({ success: true, data: status });
});

/* Used by the test suite and by potential future device integrations. */
export const _validate = validateTelemetryReading;