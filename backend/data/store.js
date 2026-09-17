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

class Store {
  constructor() {
    this.batteries = [...seedBatteries];
    this.services = [...seedServices];
    this.profiles = { "user-1": { ...seedUserProfile } };
    this.users = [...seedAdminUsers, ...seedRegularUsers, ...seedEmployeeUsers];
    this.servicePersons = [...seedServicePersons];
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

  /* ---------- Batteries ---------- */
  getAllBatteries(ownerId = null) {
    if (ownerId) return this.batteries.filter((b) => b.ownerId === ownerId);
    return this.batteries;
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
    return (
      this.batteries.find((b) => {
        const matches =
          String(b.barcode || "").toUpperCase() === clean ||
          String(b.serialNumber || "").toUpperCase() === clean ||
          String(b.modalId || "").toUpperCase() === clean ||
          String(b.id || "").toUpperCase() === clean;
        if (!matches) return false;
        if (ownerId && b.ownerId !== ownerId) return false;
        return true;
      }) || null
    );
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
    this.services = [service, ...this.services];
    return service;
  }

  updateService(id, fields) {
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
  }
}

const store = new Store();

export default store;
