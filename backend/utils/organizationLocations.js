/* ============================================================
   ORGANIZATION / FACILITY NETWORK — visual network map only.

   This is NOT a navigation or GPS map. The markers exist purely to
   give users / admins / technicians a visual idea of WHICH MaxSpace
   organizations exist and WHERE they sit.

   This list used to be hardcoded here, with the file's own comment
   describing the coordinates as "temporary development/test"
   placeholders and the names as "example organisations from the map
   specification". It is now read from the organization_locations
   table (see backend/sql/schema.sql), joined to service_centers so
   organizations hosted at a service center share its coordinates.
   Nothing is hardcoded in any React component; the frontend renders
   whatever this API returns.
   ============================================================ */
import store from "../data/index.js";

export const ORGANIZATION_TYPES = [
  "Manufacturer",
  "Service Provider",
  "Reseller",
  "Recycler",
  "Collection Center",
];

/* Filter by organisation type (empty string = all). Mirrors the map
   service-layer validation style — unknown types simply match nothing. */
export const filterOrganizations = async (type = "") => {
  if (!type) return store.getOrganizationLocations();
  return ORGANIZATION_TYPES.includes(type)
    ? store.getOrganizationLocations({ type })
    : [];
};

/* Role visibility matrix for the organisation/facility network markers.
   Enforced in the BACKEND so a caller can never enumerate company
   facilities they are not authorised to see (no frontend-only masking):
     - ADMIN    → the whole network (overall company/facility data).
     - USER     → only Service Providers: the facilities a customer can
                  actually book/visit. Manufacturer plants, reseller
                  hubs, recyclers and collection points are company data.
     - EMPLOYEE → only Service Providers: the technician's work sites.
                  Technician roaming is already limited to assigned
                  services; the network markers they may ever see are
                  the service centres, not internal company facilities.
   An empty allowed-list (""/unknown role, unreachable behind `protect`)
   falls back to the whole network. */
export const ROLE_ORG_TYPES = {
  ADMIN: null,
  USER: ["Service Provider"],
  EMPLOYEE: ["Service Provider"],
};

/* Role-scoped organisation markers: applies the caller's visibility
   matrix over `filterOrganizations`. Passing a `type` outside the
   caller's allowed set returns [] (no accidental disclosure). */
export const organizationsForRole = async (role = "", requested = "") => {
  const allowed = ROLE_ORG_TYPES[role] || null;
  const list = await filterOrganizations(requested);
  return allowed === null ? list : list.filter((o) => allowed.includes(o.type));
};
