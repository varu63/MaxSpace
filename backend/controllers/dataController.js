import store from "../data/store.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

// POST /api/data/reset — restore the sample dataset for the current operator
export const resetData = asyncHandler(async (req, res) => {
  store.reset();
  res.json({
    message: "Sample data restored",
    batteries: store.getAllBatteries(),
    services: store.getAllServices(),
  });
});
