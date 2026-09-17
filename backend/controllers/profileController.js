import bcrypt from "bcryptjs";
import store from "../data/index.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { sanitizeUser, matchesPassword } from "../utils/auth.js";

const DEFAULT_NOTIFICATION_SETTINGS = {
  warrantyAlerts: true,
  healthThresholdAlerts: true,
  serviceReminders: true,
  euComplianceUpdates: true,
  smsAlerts: false,
};

/* Guarantee every authenticated user has their OWN profile row, seeded from
   the users table (the source of truth for identity) so the UI always shows
   the email used to log in — never another account's record. */
const ensureProfile = async (userId) => {
  const user = await store.getUserById(userId);
  if (!user) return null;

  const current = (await store.getProfile(userId)) || {};

  // No profile row yet (e.g. legacy account) -> create one from the user.
  if (!current.id) {
    return store.updateProfile(userId, {
      name: user.name,
      email: user.email,
      avatar: user.avatar || "",
      memberSince: new Date().toLocaleString("en-US", { month: "long", year: "numeric" }),
      notificationSettings: { ...DEFAULT_NOTIFICATION_SETTINGS },
    });
  }

  // Keep identity in sync with users.email so the displayed email always
  // matches the credentials used to log in.
  if (current.email !== user.email || !current.name) {
    return store.updateProfile(userId, {
      name: current.name || user.name,
      email: user.email,
    });
  }

  return current;
};

// GET /api/profile
export const getProfile = asyncHandler(async (req, res) => {
  res.json({ profile: sanitizeUser(await ensureProfile(req.user.id)) });
});

// PUT /api/profile
export const updateProfile = asyncHandler(async (req, res) => {
  // email and password are managed on the users record; never let a request
  // override the login email with a client-supplied value.
  const { password, email, ...allowed } = req.body || {};
  await ensureProfile(req.user.id);
  const updated = await store.updateProfile(req.user.id, allowed);
  await store.logActivity(req.user.id, "Profile Updated", "Profile details and preferences saved", "general");
  res.json({ profile: sanitizeUser(updated) });
});

// PUT /api/profile/notifications
export const updateNotifications = asyncHandler(async (req, res) => {
  const current = (await store.getProfile(req.user.id)) || {};
  const updated = await store.updateProfile(req.user.id, {
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
  await store.logActivity(req.user.id, "Password Changed", "Account password was updated", "general");

  res.json({ message: "Password updated successfully", profile: sanitizeUser(await store.getProfile(req.user.id)) });
});

// GET /api/profile/activity
export const getActivityLogs = asyncHandler(async (req, res) => {
  const profile = (await store.getProfile(req.user.id)) || {};
  res.json(profile.activityLogs || []);
});

// GET /api/profile/export
export const exportProfileData = asyncHandler(async (req, res) => {
  res.json({
    user: sanitizeUser(await store.getProfile(req.user.id)),
    batteries: await store.getAllBatteries(req.user.id),
    services: await store.getServicesByCustomerId(req.user.id),
    exportedAt: new Date().toISOString(),
  });
});
