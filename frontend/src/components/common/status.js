/* ============================================================
   STATUS STYLE MAPPING
   Single source of truth for status -> Tailwind chip style.
   Used by both customer and admin views via StatusBadge.
============================================================ */

const STATUS_STYLES = {
  Confirmed: { chip: "bg-[#FBF1C9] text-[#A77A08]", border: "border-[#F0E6C8]", dot: "bg-[#B48611]" },
  Booked: { chip: "bg-[#FBF1C9] text-[#A77A08]", border: "border-[#F0E6C8]", dot: "bg-[#B48611]" },
  Pending: { chip: "bg-[#FBF1C9] text-[#A77A08]", border: "border-[#F0E6C8]", dot: "bg-[#B48611]" },
  Accepted: { chip: "bg-blue-50 text-blue-700 border-blue-200", border: "border-blue-200", dot: "bg-blue-500" },
  Assigned: { chip: "bg-violet-50 text-violet-700 border-violet-200", border: "border-violet-200", dot: "bg-violet-500" },
  "On The Way": { chip: "bg-amber-50 text-amber-700 border-amber-200", border: "border-amber-200", dot: "bg-amber-500" },
  "In Progress": { chip: "bg-orange-50 text-orange-700 border-orange-200", border: "border-orange-200", dot: "bg-orange-500" },
  "Waiting for Admin Approval": { chip: "bg-indigo-50 text-indigo-700 border-indigo-200", border: "border-indigo-200", dot: "bg-indigo-500" },
  Active: { chip: "bg-green-100 text-green-700", border: "border-green-200", dot: "bg-green-500" },
  Completed: { chip: "bg-green-50 text-green-700 border-green-200", border: "border-green-200", dot: "bg-green-500" },
  Complete: { chip: "bg-green-100 text-green-700", border: "border-green-200", dot: "bg-green-500" },
  Cancelled: { chip: "bg-red-100 text-red-700", border: "border-red-200", dot: "bg-red-500" },
};

const DEFAULT_STYLE = { chip: "bg-[#F5F1E7] text-[#747B83]", border: "border-[#E7E1D3]", dot: "bg-[#8A9096]" };

export const getStatusStyle = (status) => {
  const style = STATUS_STYLES[status] || DEFAULT_STYLE;
  return style.chip;
};

export const statusStyle = (status) => STATUS_STYLES[status] || DEFAULT_STYLE;

export const statusLabel = (status) => {
  const labels = {
    Confirmed: "Booked / Pending Approval",
    Accepted: "Admin Accepted",
    Assigned: "Battery Technician Assigned",
    "On The Way": "On The Way",
    "In Progress": "Service In Progress",
    "Waiting for Admin Approval": "Waiting for Admin Approval",
    Completed: "Service Completed",
    Cancelled: "Cancelled",
  };
  return labels[status] || status;
};
