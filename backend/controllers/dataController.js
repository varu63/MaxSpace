import store from "../data/index.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

// POST /api/data/reset — restore the sample dataset for the current operator
export const resetData = asyncHandler(async (req, res) => {
  await store.reset();
  res.json({
    message: "Sample data restored",
    batteries: await store.getAllBatteries(),
    services: await store.getAllServices(),
  });
});
