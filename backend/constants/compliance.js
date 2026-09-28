/* ============================================================
   INDIA BATTERY COMPLIANCE CONSTANTS + HELPERS
   Single source of truth for the regulatory vocabulary used by
   the compliance module (Battery Waste Management Rules, 2022 and
   CPCB guidance). Deliberately NOT enforced as database CHECK
   constraints — legal wording evolves, so the backend validates
   against these lists at the service layer (mirroring the shared
   SERVICE_STATUSES pattern).
============================================================ */

/* Canonical framework stored as a data value on each battery's
   compliance record. `COMPLIANCE_FRAMEWORK_LABEL` is the human
   readable description shown in the UI. */
export const COMPLIANCE_FRAMEWORK = "BWMR 2022";
export const COMPLIANCE_FRAMEWORK_LABEL =
  "Battery Waste Management Rules, 2022 (BWMR 2022)";

/* Per-battery compliance lifecycle statuses. */
export const COMPLIANCE_STATUSES = [
  "Pending",
  "In Progress",
  "Compliant",
  "Non-Compliant",
  "Exempt",
];

/* CPCB EPR entity statuses. */
export const PRODUCER_STATUSES = ["Active", "Inactive", "Suspended"];

/* Entity categories recognised under the rules. */
export const PRODUCER_CATEGORIES = [
  "Manufacturer",
  "Importer",
  "Refurbisher",
  "Recycler",
];

/* BWMR 2022 rechargeable-battery categories. */
export const BATTERY_CATEGORIES = ["Portable", "Medium", "Large"];

/* Where a spent battery is returned / collected. */
export const COLLECTION_CHANNELS = [
  "Return to Producer",
  "Dealer / Retailer",
  "Registered Recycler",
  "Refurbishment Network",
  "Other",
];

/* EPR obligation lifecycle. */
export const OBLIGATION_STATUSES = ["Open", "In Progress", "Closed"];

/* CPCB EPR certificate lifecycle. */
export const CREDIT_STATUSES = ["Active", "Transferred", "Retired", "Expired"];

/* Document review statuses (documents are metadata-only references —
   the app stores no files, only the registration/certificate details). */
export const DOCUMENT_STATUSES = ["Pending Review", "Approved", "Rejected", "Expired"];

/* Document kinds stored as metadata. */
export const DOCUMENT_TYPES = [
  "EPR Registration",
  "Recycling Registration",
  "Refurbishment Registration",
  "Product Documentation",
  "Test Certificate",
  "Collection Evidence",
  "Refurbishment Evidence",
  "Recycling Certificate",
  "Other",
];

/* End-of-Life lifecycle: Collection status (nullable → Not Applicable when no record). */
export const COLLECTION_STATUSES = [
  "Not Required",
  "Pending",
  "Scheduled",
  "In Transit",
  "Collected",
  "Completed",
];

/* Recycling lifecycle statuses — mirrors refurbishment / recycling flow. */
export const RECYCLING_STATUSES = [
  "Not Required",
  "Pending",
  "Under Assessment",
  "In Progress",
  "Completed",
  "Rejected",
];

/* Allowed EOL lifecycle references for epr_reference free-form field remain unlisted
   (real regulatory numbers only; fabricated values forbidden). */

/* Append-only audit event types. */
export const COMPLIANCE_EVENT_TYPES = [
  "producer_created",
  "producer_updated",
  "battery_linked",
  "battery_compliance_updated",
  "status_changed",
  "verified",
  "obligation_created",
  "obligation_updated",
  "obligation_closed",
  "credit_issued",
  "credit_updated",
  "document_uploaded",
  "document_updated",
  "note_added",
];

export const isInList = (value, list) => list.includes(value);