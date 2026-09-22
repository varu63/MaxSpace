import express from "express";
import rateLimit from "express-rate-limit";
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
  getUsers,
  getAdminBatteries,
  getAdminAnalytics,
} from "../controllers/adminController.js";
import {
  getSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  getAvailableTechnicians,
  syncSchedules,
  refreshScheduleFromService,
  getTechnicianAvailability,
  createTechnicianAvailability,
  updateTechnicianAvailability,
  deleteTechnicianAvailability,
} from "../controllers/adminSchedulingController.js";
import { protect, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

// Public routes (login is rate-limited to slow down credential stuffing)
// Only FAILED attempts consume the window, so legit users who log out and
// back in (or log in repeatedly) are never blacklisted by their own activity.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts from this IP, please try again later." },
});

router.post("/login", loginLimiter, adminLogin);

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
router.get("/users", protect, requireAdmin, getUsers);
router.get("/batteries", protect, requireAdmin, getAdminBatteries);
router.get("/analytics", protect, requireAdmin, getAdminAnalytics);

// P2.1 Scheduling + technician availability
router.get("/schedules", protect, requireAdmin, getSchedules);
router.post("/schedules", protect, requireAdmin, createSchedule);
router.patch("/schedules/:id", protect, requireAdmin, updateSchedule);
router.delete("/schedules/:id", protect, requireAdmin, deleteSchedule);
router.get("/schedules/available", protect, requireAdmin, getAvailableTechnicians);
router.post("/schedules/sync", protect, requireAdmin, syncSchedules);
router.post("/schedules/upsert-service", protect, requireAdmin, refreshScheduleFromService);

router.get("/technician-availability", protect, requireAdmin, getTechnicianAvailability);
router.post("/technician-availability", protect, requireAdmin, createTechnicianAvailability);
router.patch("/technician-availability/:id", protect, requireAdmin, updateTechnicianAvailability);
router.delete("/technician-availability/:id", protect, requireAdmin, deleteTechnicianAvailability);

export default router;