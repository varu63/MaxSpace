import express from "express";
import {
  batteryTechnicianLogin,
  batteryTechnicianMe,
  batteryTechnicianLogout,
  getAssignedServices,
  getAssignedServiceDetail,
  updateServiceStatus,
} from "../controllers/batteryTechnicianController.js";
import { protect, requireEmployee } from "../middleware/auth.js";

const router = express.Router();

// Public routes
router.post("/login", batteryTechnicianLogin);

// Protected employee routes
router.get("/me", protect, requireEmployee, batteryTechnicianMe);
router.post("/logout", protect, requireEmployee, batteryTechnicianLogout);

router.get("/services", protect, requireEmployee, getAssignedServices);
router.get("/services/:id", protect, requireEmployee, getAssignedServiceDetail);
router.patch("/services/:id/status", protect, requireEmployee, updateServiceStatus);

export default router;
