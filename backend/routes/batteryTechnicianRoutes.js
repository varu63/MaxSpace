import express from "express";
import rateLimit from "express-rate-limit";
import {
  batteryTechnicianLogin,
  batteryTechnicianGoogleLogin,
  batteryTechnicianMe,
  batteryTechnicianLogout,
  getAssignedServices,
  getAssignedServiceDetail,
  updateServiceStatus,
} from "../controllers/batteryTechnicianController.js";
import { protect, requireEmployee } from "../middleware/auth.js";

const router = express.Router();

// Public routes (login is rate-limited to slow down credential stuffing)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts from this IP, please try again later." },
});

router.post("/login", loginLimiter, batteryTechnicianLogin);
router.post("/google", loginLimiter, batteryTechnicianGoogleLogin);

// Protected employee routes
router.get("/me", protect, requireEmployee, batteryTechnicianMe);
router.post("/logout", protect, requireEmployee, batteryTechnicianLogout);

router.get("/services", protect, requireEmployee, getAssignedServices);
router.get("/services/:id", protect, requireEmployee, getAssignedServiceDetail);
router.patch("/services/:id/status", protect, requireEmployee, updateServiceStatus);

export default router;
