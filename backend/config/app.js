import dotenv from "dotenv";

dotenv.config();

const config = {
  port: Number(process.env.PORT) || 5000,
  jwtSecret:
    process.env.JWT_SECRET ||
    (() => {
      if (process.env.NODE_ENV === "production") {
        throw new Error("JWT_SECRET environment variable is required in production");
      }
      return "maxspace_super_secret_key";
    })(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
};

export default config;
