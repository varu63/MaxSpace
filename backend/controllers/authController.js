import bcrypt from "bcryptjs";
import store from "../data/store.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { signToken, sanitizeUser, matchesPassword } from "../utils/auth.js";
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
