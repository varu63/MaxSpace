import express from "express";
import {
  getServices,
  getService,
  getBatteryServiceStatus,
  createService,
  updateService,
  deleteService,
} from "../controllers/serviceController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.route("/").get(getServices).post(createService);

router.get("/battery/:batteryId/status", getBatteryServiceStatus);

router
  .route("/:id")
  .get(getService)
  .patch(updateService)
  .delete(deleteService);

export default router;
