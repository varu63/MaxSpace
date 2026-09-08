import express from "express";
import { resetData } from "../controllers/dataController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.post("/reset", resetData);

export default router;
