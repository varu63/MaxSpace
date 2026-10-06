/* ============================================================
   SERVICE -> LIFECYCLE BRIDGE
   Projects service status changes into the append-only battery
   lifecycle ledger.

   Why this exists: the passport's credibility rests on its history
   being complete without anyone remembering to write it by hand. A
   battery that was serviced should show that it was serviced. The
   services table already records what happened (status plus
   service_history); this module mirrors the parts of that which are
   genuinely lifecycle facts into the ledger, so the passport timeline
   is a projection of real operations rather than a separate chore.

   Two deliberate constraints:

   1. Only *lifecycle-meaningful* statuses produce an event. "Accepted",
      "On The Way" and "Waiting for Admin Approval" are workflow
      bookkeeping about who is doing what, not changes in the battery's
      life, so they are deliberately silent. Writing an event per
      status change would bury the four events that matter under
      bookkeeping noise.

   2. This never throws. A service status change is the authoritative
      write and it has already been committed by the time we get here;
      failing the HTTP request afterwards would tell the client the
      update failed when it did not, and invites a duplicate retry. If
      the append fails we say so loudly in the service history and log
      it, so the gap is visible and reconcilable rather than silent.
   ============================================================ */
import { LIFECYCLE_EVENTS } from "./lifecycleLedger.js";

/* Service status -> lifecycle event code, or null for "no lifecycle
   meaning". Keys must exist in VALID_STATUSES (constants/serviceStatuses.js). */
const SERVICE_STATUS_EVENTS = {
  Confirmed: "service_scheduled",
  "In Progress": "service_started",
  Completed: "service_completed",
  Cancelled: "service_cancelled",
};

/* Actor role -> the lifecycle `source` vocabulary. These must all be
   accepted by the corresponding event definition in LIFECYCLE_EVENTS,
   otherwise appendLifecycleEvent rejects the write. */
const ROLE_SOURCES = {
  ADMIN: "admin",
  EMPLOYEE: "service_technician",
  USER: "user",
};

export const lifecycleEventForServiceStatus = (status) =>
  SERVICE_STATUS_EVENTS[status] ?? null;

export const lifecycleSourceForRole = (role) => ROLE_SOURCES[role] ?? null;

/* Pure, testable decision: should this transition write an event, and what? */
export const planServiceTransition = ({ fromStatus, toStatus, actorRole }) => {
  const eventCode = lifecycleEventForServiceStatus(toStatus);
  if (!eventCode) {
    return { eventCode: null, reason: "status has no lifecycle meaning" };
  }
  if (fromStatus === toStatus) {
    return { eventCode: null, reason: "status unchanged" };
  }

  const source = lifecycleSourceForRole(actorRole);
  if (!source) {
    /* Fail closed. An unmapped role must not be guessed into one that
       happens to be permitted for this event. */
    return { eventCode: null, reason: `no lifecycle source for role "${actorRole}"` };
  }

  const permitted = LIFECYCLE_EVENTS[eventCode].sources || [];
  if (!permitted.includes(source)) {
    return {
      eventCode: null,
      reason: `source "${source}" may not record "${eventCode}"`,
    };
  }

  return { eventCode, source, reason: null };
};

/* Appends the event. Returns a result object; never throws. */
export const recordServiceTransition = async ({
  store,
  service,
  fromStatus,
  toStatus,
  actorRole,
  actorName = null,
}) => {
  const plan = planServiceTransition({ fromStatus, toStatus, actorRole });
  if (!plan.eventCode) return { recorded: false, ...plan };

  /* No battery means nothing to attach a passport event to. */
  if (!service?.batteryId) {
    return { recorded: false, eventCode: null, reason: "service has no battery" };
  }

  try {
    const event = await store.appendLifecycleEvent({
      batteryId: service.batteryId,
      eventCode: plan.eventCode,
      source: plan.source,
      actor: actorName,
      serviceId: service.id,
      previousState: fromStatus ?? null,
      newState: toStatus,
      notes: `Service ${service.ticketNumber || service.id}: ${fromStatus} -> ${toStatus}`,
      metadata: {
        ticketNumber: service.ticketNumber || null,
        serviceType: service.serviceType || null,
        center: service.center || null,
        automatic: true,
      },
    });
    return { recorded: true, eventCode: plan.eventCode, source: plan.source, event };
  } catch (error) {
    /* The ledger is append-only and hash-chained, so a rejected append is a
       real gap rather than something to retry blindly. Surface it in the
       service history (visible to operators in the UI) as well as the log. */
    const reason = error?.message || String(error);
    try {
      await store.addServiceHistory(service.id, {
        status: toStatus,
        action: "Lifecycle ledger gap",
        performedBy: actorRole || "SYSTEM",
        performedByName: actorName || "System",
        notes: `Could not append "${plan.eventCode}" to the battery passport: ${reason}`,
      });
    } catch {
      /* Recording the gap also failed; the log line below is then the only
         record, which is exactly why it is written unconditionally. */
    }
    console.error(
      `[lifecycle] service ${service.id} (battery ${service.batteryId}): ` +
        `failed to append "${plan.eventCode}" — ${reason}`
    );
    return { recorded: false, eventCode: plan.eventCode, reason };
  }
};