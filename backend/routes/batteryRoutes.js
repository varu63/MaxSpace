import express from "express";
import {
  getBatteries,
  getBattery,
  lookupBattery,
  getBatteryPassport,
  getBatteryHealthHistory,
  createBattery,
  claimBattery,
  updateBattery,
  deleteBattery,
} from "../controllers/batteryController.js";
import { protect, optionalProtect } from "../middleware/auth.js";

const router = express.Router();

// Specific routes BEFORE generic :id routes to avoid conflicts
router.get("/lookup", optionalProtect, lookupBattery);
router.get("/:id/passport", optionalProtect, getBatteryPassport);
router.get("/:id/health-history", optionalProtect, getBatteryHealthHistory);
router.post("/:id/claim", protect, claimBattery);

// Fleet list and creation
router.route("/").get(protect, getBatteries).post(protect, createBattery);

// Generic :id routes
router
  .route("/:id")
  .get(optionalProtect, getBattery)
  .put(protect, updateBattery)
  .delete(protect, deleteBattery);

export default router;
