import bcrypt from "bcryptjs";
import store from "../data/store.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const sanitizeProfile = (profile) => {
  if (!profile) return profile;
  const { password, ...rest } = profile;
  return rest;
};

// GET /api/profile
export const getProfile = asyncHandler(async (req, res) => {
  res.json({ profile: sanitizeProfile(store.getProfile()) });
});

// PUT /api/profile
export const updateProfile = asyncHandler(async (req, res) => {
  const { password, ...allowed } = req.body || {};
  const updated = store.updateProfile(allowed);
  store.logActivity("Profile Updated", "Profile details and preferences saved", "general");
  res.json({ profile: sanitizeProfile(updated) });
});

// PUT /api/profile/notifications
export const updateNotifications = asyncHandler(async (req, res) => {
  const current = store.getProfile();
  const updated = store.updateProfile({
    notificationSettings: {
      ...(current.notificationSettings || {}),
      ...(req.body || {}),
    },
  });
  res.json({ profile: sanitizeProfile(updated) });
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

  const profile = store.getProfile();

  // Verify current password (bcrypt hash or seeded plaintext)
  const stored = profile.password;
  const looksHashed = /^\$2[aby]\$/.test(stored || "");
  const matches = looksHashed
    ? await bcrypt.compare(String(currentPassword || ""), stored)
    : stored === String(currentPassword || "");

  if (!matches) {
    res.status(401);
    throw new Error("Current password is incorrect");
  }

  const hashed = await bcrypt.hash(String(newPassword), 10);
  const updated = store.updateProfile({ password: hashed });
  store.logActivity("Password Changed", "Account password was updated", "general");

  res.json({ message: "Password updated successfully", profile: sanitizeProfile(updated) });
});

// GET /api/profile/activity
export const getActivityLogs = asyncHandler(async (req, res) => {
  res.json(store.getProfile().activityLogs || []);
});

// GET /api/profile/export
export const exportProfileData = asyncHandler(async (req, res) => {
  res.json({
    user: sanitizeProfile(store.getProfile()),
    batteries: store.getAllBatteries(),
    services: store.getAllServices(),
    exportedAt: new Date().toISOString(),
  });
});
