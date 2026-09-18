/* ============================================================
   SCHEDULER SERVICE (P2.1)
   Keeps service_schedules in sync with the services table and
   powers conflict detection for the admin scheduling board.

   Responsibilities:
     • upsertScheduleForService — create/refresh the schedule slot
       that mirrors a service's scheduledDate / scheduledTime /
       assignedServicePersonId.
     • autoScheduleAll         — one-time/periodic backfill that
       creates schedule slots for every service that is missing one.
     • findConflicts           — list technicians whose active
       schedule slots already overlap a candidate window.
     • findAvailableTechnicians — active technicians with no
       overlapping active slot (used by the admin scheduling UI).
   ============================================================ */
import { todayISO } from "../utils/date.js";

/* Normalize "10:30 AM"/"14:00"/"09:00:00" into HH:MM (24h) or keep "".
   Mirrors how scheduledTime is stored as a TIME column in postgres. */
export const normalizeTime = (value) => {
  if (!value) return "";
  const raw = String(value).trim();
  let match = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return raw;
  let [, hhRaw, mm, , meridiem] = match;
  let hh = Number.parseInt(hhRaw, 10);
  if (meridiem) {
    const isPM = /pm/i.test(meridiem);
    if (isPM && hh < 12) hh += 12;
    if (!isPM && hh === 12) hh = 0;
  }
  return `${String(hh).padStart(2, "0")}:${mm}`;
};

/* Default one-hour window when only a start time is provided. */
export const endTimeFor = (startTime, fallback) => {
  const start = normalizeTime(startTime);
  if (!start) return fallback || "";
  const [hh, mm] = start.split(":").map(Number);
  const total = hh * 60 + mm + 60;
  const endHh = Math.floor(total / 60);
  const endMm = total % 60;
  return `${String(endHh).padStart(2, "0")}:${String(endMm).padStart(2, "0")}`;
};

/* True when [s1,e1] and [s2,e2] time ranges overlap (24h "HH:MM" strings). */
const timesOverlap = (s1, e1, s2, e2) => {
  if (!s1 || !s2) return false;
  const t = (v) => {
    const [hh, mm] = String(v).split(":").map(Number);
    return (hh || 0) * 60 + (mm || 0);
  };
  return t(s1) < t(e2 || "23:59") && t(s2) < t(e1 || "23:59");
};

/* Create (or refresh) the schedule slot for a service. Returns the
   schedule row, or null when the service has no scheduled date yet. */
export const upsertScheduleForService = async (store, service) => {
  if (!service || !service.scheduledDate) return null;

  const existing = await store.getServiceSchedule(service.id);
  const payload = {
    serviceId: service.id,
    scheduledDate: service.scheduledDate,
    startTime: normalizeTime(service.scheduledTime),
    endTime: endTimeFor(service.scheduledTime, ""),
    technicianId: service.assignedServicePersonId || null,
    status:
      service.status === "Completed"
        ? "Completed"
        : service.status === "Cancelled"
        ? "Cancelled"
        : existing?.status || "Scheduled",
  };

  if (existing) return store.updateServiceSchedule(existing.id, payload);
  return store.createServiceSchedule(payload);
};

/* Backfill: create schedule slots for every service that is missing
   one but has a scheduled date set. Returns the number created. */
export const autoScheduleAll = async (store) => {
  const { data: all } = await store.listServices({ page: 1, limit: 100000 });
  let created = 0;
  for (const service of all) {
    if (!service.scheduledDate) continue;
    const existing = await store.getServiceSchedule(service.id);
    if (!existing) {
      await upsertScheduleForService(store, service);
      created += 1;
    }
  }
  return created;
};

/* Technicians whose active slots overlap the candidate window on the
   candidate date. `excludeScheduleId` ignores one schedule (the one
   being edited). */
export const findConflicts = async (
  store,
  { scheduledDate, startTime, endTime, excludeScheduleId = null }
) => {
  if (!scheduledDate || !startTime) return [];
  const start = normalizeTime(startTime);
  const end = normalizeTime(endTime) || endTimeFor(startTime, "");
  const daySchedules = await store.listServiceSchedules({ date: scheduledDate });

  const active = daySchedules.filter(
    (s) =>
      s.id !== excludeScheduleId &&
      s.status !== "Cancelled" &&
      s.status !== "Completed"
  );

  const perTechnician = new Map();
  for (const s of active) {
    if (!timesOverlap(start, end, s.startTime, s.endTime)) continue;
    if (!s.technicianId) continue;
    if (!perTechnician.has(s.technicianId)) perTechnician.set(s.technicianId, []);
    perTechnician.get(s.technicianId).push(s);
  }

  const conflictMap = {};
  for (const [technicianId, slots] of perTechnician) {
    conflictMap[technicianId] = slots;
  }
  return conflictMap;
};

/* Active technicians with no conflicting slot in the candidate window. */
export const findAvailableTechnicians = async (
  store,
  { scheduledDate, startTime, endTime, excludeScheduleId = null }
) => {
  const persons = await store.getAllServicePersons();
  const actives = persons.filter((p) => p.status === "active");
  if (!scheduledDate || !startTime) {
    // No window → everyone who is active is "available".
    return { available: actives, conflicts: {} };
  }
  const conflicts = await findConflicts(store, {
    scheduledDate,
    startTime,
    endTime,
    excludeScheduleId,
  });
  const available = actives.filter((p) => !conflicts[p.id]);
  return { available, conflicts };
};

export default {
  normalizeTime,
  endTimeFor,
  upsertScheduleForService,
  autoScheduleAll,
  findConflicts,
  findAvailableTechnicians,
  todayISO,
};