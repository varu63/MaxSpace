/* ============================================================
   IN-MEMORY DATA STORE
   Holds fleet data in memory (seeded from data/seedData.js).
   Swap with a real DB (Mongo/Postgres) by replacing these
   functions with model queries.
============================================================ */
import {
  seedBatteries,
  seedServices,
  seedUserProfile,
  seedAdminUsers,
  seedRegularUsers,
  seedServicePersons,
  seedEmployeeUsers,
} from "./seedData.js";
import {
  assertServiceIntegrity,
} from "../utils/serviceValidation.js";
import { paginateArray, compareSorted } from "../utils/pagination.js";
import { todayISO } from "../utils/date.js";

class Store {
  constructor() {
    this.batteries = [...seedBatteries];
    this.services = [...seedServices];
    this.profiles = { "user-1": { ...seedUserProfile } };
    this.users = [...seedAdminUsers, ...seedRegularUsers, ...seedEmployeeUsers];
    this.servicePersons = [...seedServicePersons];
    this.notifications = [];
    this.batteryAlerts = [];
    this.serviceEvidence = [];
    this.serviceCheckins = [];
    this.serviceSchedules = [];
    this.technicianAvailability = [];
    this.maintenanceSchedules = [];
    this.organizations = [];
    this.organizationMembers = [];
    this.workspaces = [];
    this.workspaceMembers = [];
    this.invitations = [];
    this.refreshTokens = [];
    this.appSettings = {};
  }

  /* ---------- Users (multi-user with roles) ---------- */
  getAllUsers() {
    return this.users;
  }

  getUserById(id) {
    return this.users.find((u) => u.id === id) || null;
  }

  getUserByEmail(email) {
    return (
      this.users.find(
        (u) => u.email.toLowerCase() === String(email || "").toLowerCase()
      ) || null
    );
  }

  getUserByGoogleId(googleId) {
    if (!googleId) return null;
    return this.users.find((u) => u.googleId === googleId) || null;
  }

  setPasswordResetToken(userId, tokenHash, expiresAt) {
    return this.updateUser(userId, { resetTokenHash: tokenHash, resetTokenExpiresAt: expiresAt });
  }

  getUserByPasswordResetToken(tokenHash) {
    return (
      this.users.find((u) => u.resetTokenHash === tokenHash) || null
    );
  }

  clearPasswordResetToken(userId) {
    return this.updateUser(userId, { resetTokenHash: null, resetTokenExpiresAt: null });
  }

  createUser(userData) {
    const user = {
      authProvider: "local",
      ...userData,
    };
    this.users = [...this.users, user];
    return user;
  }

  updateUser(id, fields) {
    let found = null;
    this.users = this.users.map((u) => {
      if (u.id === id) {
        found = { ...u, ...fields };
        return found;
      }
      return u;
    });
    return found;
  }

  getCustomers() {
    return this.users.filter((u) => u.role === "USER");
  }

  getUsersByIds(ids = []) {
    const set = new Set(ids.filter(Boolean));
    return this.users.filter((u) => set.has(u.id));
  }

  /* ---------- Batteries ---------- */
  getAllBatteries(ownerId = null) {
    if (ownerId) return this.batteries.filter((b) => b.ownerId === ownerId);
    return this.batteries;
  }

  getBatteriesByIds(ids = []) {
    const set = new Set(ids.filter(Boolean));
    return this.batteries.filter((b) => set.has(b.id));
  }

  getBatteryById(id, ownerId = null) {
    const battery = this.batteries.find((b) => b.id === id) || null;
    if (!battery) return null;
    if (ownerId && battery.ownerId !== ownerId) return null;
    return battery;
  }

  findBatteryByBarcodeOrSerial(code, ownerId = null) {
    const clean = String(code || "").trim().toUpperCase();
    if (!clean) return null;
    const stripped = clean.replace(/^BATT-/, "");
    const prefixed = clean.startsWith("BATT-") ? clean : `BATT-${clean}`;
    return (
      this.batteries.find((b) => {
        const bCode = String(b.barcode || "").toUpperCase();
        const bSerial = String(b.serialNumber || "").toUpperCase();
        const bModal = String(b.modalId || "").toUpperCase();
        const bId = String(b.id || "").toUpperCase();
        const matches =
          bCode === clean ||
          bSerial === clean ||
          bModal === clean ||
          bId === clean ||
          bId === prefixed ||
          bModal === stripped ||
          bSerial === stripped ||
          bCode.includes(clean);
        if (!matches) return false;
        if (ownerId && b.ownerId !== ownerId) return false;
        return true;
      }) || null
    );
  }

  getBatteryRelatedDetails(battery) {
    if (!battery) return {};
    const user = battery.ownerId ? this.users.find((u) => u.id === battery.ownerId) : null;
    return {
      ownership: user
        ? {
            ownerId: user.id,
            ownerName: user.name,
            ownerEmail: user.email,
            role: user.role,
          }
        : null,
      bmsModel: battery.bmsModel || null,
      bmsId: battery.bmsId || null,
      weldingType: battery.weldingType || null,
      seriesCount: battery.seriesCount || battery.cells || null,
      parallelCount: battery.parallelCount || 1,
      installationDate: battery.manufactureDate || null,
      cellsDetail: [],
    };
  }

  createBattery(battery) {
    this.batteries = [battery, ...this.batteries];
    return battery;
  }

  updateBattery(id, fields) {
    let found = null;
    this.batteries = this.batteries.map((b) => {
      if (b.id === id) {
        found = { ...b, ...fields };
        return found;
      }
      return b;
    });
    return found;
  }

  claimBattery(id, ownerId) {
    let found = null;
    this.batteries = this.batteries.map((b) => {
      if (b.id === id) {
        found = { ...b, ownerId };
        return found;
      }
      return b;
    });
    return found;
  }

  deleteBattery(id) {
    const index = this.batteries.findIndex((b) => b.id === id);
    if (index === -1) return false;
    const [removed] = this.batteries.splice(index, 1);
    return removed;
  }

  /* ---------- Services ---------- */
  getAllServices() {
    return this.services;
  }

  getServicesByCustomerId(customerId) {
    if (!customerId) return [];
    return this.services.filter((s) => s.customerId === customerId);
  }

  getServicesByBatteryId(batteryId) {
    return this.services.filter((s) => s.batteryId === batteryId);
  }

  getServiceById(id) {
    return this.services.find((s) => s.id === id) || null;
  }

  createService(service) {
    assertServiceIntegrity(service);
    this.services = [service, ...this.services];
    return service;
  }

  updateService(id, fields) {
    const current = this.getServiceById(id);
    if (!current) return null;
    assertServiceIntegrity({ ...current, ...fields });
    let found = null;
    this.services = this.services.map((s) => {
      if (s.id === id) {
        found = { ...s, ...fields };
        return found;
      }
      return s;
    });
    return found;
  }

  deleteService(id) {
    const index = this.services.findIndex((s) => s.id === id);
    if (index === -1) return false;
    const [removed] = this.services.splice(index, 1);
    return removed;
  }

  /* ---------- Service Persons ---------- */
  getAllServicePersons() {
    return this.servicePersons;
  }

  getServicePersonById(id) {
    return this.servicePersons.find((sp) => sp.id === id) || null;
  }

  getServicePersonsByIds(ids = []) {
    const set = new Set(ids.filter(Boolean));
    return this.servicePersons.filter((sp) => set.has(sp.id));
  }

  createServicePerson(person) {
    this.servicePersons = [...this.servicePersons, person];
    return person;
  }

  updateServicePerson(id, fields) {
    let found = null;
    this.servicePersons = this.servicePersons.map((sp) => {
      if (sp.id === id) {
        found = { ...sp, ...fields };
        return found;
      }
      return sp;
    });
    return found;
  }

  /* ---------- Technicians (enhanced service persons) ---------- */
  getAllTechnicians() {
    return this.servicePersons;
  }

  getTechnicianById(id) {
    return this.servicePersons.find((sp) => sp.id === id) || null;
  }

  getTechnicianByEmail(email) {
    if (!email) return null;
    return this.servicePersons.find(
      (sp) => sp.email.toLowerCase() === email.toLowerCase()
    ) || null;
  }

  isTechnicianIdUnique(technicianId, excludeId = null) {
    return !this.servicePersons.some(
      (sp) => sp.technicianId === technicianId && sp.id !== excludeId
    );
  }

  isPhoneUnique(phone, excludeId = null) {
    if (!phone) return true;
    return !this.servicePersons.some(
      (sp) => sp.phone === phone && sp.id !== excludeId
    );
  }

  getEmployeeByServicePersonId(servicePersonId) {
    return this.users.find(
      (u) => u.role === "EMPLOYEE" && u.servicePersonId === servicePersonId
    ) || null;
  }

  /* ---------- Profile ---------- */
  getProfile(userId = null) {
    if (!userId) return this.profiles["user-1"] || null;
    return this.profiles[userId] || null;
  }

  getProfilesByIds(userIds = []) {
    const set = new Set(userIds.filter(Boolean));
    return Object.values(this.profiles).filter((p) => p && set.has(p.id || p.userId));
  }

  updateProfile(userId, fields = {}) {
    const { id, ...rest } = fields || {};
    if (rest.password) delete rest.password;
    const existing = this.profiles[userId] || { id: userId };
    this.profiles[userId] = { ...existing, ...rest };
    return this.profiles[userId];
  }

  /* ---------- Service History ---------- */
  addServiceHistory(serviceId, entry) {
    let found = null;
    this.services = this.services.map((s) => {
      if (s.id === serviceId) {
        const history = s.history || [];
        found = {
          ...s,
          history: [
            ...history,
            {
              id: `hist-${Date.now()}`,
              status: entry.status,
              action: entry.action,
              performedBy: entry.performedBy || "System",
              performedByName: entry.performedByName || "",
              notes: entry.notes || "",
              timestamp: new Date().toISOString(),
            },
          ],
        };
        return found;
      }
      return s;
    });
    return found;
  }

  /* ---------- Service Scheduling (P2.1) ---------- */
  getServiceSchedule(serviceId) {
    return this.serviceSchedules.find((s) => s.serviceId === serviceId) || null;
  }

  getServiceScheduleByScheduleId(id) {
    return this.serviceSchedules.find((s) => s.id === id) || null;
  }

  createServiceSchedule(schedule) {
    const row = {
      id: schedule.id || `sched-${Date.now()}`,
      serviceId: schedule.serviceId,
      scheduledDate: schedule.scheduledDate,
      startTime: schedule.startTime || "",
      endTime: schedule.endTime || "",
      technicianId: schedule.technicianId || null,
      status: schedule.status || "Scheduled",
      notes: schedule.notes || "",
      createdAt: schedule.createdAt || todayISO(),
      updatedAt: schedule.updatedAt || todayISO(),
    };
    this.serviceSchedules = [...this.serviceSchedules, row];
    return row;
  }

  updateServiceSchedule(id, fields) {
    let found = null;
    this.serviceSchedules = this.serviceSchedules.map((s) => {
      if (s.id === id) {
        found = { ...s, ...fields, updatedAt: todayISO() };
        return found;
      }
      return s;
    });
    return found;
  }

  deleteServiceSchedule(id) {
    const before = this.serviceSchedules.length;
    this.serviceSchedules = this.serviceSchedules.filter((s) => s.id !== id);
    return this.serviceSchedules.length < before;
  }

  listServiceSchedules({ date = "", serviceId = "", technicianId = "" } = {}) {
    return this.serviceSchedules.filter(
      (s) =>
        (!date || s.scheduledDate === date) &&
        (!serviceId || s.serviceId === serviceId) &&
        (!technicianId || s.technicianId === technicianId)
    );
  }

  getTechnicianAvailability(servicePersonId) {
    return this.technicianAvailability.filter((a) => a.servicePersonId === servicePersonId);
  }

  getTechnicianAvailabilityById(id) {
    return this.technicianAvailability.find((a) => a.id === id) || null;
  }

  createTechnicianAvailability(avail) {
    const row = {
      id: avail.id || `avail-${Date.now()}`,
      servicePersonId: avail.servicePersonId,
      dayOfWeek: avail.dayOfWeek,
      startTime: avail.startTime,
      endTime: avail.endTime,
      status: avail.status || "active",
      createdAt: avail.createdAt || todayISO(),
    };
    this.technicianAvailability = [...this.technicianAvailability, row];
    return row;
  }

  updateTechnicianAvailability(id, fields) {
    let found = null;
    this.technicianAvailability = this.technicianAvailability.map((a) => {
      if (a.id === id) {
        found = { ...a, ...fields };
        return found;
      }
      return a;
    });
    return found;
  }

  deleteTechnicianAvailability(id) {
    const before = this.technicianAvailability.length;
    this.technicianAvailability = this.technicianAvailability.filter((a) => a.id !== id);
    return this.technicianAvailability.length < before;
  }

  /* ---------- Activity Logs ---------- */
  logActivity(userId, action, details, type = "general") {
    const log = {
      id: `act-${Date.now()}`,
      action,
      details,
      timestamp: "Just now",
      type,
    };
    const profile = this.profiles[userId] || { id: userId, activityLogs: [] };
    this.profiles[userId] = {
      ...profile,
      activityLogs: [log, ...(profile.activityLogs || [])].slice(0, 20),
    };
    return log;
  }

  /* ---------- Reset ---------- */
  reset() {
    this.batteries = [...seedBatteries];
    this.services = [...seedServices];
    this.profiles = { "user-1": { ...seedUserProfile } };
    this.users = [...seedAdminUsers, ...seedRegularUsers, ...seedEmployeeUsers];
    this.servicePersons = [...seedServicePersons];
    this.notifications = [];
    this.batteryAlerts = [];
    this.serviceEvidence = [];
    this.serviceCheckins = [];
    this.serviceSchedules = [];
    this.technicianAvailability = [];
    this.maintenanceSchedules = [];
    this.organizations = [];
    this.organizationMembers = [];
    this.workspaces = [];
    this.workspaceMembers = [];
    this.invitations = [];
    this.refreshTokens = [];
    this.appSettings = {};
  }

  /* ------------------------------------------------------------
     PAGINATED LISTINGS (mock mirror of the postgres repository)
     Controllers that want the standard envelope call these; callers
     that pass no page/limit keep the legacy behavior. All returns:
       { data, pagination }
  ------------------------------------------------------------ */

  listBatteries({ ownerId = null, page = 1, limit = 20, search = "", sort = "", order = "asc" } = {}) {
    let list = ownerId
      ? this.batteries.filter((b) => b.ownerId === ownerId)
      : [...this.batteries];

    const q = String(search || "").trim().toLowerCase();
    if (q) {
      const needle = (v) => String(v ?? "").toLowerCase().includes(q);
      list = list.filter(
        (b) =>
          needle(b.id) ||
          needle(b.barcode) ||
          needle(b.serialNumber) ||
          needle(b.modalId) ||
          needle(b.name) ||
          needle(b.modelName) ||
          needle(b.chemistry) ||
          needle(b.manufacturer)
      );
    }

    list.sort((a, b) => compareSorted(a, b, sort, order));
    return paginateArray(list, { page, limit });
  }

  listServices({
    customerId = null,
    status = "",
    search = "",
    page = 1,
    limit = 20,
    sort = "",
    order = "asc",
  } = {}) {
    let list = customerId
      ? this.services.filter((s) => s.customerId === customerId)
      : [...this.services];

    if (status) list = list.filter((s) => s.status === status);

    const q = String(search || "").trim().toLowerCase();
    if (q) {
      const needle = (v) => String(v ?? "").toLowerCase().includes(q);
      list = list.filter(
        (s) =>
          needle(s.id) ||
          needle(s.ticketNumber) ||
          needle(s.batteryId) ||
          needle(s.batteryName) ||
          needle(s.serviceType) ||
          needle(s.center) ||
          needle(s.status)
      );
    }

    list.sort((a, b) => compareSorted(a, b, sort, order));
    return paginateArray(list, { page, limit });
  }

  listServicePersons({ status = "", search = "", page = 1, limit = 20, sort = "", order = "asc" } = {}) {
    let list = [...this.servicePersons];
    if (status) list = list.filter((sp) => sp.status === status);

    const q = String(search || "").trim().toLowerCase();
    if (q) {
      const needle = (v) => String(v ?? "").toLowerCase().includes(q);
      list = list.filter(
        (sp) =>
          needle(sp.id) ||
          needle(sp.technicianId) ||
          needle(sp.name) ||
          needle(sp.email) ||
          needle(sp.specialization) ||
          needle(sp.certification)
      );
    }

    list.sort((a, b) => compareSorted(a, b, sort, order));
    return paginateArray(list, { page, limit });
  }

  listCustomers({ search = "", page = 1, limit = 20, sort = "", order = "asc" } = {}) {
    let list = this.users.filter((u) => u.role === "USER");
    const q = String(search || "").trim().toLowerCase();
    if (q) {
      const needle = (v) => String(v ?? "").toLowerCase().includes(q);
      list = list.filter((c) => needle(c.id) || needle(c.name) || needle(c.email));
    }
    list.sort((a, b) => compareSorted(a, b, sort, order));
    return paginateArray(list, { page, limit });
  }
}

const store = new Store();

export default store;
