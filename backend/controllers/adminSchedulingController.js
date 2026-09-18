import store from "../data/index.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import {
  normalizeTime,
  endTimeFor,
  upsertScheduleForService,
  autoScheduleAll,
  findAvailableTechnicians,
} from "../services/schedulerService.js";
import {
  enrichServiceSummaries,
  enrichServiceDetail,
} from "../utils/serviceEnrichment.js";

/* Fetch the service records for a set of schedule rows in one pass.
   Returns a map of serviceId → enriched service detail. */
const fetchScheduleServices = async (schedules, withDetail = false) => {
  if (!schedules.length) return new Map();
  const ids = [...new Set(schedules.map((s) => s.serviceId))];
  const { data: all } = await store.listServices({ page: 1, limit: 100000 });
  const rows = all.filter((s) => ids.includes(s.id));
  let enriched = rows;
  if (withDetail) {
    enriched = [];
    for (const s of rows) enriched.push(await enrichServiceDetail(store, s));
  } else {
    enriched = await enrichServiceSummaries(store, rows);
  }
  const map = new Map();
  for (const s of enriched) map.set(s.id, s);
  return map;
};

// GET /api/admin/schedules?date=YYYY-MM-DD
export const getSchedules = asyncHandler(async (req, res) => {
  const date = req.query.date || undefined;
  const schedules = await store.listServiceSchedules({ date });
  const servicesById = await fetchScheduleServices(schedules, true);

  const result = schedules.map((s) => ({
    ...s,
    service: servicesById.get(s.serviceId) || null,
  }));

  res.json(result);
});

// POST /api/admin/schedules  { serviceId, scheduledDate, startTime, endTime, technicianId, notes }
export const createSchedule = asyncHandler(async (req, res) => {
  const { serviceId } = req.body;
  if (!serviceId) {
    res.status(400);
    throw new Error("serviceId is required");
  }

  const service = await store.getServiceById(serviceId);
  if (!service) {
    res.status(404);
    throw new Error("Service not found");
  }

  const scheduledDate = req.body.scheduledDate || service.scheduledDate;
  if (!scheduledDate) {
    res.status(400);
    throw new Error("scheduledDate is required");
  }
  const startTime = normalizeTime(req.body.startTime || service.scheduledTime);
  if (!startTime) {
    res.status(400);
    throw new Error("startTime is required");
  }
  const endTime = normalizeTime(req.body.endTime) || endTimeFor(startTime, "");
  const technicianId = req.body.technicianId || service.assignedServicePersonId || null;

  // Ensure the chosen technician is not double-booked into the window.
  const { conflicts } = await findAvailableTechnicians(store, {
    scheduledDate,
    startTime,
    endTime,
  });
  if (technicianId && conflicts[technicianId]) {
    res.status(409);
    throw new Error("Selected technician has a conflicting schedule slot");
  }

  // Keep the schedule and the service row in sync.
  const existing = await store.getServiceSchedule(serviceId);
  const schedule = existing
    ? await store.updateServiceSchedule(existing.id, {
        scheduledDate,
        startTime,
        endTime,
        technicianId,
        notes: req.body.notes || existing.notes || "",
        status: existing.status || "Scheduled",
      })
    : await store.createServiceSchedule({
        serviceId,
        scheduledDate,
        startTime,
        endTime,
        technicianId,
        notes: req.body.notes || "",
        status: "Scheduled",
      });

  await store.updateService(serviceId, {
    scheduledDate,
    scheduledTime: startTime,
    ...(technicianId ? { assignedServicePersonId: technicianId } : {}),
  });

  res.status(existing ? 200 : 201).json(schedule);
});

// PATCH /api/admin/schedules/:id
export const updateSchedule = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existing = await store.getServiceScheduleByScheduleId(id);
  if (!existing) {
    res.status(404);
    throw new Error("Schedule not found");
  }

  const scheduledDate = req.body.scheduledDate || existing.scheduledDate;
  const startTime = req.body.startTime === undefined || req.body.startTime === null
    ? existing.startTime
    : normalizeTime(req.body.startTime);
  const endTime = req.body.endTime === undefined || req.body.endTime === null
    ? existing.endTime
    : normalizeTime(req.body.endTime);
  const technicianId =
    req.body.technicianId === undefined ? existing.technicianId : req.body.technicianId || null;

  if (technicianId) {
    const person = await store.getServicePersonById(technicianId);
    if (!person) {
      res.status(404);
      throw new Error("Battery technician not found");
    }
    const { conflicts } = await findAvailableTechnicians(store, {
      scheduledDate,
      startTime,
      endTime,
      excludeScheduleId: id,
    });
    if (conflicts[technicianId]) {
      res.status(409);
      throw new Error("Selected technician has a conflicting schedule slot");
    }
  }

  const updated = await store.updateServiceSchedule(id, {
    scheduledDate,
    startTime,
    endTime,
    technicianId,
    notes: req.body.notes !== undefined ? req.body.notes : existing.notes,
    status: req.body.status || existing.status,
  });

  await store.updateService(existing.serviceId, {
    scheduledDate,
    scheduledTime: startTime,
    ...(technicianId ? { assignedServicePersonId: technicianId } : {}),
  });

  res.json(updated);
});

// DELETE /api/admin/schedules/:id
export const deleteSchedule = asyncHandler(async (req, res) => {
  const removed = await store.deleteServiceSchedule(req.params.id);
  if (!removed) {
    res.status(404);
    throw new Error("Schedule not found");
  }
  res.json({ message: "Schedule removed", id: req.params.id });
});

// GET /api/admin/schedules/available?date=&startTime=&endTime=
export const getAvailableTechnicians = asyncHandler(async (req, res) => {
  const { date, startTime, endTime } = req.query;
  const { available, conflicts } = await findAvailableTechnicians(store, {
    scheduledDate: date,
    startTime,
    endTime,
  });
  res.json({ available, conflicts });
});

// POST /api/admin/schedules/sync — backfill missing schedule slots.
export const syncSchedules = asyncHandler(async (req, res) => {
  const created = await autoScheduleAll(store);
  res.json({ message: `Schedules synchronized`, created });
});

// POST /api/admin/schedules/:id/upsert-service — refresh a schedule from its service.
export const refreshScheduleFromService = asyncHandler(async (req, res) => {
  const service = await store.getServiceById(req.body.serviceId);
  if (!service) {
    res.status(404);
    throw new Error("Service not found");
  }
  const schedule = await upsertScheduleForService(store, service);
  res.json({ schedule, service });
});

/* ============================================================
   TECHNICIAN AVAILABILITY WINDOWS
============================================================ */

// GET /api/admin/technician-availability?servicePersonId=
export const getTechnicianAvailability = asyncHandler(async (req, res) => {
  const { servicePersonId } = req.query;
  const rows = await store.getTechnicianAvailability(servicePersonId || "");
  res.json(rows);
});

// POST /api/admin/technician-availability
export const createTechnicianAvailability = asyncHandler(async (req, res) => {
  const { servicePersonId, dayOfWeek, startTime, endTime, status } = req.body;
  if (!servicePersonId) {
    res.status(400);
    throw new Error("servicePersonId is required");
  }
  if (dayOfWeek === undefined || dayOfWeek === null || dayOfWeek < 0 || dayOfWeek > 6) {
    res.status(400);
    throw new Error("dayOfWeek must be between 0 (Sunday) and 6 (Saturday)");
  }
  const s = normalizeTime(startTime);
  const e = normalizeTime(endTime);
  if (!s || !e) {
    res.status(400);
    throw new Error("startTime and endTime are required");
  }
  if (s >= e) {
    res.status(400);
    throw new Error("endTime must be after startTime");
  }

  const person = await store.getServicePersonById(servicePersonId);
  if (!person) {
    res.status(404);
    throw new Error("Battery technician not found");
  }

  const row = await store.createTechnicianAvailability({
    servicePersonId,
    dayOfWeek,
    startTime: s,
    endTime: e,
    status: status || "active",
  });
  res.status(201).json(row);
});

// PATCH /api/admin/technician-availability/:id
export const updateTechnicianAvailability = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const current = await store.getTechnicianAvailabilityById(id);
  if (!current) {
    res.status(404);
    throw new Error("Availability window not found");
  }
  const s = normalizeTime(req.body.startTime || current.startTime);
  const e = normalizeTime(req.body.endTime || current.endTime);
  if (s && e && s >= e) {
    res.status(400);
    throw new Error("endTime must be after startTime");
  }

  const updated = await store.updateTechnicianAvailability(id, {
    servicePersonId: req.body.servicePersonId ?? current.servicePersonId,
    dayOfWeek: req.body.dayOfWeek ?? current.dayOfWeek,
    startTime: s,
    endTime: e,
    status: req.body.status ?? current.status,
  });
  res.json(updated);
});

// DELETE /api/admin/technician-availability/:id
export const deleteTechnicianAvailability = asyncHandler(async (req, res) => {
  const removed = await store.deleteTechnicianAvailability(req.params.id);
  if (!removed) {
    res.status(404);
    throw new Error("Availability window not found");
  }
  res.json({ message: "Availability window removed", id: req.params.id });
});

export default {
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
};