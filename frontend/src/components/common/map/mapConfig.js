/* ============================================================
   FLEET MAP UI CONFIGURATION
   Colour modes + tone palette shared by the Leaflet markers, the
   legend and any stats renderers. Tone names mirror the backend
   MAP_LEGEND / mapConfig.js tones so the map stays consistent with
   the API vocabulary (compliance / lifecycle / service buckets).
   ============================================================ */

export const TONE_COLORS = {
  success: "#16A34A",
  warning: "#D97706",
  danger: "#DC2626",
  info: "#2563EB",
  orange: "#EA580C",
  neutral: "#64748B",
};

/* Mode → how a marker's colour is decided. Each resolver returns
   { key, label, tone }. The buckets are the exact keys the backend
   sends in marker.lifecycle.key / marker.compliance.bucket.key /
   marker.service.bucket / marker.health.key — nothing new invented. */
export const COLOR_MODES = {
  compliance: {
    label: "Compliance",
    toneOf: (marker) => {
      const bucket = marker.compliance && marker.compliance.bucket;
      const map = {
        compliant: "success",
        pending: "warning",
        under_review: "warning",
        non_compliant: "danger",
        not_applicable: "neutral",
        not_tracked: "neutral",
      };
      return { key: bucket?.key || "not_tracked", label: bucket?.label || "Not Tracked", tone: map[bucket?.key] || "neutral" };
    },
  },
  lifecycle: {
    label: "Lifecycle",
    toneOf: (marker) => {
      const map = {
        in_service: "info",
        fg_pending: "neutral",
        defect_hold: "orange",
        unknown: "neutral",
      };
      return { key: marker.lifecycle?.key || "unknown", label: marker.lifecycle?.label || "Unknown", tone: map[marker.lifecycle?.key] || "neutral" };
    },
  },
  service: {
    label: "Service",
    toneOf: (marker) => {
      const bucket = marker.service && marker.service.bucket;
      const map = {
        active: "orange",
        completed: "success",
        none: "neutral",
      };
      return { key: bucket?.key || "none", label: bucket?.label || "No Service", tone: map[bucket?.key] || "neutral" };
    },
  },
};

export const LEGEND_ITEMS = [
  { tone: "success", label: "Compliant", note: "compliance verified" },
  { tone: "warning", label: "Compliance Pending", note: "pending or under review" },
  { tone: "danger", label: "Non-Compliant", note: "compliance failed or missing" },
  { tone: "info", label: "In Service", note: "battery lifecycle: PROD" },
  { tone: "orange", label: "Service Required", note: "active service / defect hold" },
  { tone: "neutral", label: "Unknown", note: "no record / not tracked" },
];

/* Location search box + filter vocabularies for the toolbar. */
export const HEALTH_FILTERS = [
  { value: "", label: "All health" },
  { value: "healthy", label: "Healthy" },
  { value: "warning", label: "Warning" },
  { value: "critical", label: "Critical" },
];

export const BATTERY_STATUS_FILTERS = [
  { value: "", label: "All statuses" },
  { value: "in_service", label: "In Service" },
  { value: "fg_pending", label: "FG Pending" },
  { value: "defect_hold", label: "Defect Hold" },
];

export const COMPLIANCE_FILTERS = [
  { value: "", label: "All compliance" },
  { value: "compliant", label: "Compliant" },
  { value: "pending", label: "Pending" },
  { value: "under_review", label: "Under Review" },
  { value: "non_compliant", label: "Non-Compliant" },
  { value: "not_applicable", label: "Not Applicable" },
];

export const SERVICE_FILTERS = [
  { value: "", label: "All service" },
  { value: "active", label: "Active Service" },
  { value: "completed", label: "Completed Service" },
  { value: "none", label: "No Service" },
];

export const LOCATION_TYPES = [
  "Manufacturing Plant",
  "Warehouse",
  "Customer Site",
  "Service Center",
  "End of Life Facility",
  "Recycler",
  "Other",
];

/* Hard ceiling for map markers per request — mirrors the backend
   MAP_MAX_LIMIT. The interactive layer clusters the fetched set. */
export const MAP_MAX_LIMIT = 2000;