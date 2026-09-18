/* ============================================================
    BATTERY TECHNICIAN API SERVICE LAYER
    HTTP calls for the Battery Technician panel using the employee JWT.
============================================================ */
import client, {
  BATTERY_TECHNICIAN_TOKEN_KEY,
  getBatteryTechnicianToken,
  setBatteryTechnicianToken,
  getErrorMessage,
} from "./client";

export {
  BATTERY_TECHNICIAN_TOKEN_KEY,
  getBatteryTechnicianToken,
  setBatteryTechnicianToken,
  getErrorMessage,
};

const BATTERY_TECHNICIAN_PROFILE_KEY = "maxspace_battery_technician_profile";

export const getBatteryTechnicianProfile = () => {
  try {
    const saved = localStorage.getItem(BATTERY_TECHNICIAN_PROFILE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

export const setBatteryTechnicianProfile = (profile) => {
  try {
    if (profile) localStorage.setItem(BATTERY_TECHNICIAN_PROFILE_KEY, JSON.stringify(profile));
    else localStorage.removeItem(BATTERY_TECHNICIAN_PROFILE_KEY);
  } catch {
    // Ignore storage errors
  }
};

/* ============================================================
    AUTH
============================================================ */

export const batteryTechnicianSignIn = (credentials) =>
  client("/battery-technician/login", { method: "POST", auth: false, body: credentials });

export const fetchBatteryTechnicianMe = () =>
  client("/battery-technician/me", { batteryTechnician: true });

export const batteryTechnicianLogoutApi = () =>
  client("/battery-technician/logout", { method: "POST", batteryTechnician: true });

/* ============================================================
    SERVICES
============================================================ */

export const fetchAssignedServices = () =>
  client("/battery-technician/services", { batteryTechnician: true });

/* Paginated assigned services: returns { data, pagination } from the standard envelope. */
export const fetchAssignedServicesPaginated = (params = {}) => {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", params.page);
  if (params.limit) qs.set("limit", params.limit);
  if (params.status) qs.set("status", params.status);
  if (params.search) qs.set("search", params.search);
  const query = qs.toString();
  return client(`/battery-technician/services${query ? `?${query}` : ""}`, {
    batteryTechnician: true,
  });
};

export const fetchAssignedServiceDetail = (id) =>
  client(`/battery-technician/services/${id}`, { batteryTechnician: true });

export const updateBatteryTechnicianStatus = (id, status) =>
  client(`/battery-technician/services/${id}/status`, {
    method: "PATCH",
    body: { status },
    batteryTechnician: true,
  });
