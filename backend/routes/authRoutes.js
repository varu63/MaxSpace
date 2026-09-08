import express from "express";
import {
  signIn,
  signUp,
  forgotPassword,
  getMe,
  logout,
} from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.post("/signin", signIn);
router.post("/signup", signUp);
router.post("/forgot-password", forgotPassword);
router.post("/logout", logout);
router.get("/me", protect, getMe);

export default router;
