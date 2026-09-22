/* ============================================================
   SERVICES BARREL
   Single entry point for the centralized API/service layer.
   Import anything from "./services" instead of individual files:

       import { fetchBatteries, adminSignIn } from "./services";

   Token helpers and the shared client live in client.js; the
   customer, admin, and battery-technician APIs add typed wrappers
   on top. This is the layer the frontend uses to talk to the
   MaxSpace backend — swap BASE_URL in client.js to repoint the
   whole app at another deployment.
============================================================ */

/* Shared client + token/session helpers */
export {
  default as client,
  USER_TOKEN_KEY,
  ADMIN_TOKEN_KEY,
  BATTERY_TECHNICIAN_TOKEN_KEY,
  getToken,
  setToken,
  getAdminToken,
  setAdminToken,
  getBatteryTechnicianToken,
  setBatteryTechnicianToken,
  getErrorMessage,
} from "./client";

/* Customer (user) API */
export {
  signIn,
  signUp,
  googleSignIn,
  logout,
  forgotPassword,
  resetPassword,
  fetchBatteries,
  createBattery,
  updateBattery,
  deleteBattery,
  lookupBattery,
  fetchBatteryPassport,
  fetchServices,
  createService,
  updateService,
  fetchProfile,
  updateProfile,
  updateNotifications,
  changePassword,
} from "./api";

/* Admin API */
export {
  adminSignIn,
  fetchAdminMe,
  adminLogout,
  fetchAdminServices,
  fetchAdminService,
  acceptAdminService,
  assignAdminService,
  updateAdminServiceStatus,
  approveAdminService,
  fetchAdminServicePersons,
  createAdminServicePerson,
  updateAdminServicePerson,
  createAdminTechnician,
  fetchAdminTechnicians,
  fetchAdminTechnician,
  updateAdminTechnician,
  resetAdminTechnicianPassword,
  fetchAdminCustomers,
  fetchAdminAnalytics,
} from "./adminApi";

/* Battery Technician API */
export {
  getBatteryTechnicianProfile,
  setBatteryTechnicianProfile,
  batteryTechnicianSignIn,
  fetchBatteryTechnicianMe,
  batteryTechnicianLogoutApi,
  fetchAssignedServices,
  fetchAssignedServiceDetail,
  updateBatteryTechnicianStatus,
} from "./batteryTechnicianApi";