/* ============================================================
   COMPLIANCE ACCESS CONTROL
   One place that decides who may read and write which compliance
   record. Every admin compliance route calls through here, so no
   controller can accidentally trust a company id that the client
   supplied.

   Model
   -----
   A user row may carry a `companyId`:
     • companyId set   → a COMPANY-SCOPED admin. It may only see and
                         edit records belonging to that company.
     • companyId null  → a PLATFORM operator (MaxSpace staff). It may
                         act for any company, and it is the only kind
                         of account allowed to create a company or to
                         assign another admin to one.

   Rules enforced here
   -------------------
   1. A company-scoped admin can never widen its own scope: the scope
      comes from the JWT-backed user record, never from the request
      body or query string.
   2. A company-scoped admin cannot create, delete or re-assign
      companies, and cannot move a record to another company.
   3. Reading or writing a record that belongs to another company is
      reported as 404 (not 403) so the API does not confirm the
      existence of other tenants' records.
   4. Development/reference data is admin-only. It is never exposed by
      the customer passport endpoints.
   ============================================================ */

export class ComplianceAccessError extends Error {
  constructor(message, statusCode = 403, code = "FORBIDDEN") {
    super(message);
    this.name = "ComplianceAccessError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

/* Company id may arrive as a number (Postgres SERIAL) or a string. */
const normalizeId = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export const isPlatformOperator = (user) => normalizeId(user?.companyId) === null;

/* The company an admin is pinned to, or null for a platform operator. */
export const adminCompanyId = (user) => normalizeId(user?.companyId);

/* Build the effective company scope for a request.
   `requested` is only honoured for platform operators. */
export const resolveCompanyScope = (user, requested) => {
  const scoped = adminCompanyId(user);
  if (scoped !== null) {
    // A company admin asking for a different company is silently pinned
    // back to its own company rather than 403'd, so list views keep
    // working; writes are blocked separately by assertCanEdit.
    return { companyId: scoped, isPlatform: false, requestedIgnored: normalizeId(requested) !== null && normalizeId(requested) !== scoped };
  }
  return { companyId: normalizeId(requested), isPlatform: true, requestedIgnored: false };
};

/* Guard used by every write path. */
export const assertCanEdit = (user, targetCompanyId) => {
  const scoped = adminCompanyId(user);
  if (scoped === null) return true;
  const target = normalizeId(targetCompanyId);
  if (target === null || target !== scoped) {
    throw new ComplianceAccessError(
      "You can only modify compliance records that belong to your company.",
      403,
      "COMPANY_SCOPE_VIOLATION"
    );
  }
  return true;
};

/* Guard used before loading a single record. Throws 404 so a
   company admin cannot probe another company's record ids. */
export const assertCanRead = (user, record) => {
  if (!record) {
    throw new ComplianceAccessError("Compliance record not found.", 404, "NOT_FOUND");
  }
  const scoped = adminCompanyId(user);
  if (scoped === null) return record;
  if (normalizeId(record.companyId) !== scoped) {
    throw new ComplianceAccessError("Compliance record not found.", 404, "NOT_FOUND");
  }
  return record;
};

/* Only a platform operator may manage the company list itself. */
export const assertPlatformOperator = (user, action = "manage companies") => {
  if (!isPlatformOperator(user)) {
    throw new ComplianceAccessError(
      `Only a MaxSpace platform operator can ${action}.`,
      403,
      "PLATFORM_ONLY"
    );
  }
  return true;
};

/* Non-ADMIN roles never reach the compliance module; the router already
   enforces requireAdmin, this is the second, explicit check used by the
   service so it cannot be bypassed by mounting a handler elsewhere. */
export const assertComplianceAdmin = (user) => {
  if (!user || user.role !== "ADMIN") {
    throw new ComplianceAccessError("Access denied. Admin privileges required.", 403, "FORBIDDEN");
  }
  return true;
};

/* Development/reference data is admin-only. The passport read path uses
   this to guarantee illustrative rows are never presented as legal
   evidence to a customer. */
export const isPublishable = (record) => !record?.isDevelopmentData;
