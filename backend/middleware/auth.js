import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import config from "../config/app.js";
import store from "../data/index.js";

/* Attach the re-fetched user to the request. For EMPLOYEE accounts the
   linked battery-technician record must still be active — deactivated
   technicians are locked out immediately, even with a valid token. */
const attachUser = async (req, user) => {
  if (user.role === "EMPLOYEE") {
    const servicePerson = user.servicePersonId
      ? await store.getServicePersonById(user.servicePersonId)
      : null;
    if (!servicePerson || String(servicePerson.status || "").toLowerCase() !== "active") {
      return false;
    }
  }
  // companyId scopes the account for company-restricted modules
  // (compliance). null/undefined = MaxSpace platform operator, which
  // may act for any company. Taken from the stored user, never from the
  // token body, so a forged claim cannot widen an account's scope.
  // partnerId does the same for external EPR partners: it is the
  // `compliance_producers` row the account may act for, and a PARTNER
  // account without one is refused rather than defaulted to fleet-wide
  // access (see utils/partnerAccess.js).
  req.user = {
    id: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    companyId: user.companyId ?? null,
    partnerId: user.partnerId ?? null,
  };
  return true;
};

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
    const active = await attachUser(req, user);
    if (!active) {
      return res.status(401).json({ success: false, status: 401, message: "Not authorized, account is inactive" });
    }
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
      await attachUser(req, user);
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

/* Fleet operators: ADMIN and EMPLOYEE together.
   Used by the passport lifecycle writes, which an admin performs and a
   technician performs on their assigned work — but which a customer and
   an external partner must never perform. `requireEmployee` stays for
   the technician-only surfaces that already use it. */
export const requireOperator = (req, res, next) => {
  if (!req.user || (req.user.role !== "ADMIN" && req.user.role !== "EMPLOYEE")) {
    return res.status(403).json({ success: false, status: 403, message: "Access denied. Admin or employee privileges required." });
  }
  next();
};

/* External EPR partners (collection centres, recyclers, refurbishers,
   auditors) only. The linked producer itself is verified by
   `assertPartnerAccount` in the service layer, because "is this account
   linked to a registration" is a business rule and not something a role
   string can answer. */
export const requirePartner = (req, res, next) => {
  if (!req.user || req.user.role !== "PARTNER") {
    return res.status(403).json({ success: false, status: 403, message: "Access denied. Partner privileges required." });
  }
  next();
};

/* Authentication for IoT/BMS device ingest (POST telemetry).
   Two accepted identities, in order:
     1. An ADMIN JWT (human/manual/testing ingest).
     2. A shared device key in the `X-IoT-Device-Key` header, matching the
        configured IOT_DEVICE_KEY. When IOT_DEVICE_KEY is unset this path
        is disabled entirely, so the marketing app's API surface is unchanged
        and no device can push data until a real integration is configured.
   The device key comparison is constant-time to avoid timing side-channels. */
export const iotDeviceOrAdmin = async (req, res, next) => {
  const deviceKey = config.iot?.deviceKey || "";

  // Device-push path (preferred once a gateway exists).
  if (deviceKey) {
    const presented = req.headers["x-iot-device-key"];
    if (typeof presented === "string" && presented.length > 0) {
      const expected = Buffer.from(deviceKey);
      const actual = Buffer.from(presented);
      const safeCompare =
        expected.length === actual.length &&
        crypto.timingSafeEqual(expected, actual);
      if (safeCompare) {
        req.device = { kind: "iot-gateway" };
        return next();
      }
    }
  }

  // Human path: an authenticated ADMIN may also ingest (e.g. manual import).
  if (req.user && req.user.role === "ADMIN") {
    return next();
  }

  return res.status(403).json({
    success: false,
    status: 403,
    message: "Access denied. Provide a valid device key (X-IoT-Device-Key) or authenticate as an admin.",
  });
};
