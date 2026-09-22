/* ============================================================
   ADMIN API SERVICE LAYER
   HTTP calls for the Admin Panel using the admin JWT.
============================================================ */
import client, { getAdminToken, setAdminToken, getErrorMessage } from "./client";

export { getAdminToken, setAdminToken, getErrorMessage };

/* ============================================================
   AUTH
============================================================ */

export const adminSignIn = (credentials) =>
  client("/admin/login", { method: "POST", auth: false, body: credentials });

export const fetchAdminMe = () => client("/admin/me", { admin: true });

export const adminLogout = () => client("/admin/logout", { method: "POST", admin: true });

/* ============================================================
   SERVICES
============================================================ */

export const fetchAdminServices = () => client("/admin/services", { admin: true });

/* Paginated admin services: returns { data, pagination } from the standard envelope. */
export const fetchAdminServicesPaginated = (params = {}) => {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", params.page);
  if (params.limit) qs.set("limit", params.limit);
  if (params.status) qs.set("status", params.status);
  if (params.search) qs.set("search", params.search);
  if (params.sort) qs.set("sort", params.sort);
  if (params.order) qs.set("order", params.order);
  const query = qs.toString();
  return client(`/admin/services${query ? `?${query}` : ""}`, { admin: true });
};

export const fetchAdminService = (id) => client(`/admin/services/${id}`, { admin: true });

export const acceptAdminService = (id) =>
  client(`/admin/services/${id}/accept`, { method: "PATCH", admin: true });

export const assignAdminService = (id, servicePersonId) =>
  client(`/admin/services/${id}/assign`, {
    method: "PATCH",
    body: { servicePersonId },
    admin: true,
  });

export const updateAdminServiceStatus = (id, status) =>
  client(`/admin/services/${id}/status`, {
    method: "PATCH",
    body: { status },
    admin: true,
  });

export const approveAdminService = (id) =>
  client(`/admin/services/${id}/approve`, { method: "PATCH", admin: true });

/* ============================================================
   SERVICE PERSONS
============================================================ */

export const fetchAdminServicePersons = () => client("/admin/service-persons", { admin: true });

/* Paginated service persons: returns { data, pagination } from the standard envelope. */
export const fetchAdminServicePersonsPaginated = (params = {}) => {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", params.page);
  if (params.limit) qs.set("limit", params.limit);
  if (params.status) qs.set("status", params.status);
  if (params.search) qs.set("search", params.search);
  if (params.sort) qs.set("sort", params.sort);
  if (params.order) qs.set("order", params.order);
  const query = qs.toString();
  return client(`/admin/service-persons${query ? `?${query}` : ""}`, { admin: true });
};

export const createAdminServicePerson = (person) =>
  client("/admin/service-persons", { method: "POST", body: person, admin: true });

export const updateAdminServicePerson = (id, fields) =>
  client(`/admin/service-persons/${id}`, { method: "PATCH", body: fields, admin: true });

/* ============================================================
   TECHNICIANS (Employee + Service Person)
============================================================ */

export const createAdminTechnician = (data) =>
  client("/admin/technicians", { method: "POST", body: data, admin: true });

export const fetchAdminTechnicians = () =>
  client("/admin/technicians", { admin: true });

export const fetchAdminTechnician = (id) =>
  client(`/admin/technicians/${id}`, { admin: true });

export const updateAdminTechnician = (id, fields) =>
  client(`/admin/technicians/${id}`, { method: "PATCH", body: fields, admin: true });

export const resetAdminTechnicianPassword = (id, data) =>
  client(`/admin/technicians/${id}/reset-password`, {
    method: "PATCH",
    body: data,
    admin: true,
  });

/* ============================================================
   CUSTOMERS / ANALYTICS
============================================================ */

export const fetchAdminCustomers = () => client("/admin/customers", { admin: true });

/* Paginated customers: returns { data, pagination } from the standard envelope. */
export const fetchAdminCustomersPaginated = (params = {}) => {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", params.page);
  if (params.limit) qs.set("limit", params.limit);
  if (params.search) qs.set("search", params.search);
  if (params.sort) qs.set("sort", params.sort);
  if (params.order) qs.set("order", params.order);
  const query = qs.toString();
  return client(`/admin/customers${query ? `?${query}` : ""}`, { admin: true });
};

/* ============================================================
   ALL ACCOUNTS / BATTERIES (read-only registries)
============================================================ */

/* Every account (ADMIN / USER / EMPLOYEE): { data, pagination } envelope. */
export const fetchUsersPaginated = (params = {}) => {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", params.page);
  if (params.limit) qs.set("limit", params.limit);
  if (params.search) qs.set("search", params.search);
  if (params.sort) qs.set("sort", params.sort);
  if (params.order) qs.set("order", params.order);
  const query = qs.toString();
  return client(`/admin/users${query ? `?${query}` : ""}`, { admin: true });
};

/* Full fleet registry (every battery field + owner): { data, pagination }. */
export const fetchAdminBatteriesPaginated = (params = {}) => {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", params.page);
  if (params.limit) qs.set("limit", params.limit);
  if (params.search) qs.set("search", params.search);
  if (params.sort) qs.set("sort", params.sort);
  if (params.order) qs.set("order", params.order);
  const query = qs.toString();
  return client(`/admin/batteries${query ? `?${query}` : ""}`, { admin: true });
};

export const fetchAdminTechniciansPaginated = (params = {}) => {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", params.page);
  if (params.limit) qs.set("limit", params.limit);
  if (params.status) qs.set("status", params.status);
  if (params.search) qs.set("search", params.search);
  if (params.sort) qs.set("sort", params.sort);
  if (params.order) qs.set("order", params.order);
  const query = qs.toString();
  return client(`/admin/technicians${query ? `?${query}` : ""}`, { admin: true });
};

export const fetchAdminAnalytics = () => client("/admin/analytics", { admin: true });
