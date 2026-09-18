/* ============================================================
   SERVICE VALIDATION HELPERS
   Mirrors the CHECK constraints applied in the database
   (see backend/sql/schema.sql + backend/sql/migrations/001_*).
   Both stores enforce these invariants so mock mode behaves
   identically to postgres mode.
============================================================ */

import { VALID_STATUSES } from "../constants/serviceStatuses.js";

export const VALID_PRIORITIES = ["Low", "Normal", "High", "Urgent"];

export const isServiceStatus = (status) => VALID_STATUSES.includes(status);

export const isServicePriority = (priority) => VALID_PRIORITIES.includes(priority);

/* Enforce the same invariants the database CHECK constraints hold.
   Throws a 400-style AppError shape when violated. */
export const assertServiceIntegrity = (service) => {
  if (typeof service.status !== "string" || !isServiceStatus(service.status)) {
    const error = new Error(
      `Invalid service status "${service.status}". Allowed: ${VALID_STATUSES.join(", ")}.`
    );
    error.statusCode = 400;
    throw error;
  }
  if (
    service.priority != null &&
    (typeof service.priority !== "string" || !isServicePriority(service.priority))
  ) {
    const error = new Error(
      `Invalid service priority "${service.priority}". Allowed: ${VALID_PRIORITIES.join(", ")}.`
    );
    error.statusCode = 400;
    throw error;
  }
};

/* Ticket numbers are HUMAN-ID unique — used by store uniqueness checks.
   Normalizes common duplicates the mock store would otherwise allow. */
export const normalizeTicketNumber = (ticketNumber, existing) => {
  const raw = String(ticketNumber || "").trim();
  if (!raw) return raw;
  const seen = new Set(existing);
  if (!seen.has(raw)) return raw;
  let candidate = `${raw}-${Date.now().toString(36).slice(-4)}`;
  while (seen.has(candidate)) {
    candidate = `${raw}-${Date.now().toString(36).slice(-4)}`;
  }
  return candidate;
};