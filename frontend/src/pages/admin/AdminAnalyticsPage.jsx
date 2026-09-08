import React, { useMemo } from "react";
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
import { PageHeader, Card } from "../../components/common";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import { statusStyle, statusLabel } from "../../components/admin/adminUtils";

const AdminAnalyticsPage = () => {
  const { analytics, services, loading } = useAdmin();

  const statCards = useMemo(() => {
    if (!analytics) return [];
    return [
      { label: "Total Bookings", value: analytics.totalBookings, icon: ClipboardList, tone: "primary" },
      { label: "Pending Bookings", value: analytics.pendingBookings, icon: Clock, tone: "accent" },
      { label: "Active Services", value: analytics.activeServices, icon: Activity, tone: "primary" },
      { label: "Completed Services", value: analytics.completedServices, icon: TrendingUp, tone: "accent" },
      { label: "Cancelled Services", value: analytics.cancelledServices, icon: XCircle, tone: "primary" },
      { label: "Completion Rate", value: `${analytics.completionRate}%`, icon: Percent, tone: "accent" },
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
        title="Analytics"
        subtitle="Service performance & booking statistics"
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-[#FFFDF8] border border-[#EEE9DA] rounded-3xl p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs sm:text-sm font-medium text-[#8A7A4A]">
                  {card.label}
                </p>
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    card.tone === "primary" ? "bg-[#173B5C]" : "bg-[#B48611]"
                  }`}
                >
                  <Icon className="w-4 h-4 text-white" />
                </div>
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-[#16263A] mt-2">
                {card.value}
              </h3>
            </div>
          );
        })}
      </div>

      {/* Status statistics */}
      <Card padded={false}>
        <div className="p-6 lg:p-7 border-b border-[#EEE9DA]">
          <h2 className="font-bold text-lg text-[#16263A]">
            Service Status Statistics
          </h2>
          <p className="text-xs text-[#747B83] mt-0.5">
            Distribution of all bookings by current stage
          </p>
        </div>

        <div className="p-6 lg:p-7">
          {statusBreakdown.length === 0 ? (
            <p className="text-sm text-[#747B83]">No data available.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {statusBreakdown.map(([status, count]) => {
                const { chip, dot } = statusStyle(status);
                const total = analytics?.totalBookings || 0;
                const percent = total ? Math.round((count / total) * 100) : 0;
                return (
                  <div
                    key={status}
                    className="p-4 rounded-2xl bg-[#F5F1E7] border border-[#E7E1D3]"
                  >
                    <div className="flex items-center justify-between mb-2">
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
                    <p className="text-[11px] text-[#8A9096] mt-1.5">
                      {percent}% of total
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {/* Additional overview */}
      {analytics && (
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="bg-[#FBF1C9] border border-[#F0E6C8] rounded-3xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-[#B48611]" />
              <span className="text-[11px] font-semibold text-[#A77A08] uppercase">
                Total Customers
              </span>
            </div>
            <p className="text-3xl font-bold text-[#16263A]">
              {analytics.totalCustomers}
            </p>
          </div>

          <div className="bg-[#FBF1C9] border border-[#F0E6C8] rounded-3xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <UserCheck className="w-4 h-4 text-[#B48611]" />
              <span className="text-[11px] font-semibold text-[#A77A08] uppercase">
                Service Persons
              </span>
            </div>
            <p className="text-3xl font-bold text-[#16263A]">
              {analytics.totalServicePersons}
            </p>
          </div>

          <div className="bg-[#FBF1C9] border border-[#F0E6C8] rounded-3xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Wrench className="w-4 h-4 text-[#B48611]" />
              <span className="text-[11px] font-semibold text-[#A77A08] uppercase">
                Fleet Batteries
              </span>
            </div>
            <p className="text-3xl font-bold text-[#16263A]">
              {analytics.totalBatteries}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAnalyticsPage;