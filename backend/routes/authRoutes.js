import express from "express";
import rateLimit from "express-rate-limit";
import {
  signIn,
  signUp,
  googleSignIn,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
  getMe,
  logout,
} from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

/* Endpoints that make the SERVER send an e-mail are limited separately
   from the general auth limiter: an attacker (or a broken client) must not
   be able to turn MaxSpace into a mail relay, and one mailbox must not be
   flooded by repeated "resend" clicks. Keyed per IP, 5 requests / 15 min. */
const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many email requests from this IP. Please wait a few minutes and try again.",
  },
});

/* Sign-up also triggers an e-mail, so it gets a slightly wider budget:
   the whole form has to be filled in to reach it, but it still caps how
   many messages one IP can originate. */
const signUpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many sign-up attempts from this IP. Please wait a few minutes and try again.",
  },
});

router.post("/signin", signIn);
router.post("/signup", signUpLimiter, signUp);
router.post("/google", googleSignIn);

// E-mail verification: the link in the message is a GET that the backend
// answers with a redirect to the frontend page showing the outcome.
router.get("/verify-email", verifyEmail);
router.post("/resend-verification", emailLimiter, resendVerification);

router.post("/forgot-password", emailLimiter, forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/logout", logout);
router.get("/me", protect, getMe);

export default router;
