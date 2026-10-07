/* Ownership assertion for battery-scoped reads and writes.

   ownerScope.js answers "which rows may this request see" for list
   queries. This module answers the sharper question for a single,
   already-resolved battery: "may THIS request touch it". The rules are
   derived from the same model:

     - anonymous requests are the public passport/scan flow and are
       never restricted here (optionalProtect routes),
     - ADMIN and EMPLOYEE are operators and see the whole fleet,
     - any role that is not USER starts with no access: a PARTNER is
       external and reaches its batteries only through the assignment
       checks in utils/partnerAccess.js, never through ownership,
     - a battery with no owner, or with the production-fleet placeholder
       owner, belongs to nobody yet — the public passport and the claim
       flow must keep working for it,
     - anything else is the owner's battery and nobody else's.

   Denials are 403, not 404: the caller is authenticated and the battery
   exists, it simply is not theirs. After a completed ownership transfer
   the previous owner must be told the battery left their account — a
   404 reads as "you never had it" and makes the denial undebuggable.

   Two variants:
     assertBatteryAccess       READS — unclaimed batteries are open.
     assertBatteryWriteAccess WRITES — an unclaimed battery belongs to
                               nobody, so only its owner (or an
                               operator) may change or delete it. */

/* Units imported from the production database sit under this placeholder
   until a customer claims them; it is an accounting artefact, not a
   person (same constant as utils/batteryLifecycleBridge.js). */
const FLEET_PLACEHOLDER_OWNER_ID = "user-maxvolt";

export const BATTERY_ACCESS_DENIED_MESSAGE =
  "You no longer own or have access to this battery.";

/* Works with a mapped battery ({ id, ownerId }) or a raw row
   ({ battery_id, owner_id }) — callers hand us either. */
const ownerIdOf = (battery) =>
  battery?.ownerId ?? battery?.owner_id ?? battery?.owner?.id ?? null;

export const canAccessBattery = (req, battery) => {
  if (!req.user) return true;
  if (req.user.role === "ADMIN" || req.user.role === "EMPLOYEE") return true;
  if (req.user.role !== "USER") return false;

  const ownerId = ownerIdOf(battery);
  if (!ownerId || ownerId === FLEET_PLACEHOLDER_OWNER_ID) return true;
  return ownerId === req.user.id;
};

export const canWriteBattery = (req, battery) => {
  if (!req.user) return false;
  if (req.user.role === "ADMIN" || req.user.role === "EMPLOYEE") return true;
  if (req.user.role !== "USER") return false;

  const ownerId = ownerIdOf(battery);
  return Boolean(ownerId) && ownerId !== FLEET_PLACEHOLDER_OWNER_ID && ownerId === req.user.id;
};

const accessDenied = () =>
  Object.assign(new Error(BATTERY_ACCESS_DENIED_MESSAGE), {
    code: "forbidden",
    statusCode: 403,
    userFacing: true,
  });

/* Throws the denial above. Returns the battery so callers can chain:
     const battery = assertBatteryAccess(req, await store.getBattery(id));
   A null/undefined battery is passed through — "not found" stays the
   caller's decision to make. */
export const assertBatteryAccess = (req, battery) => {
  if (battery && !canAccessBattery(req, battery)) throw accessDenied();
  return battery;
};

export const assertBatteryWriteAccess = (req, battery) => {
  if (battery && !canWriteBattery(req, battery)) throw accessDenied();
  return battery;
};

/* For handlers that resolve WITH the caller's owner scope and then get
   null: distinguish "does not exist" from "exists but is not yours".
   The scoped lookup returned null, so re-resolve without the scope —
   if the row is there, it was excluded by ownership and the shared
   rules decide between 403 (denied) and falling through (unclaimed,
   which reads as public). Returns the battery, or null when the row
   genuinely does not exist. */
export const assertAccessIfScopedOut = async (req, scopedBattery, loadUnscoped) => {
  if (scopedBattery) return scopedBattery;
  const anyBattery = await loadUnscoped();
  if (!anyBattery) return null;
  return assertBatteryAccess(req, anyBattery);
};
