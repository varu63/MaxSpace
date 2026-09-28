/* ============================================================
   FLEET MAP CONTROLLER
   Two surfaces:

   1. GET /api/map/batteries — role-scoped map markers + summary.
      - ADMIN   → the whole fleet, markers include the linked owner.
      - USER    → ONLY batteries the account owns (owner_id isolation,
                  identical to the rest of the fleet APIs).
      - EMPLOYEE→ ONLY batteries that have a service assigned to the
                  technician linked to that account (a stricter scope
                  than the fleet registry, per the map privacy policy:
                  a technician's map shows only what they are assigned
                  to service).
      No role ever sees batteries with no location row (they are not
      on the map), and a missing compliance record is reported as
      "not tracked" — never as compliant.

   2. /api/map/locations/* (ADMIN only) — record the REAL current
      location of a battery + append-only movement history. Nothing
      auto-generates coordinates; creating/deleting rows requires an
      ADMIN and validated input (see mapValidation.js).
============================================================ */
import store from "../data/index.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { parsePagination } from "../utils/pagination.js";
import { parseMapFilters, parseLocationPayload } from "../utils/mapValidation.js";
import { resolveBatteryByIdentifier } from "../utils/batteryIdentifier.js";
import { MAP_MAX_LIMIT } from "../constants/mapConfig.js";
import { organizationsForRole } from "../utils/organizationLocations.js";

/* Authorization decision for the map. See the role matrix above —
   deliberately NOT the generic operator-wide scope used by the fleet
   registry so a technician's map cannot expose other customers' data. */
const mapScopeFor = async (req) => {
  const role = req.user && req.user.role;
  if (role === "ADMIN") {
    return { ownerId: null, employeePersonId: null, includeOwner: true };
  }
  if (role === "USER") {
    return { ownerId: req.user.id, employeePersonId: null, includeOwner: false };
  }
  if (role === "EMPLOYEE") {
    const user = await store.getUserById(req.user.id);
    return {
      ownerId: null,
      employeePersonId: (user && user.servicePersonId) || null,
      includeOwner: false,
    };
  }
  return { ownerId: null, employeePersonId: null, includeOwner: false };
};

// GET /api/map/batteries — map markers + summary for the caller's scope.
// The map UI fetches the whole matched set once per filter change and
// clusters client-side, so the default size is MAP_MAX_LIMIT (not the
// page limit used by list pages). Large deployments can page region by
// region via `bbox` plus a smaller `limit`.
export const getMapBatteries = asyncHandler(async (req, res) => {
  const filters = parseMapFilters(req.query);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || MAP_MAX_LIMIT, MAP_MAX_LIMIT));
  const scope = await mapScopeFor(req);
  const { data, pagination, summary } = await store.listMapBatteries({
    ...scope,
    ...filters,
    page,
    limit,
  });
  res.json({ success: true, data, pagination, summary });
});

// GET /api/map/organizations — visual network markers for the compliance /
// facility map. Read-only for every authenticated role but ROLE-SCOPED in
// the backend (see organizationsForRole): Admin sees the whole network,
// Users and Battery Technicians only the Service Providers that are
// relevant to them. Company facilities are never returned to them. The
// optional ?type= filter is clamped to the caller's allowed set.
export const getOrganizationLocations = asyncHandler(async (req, res) => {
  const requested = typeof req.query.type === "string" ? req.query.type.trim() : "";
  const data = await organizationsForRole(req.user && req.user.role, requested);
  res.json({ success: true, data });
});

// GET /api/map/locations — admin registry of recorded locations.
export const getMapLocations = asyncHandler(async (req, res) => {
  const { page, limit, sort, order } = parsePagination(req.query);
  const str = (key) => (typeof req.query[key] === "string" ? req.query[key].trim() : "");
  const results = await store.listBatteryLocations({
    search: str("search"),
    country: str("country"),
    state: str("state"),
    city: str("city"),
    site: str("site"),
    locationType: str("locationType"),
    page,
    limit,
    sort,
    order,
  });
  res.json({ success: true, data: results.data, pagination: results.pagination });
});

// GET /api/map/locations/:batteryId — one battery's location + movement history.
export const getMapLocation = asyncHandler(async (req, res) => {
  const location = await store.getBatteryLocation(req.params.batteryId);
  if (!location) {
    res.status(404);
    throw new Error("No location is recorded for this battery");
  }
  const history = await store.getBatteryLocationHistory(req.params.batteryId);
  res.json({ success: true, data: { ...location, history } });
});

// PUT /api/map/locations/:batteryId — record a battery's real location.
export const saveMapLocation = asyncHandler(async (req, res) => {
  const battery = await resolveBatteryByIdentifier(store, req.params.batteryId);
  if (!battery) {
    res.status(404);
    throw new Error("Battery not found");
  }
  const payload = parseLocationPayload(req.body);
  const location = await store.saveBatteryLocation(battery.id, payload, {
    actorId: req.user && req.user.id,
    reason: payload.reason,
  });
  res.status(201).json({ success: true, data: location });
});

// DELETE /api/map/locations/:batteryId — remove a recorded location.
export const deleteMapLocation = asyncHandler(async (req, res) => {
  const deleted = await store.deleteBatteryLocation(req.params.batteryId);
  if (!deleted) {
    res.status(404);
    throw new Error("No location is recorded for this battery");
  }
  res.json({ success: true, data: { batteryId: req.params.batteryId, deleted: true } });
});

// GET /api/map/locations/:batteryId/history — append-only movement log.
export const getMapLocationHistory = asyncHandler(async (req, res) => {
  const history = await store.getBatteryLocationHistory(req.params.batteryId);
  res.json({ success: true, data: history });
});