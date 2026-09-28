/* ============================================================
   MAP VALIDATION + FILTER PARSING
   Mirrors backend/utils/complianceValidation.js: the filter and
   location vocabulary lives in backend/constants/mapConfig.js and
   every input validates against it here, so invalid values return
   clean 400 responses in both mock and postgres modes — never raw
   database errors.

   Contract:
     parseMapFilters         — query-string filters; unknown filter
                               values and malformed bounding boxes throw.
     parseLocationPayload    — full location save payload. Coordinates
                               are required together; at least one
                               locating hint (coords or address) must
                               exist, mirroring the DB CHECK guard.
     parseLocationPatch      — partial updates; only present keys.
============================================================ */
import {
  COMPLIANCE_FILTERS,
  BATTERY_STATUS_FILTERS,
  SERVICE_FILTERS,
  HEALTH_FILTERS,
  LOCATION_TYPES,
} from "../constants/mapConfig.js";
import { parsePagination } from "./pagination.js";

const cleanText = (value, max = 200) =>
  value === undefined || value === null ? "" : String(value).trim().slice(0, max);

const cleanOptionalText = (value, max = 200) => {
  const s = cleanText(value, max);
  return s || null;
};

const filterValues = (filters) => filters.map((f) => f.value);

/* Validate a single map filter value against its allowed vocabulary. */
const assertFilter = (value, list, field) => {
  if (value === undefined || value === null || value === "") return "";
  if (!list.includes(value)) {
    throw new Error(
      `${field} "${value}" is not valid. Expected one of: ${list.join(", ")}.`
    );
  }
  return value;
};

/* Parse + validate map query filters. Never returns raw values — unknown
   keys are ignored, known keys are cleaned. Throws on invalid enum values
   or a malformed bounding box. */
export const parseMapFilters = (query = {}) => {
  const complianceStatus = assertFilter(
    query.complianceStatus,
    filterValues(COMPLIANCE_FILTERS),
    "complianceStatus"
  );
  const batteryStatus = assertFilter(
    query.batteryStatus,
    filterValues(BATTERY_STATUS_FILTERS),
    "batteryStatus"
  );
  const serviceStatus = assertFilter(
    query.serviceStatus,
    filterValues(SERVICE_FILTERS),
    "serviceStatus"
  );
  const healthStatus = assertFilter(
    query.healthStatus,
    filterValues(HEALTH_FILTERS),
    "healthStatus"
  );
  const locationType = assertFilter(query.locationType, LOCATION_TYPES, "locationType");

  const pagination = parsePagination(query);

  let bbox = null;
  const raw = {
    minLat: query.minLat,
    minLng: query.minLng,
    maxLat: query.maxLat,
    maxLng: query.maxLng,
  };
  const hasAnyBbox = Object.values(raw).some((v) => v !== undefined && v !== null && v !== "");
  if (hasAnyBbox) {
    const minLat = Number(raw.minLat);
    const minLng = Number(raw.minLng);
    const maxLat = Number(raw.maxLat);
    const maxLng = Number(raw.maxLng);
    if (![minLat, minLng, maxLat, maxLng].every(Number.isFinite)) {
      throw new Error("bbox requires numeric minLat, minLng, maxLat, maxLng");
    }
    if (minLat < -90 || maxLat > 90 || minLat > maxLat) {
      throw new Error("bbox latitudes must be between -90 and 90 with minLat <= maxLat");
    }
    if (minLng < -180 || maxLng > 180 || minLng > maxLng) {
      throw new Error("bbox longitudes must be between -180 and 180 with minLng <= maxLng");
    }
    bbox = { minLat, minLng, maxLat, maxLng };
  }

  return {
    complianceStatus,
    batteryStatus,
    serviceStatus,
    healthStatus,
    locationType,
    country: cleanText(query.country, 100),
    state: cleanText(query.state, 100),
    city: cleanText(query.city, 100),
    site: cleanText(query.site, 150),
    search: cleanText(query.search, 200),
    bbox,
    page: pagination.page,
    limit: pagination.limit,
    offset: pagination.offset,
    sort: pagination.sort,
    order: pagination.order,
  };
};

const cleanCoordinate = (value, field) => {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`${field} must be a number`);
  if (field === "latitude" && (n < -90 || n > 90)) {
    throw new Error("latitude must be between -90 and 90");
  }
  if (field === "longitude" && (n < -180 || n > 180)) {
    throw new Error("longitude must be between -180 and 180");
  }
  return n;
};

/* Full location save payload (used by the admin upsert route). Requires
   at least one locating hint; coordinates are atomic (both or neither).
   Mirrors the battery_locations CHECK guards. */
export const parseLocationPayload = (body = {}) => {
  const latitude = cleanCoordinate(body.latitude, "latitude");
  const longitude = cleanCoordinate(body.longitude, "longitude");
  if ((latitude === null) !== (longitude === null)) {
    throw new Error(
      "latitude and longitude must be provided together (or both omitted for an address-only location)"
    );
  }
  const address = cleanOptionalText(body.address, 400);
  if (!latitude && !address) {
    throw new Error("provide coordinates and/or an address to record a location");
  }
  const locationType = cleanOptionalText(body.locationType, 100) || "Other";
  if (!LOCATION_TYPES.includes(locationType)) {
    throw new Error(
      `locationType "${locationType}" is not valid. Expected one of: ${LOCATION_TYPES.join(", ")}.`
    );
  }
  return {
    latitude,
    longitude,
    address,
    city: cleanOptionalText(body.city, 100),
    state: cleanOptionalText(body.state, 100),
    country: cleanOptionalText(body.country, 100),
    siteName: cleanOptionalText(body.siteName, 150),
    locationType,
    isCurrent: body.isCurrent === undefined ? true : Boolean(body.isCurrent),
    reason: cleanOptionalText(body.reason, 500),
  };
};

/* Partial update: only keys present in the body are returned, coordinates
   are validated atomically when one of them is supplied. */
export const parseLocationPatch = (body = {}) => {
  const fields = parseLocationPayload({
    ...body,
    address: body.address ?? "_",
  });
  const out = {};
  for (const key of [
    "latitude",
    "longitude",
    "address",
    "city",
    "state",
    "country",
    "siteName",
    "locationType",
    "isCurrent",
    "reason",
  ]) {
    if (key in body) out[key] = fields[key];
  }
  return out;
};