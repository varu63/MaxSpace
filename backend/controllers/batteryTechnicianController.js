import store from "../data/index.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { signToken, sanitizeUser, matchesPassword } from "../utils/auth.js";
import { VALID_STATUSES } from "../constants/serviceStatuses.js";
import { parsePagination, buildPagination } from "../utils/pagination.js";
import { enrichServiceSummaries, enrichServiceDetail } from "../utils/serviceEnrichment.js";

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

  const user = await store.getUserByEmail(email);

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
    ? await store.getServicePersonById(user.servicePersonId)
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
  const user = await store.getUserById(req.user.id);
  if (!user || user.role !== "EMPLOYEE") {
    res.status(403);
    throw new Error("Access denied");
  }

  const servicePerson = user.servicePersonId
    ? await store.getServicePersonById(user.servicePersonId)
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
  const user = await store.getUserById(req.user.id);
  if (!user || !user.servicePersonId) {
    return res.json([]);
  }

  const servicePerson = await store.getServicePersonById(user.servicePersonId);
  if (!servicePerson) {
    return res.json([]);
  }

  const { page, limit } = parsePagination(req.query);
  const paginated = req.query.page !== undefined || req.query.limit !== undefined;

  const assignedIds = servicePerson.assignedServices || [];

  // No page/limit → legacy behavior (full enriched array).
  if (!paginated) {
    const { data: all } = await store.listServices({
      status: req.query.status || "",
      search: req.query.search || "",
      page: 1,
      limit: 100000,
    });
    const assigned = all.filter((s) => assignedIds.includes(s.id));
    const enriched = await enrichServiceSummaries(store, assigned);
    return res.json(enriched);
  }

  // Page inside the already-filtered assigned set. The mock store filters
  // in memory; the postgres store resolves the assigned subset first, then
  // applies offset/limit.
  const allAssigned = await store.listServices({ page: 1, limit: 100000 });
  const status = req.query.status || "";
  const q = String(req.query.search || "").trim().toLowerCase();
  let subset = allAssigned.data.filter((s) => assignedIds.includes(s.id));
  if (status) subset = subset.filter((s) => s.status === status);
  if (q) {
    const needle = (v) => String(v ?? "").toLowerCase().includes(q);
    subset = subset.filter(
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
  const start = (page - 1) * limit;
  const slice = subset.slice(start, start + limit);
  const enriched = await enrichServiceSummaries(store, slice);

  res.json({
    success: true,
    data: enriched,
    pagination: buildPagination(page, limit, subset.length),
  });
});

// GET /api/battery-technician/services/:id — get a specific assigned service
export const getAssignedServiceDetail = asyncHandler(async (req, res) => {
  const user = await store.getUserById(req.user.id);
  if (!user || !user.servicePersonId) {
    res.status(403);
    throw new Error("Access denied");
  }

  const service = await store.getServiceById(req.params.id);
  if (!service) {
    res.status(404);
    throw new Error("Service not found");
  }

  const servicePerson = await store.getServicePersonById(user.servicePersonId);
  const assignedIds = servicePerson ? servicePerson.assignedServices || [] : [];

  if (!assignedIds.includes(service.id)) {
    res.status(403);
    throw new Error("This service is not assigned to you");
  }

  const battery = await store.getBatteryById(service.batteryId);
  const customers = await store.getCustomers();
  const customer = customers.find((u) => u.id === service.customerId);

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
  const user = await store.getUserById(req.user.id);
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

  const service = await store.getServiceById(req.params.id);
  if (!service) {
    res.status(404);
    throw new Error("Service not found");
  }

  const servicePerson = await store.getServicePersonById(user.servicePersonId);
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

  const updated = await store.updateService(req.params.id, { status });

  await store.addServiceHistory(req.params.id, {
    status,
    action: `Service ${status}`,
    performedBy: "EMPLOYEE",
    performedByName: user.name,
    notes: `Status changed to ${status} by battery technician`,
  });

  await store.logActivity(
    req.user.id,
    `Service ${status}`,
    `Ticket #${updated.ticketNumber} status changed to ${status} by battery technician`,
    "service"
  );

  res.json(updated);
});
