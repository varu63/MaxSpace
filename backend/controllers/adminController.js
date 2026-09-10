import store from "../data/store.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { signToken, sanitizeUser, matchesPassword } from "../utils/auth.js";
import { todayISO } from "../utils/date.js";
import { VALID_STATUSES, isActiveStatus } from "../constants/serviceStatuses.js";

const signAdminToken = (id, role) => signToken(id, role);

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

  const token = signAdminToken(user.id, user.role);

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

  const enriched = persons.map((sp) => ({
    ...sp,
    assignedServiceCount: (sp.assignedServices || []).length,
    recentServices: services
      .filter((s) => (sp.assignedServices || []).includes(s.id))
      .slice(0, 3),
  }));

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
  const { name, email, password, phone, certification, specialization } = req.body;

  if (!name || !email || !password) {
    res.status(400);
    throw new Error("Name, email, and password are required");
  }

  const existing = store.getUserByEmail(email);
  if (existing) {
    res.status(400);
    throw new Error("A user with this email already exists");
  }

  const personId = `sp-${Date.now()}`;
  const userId = `emp-${Date.now()}`;

  const newPerson = store.createServicePerson({
    id: personId,
    name,
    email,
    phone: phone || "",
    certification: certification || "",
    specialization: specialization || "",
    status: "active",
    assignedServices: [],
    createdAt: todayISO(),
  });

  const bcrypt = await import("bcryptjs");
  const hashedPassword = await bcrypt.default.hash(password, 10);

  const newUser = store.createUser({
    id: userId,
    name,
    email,
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
