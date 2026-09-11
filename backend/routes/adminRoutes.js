import express from "express";
import {
  adminLogin,
  adminMe,
  adminLogout,
  getAdminServices,
  getAdminService,
  acceptService,
  assignService,
  updateServiceStatus,
  approveService,
  getServicePersons,
  createServicePerson,
  updateServicePerson,
  createTechnician,
  getTechnicians,
  getTechnician,
  updateTechnician,
  resetTechnicianPassword,
  getCustomers,
  getAdminAnalytics,
} from "../controllers/adminController.js";
import { protect, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

// Public routes
router.post("/login", adminLogin);

// Protected admin routes
router.get("/me", protect, requireAdmin, adminMe);
router.post("/logout", protect, requireAdmin, adminLogout);

router.get("/services", protect, requireAdmin, getAdminServices);
router.get("/services/:id", protect, requireAdmin, getAdminService);
router.patch("/services/:id/accept", protect, requireAdmin, acceptService);
router.patch("/services/:id/assign", protect, requireAdmin, assignService);
router.patch("/services/:id/status", protect, requireAdmin, updateServiceStatus);
router.patch("/services/:id/approve", protect, requireAdmin, approveService);

router.get("/service-persons", protect, requireAdmin, getServicePersons);
router.post("/service-persons", protect, requireAdmin, createServicePerson);
router.patch("/service-persons/:id", protect, requireAdmin, updateServicePerson);

router.get("/technicians", protect, requireAdmin, getTechnicians);
router.get("/technicians/:id", protect, requireAdmin, getTechnician);
router.post("/technicians", protect, requireAdmin, createTechnician);
router.patch("/technicians/:id", protect, requireAdmin, updateTechnician);
router.patch("/technicians/:id/reset-password", protect, requireAdmin, resetTechnicianPassword);

router.get("/customers", protect, requireAdmin, getCustomers);
router.get("/analytics", protect, requireAdmin, getAdminAnalytics);

export default router;