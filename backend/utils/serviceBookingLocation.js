/* ============================================================
   BOOKING SERVICE-LOCATION VALIDATION
   Parses the customer's service location out of a
   POST /api/services body (either `location: {...}` or the same
   keys at the top level) into the six `services` columns:
   address, city, state, pincode, latitude, longitude.

   Contract:
     - every string is sanitised server-side (control characters and
       angle brackets stripped, whitespace collapsed, length capped)
     - coordinates are never trusted blindly: they must be finite
       numbers inside the WGS84 ranges and are provided together
       (both or neither), then rounded to 6 dp to match NUMERIC(9,6)
     - a missing / empty location is NOT an error: the booking must
       not be blocked when GPS or geocoding is unavailable
     - malformed coordinates ARE an error (400), so bogus values are
       rejected instead of silently stored
   ============================================================ */

const MAX_ADDRESS = 400;
const MAX_CITY = 100;
const MAX_STATE = 100;
const MAX_PINCODE = 12;

const invalid = (message) =>
  Object.assign(new Error(message), { code: "validation", statusCode: 400 });

/* Strip control characters and angle brackets (defence in depth for the
   Leaflet popup, which interpolates the address into HTML), collapse
   whitespace, then hard-cap the length. */
const sanitizeText = (value, max) => {
  if (value === undefined || value === null) return null;
  const cleaned = String(value)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
  return cleaned || null;
};

/* PIN / postal code: keep digits, letters, spaces and hyphens only
   (covers Indian PINs and international postal formats). */
const sanitizePincode = (value) => {
  if (value === undefined || value === null) return null;
  const cleaned = String(value)
    .replace(/[^A-Za-z0-9 -]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_PINCODE);
  return cleaned || null;
};

const parseCoordinate = (value, field, min, max) => {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) throw invalid(`${field} must be a number`);
  if (n < min || n > max) throw invalid(`${field} must be between ${min} and ${max}`);
  // NUMERIC(9,6): six decimal places (~0.1 m) is plenty for a pin.
  return Math.round(n * 1e6) / 1e6;
};

const EMPTY = Object.freeze({
  address: null,
  city: null,
  state: null,
  pincode: null,
  latitude: null,
  longitude: null,
});

/* Accepts either { location: {...} } style input (what the frontend
   sends) or a flat object with the same keys. Returns nulls when no
   locating information is present at all. */
export const parseBookingLocation = (input) => {
  const raw =
    input && typeof input === "object" && input.location !== undefined
      ? input.location
      : input;

  if (!raw || typeof raw !== "object") return { ...EMPTY };

  const address = sanitizeText(raw.address, MAX_ADDRESS);
  const city = sanitizeText(raw.city, MAX_CITY);
  const state = sanitizeText(raw.state, MAX_STATE);
  const pincode = sanitizePincode(raw.pincode);
  const latitude = parseCoordinate(raw.latitude, "latitude", -90, 90);
  const longitude = parseCoordinate(raw.longitude, "longitude", -180, 180);

  if ((latitude === null) !== (longitude === null)) {
    throw invalid("latitude and longitude must be provided together (or both omitted)");
  }

  if (!address && latitude === null) return { ...EMPTY };

  return {
    address,
    city,
    state,
    pincode,
    latitude,
    longitude,
  };
};

export const hasBookingLocation = (location) =>
  Boolean(location && (location.address || location.latitude !== null));
