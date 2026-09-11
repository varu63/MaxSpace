import { useMemo } from "react";
import { BarChart3, RefreshCw } from "lucide-react";

import { useBattery } from "../../context/BatteryContext";
import { bookingsFromServices, getBatteryServiceCount } from "../../data/dummyData";
import { PageHeader } from "../../components/common";

import AnalyticsStats from "../../components/user/analytics/AnalyticsStats";
import BatteryHealthChart from "../../components/user/analytics/BatteryHealthChart";
import ServiceAnalytics from "../../components/user/analytics/ServiceAnalytics";
import BatteryPerformance from "../../components/user/analytics/BatteryPerformance";
import AnalyticsTable from "../../components/user/analytics/AnalyticsTable";

const AnalyticsPage = () => {
  const {
    batteries = [],
    services = [],
  } = useBattery();

  /* Batteries enriched with service counts computed from the same
     shared service records used everywhere else. */
  const batteriesWithServiceData = useMemo(
    () =>
      batteries.map((battery) => ({
        ...battery,
        serviceCount: getBatteryServiceCount(battery, services),
      })),
    [batteries, services]
  );

  /* Booking-shaped view of the shared services so service analytics
     uses the same records as the Service page. */
  const bookings = useMemo(
    () => bookingsFromServices(services),
    [services]
  );

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

    const totalServices = services.length;

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
  }, [batteries, services]);

  return (
    <div className="w-full space-y-8">
      {/* Header */}
      <PageHeader
        icon={BarChart3}
        title="Analytics"
        subtitle="Monitor battery health and service performance"
        actions={
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-[#FFFDF8] border border-[#EEE9DA] text-[#16263A] font-medium hover:bg-[#F5F1E7] shadow-sm transition"
          >
            <RefreshCw className="w-4 h-4 text-[#8A7A4A]" />
            Refresh
          </button>
        }
      />

      {/* Statistics */}
      <AnalyticsStats stats={stats} />

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <BatteryHealthChart batteries={batteriesWithServiceData} />

        <ServiceAnalytics bookings={bookings} />
      </div>

      {/* Battery Performance */}
      <BatteryPerformance batteries={batteriesWithServiceData} />

      {/* Detailed Table */}
      <AnalyticsTable batteries={batteriesWithServiceData} />
    </div>
  );
};

export default AnalyticsPage;