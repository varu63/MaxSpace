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
    // Data source mode:
    //   "mock"     — in-memory seeded store (default, no database required)
    //   "postgres" — PostgreSQL repository (requires DATABASE_URL)
    dataSource: process.env.DATA_SOURCE || "mock",
    databaseUrl: process.env.DATABASE_URL || null,
    // Legacy production tables live in `public` on maxvolt_prod; set
    // LEGACY_SCHEMA (e.g. maxspace_pro) when pointing at the old mirror.
    legacySchema: (process.env.LEGACY_SCHEMA || "").trim(),
    // POST /api/data/reset truncates tables. Production databases must
    // keep this off; enable only on a disposable dev database.
    allowReset: process.env.ALLOW_DB_RESET === "true",
  },
  iot: {
    // Optional shared secret for future IoT/BMS device ingest. When set, a
    // device may push telemetry by sending `X-IoT-Device-Key: <secret>` on
    // POST /api/batteries/:id/telemetry. When unset (default), ingest is
    // ADMIN-JWT-only, so the current API surface is unchanged and no device
    // can submit readings until a real integration is configured.
    deviceKey: (process.env.IOT_DEVICE_KEY || "").trim(),
  },
};

export default config;