import store from "../data/store.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { todayISO } from "../utils/date.js";
import { VALID_STATUSES, isActiveStatus, isCancelled } from "../constants/serviceStatuses.js";

// GET /api/services
export const getServices = asyncHandler(async (req, res) => {
  const { batteryId, status } = req.query;
  let services = store.getAllServices();
  if (batteryId) {
    services = services.filter((s) => s.batteryId === batteryId);
  }

  if (status) {
    services = services.filter((s) => s.status === status);
  }

  res.json(services);
});

// GET /api/services/:id
export const getService = asyncHandler(async (req, res) => {
  const service = store.getServiceById(req.params.id);
  if (!service) {
    res.status(404);
    throw new Error("Service record not found");
  }
  res.json(service);
});

// GET /api/services/battery/:batteryId/status  (derived per-battery status)
export const getBatteryServiceStatus = asyncHandler(async (req, res) => {
  const battery = store.getBatteryById(req.params.batteryId);
  if (!battery) {
    res.status(404);
    throw new Error("Battery not found");
  }

  const records = store
    .getServicesByBatteryId(req.params.batteryId)
    .filter((s) => !isCancelled(s.status));

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

  const battery = store.getBatteryById(data.batteryId);
  if (!battery) {
    res.status(400);
    throw new Error("Battery not found for the provided batteryId");
  }

  const year = new Date().getFullYear();

  const newService = {
    id: `srv-${Date.now()}`,
    ticketNumber: `SRV-${year}-${Math.floor(1000 + Math.random() * 9000)}`,
    batteryId: data.batteryId,
    batteryName: battery?.modelName || data.batteryName || "Unknown Battery",
    serviceType: data.serviceType || "Battery Inspection",
    center: data.center || "MaxSpace Service Center",
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

  store.createService(newService);
  store.logActivity(
    "Service Booked",
    `Ticket #${newService.ticketNumber} for ${newService.batteryName}`,
    "service"
  );

  res.status(201).json(newService);
});

// PATCH /api/services/:id
export const updateService = asyncHandler(async (req, res) => {
  const existing = store.getServiceById(req.params.id);
  if (!existing) {
    res.status(404);
    throw new Error("Service record not found");
  }

  const { status, ...restFields } = req.body || {};

  if (status && !VALID_STATUSES.includes(status)) {
    res.status(400);
    throw new Error(`Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`);
  }

  const updated = store.updateService(req.params.id, { ...restFields, ...(status ? { status } : {}) });

  if (status) {
    store.addServiceHistory(req.params.id, {
      status,
      action: `Service ${status}`,
      performedBy: "USER",
      performedByName: req.user?.name || "Customer",
      notes: `Status changed to ${status}`,
    });
  }

  if (status === "Completed") {
    store.logActivity(
      "Service Completed",
      `Ticket #${updated.ticketNumber} marked completed`,
      "service"
    );
  } else if (status === "Cancelled") {
    store.logActivity(
      "Service Cancelled",
      `Ticket #${updated.ticketNumber} was cancelled`,
      "service"
    );
  }

  res.json(updated);
});

// DELETE /api/services/:id
export const deleteService = asyncHandler(async (req, res) => {
  const removed = store.deleteService(req.params.id);
  if (!removed) {
    res.status(404);
    throw new Error("Service record not found");
  }
  res.json({ message: "Service record removed", id: req.params.id });
});
