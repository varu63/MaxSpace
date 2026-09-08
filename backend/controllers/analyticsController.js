import store from "../data/store.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { isCancelled } from "../constants/serviceStatuses.js";

const getServiceCount = (batteryId, services) =>
  services.filter((s) => s.batteryId === batteryId && !isCancelled(s.status)).length;

// GET /api/analytics/fleet-stats
export const getFleetStats = asyncHandler(async (req, res) => {
  const batteries = store.getAllBatteries();
  const services = store.getAllServices();

  const totalBatteries = batteries.length;

  const optimalBatteries = batteries.filter((b) => Number(b.stateOfHealth) >= 90).length;
  const goodBatteries = batteries.filter((b) => {
    const h = Number(b.stateOfHealth);
    return h >= 80 && h < 90;
  }).length;
  const attentionBatteries = batteries.filter((b) => Number(b.stateOfHealth) < 80).length;

  const totalCapacityKwh = batteries.reduce(
    (t, b) => t + (Number(b.capacityKwh) || 0),
    0
  );

  const avgHealth =
    totalBatteries > 0
      ? batteries.reduce((t, b) => t + Number(b.stateOfHealth), 0) / totalBatteries
      : 0;

  const upcomingServices = services.filter((s) => s.status === "Confirmed").length;
  const inProgressServices = services.filter((s) => s.status === "In Progress").length;
  const completedServices = services.filter((s) => s.status === "Completed").length;
  const cancelledServices = services.filter((s) => s.status === "Cancelled").length;

  const activeWarranties = batteries.filter((b) => b.warranty?.status === "Active").length;
  const expiringWarranties = batteries.filter(
    (b) => b.warranty?.status === "Expiring Soon"
  ).length;
  const expiredWarranties = batteries.filter((b) => b.warranty?.status === "Expired").length;

  res.json({
    totalBatteries,
    optimalBatteries,
    goodBatteries,
    attentionBatteries,
    totalCapacityKwh: totalCapacityKwh.toFixed(1),
    avgHealth: Number(avgHealth).toFixed(1),
    totalServices: services.length,
    upcomingServices,
    inProgressServices,
    completedServices,
    cancelledServices,
    activeWarranties,
    expiringWarranties,
    expiredWarranties,
  });
});

// GET /api/analytics/services
export const getServiceAnalytics = asyncHandler(async (req, res) => {
  const services = store.getAllServices();

  const booked = services.filter((s) => s.status === "Confirmed").length;
  const inProgress = services.filter((s) => s.status === "In Progress").length;
  const completed = services.filter((s) => s.status === "Completed").length;
  const cancelled = services.filter((s) => s.status === "Cancelled").length;

  const pending = booked + inProgress;
  const total = services.length;

  const pendingPercent = total > 0 ? Math.round((pending / total) * 100) : 0;

  res.json({
    booked,
    inProgress,
    completed,
    cancelled,
    total,
    pending,
    pendingPercent,
  });
});

// GET /api/analytics/batteries/performance
export const getBatteryPerformance = asyncHandler(async (req, res) => {
  const batteries = store.getAllBatteries();
  const services = store.getAllServices();

  const rows = batteries.map((b) => ({
    battery: b,
    health: Number(b.stateOfHealth) || 0,
    voltage: b.nominalVoltage || b.voltage || "—",
    capacityKwh: Number(b.capacityKwh) || 0,
    serviceCount: getServiceCount(b.id, services),
  }));

  res.json(rows);
});

// GET /api/analytics (combined summary for dashboards)
export const getAnalytics = asyncHandler(async (req, res) => {
  const batteries = store.getAllBatteries();
  const services = store.getAllServices();

  const withCounts = batteries.map((b) => ({
    ...b,
    serviceCount: getServiceCount(b.id, services),
  }));

  res.json({
    batteries: withCounts,
    services,
  });
});
