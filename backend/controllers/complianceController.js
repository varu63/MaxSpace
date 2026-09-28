/* ============================================================
   INDIA COMPLIANCE — CUSTOMER-FACING CONTROLLER
   Read-only compliance data surfaced on the battery passport.
   Reads observe the same ownership isolation as the rest of the
   fleet APIs (ownerScopeFor): a USER only sees compliance records
   for batteries they own; operators (ADMIN / EMPLOYEE) see all.

   When no compliance record has been entered for a battery the
   endpoint returns `{ success: true, data: null, available: false }`
   so the UI renders an honest "not yet tracked" state — nothing is
   fabricated.
============================================================ */
import store from "../data/index.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { resolveBatteryByIdentifier } from "../utils/batteryIdentifier.js";
import { ownerScopeFor } from "../utils/ownerScope.js";

const EVENT_WINDOW = { page: 1, limit: 50 };

// GET /api/batteries/:id/compliance
export const getBatteryCompliance = asyncHandler(async (req, res) => {
  const battery = await resolveBatteryByIdentifier(
    store,
    req.params.id,
    ownerScopeFor(req)
  );
  if (!battery) {
    res.status(404);
    throw new Error("Battery not found");
  }

  const record = await store.getBatteryCompliance(battery.id);
  if (!record) {
    return res.json({ success: true, data: null, available: false });
  }

  const { data: documents } = await store.listComplianceDocuments({
    batteryId: battery.id,
    page: EVENT_WINDOW.page,
    limit: EVENT_WINDOW.limit,
  });
  const { data: events } = await store.listComplianceEvents({
    batteryId: battery.id,
    ...EVENT_WINDOW,
  });

  res.json({
    success: true,
    available: true,
    data: {
      ...record,
      documents,
      events,
    },
  });
});