import { useMemo } from "react";
import {
  ClipboardList,
  Clock,
  Activity,
  TrendingUp,
  XCircle,
  Percent,
  BarChart3,
  Users,
  UserCheck,
  Wrench,
} from "lucide-react";

import { useAdmin } from "../../context/AdminContext";
import { PageHeader, Card, StatCard } from "../../components/common";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import { statusStyle, statusLabel } from "../../components/admin/adminUtils";

const AdminAnalyticsPage = () => {
  const { analytics, services, loading } = useAdmin();

  const statCards = useMemo(() => {
    if (!analytics) return [];
    return [
      { label: "Total Bookings", value: analytics.totalBookings, icon: ClipboardList, tone: "primary", description: "Fleet service requests" },
      { label: "Pending Bookings", value: analytics.pendingBookings, icon: Clock, tone: "accent", description: "Awaiting dispatch" },
      { label: "Active Services", value: analytics.activeServices, icon: Activity, tone: "primary", description: "In-progress jobs" },
      { label: "Completed Services", value: analytics.completedServices, icon: TrendingUp, tone: "accent", description: "Finished successfully" },
      { label: "Cancelled Services", value: analytics.cancelledServices, icon: XCircle, tone: "primary", description: "Terminated requests" },
      { label: "Completion Rate", value: `${analytics.completionRate}%`, icon: Percent, tone: "accent", description: "Overall fulfillment" },
    ];
  }, [analytics]);

  const statusBreakdown = useMemo(() => {
    if (!analytics?.statusBreakdown) return [];
    return Object.entries(analytics.statusBreakdown);
  }, [analytics]);

  if (loading && services.length === 0) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        icon={BarChart3}
        title="Fleet Analytics"
        subtitle="Service performance metrics & booking statistics across all assets"
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 lg:gap-5">
        {statCards.map((card) => (
          <StatCard
            key={card.label}
            icon={card.icon}
            value={card.value}
            label={card.label}
            description={card.description}
            tone={card.tone}
          />
        ))}
      </div>

      {/* Status statistics */}
      <Card padded={false} className="overflow-hidden">
        <div className="p-6 lg:p-7 border-b border-[#EEE9DA]">
          <h2 className="font-bold text-lg sm:text-xl text-[#16263A]">
            Service Status Distribution
          </h2>
          <p className="text-xs text-[#747B83] mt-0.5">
            Breakdown of all active and historical bookings by operational stage
          </p>
        </div>

        <div className="p-6 lg:p-7">
          {statusBreakdown.length === 0 ? (
            <p className="text-sm text-[#747B83]">No service data available.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {statusBreakdown.map(([status, count]) => {
                const { chip, dot } = statusStyle(status);
                const total = analytics?.totalBookings || 0;
                const percent = total ? Math.round((count / total) * 100) : 0;
                return (
                  <div
                    key={status}
                    className="p-4 sm:p-5 rounded-2xl bg-[#F5F1E7] border border-[#E7E1D3]"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className={`chip border ${chip}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                        {statusLabel(status)}
                      </span>
                      <span className="font-mono text-sm font-black text-[#16263A]">
                        {count}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[#FFFDF8] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${dot}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <p className="text-[11px] font-medium text-[#8A9096] mt-2">
                      {percent}% of total requests
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {/* Additional fleet overview tiles */}
      {analytics && (
        <div className="grid sm:grid-cols-3 gap-4 lg:gap-5">
          <div className="bg-[#FBF1C9] border border-[#F0E6C8] rounded-3xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-[#B48611]" />
              <span className="text-xs font-bold text-[#A77A08] uppercase tracking-wider">
                Total Customers
              </span>
            </div>
            <p className="text-3xl font-black text-[#16263A] mt-1">
              {analytics.totalCustomers}
            </p>
            <p className="text-xs text-[#8A7A4A] mt-1">Registered consumer accounts</p>
          </div>

          <div className="bg-[#FBF1C9] border border-[#F0E6C8] rounded-3xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <UserCheck className="w-5 h-5 text-[#B48611]" />
              <span className="text-xs font-bold text-[#A77A08] uppercase tracking-wider">
                Battery Technicians
              </span>
            </div>
            <p className="text-3xl font-black text-[#16263A] mt-1">
              {analytics.totalServicePersons}
            </p>
            <p className="text-xs text-[#8A7A4A] mt-1">Active field technicians</p>
          </div>

          <div className="bg-[#FBF1C9] border border-[#F0E6C8] rounded-3xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Wrench className="w-5 h-5 text-[#B48611]" />
              <span className="text-xs font-bold text-[#A77A08] uppercase tracking-wider">
                Fleet Batteries
              </span>
            </div>
            <p className="text-3xl font-black text-[#16263A] mt-1">
              {analytics.totalBatteries}
            </p>
            <p className="text-xs text-[#8A7A4A] mt-1">Monitored energy assets</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAnalyticsPage;
