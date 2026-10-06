/* ============================================================
   BATTERY OWNERSHIP -> LIFECYCLE BRIDGE
   Opens a passport ledger when a battery is registered or claimed,
   so a battery's history begins the moment it enters the system
   rather than whenever somebody remembers to start one.

   The distinction that matters: `first_owner_registered` versus
   `ownership_transferred`. They are not interchangeable. Writing
   "first owner registered" onto a battery that already has a
   manufacturing record in its ledger would erase the fact that the
   unit existed before this app did. So the ledger itself is asked
   what it knows, and the claim is classified from that.

   Neither helper throws. See utils/serviceLifecycle.js for the same
   reasoning: the authoritative write has already committed, so
   failing the request afterwards would misreport it.
   ============================================================ */
import { LIFECYCLE_EVENTS } from "./lifecycleLedger.js";

/* Units imported from the production database sit under this placeholder
   owner until a customer scans them. It is an accounting artefact, not a
   person who owned the battery, so it must never appear as prior custody. */
const FLEET_PLACEHOLDER_OWNER_ID = "user-maxvolt";

const isFleetPlaceholder = (ownerId) => ownerId === FLEET_PLACEHOLDER_OWNER_ID;

const appendOrExplain = async ({ store, batteryId, event }) => {
  try {
    const written = await store.appendLifecycleEvent(event);
    return { recorded: true, eventCode: event.eventCode, event: written };
  } catch (error) {
    const reason = error?.message || String(error);
    console.error(
      `[lifecycle] battery ${batteryId}: failed to append "${event.eventCode}" — ${reason}`
    );
    return { recorded: false, eventCode: event.eventCode, reason };
  }
};

/* Called after a customer registers a new battery in the app. */
export const recordBatteryRegistration = async ({
  store,
  battery,
  actorName = null,
}) => {
  const batteryId = battery?.id || battery?.batteryId;
  if (!batteryId) return { recorded: false, reason: "battery has no identifier" };

  return appendOrExplain({
    store,
    batteryId,
    event: {
      batteryId,
      eventCode: "first_owner_registered",
      source: "user",
      actor: actorName,
      newState: "Registered to first owner",
      notes: `Registered in MaxSpace (${battery.modelName || battery.barcode || batteryId})`,
      metadata: { automatic: true, channel: "registration" },
    },
  });
};

/* Called after a customer claims a battery by scanning it. */
export const recordBatteryClaim = async ({
  store,
  battery,
  previousOwnerId = null,
  newOwnerId = null,
  actorName = null,
}) => {
  const batteryId = battery?.id || battery?.batteryId;
  if (!batteryId) return { recorded: false, reason: "battery has no identifier" };

  /* The distinction is "does the ledger already attribute this battery to a
     *prior owner*", not "does its ledger have any events". A unit with a
     manufacturing record but no recorded owner is still being registered to
     its first owner — calling that a transfer would be wrong, and would also
     be rejected by the stage machine, since a manufactured battery cannot
     jump to OwnershipTransferred.

     The ledger is the only authority here. The batteries row still carries
     the old production-fleet placeholder owner ("user-maxvolt") on units
     that were never actually sold, and treating that as custody would
     fabricate a transfer. */
  let priorOwnerId = null;
  let hasPriorOwner = false;
  try {
    const ownership = await store.getCurrentOwnership(batteryId);
    if (ownership?.ownerId) {
      priorOwnerId = ownership.ownerId;
      hasPriorOwner = true;
    }
  } catch {
    /* The ownership history could not be read. Falling back to the batteries
       row is only safe when the caller explicitly says the unit had a real
       owner; the production-fleet placeholder is never a real one. */
    if (previousOwnerId && !isFleetPlaceholder(previousOwnerId)) {
      priorOwnerId = previousOwnerId;
      hasPriorOwner = true;
    }
  }
  if (newOwnerId && priorOwnerId === newOwnerId) hasPriorOwner = false;

  const eventCode = hasPriorOwner ? "ownership_transferred" : "first_owner_registered";
  const source = "user";
  if (!(LIFECYCLE_EVENTS[eventCode].sources || []).includes(source)) {
    /* Defensive: never guess a source the ledger would reject. */
    return { recorded: false, reason: `source "${source}" may not record "${eventCode}"` };
  }

  return appendOrExplain({
    store,
    batteryId,
    event: {
      batteryId,
      eventCode,
      source,
      actor: actorName,
      previousState: priorOwnerId || null,
      newState: "Claimed by owner",
      notes: hasPriorOwner
        ? "Claimed by QR scan; the unit already had a recorded owner"
        : "Claimed by QR scan as the first recorded owner",
      metadata: { automatic: true, channel: "claim", hadPriorOwner: hasPriorOwner },
    },
  });
};