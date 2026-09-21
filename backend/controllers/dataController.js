import store from "../data/index.js";
import config from "../config/app.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

// POST /api/data/reset — restore the sample dataset for the current operator.
// Destructive (TRUNCATE): disabled unless ALLOW_DB_RESET=true so a
// production database such as maxvolt_prod can never be wiped via the API.
export const resetData = asyncHandler(async (req, res) => {
  if (!config.db.allowReset) {
    res.status(403);
    throw new Error(
      "Database reset is disabled (set ALLOW_DB_RESET=true to enable). Inventory is production data and is never reset through the API."
    );
  }
  await store.reset();
  res.json({
    message: "Sample data restored",
    batteries: await store.getAllBatteries(),
    services: await store.getAllServices(),
  });
});