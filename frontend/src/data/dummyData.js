/* ============================================================
   SERVICE MAPPING HELPERS
   Pure mapping utilities shared by Home / Service / Analytics
   pages. All records come from the PostgreSQL-backed API — these
   functions only derive statuses and "booking" shapes from real
   service records. Defaulting to an empty array means an empty
   fleet simply renders the existing empty states — no sample or
   hardcoded records are ever shown.
============================================================ */
import { isActiveService, isCancelledService } from "./serviceStatuses";

/* Return the effective service status for a battery based on its
   service records. Priority: In Progress > Confirmed > (none).
   Values are normalized to the set used across Home / Service /
   Analytics: "Pending" | "Active" | "Booked" | "Completed". */
export const getBatteryServiceStatus = (
  battery,
  serviceRecords = []
) => {
  const batteryId = battery?.id || battery?.batteryId;

  const records = serviceRecords.filter(
    (service) =>
      service.batteryId === batteryId &&
      !isCancelledService(service.status)
  );

  if (records.length === 0) {
    return "Pending";
  }

  // Once a service is accepted/assigned/on-the-way/in-progress it counts
  // as an active service (same bucket the Home page and filters use).
  if (records.some((s) => isActiveService(s.status))) {
    return "Active";
  }

  if (records.some((s) => s.status === "Confirmed")) {
    return "Booked";
  }

  return "Completed";
};

/* Map a raw service record into the booking shape used by the
   Service / Analytics views. "Confirmed" is shown as "Booked". */
const serviceToBooking = (service) => ({
  id: service.id,
  ticketNumber: service.ticketNumber,
  batteryId: service.batteryId,
  batteryName: service.batteryName,
  serviceType: service.serviceType,
  center: service.center,
  date: service.scheduledDate,
  time: service.scheduledTime,
  mobileNumber: service.mobileNumber,
  notes: service.notes,
  cost: service.cost,
  priority: service.priority,
  technician: service.technician,
  estimatedArrival: service.estimatedArrival,
  history: service.history || [],
  status:
    service.status === "Confirmed"
      ? "Booked"
      : service.status === "In Progress"
        ? "In Progress"
        : service.status,
});

/* Convert a list of service records to booking records. */
export const bookingsFromServices = (
  serviceRecords = []
) => serviceRecords.map(serviceToBooking);

/* Number of non-cancelled services for a given battery. */
export const getBatteryServiceCount = (
  battery,
  serviceRecords = []
) => {
  const batteryId = battery?.id || battery?.batteryId;

  return serviceRecords.filter(
    (service) =>
      service.batteryId === batteryId &&
      !isCancelledService(service.status)
  ).length;
};