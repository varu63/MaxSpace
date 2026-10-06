/* ============================================================
   PARTNER ACCESS CONTROL
   One place that decides what an external end-of-life partner
   (collection centre, recycler, refurbisher, auditor) may read and
   write.

   Why a partner role at all
   ------------------------
   MaxSpace manufactures and services the batteries; collection and
   recycling are done by third parties who hold their own EPR
   registrations (already in `compliance_producers`). An account for
   such a body is an OPERATOR of the EPR module — it must be able to
   record what it did to a battery — but it must not inherit the reach
   that ADMIN and EMPLOYEE have.

   The rule
   --------
   A partner sees exactly the batteries it has an ACTIVE, unexpired
   assignment for (`battery_eol_assignments`). That is per-battery and
   time-boxed, so it can be granted per job and withdrawn per job. It is
   deliberately NOT "all batteries in the 'Collected' stage": a stage is
   a fact about a battery, not an authorisation for a company.

   Read scope is narrower than the owner's passport. A recycler needs to
   know which pack, how old, which chemistry, what the passport already
   says about collection and evidence — not the customer's service
   history, notes or other batteries.
   ============================================================ */

export class PartnerAccessError extends Error {
  constructor(message, statusCode = 403, code = "FORBIDDEN") {
    super(message);
    this.name = "PartnerAccessError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

/* partner_id is a SERAL column, so it may arrive as a number or a
   string depending on who built the request. */
const normalizeId = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export const isPartnerAccount = (user) => user?.role === "PARTNER";

export const partnerIdFor = (user) => normalizeId(user?.partnerId);

/* Operator roles keep the existing whole-fleet reach. `ownerScopeFor`
   deliberately does not include PARTNER: it answers "whose batteries may
   this request touch", and for a partner the answer is "the ones it was
   assigned", which is enforced by an assignment lookup instead. */
export const isOperatorAccount = (user) => user?.role === "ADMIN" || user?.role === "EMPLOYEE";

/* A PARTNER account with no linked producer is misconfigured and must
   not be treated as a fleet-wide account by default. Failing closed is
   the whole point: an unlinked partner must never widen its own scope. */
export const assertPartnerAccount = (user) => {
  if (!isPartnerAccount(user)) {
    throw new PartnerAccessError("Access denied. Partner privileges required.", 403, "FORBIDDEN");
  }
  if (partnerIdFor(user) === null) {
    throw new PartnerAccessError(
      "This partner account is not linked to an EPR producer registration. Ask a MaxSpace administrator to link it.",
      403,
      "PARTNER_NOT_LINKED"
    );
  }
  return true;
};

/* Read a single battery on behalf of a partner.
   Returns the narrow partner view, or 404 when the battery exists but
   is not assigned to this partner — reporting 403 instead would confirm
   the battery exists, which is itself a disclosure. */
export const assertCanReadPartnerBattery = (battery) => {
  if (!battery) {
    throw new PartnerAccessError("Battery not found for your organisation.", 404, "NOT_FOUND");
  }
  return battery;
};