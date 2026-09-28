/* ============================================================
   FLEET MAP API SERVICE LAYER · MaxSpace
   HTTP calls for the Global Battery & Compliance Map. The same
   /api/map/batteries endpoint is role-scoped by the backend: the
   caller's JWT decides which batteries are returned (ADMIN = whole
   fleet, USER = owned batteries, EMPLOYEE = assigned-service
   batteries). All wrappers pass the correct token to the shared
   client (user / admin).

   The battery-technician panel has NO standalone map (service
   location lives inside the assigned service details), so there are
   no technician map wrappers here.

   The /api/map/locations endpoints are ADMIN-only and manage the
   REAL recorded location of a battery plus its movement history.
   ============================================================ */
import client from "./client";

const qsOf = (params = {}) => {
  const qs = new URLSearchParams();
  const list = [
    "search",
    "healthStatus",
    "batteryStatus",
    "complianceStatus",
    "serviceStatus",
    "bbox",
    "page",
    "limit",
    "sort",
    "order",
  ];
  for (const key of list) {
    const value = params[key];
    if (value !== undefined && value !== null && value !== "") qs.set(key, value);
  }
  return qs.toString();
};

/* ---------- Map markers (role-scoped) ---------- */

export const fetchUserMapBatteries = (params = {}) => {
  const q = qsOf(params);
  return client(`/map/batteries${q ? `?${q}` : ""}`);
};

export const fetchAdminMapBatteries = (params = {}) => {
  const q = qsOf(params);
  return client(`/map/batteries${q ? `?${q}` : ""}`, { admin: true });
};

/* ---------- Shared service centers (role-scoped token, same endpoint) ---------- */

export const fetchUserServiceCenters = () =>
  client("/services/service-centers");

export const fetchAdminServiceCenters = () =>
  client("/services/service-centers", { admin: true });

/* ---------- Organisation / facility network markers (role-scoped token) ---------- */

const orgQueryOf = (params = {}) => {
  const qs = new URLSearchParams();
  if (params.type) qs.set("type", params.type);
  const q = qs.toString();
  return q ? `?${q}` : "";
};

export const fetchUserOrganizations = (params = {}) =>
  client(`/map/organizations${orgQueryOf(params)}`);

export const fetchAdminOrganizations = (params = {}) =>
  client(`/map/organizations${orgQueryOf(params)}`, { admin: true });

/* ---------- Admin location registry ---------- */

export const fetchMapLocations = (params = {}) => {
  const q = qsOf(params);
  return client(`/map/locations${q ? `?${q}` : ""}`, { admin: true });
};

export const fetchMapLocation = (batteryId) =>
  client(`/map/locations/${encodeURIComponent(batteryId)}`, { admin: true });

export const saveMapLocation = (batteryId, payload) =>
  client(`/map/locations/${encodeURIComponent(batteryId)}`, {
    method: "PUT",
    body: payload,
    admin: true,
  });

export const deleteMapLocation = (batteryId) =>
  client(`/map/locations/${encodeURIComponent(batteryId)}`, {
    method: "DELETE",
    admin: true,
  });

export const fetchMapLocationHistory = (batteryId) =>
  client(`/map/locations/${encodeURIComponent(batteryId)}/history`, { admin: true });