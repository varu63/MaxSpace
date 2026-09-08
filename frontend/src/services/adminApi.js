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

/* ============================================================
   SERVICE PERSONS
============================================================ */

export const fetchAdminServicePersons = () => client("/admin/service-persons", { admin: true });

export const createAdminServicePerson = (person) =>
  client("/admin/service-persons", { method: "POST", body: person, admin: true });

export const updateAdminServicePerson = (id, fields) =>
  client(`/admin/service-persons/${id}`, { method: "PATCH", body: fields, admin: true });

/* ============================================================
   CUSTOMERS / ANALYTICS
============================================================ */

export const fetchAdminCustomers = () => client("/admin/customers", { admin: true });

export const fetchAdminAnalytics = () => client("/admin/analytics", { admin: true });
