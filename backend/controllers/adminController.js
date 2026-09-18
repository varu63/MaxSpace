import bcrypt from "bcryptjs";
import store from "../data/index.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { signToken, sanitizeUser, matchesPassword } from "../utils/auth.js";
import { todayISO } from "../utils/date.js";
import { VALID_STATUSES, isActiveStatus } from "../constants/serviceStatuses.js";
import { upsertScheduleForService } from "../services/schedulerService.js";
import { parsePagination } from "../utils/pagination.js";
import {
  enrichServiceSummaries,
  enrichServiceDetail,
} from "../utils/serviceEnrichment.js";

// POST /api/admin/login
export const adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error("Please provide email and password");
  }

  const user = await store.getUserByEmail(email);

  if (!user || user.role !== "ADMIN") {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  const ok = await matchesPassword(password, user.password);
  if (!ok) {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  const token = signToken(user.id, user.role);

  res.status(200).json({
    token,
    user: sanitizeUser(user),
  });
});

// GET /api/admin/me
export const adminMe = asyncHandler(async (req, res) => {
  const user = await store.getUserById(req.user.id);
  if (!user || user.role !== "ADMIN") {
    res.status(403);
    throw new Error("Access denied");
  }
  res.json({ user: sanitizeUser(user) });
});

// POST /api/admin/logout
export const adminLogout = asyncHandler(async (req, res) => {
  res.json({ message: "Logged out successfully" });
});

// GET /api/admin/services
export const getAdminServices = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const paginated = req.query.page !== undefined || req.query.limit !== undefined;

  // No page/limit → legacy behavior (full enriched array).
  if (!paginated) {
    const { data: all } = await store.listServices({
      status: req.query.status || "",
      search: req.query.search || "",
      page: 1,
      limit: 100000,
    });
    const enriched = await enrichServiceSummaries(store, all);
    return res.json(enriched);
  }

  const results = await store.listServices({
    status: req.query.status || "",
    search: req.query.search || "",
    page,
    limit,
    sort: req.query.sort,
    order: req.query.order,
  });
  const enriched = await enrichServiceSummaries(store, results.data);

  res.json({ success: true, data: enriched, pagination: results.pagination });
});

// GET /api/admin/services/:id
export const getAdminService = asyncHandler(async (req, res) => {
  const service = await store.getServiceById(req.params.id);
  if (!service) {
    res.status(404);
    throw new Error("Service not found");
  }

  res.json(await enrichServiceDetail(store, service));
});

// PATCH /api/admin/services/:id/accept
export const acceptService = asyncHandler(async (req, res) => {
  const service = await store.getServiceById(req.params.id);
  if (!service) {
    res.status(404);
    throw new Error("Service not found");
  }

  if (service.status !== "Confirmed") {
    res.status(400);
    throw new Error("Only pending services can be accepted");
  }

  const updated = await store.updateService(req.params.id, {
    status: "Accepted",
    notes: service.notes
      ? `${service.notes} | Admin accepted.`
      : "Admin accepted the service request.",
  });

  await store.addServiceHistory(req.params.id, {
    status: "Accepted",
    action: "Service Accepted",
    performedBy: "ADMIN",
    performedByName: req.user.name || "Admin",
    notes: "Service request accepted by admin",
  });

  await store.logActivity(
    req.user.id,
    "Service Accepted",
    `Ticket #${updated.ticketNumber} accepted by admin`,
    "service"
  );

  res.json(updated);
});

// PATCH /api/admin/services/:id/assign
export const assignService = asyncHandler(async (req, res) => {
  const { servicePersonId } = req.body;
  const service = await store.getServiceById(req.params.id);

  if (!service) {
    res.status(404);
    throw new Error("Service not found");
  }

  if (!servicePersonId) {
    res.status(400);
    throw new Error("servicePersonId is required");
  }

  const person = await store.getServicePersonById(servicePersonId);
  if (!person) {
    res.status(404);
    throw new Error("Battery technician not found");
  }

  if (person.status !== "active") {
    res.status(400);
    throw new Error("Battery technician is not active");
  }

  const technicianLabel = `${person.name} (${person.certification})`;

  // Remove the service from every technician's assigned-services list first,
  // so only the newly assigned technician can see the service.
  const allPersons = await store.getAllServicePersons();
  for (const sp of allPersons) {
    const list = sp.assignedServices || [];
    if (list.includes(req.params.id)) {
      await store.updateServicePerson(sp.id, {
        assignedServices: list.filter((id) => id !== req.params.id),
      });
    }
  }

  const updated = await store.updateService(req.params.id, {
    status: "Assigned",
    technician: technicianLabel,
    assignedServicePersonId: servicePersonId,
  });

  // Update battery technician's assigned services (re-read after cleanup so the
  // list is current — it may have been cleared in the loop above)
  const freshPerson = await store.getServicePersonById(servicePersonId);
  const freshAssigned = freshPerson.assignedServices || [];
  if (!freshAssigned.includes(req.params.id)) {
    await store.updateServicePerson(servicePersonId, {
      assignedServices: [...freshAssigned, req.params.id],
    });
  }

  await store.addServiceHistory(req.params.id, {
    status: "Assigned",
    action: "Service Assigned",
    performedBy: "ADMIN",
    performedByName: req.user.name || "Admin",
    notes: `Assigned to ${technicianLabel}`,
  });

  await store.logActivity(
    req.user.id,
    "Service Assigned",
    `Ticket #${updated.ticketNumber} assigned to ${technicianLabel}`,
    "service"
  );

  // P2.1: keep the schedule slot's technician in sync with the assignment.
  try {
    await upsertScheduleForService(store, updated);
  } catch {
    // Non-fatal — admin can fix via the scheduling board.
  }

  res.json(updated);
});

// PATCH /api/admin/services/:id/status
export const updateServiceStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const service = await store.getServiceById(req.params.id);

  if (!service) {
    res.status(404);
    throw new Error("Service not found");
  }

  if (!VALID_STATUSES.includes(status)) {
    res.status(400);
    throw new Error(`Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`);
  }

  const updated = await store.updateService(req.params.id, { status });

  await store.addServiceHistory(req.params.id, {
    status,
    action: `Service ${status}`,
    performedBy: "ADMIN",
    performedByName: req.user.name || "Admin",
    notes: `Status changed to ${status} by admin`,
  });

  if (status === "Completed") {
    await store.logActivity(
      req.user.id,
      "Service Completed",
      `Ticket #${updated.ticketNumber} marked completed by admin`,
      "service"
    );
  } else if (status === "Cancelled") {
    await store.logActivity(
      req.user.id,
      "Service Cancelled",
      `Ticket #${updated.ticketNumber} cancelled by admin`,
      "service"
    );
  }

  res.json(updated);
});

// GET /api/admin/service-persons
export const getServicePersons = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const paginated = req.query.page !== undefined || req.query.limit !== undefined;

  // Batched (not per-person) enrichment; legacy callers get the full list.
  const results = await store.listServicePersons({
    status: req.query.status || "",
    search: req.query.search || "",
    page,
    limit: paginated ? limit : 100000,
    sort: req.query.sort,
    order: req.query.order,
  });

  const personsWithServices = await enrichPersonsWithServices(store, results.data);
  const body = paginated
    ? { success: true, data: personsWithServices, pagination: results.pagination }
    : personsWithServices;
  res.json(body);
});

// POST /api/admin/service-persons
export const createServicePerson = asyncHandler(async (req, res) => {
  const { name, email, phone, certification, specialization, specializations, technicianId } = req.body || {};

  if (!name || !email) {
    res.status(400);
    throw new Error("Name and email are required");
  }

  const techId =
    (technicianId && String(technicianId).trim()) ||
    `TECH-${Date.now()}`;

  const newPerson = await store.createServicePerson({
    id: `sp-${Date.now()}`,
    technicianId: techId,
    name,
    email,
    phone: phone || "",
    certification: certification || "",
    specializations: Array.isArray(specializations) ? specializations : (specialization ? [specialization] : []),
    specialization: specialization || (Array.isArray(specializations) ? specializations[0] : "") || "",
    status: "active",
    assignedServices: [],
    createdAt: todayISO(),
  });

  res.status(201).json(newPerson);
});

// PATCH /api/admin/service-persons/:id
export const updateServicePerson = asyncHandler(async (req, res) => {
  const person = await store.getServicePersonById(req.params.id);
  if (!person) {
    res.status(404);
    throw new Error("Battery technician not found");
  }

  const updated = await store.updateServicePerson(req.params.id, req.body);
  res.json(updated);
});

// GET /api/admin/customers
export const getCustomers = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const paginated = req.query.page !== undefined || req.query.limit !== undefined;

  const results = await store.listCustomers({
    search: req.query.search || "",
    page,
    limit: paginated ? limit : 100000,
    sort: req.query.sort,
    order: req.query.order,
  });

  // Resolve per-customer service counts via a single batched service query.
  const allServices = await store.getAllServices();
  const enriched = results.data.map((c) => {
    const customerServices = allServices.filter((s) => s.customerId === c.id);
    const lastService =
      customerServices.length > 0
        ? customerServices.sort(
            (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
          )[0]
        : null;

    return {
      id: c.id,
      name: c.name,
      email: c.email,
      serviceCount: customerServices.length,
      lastService: lastService
        ? {
            ticketNumber: lastService.ticketNumber,
            date: lastService.createdAt,
            status: lastService.status,
          }
        : null,
      accountStatus: "active",
      createdAt: c.createdAt,
    };
  });

  const body = paginated
    ? { success: true, data: enriched, pagination: results.pagination }
    : enriched;
  res.json(body);
});

/* Batch service-person enrichment: assigned/completed/active counts plus a
   short recent-services preview. Uses one batched service list (already
   resolved by the caller) to avoid per-person scans. */
const enrichPersonsWithServices = async (storeRef, persons) => {
  const services = await storeRef.getAllServices();
  return persons.map((sp) => {
    const assigned = services.filter((s) =>
      (sp.assignedServices || []).includes(s.id)
    );
    return {
      ...sp,
      assignedServiceCount: assigned.length,
      completedServiceCount: assigned.filter((s) => s.status === "Completed").length,
      activeServiceCount: assigned.filter((s) => isActiveStatus(s.status)).length,
      recentServices: assigned.slice(0, 3),
    };
  });
};

// GET /api/admin/analytics
export const getAdminAnalytics = asyncHandler(async (req, res) => {
  const services = await store.getAllServices();
  const customers = await store.getCustomers();
  const servicePersons = await store.getAllServicePersons();
  const batteries = await store.getAllBatteries();

  const totalBookings = services.length;
  const pendingBookings = services.filter((s) => s.status === "Confirmed").length;
  const acceptedServices = services.filter((s) => s.status === "Accepted").length;
  const assignedServices = services.filter((s) => s.status === "Assigned").length;
  const activeServices = services.filter((s) => isActiveStatus(s.status)).length;
  const completedServices = services.filter((s) => s.status === "Completed").length;
  const cancelledServices = services.filter((s) => s.status === "Cancelled").length;
  const waitingApproval = services.filter((s) => s.status === "Waiting for Admin Approval").length;

  const completionRate =
    totalBookings > 0
      ? Math.round((completedServices / totalBookings) * 100)
      : 0;

  const statusBreakdown = {
    Confirmed: services.filter((s) => s.status === "Confirmed").length,
    Accepted: acceptedServices,
    Assigned: assignedServices,
    "On The Way": services.filter((s) => s.status === "On The Way").length,
    "In Progress": services.filter((s) => s.status === "In Progress").length,
    "Waiting for Admin Approval": waitingApproval,
    Completed: completedServices,
    Cancelled: cancelledServices,
  };

  const recentServices = [...services]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  res.json({
    totalBookings,
    pendingBookings,
    acceptedServices,
    assignedServices,
    activeServices,
    completedServices,
    cancelledServices,
    waitingApproval,
    completionRate,
    statusBreakdown,
    recentServices,
    totalCustomers: customers.length,
    totalServicePersons: servicePersons.length,
    totalBatteries: batteries.length,
  });
});

// PATCH /api/admin/services/:id/approve — approve completed service from technician
export const approveService = asyncHandler(async (req, res) => {
  const service = await store.getServiceById(req.params.id);
  if (!service) {
    res.status(404);
    throw new Error("Service not found");
  }

  if (service.status !== "Waiting for Admin Approval") {
    res.status(400);
    throw new Error("Only services waiting for admin approval can be approved");
  }

  const updated = await store.updateService(req.params.id, {
    status: "Completed",
    adminApprovedAt: new Date().toISOString(),
    approvedBy: req.user.id,
  });

  await store.addServiceHistory(req.params.id, {
    status: "Completed",
    action: "Admin Approved Completion",
    performedBy: "ADMIN",
    performedByName: req.user.name || "Admin",
    notes: "Service completion approved by admin",
  });

  await store.logActivity(
    req.user.id,
    "Service Completed",
    `Ticket #${updated.ticketNumber} completion approved by admin`,
    "service"
  );

  res.json(updated);
});

// POST /api/admin/technicians — create a battery technician (employee + service person)
export const createTechnician = asyncHandler(async (req, res) => {
  const { name, email, password, confirmPassword, phone, technicianId, specializations, certification } = req.body;

  if (!name || !name.trim()) {
    res.status(400);
    throw new Error("Full name is required");
  }

  if (!email || !email.trim()) {
    res.status(400);
    throw new Error("Email is required");
  }

  if (!password) {
    res.status(400);
    throw new Error("Password is required");
  }

  if (!technicianId || !technicianId.trim()) {
    res.status(400);
    throw new Error("Technician ID is required");
  }

  if (!specializations || !Array.isArray(specializations) || specializations.length === 0) {
    res.status(400);
    throw new Error("At least one specialization is required");
  }

  if (password.length < 6) {
    res.status(400);
    throw new Error("Password must be at least 6 characters");
  }

  if (confirmPassword && password !== confirmPassword) {
    res.status(400);
    throw new Error("Passwords do not match");
  }

  const phoneRegex = /^\+?[\d\s\-().]{7,20}$/;
  if (phone && !phoneRegex.test(phone.trim())) {
    res.status(400);
    throw new Error("Invalid phone number format");
  }

  if (!(await store.isTechnicianIdUnique(technicianId.trim()))) {
    res.status(409);
    throw new Error("Technician ID already exists");
  }

  const existingUser = await store.getUserByEmail(email.trim());
  if (existingUser) {
    res.status(409);
    throw new Error("A user with this email already exists");
  }

  const existingTech = await store.getTechnicianByEmail(email.trim());
  if (existingTech) {
    res.status(409);
    throw new Error("A technician with this email already exists");
  }

  if (phone && !(await store.isPhoneUnique(phone.trim()))) {
    res.status(409);
    throw new Error("A technician with this phone number already exists");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const personId = `sp-${Date.now()}`;

  const newPerson = await store.createServicePerson({
    id: personId,
    technicianId: technicianId.trim(),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    phone: phone ? phone.trim() : "",
    certification: certification || "",
    specializations: specializations,
    specialization: specializations[0] || "",
    status: "active",
    assignedServices: [],
    createdAt: todayISO(),
  });

  const userId = `emp-${Date.now()}`;
  const newUser = await store.createUser({
    id: userId,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password: hashedPassword,
    role: "EMPLOYEE",
    servicePersonId: personId,
    createdAt: todayISO(),
  });

  res.status(201).json({
    user: sanitizeUser(newUser),
    servicePerson: newPerson,
  });
});

// GET /api/admin/technicians — list all technicians
export const getTechnicians = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const paginated = req.query.page !== undefined || req.query.limit !== undefined;

  const results = await store.listServicePersons({
    status: req.query.status || "",
    search: req.query.search || "",
    page,
    limit: paginated ? limit : 100000,
    sort: req.query.sort,
    order: req.query.order,
  });

  const enriched = await enrichPersonsWithServices(store, results.data);
  const body = paginated
    ? { success: true, data: enriched, pagination: results.pagination }
    : enriched;
  res.json(body);
});

// GET /api/admin/technicians/:id — get single technician
export const getTechnician = asyncHandler(async (req, res) => {
  const person = await store.getTechnicianById(req.params.id);
  if (!person) {
    res.status(404);
    throw new Error("Technician not found");
  }

  const services = await store.getAllServices();
  const assignedServices = services.filter(
    (s) => (person.assignedServices || []).includes(s.id)
  );

  res.json({
    ...person,
    assignedServiceCount: assignedServices.length,
    assignedServices: assignedServices,
  });
});

// PATCH /api/admin/technicians/:id — update technician
export const updateTechnician = asyncHandler(async (req, res) => {
  const person = await store.getTechnicianById(req.params.id);
  if (!person) {
    res.status(404);
    throw new Error("Technician not found");
  }

  const { name, email, phone, technicianId, specializations, certification, status } = req.body;

  if (technicianId && technicianId !== person.technicianId) {
    if (!(await store.isTechnicianIdUnique(technicianId, person.id))) {
      res.status(409);
      throw new Error("Technician ID already exists");
    }
  }

  if (phone && phone !== person.phone) {
    if (!(await store.isPhoneUnique(phone, person.id))) {
      res.status(409);
      throw new Error("A technician with this phone number already exists");
    }
  }

  if (email && email !== person.email) {
    const existingUser = await store.getUserByEmail(email);
    if (existingUser) {
      res.status(409);
      throw new Error("A user with this email already exists");
    }
    const existingTech = await store.getTechnicianByEmail(email);
    if (existingTech) {
      res.status(409);
      throw new Error("A technician with this email already exists");
    }
  }

  const fields = {};
  if (name !== undefined) fields.name = name.trim();
  if (email !== undefined) fields.email = email.trim().toLowerCase();
  if (phone !== undefined) fields.phone = phone.trim();
  if (technicianId !== undefined) fields.technicianId = technicianId.trim();
  if (specializations !== undefined) {
    fields.specializations = specializations;
    if (specializations.length > 0) fields.specialization = specializations[0];
  }
  if (certification !== undefined) fields.certification = certification;
  if (status !== undefined) fields.status = status;

  const updated = await store.updateServicePerson(req.params.id, fields);

  const syncEmployeeUser = async () => {
    const employee = await store.getEmployeeByServicePersonId(person.id);
    if (!employee) return;
    const userFields = {};
    if (email && email !== person.email) userFields.email = email.trim().toLowerCase();
    if (name && name !== person.name) userFields.name = name.trim();
    if (Object.keys(userFields).length === 0) return;
    await store.updateUser(employee.id, userFields);
  };
  await syncEmployeeUser();

  res.json(updated);
});

// PATCH /api/admin/technicians/:id/reset-password — reset technician password
export const resetTechnicianPassword = asyncHandler(async (req, res) => {
  const person = await store.getTechnicianById(req.params.id);
  if (!person) {
    res.status(404);
    throw new Error("Technician not found");
  }

  const { password, confirmPassword } = req.body;

  if (!password) {
    res.status(400);
    throw new Error("New password is required");
  }

  if (password.length < 6) {
    res.status(400);
    throw new Error("Password must be at least 6 characters");
  }

  if (confirmPassword && password !== confirmPassword) {
    res.status(400);
    throw new Error("Passwords do not match");
  }

  const employee = await store.getEmployeeByServicePersonId(person.id);
  if (!employee) {
    res.status(404);
    throw new Error("Technician login account not found");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await store.updateUser(employee.id, { password: hashedPassword });

  res.json({ message: "Password reset successfully" });
});
