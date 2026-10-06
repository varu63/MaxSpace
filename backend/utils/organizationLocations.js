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
import { ORGANIZATION_TYPES, ROLE_ORG_TYPES, allowedTypesForRole } from "./organizationAccess.js";

/* Re-exported so existing callers keep one import site for the vocabulary
   and the matrix, both of which are defined store-free in
   organizationAccess.js. */
export { ORGANIZATION_TYPES, ROLE_ORG_TYPES };

/* Filter by organisation type (empty string = all). Mirrors the map
   service-layer validation style — unknown types simply match nothing. */
export const filterOrganizations = async (type = "") => {
  if (!type) return store.getOrganizationLocations();
  return ORGANIZATION_TYPES.includes(type)
    ? store.getOrganizationLocations({ type })
    : [];
};

/* Role-scoped organisation markers: applies the caller's visibility
   matrix over `filterOrganizations`. Passing a `type` outside the
   caller's allowed set returns [] (no accidental disclosure). */
export const organizationsForRole = async (role = "", requested = "") => {
  const allowed = allowedTypesForRole(role);
  const list = await filterOrganizations(requested);
  return allowed === null ? list : list.filter((o) => allowed.includes(o.type));
};
