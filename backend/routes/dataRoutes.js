import express from "express";
import { resetData } from "../controllers/dataController.js";
import { protect, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.post("/reset", requireAdmin, resetData);

export default router;
