/* ============================================================
   NOMINATIM (OpenStreetMap) GEOCODING CLIENT
   Free, keyless address search + reverse geocoding. The browser
   never talks to Nominatim directly: every request is proxied by
   this module so input can be sanitised, responses shaped, and the
   upstream protected by

     - an in-memory result cache (10 min TTL) so repeated keystrokes
       and duplicate bookings never hit the network twice,
     - a 1 request/second slot reservation, matching Nominatim's
       published usage policy, and
     - a hard timeout so a slow upstream cannot hang a booking.

   No API key exists anywhere in this flow.
   ============================================================ */
import config from "../config/app.js";

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;
const MIN_INTERVAL_MS = 1000;

const cache = new Map();
let nextSlotAt = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* Returns undefined on a miss so a cached `null` (Nominatim knows
   nothing about the point) is still distinguishable from a miss. */
const cacheGet = (key) => {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (hit.expiresAt <= Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return hit.value;
};

const cacheSet = (key, value) => {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    // Map preserves insertion order, so the first key is the oldest.
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
};

/* Reserves the next one-second slot. Concurrent callers each take the
   following slot, so bursts are serialised instead of stampeding. */
const waitForSlot = async () => {
  const now = Date.now();
  const slot = Math.max(now, nextSlotAt);
  nextSlotAt = slot + MIN_INTERVAL_MS;
  if (slot > now) await sleep(slot - now);
};

const fetchJson = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.geo.timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": config.geo.userAgent,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Geocoding upstream responded with ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
};

/* Shapes one raw Nominatim result into the location object the booking
   form and the services table use. Exported for unit tests. */
export const mapNominatimPlace = (place) => {
  if (!place || !place.display_name || place.lat === undefined || place.lon === undefined) {
    return null;
  }
  const latitude = Number(place.lat);
  const longitude = Number(place.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  const a = place.address || {};
  const house = [a.building, a.house_number, a.road].filter(Boolean).join(" ").trim();
  const area =
    a.neighbourhood || a.suburb || a.quarter || a.city_district || a.hamlet || "";
  const city = a.city || a.town || a.village || a.municipality || a.county || "";
  const state = a.state || a.region || a.county || "";
  const displayName = String(place.display_name);

  return {
    id:
      place.osm_type && place.osm_id
        ? `${place.osm_type}/${place.osm_id}`
        : String(place.place_id ?? displayName),
    // The complete selected address is what gets stored on the booking.
    address: displayName.slice(0, 400),
    label: displayName.slice(0, 400),
    house: house.slice(0, 120),
    area: String(area).slice(0, 120),
    city: String(city).slice(0, 100),
    state: String(state).slice(0, 100),
    pincode: String(a.postcode || "").slice(0, 12),
    latitude: Math.round(latitude * 1e6) / 1e6,
    longitude: Math.round(longitude * 1e6) / 1e6,
  };
};

/* Forward search: free-text address -> structured suggestions. */
export const searchPlaces = async (query, { limit = 8 } = {}) => {
  const key = `search:${limit}:${query.toLowerCase()}`;
  const cached = cacheGet(key);
  if (cached !== undefined) return cached;

  await waitForSlot();
  const url =
    `${config.geo.baseUrl}/search?q=${encodeURIComponent(query)}` +
    `&format=jsonv2&addressdetails=1&limit=${limit}&accept-language=en`;
  const places = await fetchJson(url);
  const results = (Array.isArray(places) ? places : [])
    .map(mapNominatimPlace)
    .filter(Boolean);
  cacheSet(key, results);
  return results;
};

/* Reverse lookup: coordinates (from browser GPS) -> address. Returns
   null when Nominatim knows nothing about the point; the caller decides
   how to fall back. */
export const reversePlace = async (latitude, longitude) => {
  const lat = Math.round(Number(latitude) * 1e6) / 1e6;
  const lon = Math.round(Number(longitude) * 1e6) / 1e6;
  const key = `reverse:${lat}:${lon}`;
  const cached = cacheGet(key);
  if (cached !== undefined) return cached;

  await waitForSlot();
  const url =
    `${config.geo.baseUrl}/reverse?lat=${lat}&lon=${lon}` +
    `&format=jsonv2&addressdetails=1&zoom=18&accept-language=en`;
  const place = await fetchJson(url);
  if (!place || place.error) {
    cacheSet(key, null);
    return null;
  }
  const mapped = mapNominatimPlace(place);
  cacheSet(key, mapped);
  return mapped;
};

/* Test hook: drops cached upstream results. */
export const clearGeocodeCache = () => cache.clear();
