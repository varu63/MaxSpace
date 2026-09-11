import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ClipboardList,
  Clock,
  CheckCircle2,
  XCircle,
  Activity,
  UserCheck,
  TrendingUp,
  Wrench,
  ChevronRight,
} from "lucide-react";

import { useAdmin } from "../../context/AdminContext";
import { PageHeader, Card, StatCard, SectionHeader } from "../../components/common";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import { statusStyle, statusLabel, formatDate } from "../../components/admin/adminUtils";

const AdminDashboardPage = () => {
  const { services, analytics, loading } = useAdmin();
  const navigate = useNavigate();

  const stats = useMemo(() => {
    const total = services.length;
    const pending = services.filter((s) => s.status === "Confirmed").length;
    const accepted = services.filter((s) => s.status === "Accepted").length;
    const active = services.filter((s) =>
      ["On The Way", "In Progress"].includes(s.status)
    ).length;
    const waitingApproval = services.filter(
      (s) => s.status === "Waiting for Admin Approval"
    ).length;
    const completed = services.filter((s) => s.status === "Completed").length;
    const cancelled = services.filter((s) => s.status === "Cancelled").length;

    return { total, pending, accepted, active, waitingApproval, completed, cancelled };
  }, [services]);

  const recentServices = useMemo(
    () =>
      [...services]
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .slice(0, 5),
    [services]
  );

  const statusBreakdown = useMemo(() => {
    const counts = {
      Confirmed: 0,
      Accepted: 0,
      Assigned: 0,
      "On The Way": 0,
      "In Progress": 0,
      "Waiting for Admin Approval": 0,
      Completed: 0,
      Cancelled: 0,
    };
    services.forEach((s) => {
      if (s.status in counts) counts[s.status] += 1;
    });
    return Object.entries(counts).filter(([, count]) => count > 0);
  }, [services]);

  const statCards = [
    { label: "Total Service Requests", value: stats.total, icon: ClipboardList, tone: "primary", description: "All fleet bookings" },
    { label: "Pending Requests", value: stats.pending, icon: Clock, tone: "accent", description: "Awaiting acceptance" },
    { label: "Accepted Services", value: stats.accepted, icon: CheckCircle2, tone: "primary", description: "Ready for technician" },
    { label: "Active Services", value: stats.active, icon: Activity, tone: "accent", description: "In progress / en route" },
    { label: "Awaiting Approval", value: stats.waitingApproval, icon: CheckCircle2, tone: "primary", description: "Finished by tech" },
    { label: "Completed Services", value: stats.completed, icon: TrendingUp, tone: "primary", description: "Successfully closed" },
    { label: "Cancelled Services", value: stats.cancelled, icon: XCircle, tone: "accent", description: "Terminated requests" },
  ];

  if (loading && services.length === 0) {
    return <LoadingSpinner />;
  }

  return (
  <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">

    {/* Page Header */}
    <PageHeader
      icon={Wrench}
      title="Dashboard"
      subtitle="Overview of all customer service requests"
      actions={
        <Link
          to="/admin/services"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#173B5C] px-5 py-3 text-white font-semibold hover:bg-[#102F4A] transition-all shadow-sm text-sm"
        >
          View All Requests
        </Link>
      }
    />

    {/* Stats Grid */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
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

    {/* Recent Services + Status Overview */}
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-stretch">

      {/* Recent Service Requests */}
      <Card
        className="lg:col-span-3 h-full"
        padded={false}
      >
        <SectionHeader
          icon={ClipboardList}
          title="Recent Service Requests"
          subtitle="Latest bookings across the fleet"
          right={
            <Link
              to="/admin/services"
              className="flex items-center gap-1.5 text-sm font-semibold text-[#173B5C] hover:text-[#102F4A] transition"
            >
              View all
              <ChevronRight className="w-4 h-4" />
            </Link>
          }
        />

        {recentServices.length === 0 ? (
          <p className="p-6 text-sm text-[#747B83]">
            No service requests yet.
          </p>
        ) : (
          <ul className="divide-y divide-[#EEE9DA]">
            {recentServices.map((service) => {
              const { chip, dot } = statusStyle(service.status);

              return (
                <li key={service.id}>
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/admin/services/${service.id}`)
                    }
                    className="w-full flex items-center justify-between gap-3 px-6 py-4 text-left hover:bg-[#F5F1E7] transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-[#173B5C]">
                          {service.ticketNumber}
                        </span>

                        <span className="text-[11px] text-[#8A9096]">
                          {formatDate(service.createdAt)}
                        </span>
                      </div>

                      <p className="text-sm font-semibold text-[#16263A] mt-0.5 truncate">
                        {service.batteryName}
                      </p>

                      <p className="text-xs text-[#747B83] truncate">
                        {service.serviceType}
                      </p>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <span
                        className={`chip border ${chip} hidden sm:inline-flex`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${dot}`}
                        />
                        {statusLabel(service.status)}
                      </span>

                      <ChevronRight className="w-4 h-4 text-[#8A9096]" />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Service Status Overview */}
      <Card
        className="lg:col-span-2 h-full"
        padded={false}
      >
        <SectionHeader
          icon={Activity}
          title="Service Status Overview"
          subtitle="Distribution across all stages"
        />

        <div className="p-6 lg:p-7">
          {statusBreakdown.length === 0 ? (
            <p className="text-sm text-[#747B83]">
              No services recorded.
            </p>
          ) : (
            <div className="space-y-4">
              {statusBreakdown.map(([status, count]) => {
                const { chip, dot } = statusStyle(status);

                const percent = stats.total
                  ? Math.round((count / stats.total) * 100)
                  : 0;

                return (
                  <div key={status}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`chip border ${chip}`}>
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${dot}`}
                        />
                        {statusLabel(status)}
                      </span>

                      <span className="font-mono text-xs font-bold text-[#16263A]">
                        {count}
                      </span>
                    </div>

                    <div className="h-2 rounded-full bg-[#F5F1E7] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${dot}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {analytics && (
            <div className="mt-6 p-4 rounded-2xl bg-[#FBF1C9] border border-[#F0E6C8]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#A77A08]">
                  Service completion rate
                </span>

                <span className="font-mono font-black text-[#A77A08]">
                  {analytics.completionRate}%
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between text-[11px] text-[#8A7A4A]">
                <span className="flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5" />
                  {analytics.totalServicePersons} battery technicians
                </span>

                <span>{analytics.totalCustomers} customers</span>
              </div>
            </div>
          )}
        </div>
      </Card>

    </div>
  </div>
);
};

export default AdminDashboardPage;