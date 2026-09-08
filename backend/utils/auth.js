/* ============================================================
   AUTH HELPERS
   Shared token signing, password matching, and sanitization
   used by both customer and admin auth controllers.
============================================================ */
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import config from "../config/app.js";

export const signToken = (id, role) =>
  jwt.sign({ id, role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

export const sanitizeUser = (user) => {
  if (!user) return user;
  const { password, ...rest } = user;
  return rest;
};

export const matchesPassword = async (provided, stored) => {
  if (!stored) return false;
  const looksHashed = /^\$2[aby]\$/.test(stored);
  if (looksHashed) {
    return bcrypt.compare(String(provided), stored);
  }
  return stored === String(provided);
};
