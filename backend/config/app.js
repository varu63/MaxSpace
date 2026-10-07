import dotenv from "dotenv";

dotenv.config();

const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 5000,
  jwtSecret: (() => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET environment variable is required");
    }
    return secret;
  })(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  clientUrl: process.env.FRONTEND_URL || process.env.CLIENT_URL || "http://localhost:5173",
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    // Redirect URI used only by the OAuth 2.0 authorization-code flow.
    // The current Google Sign-In uses ID-token verification, so this is
    // optional and reserved for future server-side code exchanges.
    callbackUrl: process.env.GOOGLE_CALLBACK_URL || "",
  },
  db: {
    // PostgreSQL is the only data source. There is no in-memory fallback
    // and no seed path: if DATABASE_URL is missing or the database is
    // unreachable the process refuses to start. DATA_SOURCE and
    // LEGACY_SCHEMA are no longer read — the v2 schema is authoritative
    // and lives entirely in `public`.
    databaseUrl: process.env.DATABASE_URL || null,
  },
  /* Free OpenStreetMap geocoding (Nominatim). No API key is required
     and none is ever configured: the backend proxies every request so
     the upstream is never called from the browser, and NOMINATIM_BASE_URL
     lets a self-hosted instance replace the public one. */
  geo: {
    baseUrl: (process.env.NOMINATIM_BASE_URL || "https://nominatim.openstreetmap.org").replace(/\/+$/, ""),
    // Nominatim's usage policy requires a descriptive User-Agent with a
    // contact URL/e-mail; override in .env for real deployments.
    userAgent: (process.env.NOMINATIM_USER_AGENT || "MaxSpace/1.0 (booking location search)").trim(),
    timeoutMs: Number(process.env.NOMINATIM_TIMEOUT_MS) || 6000,
  },
  iot: {
    // Optional shared secret for future IoT/BMS device ingest. When set, a
    // device may push telemetry by sending `X-IoT-Device-Key: <secret>` on
    // POST /api/batteries/:id/telemetry. When unset (default), ingest is
    // ADMIN-JWT-only, so the current API surface is unchanged and no device
    // can submit readings until a real integration is configured.
    deviceKey: (process.env.IOT_DEVICE_KEY || "").trim(),
  },
  /* Transactional e-mail (account verification + password reset) is sent
     through Resend. The API key lives ONLY here, on the backend: it is
     never read by the frontend and never prefixed with VITE_. */
  email: {
    resendApiKey: (process.env.RESEND_API_KEY || "").trim(),
    fromEmail: (process.env.RESEND_FROM_EMAIL || "").trim(),
    fromName: (process.env.RESEND_FROM_NAME || "MaxSpace").trim(),
    // Public base URL of THIS backend, used to build the verification link
    // that must be served by the API (it validates the token server-side).
    appBaseUrl: (process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 5000}`).trim(),
  },
};

export default config;