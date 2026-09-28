/* ============================================================
   COMPLIANCE MANAGEMENT CONSTANTS
   Vocabulary for the hierarchical Admin Compliance module
   (Company → Battery Model → Compliance Record → Batteries).

   Mirrors the existing backend/constants/compliance.js pattern: the
   values live here as the single source of truth and are validated at
   the service layer in both data sources, because legal wording
   evolves and must not be frozen into database CHECK constraints.

   This module is deliberately separate from the India BWMR 2022
   vocabulary in compliance.js: that module tracks per-battery EPR /
   producer lifecycle, while this one records a certification or
   obligation ONCE at company, battery-model or individual-battery
   level so it is never duplicated across a fleet.
   ============================================================ */

/* The three scopes a compliance record can be attached to.
   Exactly one of batteryModelId / batteryId may be set:
     COMPANY     → companyId only
     BATTERY_MODEL → companyId + batteryModelId
     BATTERY     → companyId + batteryId                       */
export const COMPLIANCE_LEVELS = ["COMPANY", "BATTERY_MODEL", "BATTERY"];

/* Record status. A record is never created as Compliant — it starts
   Pending and only an explicit admin verification can promote it. */
export const RECORD_STATUSES = [
  "Pending",
  "Under Review",
  "Compliant",
  "Attention Required",
  "Expired",
];

/* Whether the requirement applies at all. "Not Applicable" is a first
   class value so nobody is forced to upload a certificate for a rule
   that does not cover their product (e.g. AIS-156 on a stationary ESS). */
export const APPLICABILITY_VALUES = [
  "Applicable",
  "Not Applicable",
  "Under Review",
  "Compliant",
  "Attention Required",
  "Expired",
];

/* Regulatory / customer bodies that can issue or own a requirement. */
export const KNOWN_AUTHORITIES = [
  "BIS",
  "CPCB",
  "AIS",
  "MCA",
  "CE",
  "UL",
  "IEC",
  "ISO",
  "Customer",
  "Internal",
  "Other",
];

/* Document kinds that can be attached to a compliance record.
   Extends (never replaces) the BWMR 2022 document vocabulary. */
export const RECORD_DOCUMENT_TYPES = [
  "Certificate",
  "Registration",
  "Test Report",
  "Supporting Document",
  "Declaration",
  "License",
  "Other",
];

/* Who may see a stored document reference:
   Internal  → admin only (never returned by the customer passport API)
   Customer  → may be listed on the battery passport               */
export const DOCUMENT_VISIBILITY_VALUES = ["Internal", "Customer"];

/* Audit actions recorded for a compliance record. Extends the BWMR
   2022 event vocabulary (compliance.js) with the record-level events
   this module needs. */
export const RECORD_EVENT_TYPES = [
  "record_created",
  "record_updated",
  "record_verified",
  "record_status_changed",
  "record_certificate_changed",
  "record_expiry_changed",
  "record_scope_changed",
  "record_document_uploaded",
  "record_document_removed",
  "record_deleted",
  "record_imported",
];

/* Default thresholds. The live values are read from the
   compliance_settings table (see backend/utils/complianceExpiry.js);
   these are the code-side fallbacks used when the table is absent. */
export const DEFAULT_COMPLIANCE_SETTINGS = {
  expiryWarningDays: 90,
  deadlineSoonDays: 30,
  reviewIntervalDays: 180,
  showDevelopmentData: true,
};

/* Expiry outcome buckets, computed server-side. */
export const EXPIRY_STATES = ["Normal", "Upcoming", "Expired", "Unknown"];
export const DEADLINE_STATES = ["None", "Upcoming", "Overdue", "Met"];

export const isInList = (value, list) => list.includes(value);

/* Map a compliance type code to its catalogue row shape, used by the
   frontend-facing API so a type always carries its own field rules
   instead of the client hard-coding them. */
export const typeFieldRules = (type) => ({
  requiresCertificate: Boolean(type?.requiresCertificate),
  requiresTestReport: Boolean(type?.requiresTestReport),
  requiresCapacity: Boolean(type?.requiresCapacity),
  requiresExpiry: Boolean(type?.requiresExpiry),
});
