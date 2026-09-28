import express from "express";
import rateLimit from "express-rate-limit";
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
import {
  getLatestTelemetry,
  getTelemetryHistory,
  submitTelemetry,
} from "../controllers/telemetryController.js";
import { getBatteryCompliance } from "../controllers/complianceController.js";
import { getBatteryCompliancePassport } from "../controllers/complianceManagementController.js";
import {
  protect,
  optionalProtect,
  iotDeviceOrAdmin,
} from "../middleware/auth.js";

const router = express.Router();

// Ingest is a write threshold for high-frequency device data — throttle it
// independently so a misconfigured gateway cannot flood the store.
const telemetryIngestLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,            // 120 readings/min ≈ a sensor every 500ms
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many telemetry readings from this IP, please try again later." },
});

// Specific routes BEFORE generic :id routes to avoid conflicts
router.get("/lookup", optionalProtect, lookupBattery);
router.get("/:id/passport", optionalProtect, getBatteryPassport);
router.get("/:id/health-history", optionalProtect, getBatteryHealthHistory);
router.post("/:id/claim", protect, claimBattery);

// Battery telemetry / IoT-BMS (see services/batteryTelemetryService.js)
router.get("/:id/telemetry/latest", optionalProtect, getLatestTelemetry);
router.get("/:id/telemetry/history", optionalProtect, getTelemetryHistory);
router.post("/:id/telemetry", optionalProtect, telemetryIngestLimiter, iotDeviceOrAdmin, submitTelemetry);

// India compliance read view (owner-scoped, surfaced on the passport)
router.get("/:id/compliance", optionalProtect, getBatteryCompliance);

// Hierarchical compliance passport: the company, model and battery-level
// certificates that apply to this battery, with derived expiry state.
// Development/reference rows and Internal documents are filtered out by
// the service, never by the client.
router.get("/:id/compliance-passport", optionalProtect, getBatteryCompliancePassport);

// Fleet list and creation
router.route("/").get(protect, getBatteries).post(protect, createBattery);

// Generic :id routes
router
  .route("/:id")
  .get(optionalProtect, getBattery)
  .put(protect, updateBattery)
  .delete(protect, deleteBattery);

export default router;