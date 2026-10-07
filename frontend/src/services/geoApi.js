/* ============================================================
   GEO API — free OpenStreetMap/Nominatim geocoding, proxied by
   the MaxSpace backend (no API key, rate-limited server-side).
   Used by the booking form's Service Location picker.
   ============================================================ */
import client from "./client";

/* Address autocomplete: returns { success, data: [location, ...] }
   where each location is
   { id, address, label, house, area, city, state, pincode,
     latitude, longitude }. */
export const searchLocations = (query) =>
  client(`/geo/search?q=${encodeURIComponent(query)}`);

/* Reverse geocoding for browser GPS coordinates:
   returns { success, data: location } or throws (404 = no address
   found, 502 = upstream unavailable). */
export const reverseLookup = (latitude, longitude) =>
  client(
    `/geo/reverse?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`
  );
