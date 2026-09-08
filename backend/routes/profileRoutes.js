import express from "express";
import {
  getProfile,
  updateProfile,
  updateNotifications,
  changePassword,
  getActivityLogs,
  exportProfileData,
} from "../controllers/profileController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.get("/", getProfile);
router.put("/", updateProfile);
router.put("/notifications", updateNotifications);
router.post("/password", changePassword);
router.get("/activity", getActivityLogs);
router.get("/export", exportProfileData);

export default router;
