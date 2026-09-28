import express from "express";
import rateLimit from "express-rate-limit";
import {
  adminLogin,
  adminMe,
  adminLogout,
  getAdminServices,
  getAdminService,
  acceptService,
  assignService,
  updateServiceStatus,
  approveService,
  getServicePersons,
  createServicePerson,
  updateServicePerson,
  createTechnician,
  getTechnicians,
  getTechnician,
  updateTechnician,
  resetTechnicianPassword,
  getCustomers,
  getUsers,
  getAdminBatteries,
  getAdminAnalytics,
} from "../controllers/adminController.js";
import {
  getSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  getAvailableTechnicians,
  syncSchedules,
  refreshScheduleFromService,
  getTechnicianAvailability,
  createTechnicianAvailability,
  updateTechnicianAvailability,
  deleteTechnicianAvailability,
} from "../controllers/adminSchedulingController.js";
import { protect, requireAdmin } from "../middleware/auth.js";
import {
  getComplianceOverview,
  listComplianceProducers,
  getComplianceProducer,
  createComplianceProducer,
  updateComplianceProducer,
  deleteComplianceProducer,
  listBatteryCompliance,
  getBatteryCompliance,
  createBatteryCompliance,
  updateBatteryCompliance,
  listComplianceObligations,
  createComplianceObligation,
  updateComplianceObligation,
  deleteComplianceObligation,
  listComplianceCredits,
  createComplianceCredit,
  updateComplianceCredit,
  deleteComplianceCredit,
  listComplianceDocuments,
  createComplianceDocument,
  updateComplianceDocument,
  deleteComplianceDocument,
  listComplianceEvents,
} from "../controllers/adminComplianceController.js";
import {
  getComplianceOptions,
  getComplianceDashboard,
  getComplianceSettings,
  updateComplianceSettings,
  listComplianceCompanies,
  getComplianceCompany,
  createComplianceCompany,
  updateComplianceCompany,
  deleteComplianceCompany,
  listComplianceCompanyModels,
  listComplianceModels,
  setComplianceModelCompany,
  listComplianceTypes,
  createComplianceType,
  updateComplianceType,
  deleteComplianceType,
  listComplianceRecords,
  getComplianceRecord,
  createComplianceRecord,
  updateComplianceRecord,
  verifyComplianceRecord,
  deleteComplianceRecord,
  listComplianceRecordBatteries,
  listComplianceRecordEvents,
  listComplianceRecordDocuments,
  attachComplianceRecordDocument,
  detachComplianceRecordDocument,
  importComplianceRecords,
  getComplianceImportTemplate,
} from "../controllers/complianceManagementController.js";

const router = express.Router();

// Public routes (login is rate-limited to slow down credential stuffing)
// Only FAILED attempts consume the window, so legit users who log out and
// back in (or log in repeatedly) are never blacklisted by their own activity.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts from this IP, please try again later." },
});

router.post("/login", loginLimiter, adminLogin);

// Protected admin routes
router.get("/me", protect, requireAdmin, adminMe);
router.post("/logout", protect, requireAdmin, adminLogout);

router.get("/services", protect, requireAdmin, getAdminServices);
router.get("/services/:id", protect, requireAdmin, getAdminService);
router.patch("/services/:id/accept", protect, requireAdmin, acceptService);
router.patch("/services/:id/assign", protect, requireAdmin, assignService);
router.patch("/services/:id/status", protect, requireAdmin, updateServiceStatus);
router.patch("/services/:id/approve", protect, requireAdmin, approveService);

router.get("/service-persons", protect, requireAdmin, getServicePersons);
router.post("/service-persons", protect, requireAdmin, createServicePerson);
router.patch("/service-persons/:id", protect, requireAdmin, updateServicePerson);

router.get("/technicians", protect, requireAdmin, getTechnicians);
router.get("/technicians/:id", protect, requireAdmin, getTechnician);
router.post("/technicians", protect, requireAdmin, createTechnician);
router.patch("/technicians/:id", protect, requireAdmin, updateTechnician);
router.patch("/technicians/:id/reset-password", protect, requireAdmin, resetTechnicianPassword);

router.get("/customers", protect, requireAdmin, getCustomers);
router.get("/users", protect, requireAdmin, getUsers);
router.get("/batteries", protect, requireAdmin, getAdminBatteries);
router.get("/analytics", protect, requireAdmin, getAdminAnalytics);

// P2.1 Scheduling + technician availability
router.get("/schedules", protect, requireAdmin, getSchedules);
router.post("/schedules", protect, requireAdmin, createSchedule);
router.patch("/schedules/:id", protect, requireAdmin, updateSchedule);
router.delete("/schedules/:id", protect, requireAdmin, deleteSchedule);
router.get("/schedules/available", protect, requireAdmin, getAvailableTechnicians);
router.post("/schedules/sync", protect, requireAdmin, syncSchedules);
router.post("/schedules/upsert-service", protect, requireAdmin, refreshScheduleFromService);

router.get("/technician-availability", protect, requireAdmin, getTechnicianAvailability);
router.post("/technician-availability", protect, requireAdmin, createTechnicianAvailability);
router.patch("/technician-availability/:id", protect, requireAdmin, updateTechnicianAvailability);
router.delete("/technician-availability/:id", protect, requireAdmin, deleteTechnicianAvailability);

// India compliance module (BWMR 2022) — all admin-guarded
router.get("/compliance/overview", protect, requireAdmin, getComplianceOverview);
router.get("/compliance/events", protect, requireAdmin, listComplianceEvents);

router.get("/compliance/producers", protect, requireAdmin, listComplianceProducers);
router.get("/compliance/producers/:id", protect, requireAdmin, getComplianceProducer);
router.post("/compliance/producers", protect, requireAdmin, createComplianceProducer);
router.patch("/compliance/producers/:id", protect, requireAdmin, updateComplianceProducer);
router.delete("/compliance/producers/:id", protect, requireAdmin, deleteComplianceProducer);

router.get("/compliance/batteries", protect, requireAdmin, listBatteryCompliance);
router.get("/compliance/batteries/:batteryId", protect, requireAdmin, getBatteryCompliance);
router.post("/compliance/batteries/:batteryId", protect, requireAdmin, createBatteryCompliance);
router.patch("/compliance/batteries/:batteryId", protect, requireAdmin, updateBatteryCompliance);

router.get("/compliance/obligations", protect, requireAdmin, listComplianceObligations);
router.post("/compliance/obligations", protect, requireAdmin, createComplianceObligation);
router.patch("/compliance/obligations/:id", protect, requireAdmin, updateComplianceObligation);
router.delete("/compliance/obligations/:id", protect, requireAdmin, deleteComplianceObligation);

router.get("/compliance/credits", protect, requireAdmin, listComplianceCredits);
router.post("/compliance/credits", protect, requireAdmin, createComplianceCredit);
router.patch("/compliance/credits/:id", protect, requireAdmin, updateComplianceCredit);
router.delete("/compliance/credits/:id", protect, requireAdmin, deleteComplianceCredit);

router.get("/compliance/documents", protect, requireAdmin, listComplianceDocuments);
router.post("/compliance/documents", protect, requireAdmin, createComplianceDocument);
router.patch("/compliance/documents/:id", protect, requireAdmin, updateComplianceDocument);
router.delete("/compliance/documents/:id", protect, requireAdmin, deleteComplianceDocument);

/* ============================================================
   Hierarchical compliance management (company → model → battery).
   Distinct from the India BWMR routes above: this module carries
   certificates, expiry tracking, verification and the customer
   passport. The service re-checks the admin role and the company
   scope, so these guards are defence in depth, not the only check.
   ============================================================ */

// Vocabulary for the UI (statuses, authorities, document types, …)
router.get("/compliance/options", protect, requireAdmin, getComplianceOptions);
router.get("/compliance/dashboard", protect, requireAdmin, getComplianceDashboard);
router.get("/compliance/settings", protect, requireAdmin, getComplianceSettings);
router.patch("/compliance/settings", protect, requireAdmin, updateComplianceSettings);

router.get("/compliance/companies", protect, requireAdmin, listComplianceCompanies);
router.get("/compliance/companies/:id", protect, requireAdmin, getComplianceCompany);
router.post("/compliance/companies", protect, requireAdmin, createComplianceCompany);
router.patch("/compliance/companies/:id", protect, requireAdmin, updateComplianceCompany);
router.delete("/compliance/companies/:id", protect, requireAdmin, deleteComplianceCompany);
router.get("/compliance/companies/:id/models", protect, requireAdmin, listComplianceCompanyModels);

router.get("/compliance/models", protect, requireAdmin, listComplianceModels);
router.patch("/compliance/models/:modelId/company", protect, requireAdmin, setComplianceModelCompany);

router.get("/compliance/types", protect, requireAdmin, listComplianceTypes);
router.post("/compliance/types", protect, requireAdmin, createComplianceType);
router.patch("/compliance/types/:id", protect, requireAdmin, updateComplianceType);
router.delete("/compliance/types/:id", protect, requireAdmin, deleteComplianceType);

// Static segments are declared before the ":id" routes so they are not
// swallowed by the parameterised ones.
router.get("/compliance/record-documents", protect, requireAdmin, listComplianceRecordDocuments);
router.post("/compliance/record-documents", protect, requireAdmin, attachComplianceRecordDocument);
router.delete("/compliance/record-documents/:id", protect, requireAdmin, detachComplianceRecordDocument);

// The legacy module already owns GET /compliance/events, so the
// hierarchical audit log lives under its own name.
router.get("/compliance/record-events", protect, requireAdmin, listComplianceEvents);

router.get("/compliance/import/template", protect, requireAdmin, getComplianceImportTemplate);
router.post(
  "/compliance/import",
  protect,
  requireAdmin,
  // The file arrives as the raw request body (text/csv or xlsx bytes) or
  // as { csv } in JSON, so no multipart parser is required.
  express.raw({ type: ["text/csv", "text/plain", "application/csv", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"], limit: "5mb" }),
  importComplianceRecords
);

router.get("/compliance/records", protect, requireAdmin, listComplianceRecords);
router.post("/compliance/records", protect, requireAdmin, createComplianceRecord);
router.get("/compliance/records/:id", protect, requireAdmin, getComplianceRecord);
router.patch("/compliance/records/:id", protect, requireAdmin, updateComplianceRecord);
router.post("/compliance/records/:id/verify", protect, requireAdmin, verifyComplianceRecord);
router.delete("/compliance/records/:id", protect, requireAdmin, deleteComplianceRecord);
router.get("/compliance/records/:id/batteries", protect, requireAdmin, listComplianceRecordBatteries);
router.get("/compliance/records/:id/events", protect, requireAdmin, listComplianceRecordEvents);

export default router;