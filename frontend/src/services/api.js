/* ============================================================
   USER API SERVICE LAYER
   HTTP calls for the customer app using the user JWT.
============================================================ */
import client, { getToken, setToken, getErrorMessage } from "./client";

export { getToken, setToken, getErrorMessage };

/* ============================================================
   AUTH
============================================================ */

export const signIn = (credentials) =>
  client("/auth/signin", { method: "POST", auth: false, body: credentials });

export const signUp = (credentials) =>
  client("/auth/signup", { method: "POST", auth: false, body: credentials });

export const googleSignIn = (credential) =>
  client("/auth/google", { method: "POST", auth: false, body: { credential } });

export const logout = () => client("/auth/logout", { method: "POST" });

export const forgotPassword = (email) =>
  client("/auth/forgot-password", { method: "POST", auth: false, body: { email } });

export const resetPassword = (token, password, confirmPassword) =>
  client("/auth/reset-password", { method: "POST", auth: false, body: { token, password, confirmPassword } });

/* E-mail verification. The link in the e-mail is a GET on the backend
   that redirects here with ?status=…, so the page only ever needs to
   re-request a link — never to validate a token itself. */
export const resendVerificationEmail = (email) =>
  client("/auth/resend-verification", { method: "POST", auth: false, body: { email } });

/* ============================================================
   BATTERIES
============================================================ */

export const fetchBatteries = () => client("/batteries");

/* Paginated batteries: returns { data, pagination } from the standard envelope. */
export const fetchBatteriesPaginated = (params = {}) => {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", params.page);
  if (params.limit) qs.set("limit", params.limit);
  if (params.search) qs.set("search", params.search);
  if (params.sort) qs.set("sort", params.sort);
  if (params.order) qs.set("order", params.order);
  const query = qs.toString();
  return client(`/batteries${query ? `?${query}` : ""}`);
};

export const createBattery = (battery) =>
  client("/batteries", { method: "POST", body: battery });

export const updateBattery = (id, fields) =>
  client(`/batteries/${id}`, { method: "PUT", body: fields });

export const deleteBattery = (id) =>
  client(`/batteries/${id}`, { method: "DELETE" });

export const lookupBattery = (code) =>
  client(`/batteries/lookup?code=${encodeURIComponent(code)}`);

export const claimBattery = (identifier) =>
  client(`/batteries/${encodeURIComponent(identifier)}/claim`, { method: "POST" });

export const fetchBatteryPassport = (identifier) =>
  client(`/batteries/${encodeURIComponent(identifier)}/passport`);

/* Telemetry / IoT-BMS readings. Returns { success, data, available } for
   latest and { success, data, count, limit } for history. When no device
   is connected, data is null and available is false — callers must render
   the "telemetry unavailable" state rather than showing a live value. */
export const fetchBatteryTelemetryLatest = (identifier) =>
  client(`/batteries/${encodeURIComponent(identifier)}/telemetry/latest`);

export const fetchBatteryTelemetryHistory = (identifier, params = {}) => {
  const qs = new URLSearchParams();
  if (params.limit) qs.set("limit", params.limit);
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  const query = qs.toString();
  return client(`/batteries/${encodeURIComponent(identifier)}/telemetry/history${query ? `?${query}` : ""}`);
};

/* India compliance read view (BWMR 2022) surfaced on the passport.
   Returns { success, data, available } — when no compliance record has
   been entered, data is null and available is false. Callers must render
   the honest "not yet tracked" state rather than inventing data. */
export const fetchBatteryCompliance = (identifier) =>
  client(`/batteries/${encodeURIComponent(identifier)}/compliance`);

/* ============================================================
   OWNERSHIP TRANSFER (one-time QR)
   The token is a bearer secret: it exists only in the QR the current
   owner shows, is never listed, and is spent by the first acceptance.
   ============================================================ */

export const createOwnershipTransfer = (batteryId) =>
  client(`/batteries/${encodeURIComponent(batteryId)}/transfers`, { method: "POST" });

export const fetchOwnershipTransfer = (token) =>
  client(`/batteries/transfers/${encodeURIComponent(token)}`);

export const acceptOwnershipTransfer = (token) =>
  client(`/batteries/transfers/${encodeURIComponent(token)}/accept`, { method: "POST" });

export const cancelOwnershipTransfer = (token) =>
  client(`/batteries/transfers/${encodeURIComponent(token)}/cancel`, { method: "POST" });

/* ============================================================
   SERVICES
============================================================ */

export const fetchServices = () => client("/services");

/* Paginated services: returns { data, pagination } from the standard envelope. */
export const fetchServicesPaginated = (params = {}) => {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", params.page);
  if (params.limit) qs.set("limit", params.limit);
  if (params.status) qs.set("status", params.status);
  if (params.search) qs.set("search", params.search);
  const query = qs.toString();
  return client(`/services${query ? `?${query}` : ""}`);
};

export const createService = (service) =>
  client("/services", { method: "POST", body: service });

export const updateService = (id, fields) =>
  client(`/services/${id}`, { method: "PATCH", body: fields });

export const fetchServiceCenters = () =>
  client("/services/service-centers");

/* ============================================================
   PROFILE
============================================================ */

export const fetchProfile = () => client("/profile");

export const updateProfile = (fields) =>
  client("/profile", { method: "PUT", body: fields });

export const updateNotifications = (settings) =>
  client("/profile/notifications", { method: "PUT", body: settings });

export const changePassword = (payload) =>
  client("/profile/password", { method: "POST", body: payload });
