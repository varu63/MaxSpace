/* ============================================================
   ORGANISATION FACILITY VISIBILITY — POLICY ONLY

   Which facilities a role may see on the network map is a governance
   decision, not a query. It lives here, with no store import, so it can
   be read (and tested) without opening a database connection: the map
   layer in organizationLocations.js supplies the data, this file decides
   who is allowed to look at it.
   ============================================================ */

/* The organisation types a facility marker may carry. A fixed vocabulary,
   not free text: the map filter treats an unrecognised type as "matches
   nothing" rather than "ignore the filter". */
export const ORGANIZATION_TYPES = [
  "Manufacturer",
  "Service Provider",
  "Reseller",
  "Recycler",
  "Collection Center",
];

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
     - PARTNER  → no facility network at all. An EPR partner reaches a
                  battery through its time-boxed end-of-life assignment
                  (see /api/partner), which is per-battery and does not
                  include the wider MaxSpace facility network. Nothing
                  here is needed to collect or process a battery, so the
                  honest answer is "no markers", not "all markers".
   Anything else (""/unknown role, unreachable behind `protect`) resolves
   to an EMPTY list: this lookup fails CLOSED. A role that is not
   explicitly listed has no business seeing company facilities. */
export const ROLE_ORG_TYPES = {
  ADMIN: null, // null = the whole network
  USER: ["Service Provider"],
  EMPLOYEE: ["Service Provider"],
  PARTNER: [],
};

/* The allowed types for a role, or an empty list for a role this file
   does not know about. An absent key is NOT "no restriction". */
export const allowedTypesForRole = (role) =>
  Object.prototype.hasOwnProperty.call(ROLE_ORG_TYPES, role) ? ROLE_ORG_TYPES[role] : [];