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

/* ============================================================
   DATA / RESET
============================================================ */

export const resetData = () => client("/data/reset", { method: "POST" });
