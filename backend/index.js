import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

import config from "./config/app.js";
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import batteryRoutes from "./routes/batteryRoutes.js";
import partnerRoutes from "./routes/partnerRoutes.js";
import serviceRoutes from "./routes/serviceRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import batteryTechnicianRoutes from "./routes/batteryTechnicianRoutes.js";
import mapRoutes from "./routes/mapRoutes.js";
import geoRoutes from "./routes/geoRoutes.js";
import { notFound, errorHandler } from "./middleware/errorMiddleware.js";
import { isDatabaseConnected } from "./data/index.js";

const app = express();

// Security headers. CSP is disabled because this service can also serve the
// built SPA, which loads Google Identity Services and OpenStreetMap tiles.
// COOP allows popups so Google Sign-In's popup/One Tap flow can postMessage
// back to the opener window.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  })
);

// CORS — restrict to the configured frontend origin(s) so the API is not
// callable cross-site with credentials. FRONTEND_URL/CLIENT_URL may hold a
// comma-separated list (e.g. localhost + LAN IP for mobile testing).
const allowedOrigins = String(config.clientUrl || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Non-browser callers (curl, tests) send no Origin header — allow them.
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      callback(null, false);
    },
    credentials: true,
  })
);

// Request body parsing with size limit (prevents large payload DoS)
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// Rate limiting on auth routes (100 failed requests per 15 minutes per IP).
// Successful requests (sign-in, sign-up, forgot-password, logout) are skipped
// so legitimate users are never blacklisted by their own normal activity.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests from this IP, please try again later." },
});

// Health check
app.get("/", async (req, res, next) => {
  try {
    const databaseConnected = await isDatabaseConnected();
    res.json({
      message: "MaxSpace API is running",
      version: "1.0.0",
      dataSource: "postgres",
      databaseConfigured: Boolean(config.db.databaseUrl),
      databaseConnected,
      endpoints: {
        auth: "/api/auth",
        admin: "/api/admin",
        batteries: "/api/batteries",
        services: "/api/services",
        profile: "/api/profile",
        analytics: "/api/analytics",
        batteryTechnician: "/api/battery-technician",
        map: "/api/map",
        geo: "/api/geo",
      },
    });
  } catch (error) {
    next(error);
  }
});

// API Routes
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/batteries", batteryRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/battery-technician", batteryTechnicianRoutes);

// External EPR partners (collection centres, recyclers, refurbishers,
// auditors). Mounted as its own surface rather than as extra battery
// routes, because a partner's authorised view is gated on a per-battery
// EOL assignment and is deliberately narrower than a customer's passport.
app.use("/api/partner", partnerRoutes);

// Backward compatibility: old /api/service-man routes redirect to battery technician
app.use("/api/service-man", batteryTechnicianRoutes);

// Global Battery & Compliance Map (role-scoped markers + admin location registry)
app.use("/api/map", mapRoutes);

// Free OpenStreetMap/Nominatim geocoding proxy (rate-limited, keyless)
app.use("/api/geo", geoRoutes);

// Serve the built frontend (single-service deploy). The Vite build lives in
// frontend/dist; when it is absent (API-only dev) this block is skipped.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.resolve(__dirname, "../frontend/dist");

if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));

  // SPA fallback: any non-API GET returns index.html so client-side routes
  // (React Router) resolve on a hard refresh. /api is left untouched.
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) return next();
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

// 404 + error handling
app.use(notFound);
app.use(errorHandler);

// Start server
app.listen(config.port, "0.0.0.0", () => {
  console.log(`🚀 MaxSpace API running on http://localhost:${config.port} (data source: PostgreSQL)`);
});
