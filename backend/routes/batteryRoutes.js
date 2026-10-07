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
  correctBatteryManufacturerFields,
  deleteBattery,
} from "../controllers/batteryController.js";
import {
  appendBatteryEvent,
  assignBatteryEolPartner,
  backfillBatteryLifecycle,
  detectBatteryTelemetryEvents,
  getBatteryEolAssignments,
  getBatteryFirmware,
  getBatteryLifecycle,
  getBatteryProvenance,
  getBatterySecondLife,
  getBatteryTelemetryEvents,
  getLifecycleVocabulary,
  getOwnershipHistory,
  listBatteryEvents,
  recordBatteryFirmware,
  recordBatteryProvenance,
  recordBatterySecondLife,
  transferBatteryOwnership,
  updateBatteryEolAssignment,
  verifyBatteryLifecycle,
} from "../controllers/batteryLifecycleController.js";
import {
  getLatestTelemetry,
  getTelemetryHistory,
  submitTelemetry,
} from "../controllers/telemetryController.js";
import { getBatteryCompliance } from "../controllers/complianceController.js";
import { getBatteryCompliancePassport } from "../controllers/complianceManagementController.js";
import {
  acceptOwnershipTransferRequest,
  cancelOwnershipTransferRequest,
  createOwnershipTransferRequest,
  getOwnershipTransferRequest,
} from "../controllers/batteryOwnershipTransferController.js";
import {
  protect,
  optionalProtect,
  iotDeviceOrAdmin,
  requireAdmin,
  requireOperator,
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

// One-time QR ownership transfer. The fixed `transfers` segment keeps
// these out of the way of `/:id/...` (`:id` never sees them, and the
// 43-character token can never equal a literal segment like "passport").
// All four require an account: minting and accepting are owner acts,
// never anonymous ones.
router.post("/:id/transfers", protect, createOwnershipTransferRequest);
router.get("/transfers/:token", protect, getOwnershipTransferRequest);
router.post("/transfers/:token/accept", protect, acceptOwnershipTransferRequest);
router.post("/transfers/:token/cancel", protect, cancelOwnershipTransferRequest);

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

// ---------------------------------------------------------------------------
// BATTERY PASSPORT LIFECYCLE
// The history the passport previously had no way to express: the
// append-only event ledger and its hash chain, ownership transfers,
// per-field provenance, derived telemetry events, firmware history,
// end-of-life partner assignments and second-life assessments.
//
// Reads are owner-scoped (optionalProtect, then ownerScopeFor inside the
// controller); writes require an operator or, for the EOL paths, an
// admin. Writes additionally re-check the role in the controller itself,
// so mounting a handler somewhere else cannot bypass the check.
// ---------------------------------------------------------------------------

// Vocabulary first: a fixed path that must not be captured by `/:id/...`.
router.get("/lifecycle/vocabulary", protect, getLifecycleVocabulary);

router.get("/:id/lifecycle", optionalProtect, getBatteryLifecycle);
router.get("/:id/lifecycle/verify", optionalProtect, verifyBatteryLifecycle);
router.get("/:id/lifecycle/events", optionalProtect, listBatteryEvents);
router.post("/:id/lifecycle/events", protect, requireOperator, appendBatteryEvent);
router.post("/:id/lifecycle/backfill", protect, requireAdmin, backfillBatteryLifecycle);

router.get("/:id/ownership-history", optionalProtect, getOwnershipHistory);
router.post("/:id/transfer-ownership", protect, requireAdmin, transferBatteryOwnership);

router.get("/:id/provenance", optionalProtect, getBatteryProvenance);
router.post("/:id/provenance", protect, requireOperator, recordBatteryProvenance);

router.get("/:id/telemetry-events", optionalProtect, getBatteryTelemetryEvents);
router.post("/:id/telemetry-events/detect", protect, requireOperator, detectBatteryTelemetryEvents);

router.get("/:id/firmware", optionalProtect, getBatteryFirmware);
router.post("/:id/firmware", protect, requireOperator, recordBatteryFirmware);

router.get("/:id/eol-assignments", optionalProtect, getBatteryEolAssignments);
router.post("/:id/eol-assignments", protect, requireAdmin, assignBatteryEolPartner);
// Express 5 mounts path-to-regexp v8, which spells a custom parameter
// pattern with braces (`:action{complete|revoke}`). The old parenthesised
// form throws a PathError while the router is being built, which takes the
// whole API down at import time.
router.post("/:id/eol-assignments/:assignmentId/:action{complete|revoke}", protect, requireAdmin, updateBatteryEolAssignment);

router.get("/:id/second-life", optionalProtect, getBatterySecondLife);
router.post("/:id/second-life", protect, requireAdmin, recordBatterySecondLife);

// Manufacturer-authoritative fields are locked by a database trigger, so
// they are not part of the ordinary update. This is the audited path.
router.patch("/:id/manufacturer-correction", protect, requireAdmin, correctBatteryManufacturerFields);

// Fleet list and creation
router.route("/").get(protect, getBatteries).post(protect, createBattery);

// Generic :id routes
router
  .route("/:id")
  .get(optionalProtect, getBattery)
  .put(protect, updateBattery)
  .delete(protect, deleteBattery);

export default router;