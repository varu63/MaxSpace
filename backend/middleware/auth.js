import jwt from "jsonwebtoken";
import config from "../config/app.js";
import store from "../data/index.js";

export const protect = async (req, res, next) => {
  const header = req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, status: 401, message: "Not authorized, no token provided" });
  }

  const token = header.split(" ")[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    // Re-fetch the user on every request (not just the token payload) so a
    // disabled/removed account or an updated role takes effect immediately –
    // JWTs themselves are stateless and cannot be revoked.
    const user = await store.getUserById(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, status: 401, message: "Not authorized, user not found" });
    }
    req.user = { id: user.id, role: user.role, name: user.name, email: user.email };
    next();
  } catch (error) {
    return res.status(401).json({ success: false, status: 401, message: "Not authorized, token invalid or expired" });
  }
};

export const optionalProtect = async (req, res, next) => {
  const header = req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return next();
  }

  const token = header.split(" ")[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const user = await store.getUserById(decoded.id);
    if (user) {
      req.user = { id: user.id, role: user.role, name: user.name, email: user.email };
    }
  } catch {
    // Invalid/expired token is ignored on optional routes
  }
  next();
};

export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "ADMIN") {
    return res.status(403).json({ success: false, status: 403, message: "Access denied. Admin privileges required." });
  }
  next();
};

export const requireEmployee = (req, res, next) => {
  if (!req.user || req.user.role !== "EMPLOYEE") {
    return res.status(403).json({ success: false, status: 403, message: "Access denied. Employee privileges required." });
  }
  next();
};
