/* ============================================================
   SHARED SERVICE STATUS CONSTANTS + HELPERS
   Single source of truth for service lifecycle statuses
   used across all backend controllers.
============================================================ */

export const VALID_STATUSES = [
  "Confirmed",
  "Accepted",
  "Assigned",
  "On The Way",
  "In Progress",
  "Waiting for Admin Approval",
  "Completed",
  "Cancelled",
];

export const ACTIVE_SERVICE_STATUSES = [
  "On The Way",
  "In Progress",
  "Assigned",
  "Accepted",
  "Waiting for Admin Approval",
];

export const isActiveStatus = (status) =>
  ACTIVE_SERVICE_STATUSES.includes(status);

export const isCancelled = (status) => status === "Cancelled";

export const isTerminalStatus = (status) =>
  status === "Completed" || status === "Cancelled";
