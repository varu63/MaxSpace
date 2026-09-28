import express from "express";
import { protect, requireAdmin } from "../middleware/auth.js";
import {
  getMapBatteries,
  getOrganizationLocations,
  getMapLocations,
  getMapLocation,
  saveMapLocation,
  deleteMapLocation,
  getMapLocationHistory,
} from "../controllers/mapController.js";

const router = express.Router();

/* Authenticated map surface. Every role (ADMIN / USER / EMPLOYEE) may
   read the map, and the controller scopes markers to their permissions
   (see mapController.js). */
router.get("/batteries", protect, getMapBatteries);

/* Organisation / facility network markers for the visual compliance map.
   Read-only for every authenticated role; the same backend markers are
   shown to User, Admin and Battery Technician. */
router.get("/organizations", protect, getOrganizationLocations);

/* Location management is ADMIN-only: locations describe real-world
   battery siting, so creating/updating/deleting them requires admin
   privileges and service-layer validation. */
router.use("/locations", protect, requireAdmin);
router.get("/locations", getMapLocations);
router.get("/locations/:batteryId/history", getMapLocationHistory);
router.get("/locations/:batteryId", getMapLocation);
router.put("/locations/:batteryId", saveMapLocation);
router.delete("/locations/:batteryId", deleteMapLocation);

export default router;