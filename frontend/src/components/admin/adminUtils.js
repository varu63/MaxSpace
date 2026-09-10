/* ============================================================
   Admin panel shared helpers
============================================================ */
import { SERVICE_STATUS_FLOW } from "../../data/serviceStatuses";
import { statusStyle, statusLabel } from "../common/status";

export { SERVICE_STATUS_FLOW, statusStyle, statusLabel };

export const formatDate = (date) => {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export const getAvatarText = (name = "?") => {
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};
