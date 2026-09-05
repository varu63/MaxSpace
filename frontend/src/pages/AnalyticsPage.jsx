import React, { useMemo } from "react";
import { BarChart3, RefreshCw } from "lucide-react";

import { useBattery } from "../context/BatteryContext";

import AnalyticsStats from "../components/analytics/AnalyticsStats";
import BatteryHealthChart from "../components/analytics/BatteryHealthChart";
import ServiceAnalytics from "../components/analytics/ServiceAnalytics";
import BatteryPerformance from "../components/analytics/BatteryPerformance";
import AnalyticsTable from "../components/analytics/AnalyticsTable";

const EMPTY_SERVICES = [];

const SAMPLE_BATTERIES = [
  {
    id: "BAT-001",
    name: "Battery Alpha",
    serialNumber: "BT-10001",
    health: 92,
    voltage: "48V",
    capacity: "100Ah",
    serviceCount: 2,
  },
  {
    id: "BAT-002",
    name: "Battery Beta",
    serialNumber: "BT-10002",
    health: 76,
    voltage: "48V",
    capacity: "80Ah",
    serviceCount: 1,
  },
  {
    id: "BAT-003",
    name: "Battery Gamma",
    serialNumber: "BT-10003",
    health: 54,
    voltage: "24V",
    capacity: "60Ah",
    serviceCount: 3,
  },
];

const AnalyticsPage = () => {
  const batteryContext = useBattery();

  const batteries =
    batteryContext?.batteries?.length > 0
      ? batteryContext.batteries
      : SAMPLE_BATTERIES;

  const bookings = batteryContext?.services ?? EMPTY_SERVICES;

  const stats = useMemo(() => {
    const totalBatteries = batteries.length;

    const healthyBatteries = batteries.filter((battery) => {
      const health = Number(
        battery.stateOfHealth ??
          battery.health ??
          battery.healthPercentage ??
          0
      );

      return health >= 80;
    }).length;

    const totalServices =
      batteries.reduce(
        (total, battery) =>
          total + Number(battery.serviceCount ?? 0),
        0
      ) + bookings.filter(
        (booking) => booking.status !== "Cancelled"
      ).length;

    const averageHealth =
      totalBatteries > 0
        ? Math.round(
            batteries.reduce((total, battery) => {
              return (
                total +
                Number(
                  battery.stateOfHealth ??
                    battery.health ??
                    battery.healthPercentage ??
                    0
                )
              );
            }, 0) / totalBatteries
          )
        : 0;

    return {
      totalBatteries,
      healthyBatteries,
      totalServices,
      averageHealth,
    };
  }, [batteries, bookings]);

  return (
    <div className="w-full space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#173B5C] flex items-center justify-center shadow-sm">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>

            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-[#16263A]">
                Analytics
              </h1>

              <p className="text-sm text-[#747B83]">
                Monitor battery health and service performance
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-[#FFFDF8] border border-[#EEE9DA] text-[#16263A] font-medium hover:bg-[#F5F1E7] shadow-sm transition"
        >
          <RefreshCw className="w-4 h-4 text-[#8A7A4A]" />
          Refresh
        </button>
      </div>

      {/* Statistics */}
      <AnalyticsStats stats={stats} />

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <BatteryHealthChart batteries={batteries} />

        <ServiceAnalytics bookings={bookings} />
      </div>

      {/* Battery Performance */}
      <BatteryPerformance batteries={batteries} />

      {/* Detailed Table */}
      <AnalyticsTable batteries={batteries} />
    </div>
  );
};

export default AnalyticsPage;