import express from "express";
import {
  getFleetStats,
  getServiceAnalytics,
  getBatteryPerformance,
  getAnalytics,
} from "../controllers/analyticsController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.get("/", getAnalytics);
router.get("/fleet-stats", getFleetStats);
router.get("/services", getServiceAnalytics);
router.get("/batteries/performance", getBatteryPerformance);

export default router;
