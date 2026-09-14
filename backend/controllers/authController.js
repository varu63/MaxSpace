import bcrypt from "bcryptjs";
import store from "../data/index.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { signToken, sanitizeUser, matchesPassword } from "../utils/auth.js";
import { verifyGoogleIdToken } from "../utils/googleAuth.js";
import { todayISO } from "../utils/date.js";

// POST /api/auth/signin
export const signIn = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error("Please provide email and password");
  }

  const user = store.getUserByEmail(email);

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
  let user = store.getUserByGoogleId(googleProfile.googleId);

  // 2) No Google link yet, but an account already uses this verified
  //    email → link Google to that account and log them in.
  if (!user) {
    const existing = store.getUserByEmail(googleProfile.email);
    if (existing) {
      if (existing.authProvider === "google" && existing.googleId !== googleProfile.googleId) {
        res.status(409);
        throw new Error("This email is already linked to a different Google account");
      }
      store.updateUser(existing.id, {
        googleId: googleProfile.googleId,
        authProvider: "google",
        avatar: googleProfile.avatar || existing.avatar,
        name: existing.name || googleProfile.name,
      });
      user = store.getUserById(existing.id);
    }
  }

  // 3) Brand-new Google user → create a normal USER account.
  if (!user) {
    const created = store.createUser({
      id: `user-${Date.now()}`,
      name: googleProfile.name || googleProfile.email,
      email: googleProfile.email,
      googleId: googleProfile.googleId,
      authProvider: "google",
      avatar: googleProfile.avatar || "",
      role: "USER",
      createdAt: todayISO(),
    });
    user = store.getUserById(created.id);
    isNewUser = true;
  }

  // Update the shared profile avatar/name so the profile UI reflects Google.
  if (googleProfile.avatar) {
    const profile = store.getProfile();
    store.updateProfile({
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

  if (password !== confirmPassword) {
    res.status(400);
    throw new Error("Passwords do not match");
  }

  if (store.getUserByEmail(email)) {
    res.status(409);
    throw new Error("An account with this email already exists");
  }

  const hashedPassword = await bcrypt.hash(String(password), 10);

  const newUser = store.createUser({
    id: `user-${Date.now()}`,
    name,
    email,
    password: hashedPassword,
    role: "USER",
    createdAt: todayISO(),
  });

  const token = signToken(newUser.id, newUser.role);

  res.status(201).json({
    token,
    user: sanitizeUser(newUser),
  });
});

// POST /api/auth/forgot-password
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    res.status(400);
    throw new Error("Please provide your email address");
  }

  res.status(200).json({
    message: "If an account exists with that email, a password reset link has been sent.",
  });
});

// GET /api/auth/me
export const getMe = asyncHandler(async (req, res) => {
  const user = store.getUserById(req.user.id);
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
