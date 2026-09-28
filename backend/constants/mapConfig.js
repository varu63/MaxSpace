/* ============================================================
   FLEET MAP CONFIGURATION + DERIVATION HELPERS
   Single source of truth for the Global Battery & Compliance Map
   vocabulary. Deliberately reuses the *real* vocabulary the app
   already stores (batteries.overall_status / hang_status,
   services.status, battery_compliance.compliance_status) — the map
   never invents statuses. Validation happens at the service layer
   (see backend/utils/mapValidation.js), mirroring the compliance and
   service-status constants modules.

   Health buckets reuse the state-of-health thresholds the app
   already displays in the battery passport and battery dashboard
   (SoH >= 90 healthy / >= 80 warning / < 80 critical).
============================================================ */
import { ACTIVE_SERVICE_STATUSES } from "./serviceStatuses.js";

/* ---------- Location management ---------- */

/* Where a battery can physically sit. Administrators pick one of these
   when recording a real location; the map filters by them. */
export const LOCATION_TYPES = [
  "Manufacturing Plant",
  "Warehouse",
  "Customer Site",
  "Service Center",
  "End of Life Facility",
  "Recycler",
  "Other",
];

/* ---------- Health buckets (reuses existing SoH thresholds) ---------- */

export const HEALTH_BUCKETS = {
  healthy: { label: "Healthy", tone: "success", min: 90 },
  warning: { label: "Warning", tone: "warning", min: 80 },
  critical: { label: "Critical", tone: "danger", min: 0 },
};

export const HEALTH_FILTERS = [
  { value: "", label: "All health" },
  { value: "healthy", label: "Healthy" },
  { value: "warning", label: "Warning" },
  { value: "critical", label: "Critical" },
];

export const deriveHealthStatus = (soh) => {
  if (soh === null || soh === undefined || Number.isNaN(Number(soh))) {
    return { key: "unknown", label: "Unknown", tone: "neutral" };
  }
  if (soh >= HEALTH_BUCKETS.healthy.min) {
    return { key: "healthy", label: HEALTH_BUCKETS.healthy.label, tone: HEALTH_BUCKETS.healthy.tone };
  }
  if (soh >= HEALTH_BUCKETS.warning.min) {
    return { key: "warning", label: HEALTH_BUCKETS.warning.label, tone: HEALTH_BUCKETS.warning.tone };
  }
  return { key: "critical", label: HEALTH_BUCKETS.critical.label, tone: HEALTH_BUCKETS.critical.tone };
};

/* ---------- Battery lifecycle (derived from REAL stored fields) ---------- */

/* The app stores only overall_status (FG PENDING / PROD) and hang_status
   today. Every lifecycle bucket below is derived from those two fields —
   statuses like Retired / Recycled do NOT exist in the database, so they
   are never shown. See the DATA notes in docs/DATABASE_MIGRATION.md. */
export const deriveLifecycle = (overallStatus, hangStatus) => {
  if (String(hangStatus || "").toLowerCase() === "true") {
    return { key: "defect_hold", label: "Defect Hold", tone: "orange" };
  }
  switch (String(overallStatus || "").trim().toUpperCase()) {
    case "PROD":
      return { key: "in_service", label: "In Service", tone: "info" };
    case "FG PENDING":
      return { key: "fg_pending", label: "FG Pending", tone: "neutral" };
    default:
      return { key: "unknown", label: "Unknown", tone: "neutral" };
  }
};

export const BATTERY_STATUS_FILTERS = [
  { value: "", label: "All statuses" },
  { value: "in_service", label: "In Service" },
  { value: "fg_pending", label: "FG Pending" },
  { value: "defect_hold", label: "Defect Hold" },
];

/* ---------- Compliance buckets ---------- */

/* Map from battery_compliance.compliance_status to the map bucket. A
   battery with NO compliance record is "not_tracked" — information that
   a record is absent is itself a fact, and is displayed separately from
   "Not Applicable" (Exempt) so a missing record is never presented as
   compliance. */
export const complianceToBucket = (status) => {
  switch (status) {
    case "Compliant":
      return { key: "compliant", label: "Compliant", tone: "success" };
    case "Pending":
      return { key: "pending", label: "Pending", tone: "warning" };
    case "In Progress":
      return { key: "under_review", label: "Under Review", tone: "warning" };
    case "Non-Compliant":
      return { key: "non_compliant", label: "Non-Compliant", tone: "danger" };
    case "Exempt":
      return { key: "not_applicable", label: "Not Applicable", tone: "neutral" };
    default:
      return { key: "not_tracked", label: "Not Tracked", tone: "neutral" };
  }
};

export const COMPLIANCE_FILTERS = [
  { value: "", label: "All compliance" },
  { value: "compliant", label: "Compliant" },
  { value: "pending", label: "Pending" },
  { value: "under_review", label: "Under Review" },
  { value: "non_compliant", label: "Non-Compliant" },
  { value: "not_applicable", label: "Not Applicable" },
];

/* ---------- Service buckets ---------- */

/* Buckets only use statuses the services system actually stores. A battery
   with no service history has serviceStatus null ("none"). */
export const deriveServiceBucket = (status) => {
  if (!status) return { key: "none", label: "No Service", tone: "neutral" };
  if (status === "Completed") {
    return { key: "completed", label: "Completed", tone: "success" };
  }
  if (ACTIVE_SERVICE_STATUSES.includes(status)) {
    return { key: "active", label: "Active", tone: "orange" };
  }
  return { key: "none", label: "No Service", tone: "neutral" };
};

export const SERVICE_FILTERS = [
  { value: "", label: "All service" },
  { value: "active", label: "Active Service" },
  { value: "completed", label: "Completed Service" },
  { value: "none", label: "No Service" },
];

/* ---------- Legend ---------- */

/* The canonical colour legend shown on every map. Tones are referenced by
   the UI so compliance / lifecycle / service colour modes stay consistent. */
export const MAP_LEGEND = [
  { tone: "success", label: "Compliant", note: "compliance verified" },
  { tone: "warning", label: "Compliance Pending", note: "pending or under review" },
  { tone: "danger", label: "Non-Compliant", note: "compliance failed or missing" },
  { tone: "info", label: "In Service", note: "battery lifecycle: PROD" },
  { tone: "orange", label: "Service Required", note: "active service / defect hold" },
  { tone: "neutral", label: "Retired / Unknown", note: "no lifecycle or no record" },
];

/* ---------- Marker payload limits ---------- */

/* Hard ceiling for map markers per request. The interactive map layer
   clusters whatever it receives client-side, so a fleet of this size is
   fetched in one request and rendered as clusters — never one request per
   marker. Larger deployments can pass a bounding box (bbox) to page over
   the visible region instead. */
export const MAP_MAX_LIMIT = 2000;