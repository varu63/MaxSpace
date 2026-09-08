import jwt from "jsonwebtoken";
import config from "../config/app.js";
import store from "../data/store.js";

export const protect = (req, res, next) => {
  const header = req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Not authorized, no token provided" });
  }

  const token = header.split(" ")[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const user = store.getUserById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: "Not authorized, user not found" });
    }
    req.user = { id: user.id, role: user.role, name: user.name, email: user.email };
    next();
  } catch (error) {
    return res.status(401).json({ message: "Not authorized, token invalid or expired" });
  }
};

export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Access denied. Admin privileges required." });
  }
  next();
};
