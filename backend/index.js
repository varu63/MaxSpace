import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import config from "./config/app.js";
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import batteryRoutes from "./routes/batteryRoutes.js";
import serviceRoutes from "./routes/serviceRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import dataRoutes from "./routes/dataRoutes.js";
import batteryTechnicianRoutes from "./routes/batteryTechnicianRoutes.js";
import { notFound, errorHandler } from "./middleware/errorMiddleware.js";

const app = express();

// Security headers
app.use(helmet());

// CORS
app.use(
  cors({
    origin: config.clientUrl,
    credentials: true,
  })
);

// Request body parsing with size limit (prevents large payload DoS)
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// Rate limiting on auth routes (100 requests per 15 minutes per IP)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests from this IP, please try again later." },
});

// Health check
app.get("/", (req, res) => {
  res.json({
    message: "MaxSpace API is running",
    version: "1.0.0",
    endpoints: {
      auth: "/api/auth",
      admin: "/api/admin",
      batteries: "/api/batteries",
      services: "/api/services",
      profile: "/api/profile",
      analytics: "/api/analytics",
      batteryTechnician: "/api/battery-technician",
    },
  });
});

// API Routes
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/batteries", batteryRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/data", dataRoutes);
app.use("/api/battery-technician", batteryTechnicianRoutes);

// Backward compatibility: old /api/service-man routes redirect to battery technician
app.use("/api/service-man", batteryTechnicianRoutes);

// 404 + error handling
app.use(notFound);
app.use(errorHandler);

// Start server
app.listen(config.port, () => {
  console.log(`🚀 MaxSpace API running on http://localhost:${config.port}`);
});
