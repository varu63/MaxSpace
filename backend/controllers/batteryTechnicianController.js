import store from "../data/store.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { signToken, sanitizeUser, matchesPassword } from "../utils/auth.js";
import { VALID_STATUSES } from "../constants/serviceStatuses.js";

/* Battery Technician status transitions — only these moves are allowed for employees */
const EMPLOYEE_ALLOWED_TRANSITIONS = {
  "Assigned": ["Accepted", "Cancelled"],
  "Accepted": ["On The Way", "Cancelled"],
  "On The Way": ["In Progress", "Cancelled"],
  "In Progress": ["Waiting for Admin Approval", "Cancelled"],
};

// POST /api/battery-technician/login
export const batteryTechnicianLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error("Please provide email and password");
  }

  const user = store.getUserByEmail(email);

  if (!user || user.role !== "EMPLOYEE") {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  const ok = await matchesPassword(password, user.password);
  if (!ok) {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  const token = signToken(user.id, user.role);

  const servicePerson = user.servicePersonId
    ? store.getServicePersonById(user.servicePersonId)
    : null;

  res.status(200).json({
    token,
    user: {
      ...sanitizeUser(user),
      servicePersonId: user.servicePersonId,
      servicePerson: servicePerson
        ? {
            id: servicePerson.id,
            name: servicePerson.name,
            certification: servicePerson.certification,
            specialization: servicePerson.specialization,
            status: servicePerson.status,
          }
        : null,
    },
  });
});

// GET /api/battery-technician/me
export const batteryTechnicianMe = asyncHandler(async (req, res) => {
  const user = store.getUserById(req.user.id);
  if (!user || user.role !== "EMPLOYEE") {
    res.status(403);
    throw new Error("Access denied");
  }

  const servicePerson = user.servicePersonId
    ? store.getServicePersonById(user.servicePersonId)
    : null;

  res.json({
    user: {
      ...sanitizeUser(user),
      servicePersonId: user.servicePersonId,
      servicePerson: servicePerson
        ? {
            id: servicePerson.id,
            name: servicePerson.name,
            certification: servicePerson.certification,
            specialization: servicePerson.specialization,
            status: servicePerson.status,
          }
        : null,
    },
  });
});

// POST /api/battery-technician/logout
export const batteryTechnicianLogout = asyncHandler(async (req, res) => {
  res.json({ message: "Logged out successfully" });
});

// GET /api/battery-technician/services — get services assigned to this battery technician
export const getAssignedServices = asyncHandler(async (req, res) => {
  const user = store.getUserById(req.user.id);
  if (!user || !user.servicePersonId) {
    return res.json([]);
  }

  const servicePerson = store.getServicePersonById(user.servicePersonId);
  if (!servicePerson) {
    return res.json([]);
  }

  const allServices = store.getAllServices();
  const batteries = store.getAllBatteries();
  const users = store.getAllUsers();

  const assignedIds = servicePerson.assignedServices || [];
  const assigned = allServices.filter((s) => assignedIds.includes(s.id));

  const enriched = assigned.map((s) => {
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

// GET /api/battery-technician/services/:id — get a specific assigned service
export const getAssignedServiceDetail = asyncHandler(async (req, res) => {
  const user = store.getUserById(req.user.id);
  if (!user || !user.servicePersonId) {
    res.status(403);
    throw new Error("Access denied");
  }

  const service = store.getServiceById(req.params.id);
  if (!service) {
    res.status(404);
    throw new Error("Service not found");
  }

  const servicePerson = store.getServicePersonById(user.servicePersonId);
  const assignedIds = servicePerson ? servicePerson.assignedServices || [] : [];

  if (!assignedIds.includes(service.id)) {
    res.status(403);
    throw new Error("This service is not assigned to you");
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

// PATCH /api/battery-technician/services/:id/status — update service status (limited workflow)
export const updateServiceStatus = asyncHandler(async (req, res) => {
  const user = store.getUserById(req.user.id);
  if (!user || !user.servicePersonId) {
    res.status(403);
    throw new Error("Access denied");
  }

  const { status } = req.body;

  if (!status) {
    res.status(400);
    throw new Error("Status is required");
  }

  if (!VALID_STATUSES.includes(status)) {
    res.status(400);
    throw new Error(`Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`);
  }

  const service = store.getServiceById(req.params.id);
  if (!service) {
    res.status(404);
    throw new Error("Service not found");
  }

  const servicePerson = store.getServicePersonById(user.servicePersonId);
  const assignedIds = servicePerson ? servicePerson.assignedServices || [] : [];

  if (!assignedIds.includes(service.id)) {
    res.status(403);
    throw new Error("This service is not assigned to you");
  }

  const allowed = EMPLOYEE_ALLOWED_TRANSITIONS[service.status];
  if (!allowed || !allowed.includes(status)) {
    res.status(400);
    throw new Error(
      `Cannot change status from "${service.status}" to "${status}". Allowed transitions: ${(allowed || []).join(", ") || "none"}`
    );
  }

  const updated = store.updateService(req.params.id, { status });

  store.addServiceHistory(req.params.id, {
    status,
    action: `Service ${status}`,
    performedBy: "EMPLOYEE",
    performedByName: user.name,
    notes: `Status changed to ${status} by battery technician`,
  });

  store.logActivity(
    `Service ${status}`,
    `Ticket #${updated.ticketNumber} status changed to ${status} by battery technician`,
    "service"
  );

  res.json(updated);
});
