import express from "express";
import {
  signIn,
  signUp,
  googleSignIn,
  forgotPassword,
  resetPassword,
  getMe,
  logout,
} from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.post("/signin", signIn);
router.post("/signup", signUp);
router.post("/google", googleSignIn);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/logout", logout);
router.get("/me", protect, getMe);

export default router;
