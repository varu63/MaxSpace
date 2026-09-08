import express from "express";
import {
  getBatteries,
  getBattery,
  lookupBattery,
  getBatteryPassport,
  getBatteryHealthHistory,
  createBattery,
  updateBattery,
  deleteBattery,
} from "../controllers/batteryController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.route("/").get(getBatteries).post(createBattery);

// Specific routes BEFORE generic :id routes to avoid conflicts
router.get("/lookup", lookupBattery);
router.get("/:id/passport", getBatteryPassport);
router.get("/:id/health-history", getBatteryHealthHistory);

router
  .route("/:id")
  .get(getBattery)
  .put(updateBattery)
  .delete(deleteBattery);

export default router;
