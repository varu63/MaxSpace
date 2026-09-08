/* ============================================================
   SERVICE TRACKING - Status -> stage mapping + milestone helpers
   Single source of truth for the delivery-style tracking UI.
   The tracking stages are derived from the service's existing
   `status` field so the UI stays consistent with booking data.
 ============================================================ */

/* Ordered lifecycle stages shown on the tracking timeline. */
export const SERVICE_STAGES = [
  { key: "Booked", label: "Booked", short: "Booked" },
  { key: "Accepted", label: "Accepted", short: "Accepted" },
  { key: "Assigned", label: "Assigned", short: "Assigned" },
  { key: "OnTheWay", label: "On the Way", short: "On the Way" },
  { key: "InProgress", label: "Service in Progress", short: "Service" },
  { key: "Completed", label: "Completed", short: "Completed" },
];

/* Map a service `status` value to the index of the CURRENT stage.
   All stages before this index are treated as completed; this
   stage is highlighted (current); stages after are upcoming. */
export const getServiceStageIndex = (status) => {
  const value = (status || "").toLowerCase();

  switch (value) {
    case "confirmed":
    case "booked":
    case "pending approval":
      return 0; // Booked (waiting for admin)
    case "accepted":
    case "approved":
      return 1; // Accepted
    case "assigned":
    case "service person assigned":
      return 2; // Assigned
    case "on the way":
    case "ontheway":
      return 3; // On the way
    case "in progress":
      return 4; // Service in progress
    case "completed":
    case "complete":
    case "done":
      return 5; // Completed
    default:
      return -1; // No bookable stage (e.g. no service / cancelled)
  }
};

/* True when a service has no bookable tracking stage yet. */
export const isServiceBooked = (status) => {
  const value = (status || "").toLowerCase();
  return ["confirmed", "booked", "pending approval"].includes(value);
};

/* True when a service has reached (or passed) admin acceptance. */
export const isServiceAccepted = (status) => {
  const index = getServiceStageIndex(status);
  return index >= 1;
};

/* Build the milestone list with per-stage state derived from status:
   "completed" | "current" | "upcoming". */
export const getTrackingMilestones = (status) => {
  const currentIndex = getServiceStageIndex(status);
  const isCancelled = (status || "").toLowerCase() === "cancelled";

  return SERVICE_STAGES.map((stage, index) => {
    let state = "upcoming";

    if (isCancelled) {
      state = "upcoming";
    } else if (currentIndex < 0) {
      state = "upcoming";
    } else if (index < currentIndex) {
      state = "completed";
    } else if (index === currentIndex) {
      state = "current";
    }

    // Once the service is completed, all milestones are green/completed.
    if (currentIndex === 5) {
      state = "completed";
    }

    return { ...stage, index, state };
  });
};
