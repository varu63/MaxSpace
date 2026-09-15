import bcrypt from "bcryptjs";
import store from "../data/index.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { sanitizeUser, matchesPassword } from "../utils/auth.js";

// GET /api/profile
export const getProfile = asyncHandler(async (req, res) => {
  res.json({ profile: sanitizeUser(await store.getProfile()) });
});

// PUT /api/profile
export const updateProfile = asyncHandler(async (req, res) => {
  const { password, ...allowed } = req.body || {};
  const updated = await store.updateProfile(allowed);
  await store.logActivity("Profile Updated", "Profile details and preferences saved", "general");
  res.json({ profile: sanitizeUser(updated) });
});

// PUT /api/profile/notifications
export const updateNotifications = asyncHandler(async (req, res) => {
  const current = (await store.getProfile()) || {};
  const updated = await store.updateProfile({
    notificationSettings: {
      ...(current.notificationSettings || {}),
      ...(req.body || {}),
    },
  });
  res.json({ profile: sanitizeUser(updated) });
});

// POST /api/profile/password
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};

  if (!currentPassword) {
    res.status(400);
    throw new Error("Please provide your current password");
  }
  if (!newPassword) {
    res.status(400);
    throw new Error("Please provide a new password");
  }
  if (String(newPassword).length < 6) {
    res.status(400);
    throw new Error("New password must be at least 6 characters");
  }

  const user = await store.getUserById(req.user?.id);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  // Verify current password against the login user record
  const matches = await matchesPassword(String(currentPassword || ""), user.password);

  if (!matches) {
    res.status(401);
    throw new Error("Current password is incorrect");
  }

  const hashed = await bcrypt.hash(String(newPassword), 10);
  await store.updateUser(user.id, { password: hashed });
  // Keep the shared profile record in sync (password is stripped on sanitize)
  await store.updateProfile({ password: hashed });
  await store.logActivity("Password Changed", "Account password was updated", "general");

  res.json({ message: "Password updated successfully", profile: sanitizeUser(await store.getProfile()) });
});

// GET /api/profile/activity
export const getActivityLogs = asyncHandler(async (req, res) => {
  const profile = (await store.getProfile()) || {};
  res.json(profile.activityLogs || []);
});

// GET /api/profile/export
export const exportProfileData = asyncHandler(async (req, res) => {
  res.json({
    user: sanitizeUser(await store.getProfile()),
    batteries: await store.getAllBatteries(),
    services: await store.getAllServices(),
    exportedAt: new Date().toISOString(),
  });
});
