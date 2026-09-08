import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import config from "./config/app.js";
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import batteryRoutes from "./routes/batteryRoutes.js";
import serviceRoutes from "./routes/serviceRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import dataRoutes from "./routes/dataRoutes.js";
import { notFound, errorHandler } from "./middleware/errorMiddleware.js";

dotenv.config();

const app = express();

// Middleware
app.use(
  cors({
    origin: config.clientUrl,
    credentials: true,
  })
);
app.use(express.json());

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
    },
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/batteries", batteryRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/data", dataRoutes);

// 404 + error handling
app.use(notFound);
app.use(errorHandler);

// Start server
app.listen(config.port, () => {
  console.log(`🚀 MaxSpace API running on http://localhost:${config.port}`);
});
