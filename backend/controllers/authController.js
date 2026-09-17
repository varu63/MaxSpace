import bcrypt from "bcryptjs";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import store from "../data/index.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { signToken, sanitizeUser, matchesPassword } from "../utils/auth.js";
import { verifyGoogleIdToken } from "../utils/googleAuth.js";
import { todayISO } from "../utils/date.js";
import config from "../config/app.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DEFAULT_NOTIFICATION_SETTINGS = {
  warrantyAlerts: true,
  healthThresholdAlerts: true,
  serviceReminders: true,
  euComplianceUpdates: true,
  smsAlerts: false,
};

/* Create the new user's own profile record so /api/profile never falls
   back to another account's data (user isolation). */
const createDefaultProfile = async (userId, { name, email, avatar = "" }) => {
  await store.updateProfile(userId, {
    name,
    email,
    avatar,
    memberSince: new Date().toLocaleString("en-US", { month: "long", year: "numeric" }),
    notificationSettings: { ...DEFAULT_NOTIFICATION_SETTINGS },
  });
};

const hashResetToken = (token) =>
  crypto.createHash("sha256").update(String(token)).digest("hex");

// POST /api/auth/signin
export const signIn = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error("Please provide email and password");
  }

  const user = await store.getUserByEmail(email);

  if (!user) {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  const ok = await matchesPassword(password, user.password);
  if (!ok) {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  const token = signToken(user.id, user.role);

  res.status(200).json({
    token,
    user: sanitizeUser(user),
  });
});

// POST /api/auth/google
// Verify a Google Identity Services credential (ID token), then sign the
// user in. New Google emails create a USER account; an existing account
// with the same verified email is linked to Google (never duplicated) so
// their profile, batteries, service records, and role are preserved.
export const googleSignIn = asyncHandler(async (req, res) => {
  const { credential } = req.body || {};

  if (!credential) {
    res.status(400);
    throw new Error("Google sign-in requires a credential token");
  }

  const googleProfile = await verifyGoogleIdToken(credential);

  // isNewUser lets the frontend distinguish a freshly-created account
  // (Sign Up) from an existing one being linked/logged in (Sign In),
  // so the UI can guide the user without ever creating duplicates.
  let isNewUser = false;

  // 1) Existing Google-linked user → log them in.
  let user = await store.getUserByGoogleId(googleProfile.googleId);

  // 2) No Google link yet, but an account already uses this verified
  //    email → link Google to that account and log them in.
  if (!user) {
    const existing = await store.getUserByEmail(googleProfile.email);
    if (existing) {
      if (existing.authProvider === "google" && existing.googleId !== googleProfile.googleId) {
        res.status(409);
        throw new Error("This email is already linked to a different Google account");
      }
      await store.updateUser(existing.id, {
        googleId: googleProfile.googleId,
        authProvider: "google",
        avatar: googleProfile.avatar || existing.avatar,
        name: existing.name || googleProfile.name,
      });
      user = await store.getUserById(existing.id);
    }
  }

  // 3) Brand-new Google user → create a normal USER account.
  if (!user) {
    const created = await store.createUser({
      id: `user-${Date.now()}`,
      name: googleProfile.name || googleProfile.email,
      email: googleProfile.email,
      googleId: googleProfile.googleId,
      authProvider: "google",
      avatar: googleProfile.avatar || "",
      role: "USER",
      createdAt: todayISO(),
    });
    user = await store.getUserById(created.id);
    isNewUser = true;
    await createDefaultProfile(user.id, {
      name: user.name,
      email: user.email,
      avatar: googleProfile.avatar || "",
    });
  }

  // Update the account's own profile avatar/name so the profile UI reflects Google.
  if (googleProfile.avatar) {
    const profile = (await store.getProfile(user.id)) || {};
    await store.updateProfile(user.id, {
      avatar: googleProfile.avatar || profile.avatar,
      name: googleProfile.name || profile.name,
      email: googleProfile.email || profile.email,
    });
  }

  const token = signToken(user.id, user.role);

  res.status(200).json({
    token,
    user: sanitizeUser(user),
    isNewUser,
  });
});

// POST /api/auth/signup
export const signUp = asyncHandler(async (req, res) => {
  const { name, email, password, confirmPassword } = req.body;

  if (!name || !email || !password) {
    res.status(400);
    throw new Error("Please provide name, email, and password");
  }

  if (!EMAIL_REGEX.test(String(email))) {
    res.status(400);
    throw new Error("Please provide a valid email address");
  }

  if (String(password).length < 6) {
    res.status(400);
    throw new Error("Password must be at least 6 characters");
  }

  if (password !== confirmPassword) {
    res.status(400);
    throw new Error("Passwords do not match");
  }

  if (await store.getUserByEmail(email)) {
    res.status(409);
    throw new Error("An account with this email already exists");
  }

  const hashedPassword = await bcrypt.hash(String(password), 10);

  const newUser = await store.createUser({
    id: `user-${Date.now()}`,
    name,
    email,
    password: hashedPassword,
    role: "USER",
    createdAt: todayISO(),
  });

  await createDefaultProfile(newUser.id, { name, email });

  const token = signToken(newUser.id, newUser.role);

  res.status(201).json({
    token,
    user: sanitizeUser(newUser),
  });
});

// POST /api/auth/forgot-password
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body || {};

  if (!email || !EMAIL_REGEX.test(String(email))) {
    res.status(400);
    throw new Error("Please provide a valid email address");
  }

  const user = await store.getUserByEmail(email);

  // Always respond the same way so email enumeration is not possible.
  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    await store.setPasswordResetToken(user.id, hashResetToken(token), expiresAt.toISOString());
    // No SMTP is configured for this build; persist the reset link so the flow
    // can be exercised in development. In production an email service would send it.
    try {
      const resetsLog = path.join(process.env.TEMP || "/tmp", "maxspace-reset-links.log");
      fs.appendFileSync(resetsLog, `${new Date().toISOString()} ${user.email} ${config.clientUrl}/auth/reset-password?token=${token}\n`);
    } catch {
      // ignore logging failures
    }
  }

  res.status(200).json({
    message: "If an account exists with that email, a password reset link has been sent.",
  });
});

// POST /api/auth/reset-password — consume a one-time reset token
export const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body || {};

  if (!token || !newPassword) {
    res.status(400);
    throw new Error("Please provide the reset token and a new password");
  }

  if (String(newPassword).length < 6) {
    res.status(400);
    throw new Error("Password must be at least 6 characters");
  }

  const user = await store.getUserByPasswordResetToken(hashResetToken(token));

  const expired =
    !user ||
    !user.resetTokenExpiresAt ||
    new Date(user.resetTokenExpiresAt).getTime() < Date.now();

  if (expired) {
    res.status(400);
    throw new Error("Invalid or expired reset token");
  }

  const hashed = await bcrypt.hash(String(newPassword), 10);
  await store.updateUser(user.id, { password: hashed });
  await store.clearPasswordResetToken(user.id);

  res.status(200).json({ message: "Password reset successfully. You can now sign in." });
});

// GET /api/auth/me
export const getMe = asyncHandler(async (req, res) => {
  const user = await store.getUserById(req.user.id);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }
  res.json({ user: sanitizeUser(user) });
});

// POST /api/auth/logout
export const logout = asyncHandler(async (req, res) => {
  res.json({ message: "Logged out successfully" });
});
