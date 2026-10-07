/* ============================================================
   GEO CONTROLLER — free OpenStreetMap/Nominatim proxy
   Exposes address autocomplete and reverse geocoding to the
   authenticated frontend. All upstream calls are made by
   utils/nominatim.js (cache + 1 req/s throttle + timeout); this
   layer only sanitises input and shapes the responses.

   Failures never break the booking flow: search/reverse return an
   explicit 502/404 the UI turns into "type your address manually".
   ============================================================ */
import { asyncHandler } from "../middleware/asyncHandler.js";
import { searchPlaces, reversePlace } from "../utils/nominatim.js";

const invalid = (message) =>
  Object.assign(new Error(message), { code: "validation", statusCode: 400 });

const cleanQuery = (value) =>
  String(value ?? "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

const upstreamUnavailable = (res) =>
  res.status(502).json({
    success: false,
    code: "GEOCODING_UNAVAILABLE",
    message:
      "Address search is temporarily unavailable. You can still type your address manually.",
  });

// GET /api/geo/search?q=<text>  ->  { success, data: [location, ...] }
export const searchLocations = asyncHandler(async (req, res) => {
  const query = cleanQuery(req.query.q);
  // Below three characters a search is meaningless (and expensive):
  // answer with an empty list rather than an error so the UI stays quiet.
  if (query.length < 3) {
    return res.json({ success: true, data: [] });
  }
  try {
    const data = await searchPlaces(query, { limit: 8 });
    return res.json({ success: true, data });
  } catch {
    return upstreamUnavailable(res);
  }
});

// GET /api/geo/reverse?lat=<n>&lon=<n>  ->  { success, data: location }
export const reverseLookup = asyncHandler(async (req, res) => {
  const latitude = Number(req.query.lat);
  const longitude = Number(req.query.lon);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw invalid("lat must be a number between -90 and 90");
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw invalid("lon must be a number between -180 and 180");
  }

  try {
    const data = await reversePlace(latitude, longitude);
    if (!data) {
      return res.status(404).json({
        success: false,
        code: "GEOCODING_NO_RESULT",
        message:
          "No address found for that position. You can still type your address manually.",
      });
    }
    return res.json({ success: true, data });
  } catch {
    return upstreamUnavailable(res);
  }
});
