/* Owner isolation for fleet reads.
   Owner isolation applies only to customer (USER) accounts. Operator roles
   (ADMIN / EMPLOYEE) manage the whole production fleet, so they are not
   restricted to batteries they personally own.

   External EPR partners (PARTNER) are NOT operators and must never inherit
   fleet-wide reach. `null` means "no owner filter" (whole fleet), which is
   exactly wrong for a partner, so a partner resolves to an id that cannot
   exist rather than to `null`:

     - `users.id` / `batteries.owner_id` are SERIAL columns, so they are
       positive integers. Returning a negative id makes every owner-scoped
       query return zero rows — the honest answer to "which batteries may
       this request touch" for a partner is "only the ones it was assigned",
       and that check lives where the assignment is known
       (utils/partnerAccess.js + /api/partner), not here.

   Defence in depth: the partner-facing read path does not use this helper
   at all, so even a future change here cannot widen it. */
export const NO_OWNER_MATCH = -1;

export const ownerScopeFor = (req) => {
  if (!req.user) return null; // unauthenticated → public, unfiltered read
  if (req.user.role === "USER") return req.user.id;
  if (req.user.role === "ADMIN" || req.user.role === "EMPLOYEE") return null;
  return NO_OWNER_MATCH;
};