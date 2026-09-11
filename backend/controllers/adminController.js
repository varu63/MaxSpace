import bcrypt from "bcryptjs";
import store from "../data/store.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { signToken, sanitizeUser, matchesPassword } from "../utils/auth.js";
import { todayISO } from "../utils/date.js";
import { VALID_STATUSES, isActiveStatus } from "../constants/serviceStatuses.js";

// POST /api/admin/login
export const adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error("Please provide email and password");
  }

  const user = store.getUserByEmail(email);

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
  const user = store.getUserById(req.user.id);
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
  const services = store.getAllServices();
  const batteries = store.getAllBatteries();
  const users = store.getAllUsers();

  const enriched = services.map((s) => {
    const battery = batteries.find((b) => b.id === s.batteryId);
    const customer = users.find(
      (u) => u.id === (s.customerId || "user-1")
    );
    return {
      ...s,
      battery: battery
        ? {
            id: battery.id,
            modelName: battery.modelName,
            chemistry: battery.chemistry,
            type: battery.type,
            serialNumber: battery.serialNumber,
          }
        : null,
      customer: customer
        ? { id: customer.id, name: customer.name, email: customer.email }
        : null,
    };
  });

  res.json(enriched);
});

// GET /api/admin/services/:id
export const getAdminService = asyncHandler(async (req, res) => {
  const service = store.getServiceById(req.params.id);
  if (!service) {
    res.status(404);
    throw new Error("Service not found");
  }

  const battery = store.getBatteryById(service.batteryId);
  const customers = store.getCustomers();
  const customer = customers.find((u) => u.id === (service.customerId || "user-1"));

  res.json({
    ...service,
    battery: battery
      ? {
          id: battery.id,
          modelName: battery.modelName,
          chemistry: battery.chemistry,
          type: battery.type,
          serialNumber: battery.serialNumber,
          barcode: battery.barcode,
          capacityKwh: battery.capacityKwh,
          stateOfHealth: battery.stateOfHealth,
          location: battery.location,
          manufacturer: battery.manufacturer,
        }
      : null,
    customer: customer
      ? {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone || "",
          location: customer.location || "",
        }
      : null,
  });
});

// PATCH /api/admin/services/:id/accept
export const acceptService = asyncHandler(async (req, res) => {
  const service = store.getServiceById(req.params.id);
  if (!service) {
    res.status(404);
    throw new Error("Service not found");
  }

  if (service.status !== "Confirmed") {
    res.status(400);
    throw new Error("Only pending services can be accepted");
  }

  const updated = store.updateService(req.params.id, {
    status: "Accepted",
    notes: service.notes
      ? `${service.notes} | Admin accepted.`
      : "Admin accepted the service request.",
  });

  store.addServiceHistory(req.params.id, {
    status: "Accepted",
    action: "Service Accepted",
    performedBy: "ADMIN",
    performedByName: req.user.name || "Admin",
    notes: "Service request accepted by admin",
  });

  store.logActivity(
    "Service Accepted",
    `Ticket #${updated.ticketNumber} accepted by admin`,
    "service"
  );

  res.json(updated);
});

// PATCH /api/admin/services/:id/assign
export const assignService = asyncHandler(async (req, res) => {
  const { servicePersonId } = req.body;
  const service = store.getServiceById(req.params.id);

  if (!service) {
    res.status(404);
    throw new Error("Service not found");
  }

  if (!servicePersonId) {
    res.status(400);
    throw new Error("servicePersonId is required");
  }

  const person = store.getServicePersonById(servicePersonId);
  if (!person) {
    res.status(404);
    throw new Error("Battery technician not found");
  }

  if (person.status !== "active") {
    res.status(400);
    throw new Error("Battery technician is not active");
  }

  const technicianLabel = `${person.name} (${person.certification})`;

  const updated = store.updateService(req.params.id, {
    status: "Assigned",
    technician: technicianLabel,
    assignedServicePersonId: servicePersonId,
  });

  // Update battery technician's assigned services
  const assignedServices = person.assignedServices || [];
  if (!assignedServices.includes(req.params.id)) {
    store.updateServicePerson(servicePersonId, {
      assignedServices: [...assignedServices, req.params.id],
    });
  }

  store.addServiceHistory(req.params.id, {
    status: "Assigned",
    action: "Service Assigned",
    performedBy: "ADMIN",
    performedByName: req.user.name || "Admin",
    notes: `Assigned to ${technicianLabel}`,
  });

  store.logActivity(
    "Service Assigned",
    `Ticket #${updated.ticketNumber} assigned to ${technicianLabel}`,
    "service"
  );

  res.json(updated);
});

// PATCH /api/admin/services/:id/status
export const updateServiceStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const service = store.getServiceById(req.params.id);

  if (!service) {
    res.status(404);
    throw new Error("Service not found");
  }

  if (!VALID_STATUSES.includes(status)) {
    res.status(400);
    throw new Error(`Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`);
  }

  const updated = store.updateService(req.params.id, { status });

  store.addServiceHistory(req.params.id, {
    status,
    action: `Service ${status}`,
    performedBy: "ADMIN",
    performedByName: req.user.name || "Admin",
    notes: `Status changed to ${status} by admin`,
  });

  if (status === "Completed") {
    store.logActivity(
      "Service Completed",
      `Ticket #${updated.ticketNumber} marked completed by admin`,
      "service"
    );
  } else if (status === "Cancelled") {
    store.logActivity(
      "Service Cancelled",
      `Ticket #${updated.ticketNumber} cancelled by admin`,
      "service"
    );
  }

  res.json(updated);
});

// GET /api/admin/service-persons
export const getServicePersons = asyncHandler(async (req, res) => {
  const persons = store.getAllServicePersons();
  const services = store.getAllServices();

  const enriched = persons.map((sp) => {
    const assigned = services.filter((s) => (sp.assignedServices || []).includes(s.id));
    return {
      ...sp,
      assignedServiceCount: assigned.length,
      completedServiceCount: assigned.filter((s) => s.status === "Completed").length,
      activeServiceCount: assigned.filter((s) => isActiveStatus(s.status)).length,
      recentServices: assigned.slice(0, 3),
    };
  });

  res.json(enriched);
});

// POST /api/admin/service-persons
export const createServicePerson = asyncHandler(async (req, res) => {
  const { name, email, phone, certification, specialization } = req.body;

  if (!name || !email) {
    res.status(400);
    throw new Error("Name and email are required");
  }

  const newPerson = store.createServicePerson({
    id: `sp-${Date.now()}`,
    name,
    email,
    phone: phone || "",
    certification: certification || "",
    specialization: specialization || "",
    status: "active",
    assignedServices: [],
    createdAt: todayISO(),
  });

  res.status(201).json(newPerson);
});

// PATCH /api/admin/service-persons/:id
export const updateServicePerson = asyncHandler(async (req, res) => {
  const person = store.getServicePersonById(req.params.id);
  if (!person) {
    res.status(404);
    throw new Error("Battery technician not found");
  }

  const updated = store.updateServicePerson(req.params.id, req.body);
  res.json(updated);
});

// GET /api/admin/customers
export const getCustomers = asyncHandler(async (req, res) => {
  const customers = store.getCustomers();
  const services = store.getAllServices();

  const enriched = customers.map((c) => {
    const customerServices = services.filter(
      (s) => s.customerId === c.id || (!s.customerId && c.id === "user-1")
    );
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

  res.json(enriched);
});

// GET /api/admin/analytics
export const getAdminAnalytics = asyncHandler(async (req, res) => {
  const services = store.getAllServices();
  const customers = store.getCustomers();
  const servicePersons = store.getAllServicePersons();
  const batteries = store.getAllBatteries();

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

  const recentServices = services
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
  const service = store.getServiceById(req.params.id);
  if (!service) {
    res.status(404);
    throw new Error("Service not found");
  }

  if (service.status !== "Waiting for Admin Approval") {
    res.status(400);
    throw new Error("Only services waiting for admin approval can be approved");
  }

  const updated = store.updateService(req.params.id, {
    status: "Completed",
    adminApprovedAt: new Date().toISOString(),
    approvedBy: req.user.id,
  });

  store.addServiceHistory(req.params.id, {
    status: "Completed",
    action: "Admin Approved Completion",
    performedBy: "ADMIN",
    performedByName: req.user.name || "Admin",
    notes: "Service completion approved by admin",
  });

  store.logActivity(
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

  if (!store.isTechnicianIdUnique(technicianId.trim())) {
    res.status(409);
    throw new Error("Technician ID already exists");
  }

  const existingUser = store.getUserByEmail(email.trim());
  if (existingUser) {
    res.status(409);
    throw new Error("A user with this email already exists");
  }

  const existingTech = store.getTechnicianByEmail(email.trim());
  if (existingTech) {
    res.status(409);
    throw new Error("A technician with this email already exists");
  }

  if (phone && !store.isPhoneUnique(phone.trim())) {
    res.status(409);
    throw new Error("A technician with this phone number already exists");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const personId = `sp-${Date.now()}`;

  const newPerson = store.createServicePerson({
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
  const newUser = store.createUser({
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
  const persons = store.getAllTechnicians();
  const services = store.getAllServices();

  const enriched = persons.map((sp) => {
    const assigned = services.filter((s) => (sp.assignedServices || []).includes(s.id));
    return {
      ...sp,
      assignedServiceCount: assigned.length,
      completedServiceCount: assigned.filter((s) => s.status === "Completed").length,
      activeServiceCount: assigned.filter((s) => isActiveStatus(s.status)).length,
      recentServices: assigned.slice(0, 3),
    };
  });

  res.json(enriched);
});

// GET /api/admin/technicians/:id — get single technician
export const getTechnician = asyncHandler(async (req, res) => {
  const person = store.getTechnicianById(req.params.id);
  if (!person) {
    res.status(404);
    throw new Error("Technician not found");
  }

  const services = store.getAllServices();
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
  const person = store.getTechnicianById(req.params.id);
  if (!person) {
    res.status(404);
    throw new Error("Technician not found");
  }

  const { name, email, phone, technicianId, specializations, certification, status } = req.body;

  if (technicianId && technicianId !== person.technicianId) {
    if (!store.isTechnicianIdUnique(technicianId, person.id)) {
      res.status(409);
      throw new Error("Technician ID already exists");
    }
  }

  if (phone && phone !== person.phone) {
    if (!store.isPhoneUnique(phone, person.id)) {
      res.status(409);
      throw new Error("A technician with this phone number already exists");
    }
  }

  if (email && email !== person.email) {
    const existingUser = store.getUserByEmail(email);
    if (existingUser) {
      res.status(409);
      throw new Error("A user with this email already exists");
    }
    const existingTech = store.getTechnicianByEmail(email);
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

  const updated = store.updateServicePerson(req.params.id, fields);

  const syncEmployeeUser = async () => {
    const employee = store.getEmployeeByServicePersonId(person.id);
    if (!employee) return;
    const userFields = {};
    if (email && email !== person.email) userFields.email = email.trim().toLowerCase();
    if (name && name !== person.name) userFields.name = name.trim();
    if (Object.keys(userFields).length === 0) return;
    store.updateUser(employee.id, userFields);
  };
  await syncEmployeeUser();

  res.json(updated);
});

// PATCH /api/admin/technicians/:id/reset-password — reset technician password
export const resetTechnicianPassword = asyncHandler(async (req, res) => {
  const person = store.getTechnicianById(req.params.id);
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

  const employee = store.getEmployeeByServicePersonId(person.id);
  if (!employee) {
    res.status(404);
    throw new Error("Technician login account not found");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  store.updateUser(employee.id, { password: hashedPassword });

  res.json({ message: "Password reset successfully" });
});
