/* ============================================================
   SERVICE LOCATION RESOLVER

   Resolves the free-text `services.center` value to a real
   service_centers row.

   This used to be a hardcoded list of six cities with a
   deterministic hash fallback: any unrecognised center string was
   hashed into one of those six points, so a service could silently be
   given coordinates it does not have. Coordinates now live in the
   database (see backend/sql/schema.sql) and an unmatched center
   resolves to null — callers decide what an unlocated service means.
   ============================================================ */
import store from "../data/index.js";

/* Returns the matched service center, or null when the text does not
   identify one. Never returns a fabricated location. */
export const resolveServiceLocation = async (service = {}) => {
  const center = await store.resolveServiceCenter(service.center);
  if (!center) return null;
  return {
    key: center.key,
    name: center.name,
    address: center.address,
    city: center.city,
    state: center.state,
    pincode: center.pincode,
    latitude: center.latitude,
    longitude: center.longitude,
    // provenance: resolved from the service_centers table
    source: "service_center",
    originalCenter: service.center || center.name,
  };
};

export const enrichWithServiceLocation = async (service) => ({
  ...service,
  serviceLocation: await resolveServiceLocation(service),
});
