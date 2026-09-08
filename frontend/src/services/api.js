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

export const logout = () => client("/auth/logout", { method: "POST" });

export const forgotPassword = (email) =>
  client("/auth/forgot-password", { method: "POST", auth: false, body: { email } });

/* ============================================================
   BATTERIES
============================================================ */

export const fetchBatteries = () => client("/batteries");

export const createBattery = (battery) =>
  client("/batteries", { method: "POST", body: battery });

export const updateBattery = (id, fields) =>
  client(`/batteries/${id}`, { method: "PUT", body: fields });

export const deleteBattery = (id) =>
  client(`/batteries/${id}`, { method: "DELETE" });

export const lookupBattery = (code) =>
  client(`/batteries/lookup?barcode=${encodeURIComponent(code)}`);

/* ============================================================
   SERVICES
============================================================ */

export const fetchServices = () => client("/services");

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
