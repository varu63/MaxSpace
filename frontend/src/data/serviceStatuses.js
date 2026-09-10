/* ============================================================
   SERVICE STATUS CONSTANTS + PREDICATES
   Single source of truth for service lifecycle statuses used
   across customer and admin views.
============================================================ */

export const SERVICE_STATUS_FLOW = [
  "Confirmed",
  "Accepted",
  "Assigned",
  "On The Way",
  "In Progress",
  "Waiting for Admin Approval",
  "Completed",
];

export const SERVICE_STATUSES = [
  "Confirmed",
  "Accepted",
  "Assigned",
  "On The Way",
  "In Progress",
  "Waiting for Admin Approval",
  "Completed",
  "Cancelled",
];

export const STATUS_FILTER_OPTIONS = ["All", ...SERVICE_STATUSES];

export const ACTIVE_BOOKING_STATUSES = [
  "Booked",
  "Accepted",
  "Assigned",
  "On The Way",
  "In Progress",
];

/* Statuses that represent a live (non-completed, non-cancelled) service. */
export const ACTIVE_SERVICE_STATUSES = [
  "On The Way",
  "In Progress",
  "Assigned",
  "Accepted",
  "Waiting for Admin Approval",
];

export const isActiveService = (status) =>
  ACTIVE_SERVICE_STATUSES.includes(status);

export const isCancelledService = (status) => status === "Cancelled";

export const isActiveBooking = (status) =>
  ACTIVE_BOOKING_STATUSES.includes(status);
