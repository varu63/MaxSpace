import bcrypt from "bcryptjs";
import crypto from "crypto";
import store from "../data/index.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { signToken, sanitizeUser, matchesPassword } from "../utils/auth.js";
import { verifyGoogleIdToken } from "../utils/googleAuth.js";
import { sendPasswordResetEmail, sendVerificationEmail } from "../services/emailService.js";
import { todayISO } from "../utils/date.js";
import config from "../config/app.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const RESET_TTL_MS = 30 * 60 * 1000; // 30 minutes

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

/* One-time tokens are random 32-byte values sent to the user; only their
   SHA-256 is stored, so a database leak cannot be replayed as a link. */
const hashToken = (token) =>
  crypto.createHash("sha256").update(String(token)).digest("hex");

const newToken = () => crypto.randomBytes(32).toString("hex");

/* Throw an error the shared error middleware renders as a user-facing
   envelope with a machine-readable `code` the frontend can branch on.
   `userFacing` also keeps the message/code visible in production for the
   5xx case (email delivery failed) instead of the generic fallback. */
const httpError = (status, message, code) =>
  Object.assign(new Error(message), { statusCode: status, code, userFacing: true });

/* Frontend origin for post-verification redirects. clientUrl may hold a
   comma-separated list (CORS allows several); the first one is the app. */
const frontendOrigin = () => String(config.clientUrl || "").split(",")[0].trim();

const verifyLink = (token) =>
  `${config.email.appBaseUrl}/api/auth/verify-email?token=${encodeURIComponent(token)}`;

const resetLink = (token) =>
  `${frontendOrigin()}/reset-password?token=${encodeURIComponent(token)}`;

/* Send an auth e-mail without ever surfacing the provider error to the
   caller. The outcome is logged server-side (never the API key). */
const deliver = async (sendFn, label) => {
  try {
    await sendFn();
    return true;
  } catch (error) {
    console.error(`[auth] ${label} could not be sent: ${error.message}`);
    return false;
  }
};

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

  // Credentials are checked FIRST so a stranger cannot use this endpoint
  // to learn which addresses are registered. Only the local sign-up flow
  // creates unverified accounts; every pre-existing, admin-created and
  // Google-linked account has emailVerified=true and is unaffected.
  if (user.emailVerified === false) {
    throw httpError(
      403,
      "Your email address has not been verified. Please check your inbox for the verification link, or resend it.",
      "EMAIL_NOT_VERIFIED"
    );
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
      // googleAuth only accepts a credential whose e-mail Google has
      // already verified, so no MaxSpace verification round-trip is needed.
      emailVerified: true,
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
// Creates the account in an UNVERIFIED state and e-mails a one-time link.
// No JWT is issued here: the address has to be confirmed before sign-in.
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
    emailVerified: false,
    createdAt: todayISO(),
  });

  await createDefaultProfile(newUser.id, { name, email });

  const token = newToken();
  await store.setEmailVerificationToken(
    newUser.id,
    hashToken(token),
    new Date(Date.now() + VERIFICATION_TTL_MS).toISOString()
  );

  // A delivery failure never re-creates or deletes the account, so a retry
  // can never produce a duplicate: the user asks for a fresh link through
  // POST /auth/resend-verification instead.
  const emailSent = await deliver(
    () =>
      sendVerificationEmail({
        to: newUser.email,
        name,
        verifyUrl: verifyLink(token),
      }),
    "Verification email"
  );

  res.status(201).json({
    success: true,
    requiresVerification: true,
    emailSent,
    message: emailSent
      ? "Account created. Please check your email to verify your account."
      : "Account created, but the verification email could not be sent. Please resend it from the verification page.",
    user: sanitizeUser(newUser),
  });
});

// POST /api/auth/forgot-password
export const forgotPassword = asyncHandler(async (req, res) => {
  const email = String((req.body || {}).email || "")
    .trim()
    .toLowerCase();

  if (!email || !EMAIL_REGEX.test(email)) {
    res.status(400);
    throw new Error("Please provide a valid email address");
  }

  // Deliberately non-enumerating: unknown addresses get the identical
  // 200 response as real ones, so this endpoint cannot be used to probe
  // which addresses have accounts.
  const genericResponse = {
    success: true,
    message: "If an account exists for this email, we have sent a password reset link.",
  };

  const user = await store.getUserByEmail(email);
  if (!user) {
    return res.status(200).json(genericResponse);
  }

  // Replaces any earlier token, so only the newest link can work, and
  // clears a "used" marker left behind by a previous reset.
  const token = newToken();
  await store.setPasswordResetToken(
    user.id,
    hashToken(token),
    new Date(Date.now() + RESET_TTL_MS).toISOString()
  );

  const sent = await deliver(
    () =>
      sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        resetUrl: resetLink(token),
      }),
    "Password reset email"
  );

  if (!sent) {
    // The provider failed: never claim an email went out. The message is
    // generic, so account existence is still not revealed by its text.
    throw httpError(
      503,
      "We could not send the password reset email right now. Please try again in a few minutes.",
      "EMAIL_DELIVERY_FAILED"
    );
  }

  res.status(200).json(genericResponse);
});

// POST /api/auth/reset-password — consume a one-time reset token
export const resetPassword = asyncHandler(async (req, res) => {
  const { token, password, confirmPassword, newPassword } = req.body || {};

  // Accept both the documented `password` field and the older `newPassword`
  // alias so existing callers keep working unchanged.
  const candidatePassword = password ?? newPassword;

  if (!token || !candidatePassword) {
    res.status(400);
    throw new Error("Please provide the reset token and a new password");
  }

  if (String(candidatePassword).length < 6) {
    res.status(400);
    throw new Error("Password must be at least 6 characters");
  }

  if (confirmPassword && confirmPassword !== candidatePassword) {
    res.status(400);
    throw new Error("Passwords do not match");
  }

  // Server-side token validation: existence, reuse, then expiry. The
  // frontend never supplies any part of this state.
  const user = await store.getUserByPasswordResetToken(hashToken(token));

  if (!user) {
    throw httpError(
      400,
      "This reset link is invalid. Please request a new password reset link.",
      "RESET_TOKEN_INVALID"
    );
  }

  if (user.resetTokenUsedAt) {
    throw httpError(
      400,
      "This reset link has already been used. Please request a new password reset link.",
      "RESET_TOKEN_USED"
    );
  }

  const expired =
    !user.resetTokenExpiresAt ||
    new Date(user.resetTokenExpiresAt).getTime() < Date.now();

  if (expired) {
    throw httpError(
      400,
      "This reset link has expired. Please request a new password reset link.",
      "RESET_TOKEN_EXPIRED"
    );
  }

  const hashed = await bcrypt.hash(String(candidatePassword), 10);
  await store.updateUser(user.id, { password: hashed });
  // Stamp consumption: the link is dead immediately and a replay is
  // answered with "already used" instead of a generic failure.
  await store.markPasswordResetTokenUsed(user.id);

  res.status(200).json({
    success: true,
    message: "Password reset successfully. You can now log in.",
  });
});

// GET /api/auth/verify-email?token=…
// Hit directly by the link in the e-mail, so the token is validated here
// and the browser is redirected to the frontend with a safe status code.
export const verifyEmail = asyncHandler(async (req, res) => {
  const token = String((req.query || {}).token || "").trim();

  const redirectTo = (status) =>
    res.redirect(302, `${frontendOrigin()}/verify-email?status=${status}`);

  if (!token) return redirectTo("invalid");

  const user = await store.getUserByEmailVerificationToken(hashToken(token));

  if (!user) return redirectTo("invalid");

  // Covers both "already verified through another link" and a replay of
  // this very link: the token was consumed when verification succeeded.
  if (user.emailVerified) return redirectTo("already-verified");

  const expired =
    !user.emailVerificationExpiresAt ||
    new Date(user.emailVerificationExpiresAt).getTime() < Date.now();

  if (expired) return redirectTo("expired");

  await store.markEmailVerified(user.id);
  console.log(`[auth] Email verified for user ${user.id}`);
  return redirectTo("verified");
});

// POST /api/auth/resend-verification
export const resendVerification = asyncHandler(async (req, res) => {
  const email = String((req.body || {}).email || "").trim().toLowerCase();

  if (!email || !EMAIL_REGEX.test(email)) {
    res.status(400);
    throw new Error("Please provide a valid email address");
  }

  // Same body for "no such account", "already verified" and "sent", so the
  // endpoint cannot be used to enumerate addresses. Rate limiting on the
  // route keeps it from being used to flood a mailbox.
  const genericResponse = {
    success: true,
    message: "If an unverified account exists for this email, a new verification link has been sent.",
  };

  const user = await store.getUserByEmail(email);
  if (!user || user.emailVerified) {
    return res.status(200).json(genericResponse);
  }

  // A fresh token invalidates the previous link (the hash is replaced).
  const token = newToken();
  await store.setEmailVerificationToken(
    user.id,
    hashToken(token),
    new Date(Date.now() + VERIFICATION_TTL_MS).toISOString()
  );

  const sent = await deliver(
    () =>
      sendVerificationEmail({
        to: user.email,
        name: user.name,
        verifyUrl: verifyLink(token),
      }),
    "Verification email"
  );

  if (!sent) {
    throw httpError(
      503,
      "We could not send the verification email right now. Please try again in a few minutes.",
      "EMAIL_DELIVERY_FAILED"
    );
  }

  res.status(200).json(genericResponse);
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
