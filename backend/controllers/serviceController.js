import store from "../data/index.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { todayISO } from "../utils/date.js";
import { parsePagination } from "../utils/pagination.js";
import { upsertScheduleForService } from "../services/schedulerService.js";
import { VALID_STATUSES, isActiveStatus, isCancelled } from "../constants/serviceStatuses.js";
import { ownerScopeFor } from "../utils/ownerScope.js";
import { assertBatteryAccess, assertBatteryWriteAccess } from "../utils/batteryAccess.js";
import { resolveServiceLocation } from "../utils/serviceLocation.js";
import { parseBookingLocation } from "../utils/serviceBookingLocation.js";
import { recordServiceTransition } from "../utils/serviceLifecycle.js";

/* Fields a customer may update on their own service record via PATCH. Identity
   and operational fields (customerId, batteryId, batteryName, assignedServicePersonId,
   approvedBy, adminApprovedAt, history, ticketNumber, technician, estimatedArrival)
   are never writable from the client — the store layer would otherwise accept
   them and persist cross-user values. Status is validated separately below. */
const EDITABLE_SERVICE_FIELDS = [
  "notes",
  "scheduledDate",
  "scheduledTime",
  "mobileNumber",
  "priority",
  "center",
  "cost",
];

// GET /api/services/service-centers — the real service_centers rows
export const getServiceCenters = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await store.getServiceCenters() });
});

// GET /api/services
export const getServices = asyncHandler(async (req, res) => {
  const batteryId = req.query.batteryId;
  const status = req.query.status || "";
  const paginated = req.query.page !== undefined || req.query.limit !== undefined;
  const { page, limit } = parsePagination(req.query);

  const results = await store.listServices({
    customerId: req.user.id,
    status,
    // Non-paginated callers expect the full array (legacy behavior).
    page: paginated ? page : 1,
    limit: paginated ? limit : 100000,
    sort: req.query.sort,
    order: req.query.order,
  });

  let data = results.data;
  if (batteryId) {
    data = data.filter((s) => s.batteryId === batteryId);
  }

  // Attach shared serviceLocation to every service
  data = await Promise.all(
    data.map(async (s) => ({ ...s, serviceLocation: await resolveServiceLocation(s) }))
  );
  if (paginated) {
    return res.json({ success: true, data, pagination: results.pagination });
  }
  res.json(data);
});

// GET /api/services/:id
export const getService = asyncHandler(async (req, res) => {
  const service = await store.getServiceById(req.params.id);
  if (!service || service.customerId !== req.user?.id) {
    res.status(404);
    throw new Error("Service record not found");
  }
  res.json({ ...service, serviceLocation: await resolveServiceLocation(service) });
});

// GET /api/services/battery/:batteryId/status  (derived per-battery status)
export const getBatteryServiceStatus = asyncHandler(async (req, res) => {
  let battery = await store.getBatteryById(req.params.batteryId, ownerScopeFor(req));
  if (!battery) {
    battery = await store.getBatteryById(req.params.batteryId);
    if (!battery) {
      res.status(404);
      throw new Error("Battery not found");
    }
    assertBatteryAccess(req, battery);
  }

  const records = (
    await store.getServicesByBatteryId(req.params.batteryId)
  ).filter((s) => !isCancelled(s.status));

  let status = "Pending";
  if (records.some((s) => isActiveStatus(s.status))) status = "Active";
  else if (records.some((s) => s.status === "Confirmed")) status = "Booked";
  else if (records.length > 0) status = "Completed";

  res.json({ batteryId: req.params.batteryId, status, count: records.length });
});

// POST /api/services
export const createService = asyncHandler(async (req, res) => {
  const data = req.body || {};

  if (!data.batteryId) {
    res.status(400);
    throw new Error("batteryId is required to create a service");
  }

  const battery = await store.getBatteryById(data.batteryId, ownerScopeFor(req))
    || (await store.getBatteryById(data.batteryId));
  if (!battery) {
    res.status(400);
    throw new Error("Battery not found for the provided batteryId");
  }
  assertBatteryWriteAccess(req, battery);

  // Customer service location: sanitised + range-validated here, never
  // trusted raw from the client. Throws 400 on malformed coordinates,
  // returns all-null when no location was supplied (GPS/geocoding
  // failure must never block a booking).
  const location = parseBookingLocation(data);

  const year = new Date().getFullYear();

  const newService = {
    id: `srv-${Date.now()}`,
    ticketNumber: `SRV-${year}-${Math.floor(1000 + Math.random() * 9000)}`,
    batteryId: data.batteryId,
    customerId: req.user.id,
    batteryName: battery?.modelName || data.batteryName || "Unknown Battery",
    serviceType: data.serviceType || "Battery Inspection",
    center: data.center || "MaxSpace Service Center",
    address: location.address,
    city: location.city,
    state: location.state,
    pincode: location.pincode,
    latitude: location.latitude,
    longitude: location.longitude,
    scheduledDate: data.scheduledDate,
    scheduledTime: data.scheduledTime,
    mobileNumber: data.mobileNumber || "",
    status: "Confirmed",
    priority: data.priority || "Normal",
    technician: data.technician || "Certified Battery Diagnostic Tech",
    notes: data.notes || "Routine check requested by owner.",
    cost: data.cost || "$0.00 (Warranty Covered)",
    createdAt: todayISO(),
    history: [
      {
        id: `hist-${Date.now()}`,
        status: "Confirmed",
        action: "Service Created",
        performedBy: "USER",
        performedByName: req.user?.name || "Customer",
        notes: "Service request created",
        timestamp: new Date().toISOString(),
      },
    ],
  };

  await store.createService(newService);
  await store.logActivity(
    req.user.id,
    "Service Booked",
    `Ticket #${newService.ticketNumber} for ${newService.batteryName}`,
    "service"
  );
  newService.serviceLocation = await resolveServiceLocation(newService);

  // P2.1: create the schedule slot when the request carries a preferred date.
  try {
    await upsertScheduleForService(store, newService);
  } catch {
    // Non-fatal — the admin scheduling board can backfill later via /schedules/sync.
  }

  res.status(201).json(newService);
});

// PATCH /api/services/:id
export const updateService = asyncHandler(async (req, res) => {
  const existing = await store.getServiceById(req.params.id);
  if (!existing || existing.customerId !== req.user?.id) {
    res.status(404);
    throw new Error("Service record not found");
  }

  const { status, ...restFields } = req.body || {};

  if (status !== undefined && status !== null) {
    if (!VALID_STATUSES.includes(status)) {
      res.status(400);
      throw new Error(`Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`);
    }
    // Users may only cancel a service; status advancement is restricted to
    // admins (PUT /api/admin/services/:id) and battery technicians
    // (PATCH /api/battery-technician/services/:id/status).
    if (status !== "Cancelled") {
      res.status(403);
      throw new Error("You do not have permission to change service status to this value");
    }
    if (existing.status === "Cancelled") {
      res.status(400);
      throw new Error("Service is already cancelled");
    }
    if (existing.status === "Completed") {
      res.status(400);
      throw new Error("Cannot cancel a completed service");
    }
  }

  // Mass-assignment guard: unknown / operational fields in the body are
  // dropped rather than persisted (e.g. a user trying to move their service
  // record onto another customer).
  const editableFields = {};
  for (const key of EDITABLE_SERVICE_FIELDS) {
    if (key in restFields) editableFields[key] = restFields[key];
  }

  const updatedRaw = await store.updateService(
    req.params.id,
    { ...editableFields, ...(status ? { status } : {}) }
  );
  const updated = { ...updatedRaw, serviceLocation: await resolveServiceLocation(updatedRaw) };

  if (status) {
    await store.addServiceHistory(req.params.id, {
      status,
      action: `Service ${status}`,
      performedBy: "USER",
      performedByName: req.user?.name || "Customer",
      notes: `Status changed to ${status}`,
    });

    /* A cancelled service is a lifecycle fact the passport should show. */
    await recordServiceTransition({
      store,
      service: updated,
      fromStatus: existing.status,
      toStatus: status,
      actorRole: "USER",
      actorName: req.user?.name || "Customer",
    });
  }

  if (status === "Cancelled") {
    await store.logActivity(
      req.user.id,
      "Service Cancelled",
      `Ticket #${updated.ticketNumber} was cancelled`,
      "service"
    );
  }

  res.json(updated);
});

// DELETE /api/services/:id
export const deleteService = asyncHandler(async (req, res) => {
  const existing = await store.getServiceById(req.params.id);
  if (!existing || existing.customerId !== req.user?.id) {
    res.status(404);
    throw new Error("Service record not found");
  }
  const removed = await store.deleteService(req.params.id);
  if (!removed) {
    res.status(404);
    throw new Error("Service record not found");
  }
  res.json({ message: "Service record removed", id: req.params.id });
});
