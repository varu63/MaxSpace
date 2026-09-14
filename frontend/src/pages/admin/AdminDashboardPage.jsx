import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Home,
  Battery,
  Wrench,
  ShieldCheck,
  AlertTriangle,
  Activity,
  Clock3,
  TrendingUp,
  ChevronRight,
  ClipboardList,
  UserCheck,
} from "lucide-react";

import { useAdmin } from "../../context/AdminContext";
import { PageHeader, Card, StatCard, SectionHeader, IconBox } from "../../components/common";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import { ACTIVE_SERVICE_STATUSES } from "../../data/serviceStatuses";
import { statusStyle, statusLabel, formatDate } from "../../components/admin/adminUtils";

const AdminDashboardPage = () => {
  const { services, servicePersons, analytics, loading } = useAdmin();
  const navigate = useNavigate();

  const stats = useMemo(() => {
    const total = services.length;
    const pending = services.filter((s) => s.status === "Confirmed").length;
    const accepted = services.filter((s) => s.status === "Accepted").length;
    const active = services.filter((s) => ACTIVE_SERVICE_STATUSES.includes(s.status)).length;
    const waitingApproval = services.filter(
      (s) => s.status === "Waiting for Admin Approval"
    ).length;
    const completed = services.filter((s) => s.status === "Completed").length;
    const cancelled = services.filter((s) => s.status === "Cancelled").length;

    return { total, pending, accepted, active, waitingApproval, completed, cancelled };
  }, [services]);

  const needsAttention = useMemo(
    () =>
      services.filter((s) =>
        ["Confirmed", "Waiting for Admin Approval"].includes(s.status)
      ).length,
    [services]
  );

  const fleetStats = useMemo(() => {
    const completionRate = stats.total
      ? Math.round((stats.completed / stats.total) * 100)
      : 0;

    return [
      { icon: Activity, label: "Active Services", value: stats.active, iconTone: "primary" },
      { icon: Clock3, label: "Awaiting Action", value: needsAttention, iconTone: "accent" },
      { icon: TrendingUp, label: "Completion Rate", value: `${completionRate}%`, iconTone: "primary" },
    ];
  }, [stats, needsAttention]);

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

  if (loading && services.length === 0) {
    return <LoadingSpinner />;
  }

  return (
  <div className="w-full space-y-8">
    {/* Page Header */}
    <PageHeader
      icon={Home}
      title="Good Morning"
      subtitle="Here's an overview of fleet operations and service requests."
      actions={
        <span className="hidden md:inline-flex items-center gap-2 text-sm text-[#747B83]">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          Live
        </span>
      }
    />

    {/* Stats Grid */}
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
      <StatCard icon={Battery} value={analytics?.totalBatteries ?? 0} label="Total Batteries" />
      <StatCard icon={Wrench} value={stats.active} label="Active Service Requests" />
      <StatCard icon={ShieldCheck} value={servicePersons.length} label="Battery Technicians" />
      <StatCard icon={AlertTriangle} value={needsAttention} label="Needs Attention" tone="accent" />
    </section>

    {/* Fleet Status */}
    <Card>
      <SectionHeader
        icon={Activity}
        title="Fleet Status"
        subtitle="Current state of fleet services and operations"
        right={
          <Link
            to="/admin/analytics"
            className="flex items-center gap-2 text-sm font-semibold text-[#173B5C] hover:text-[#102F4A] transition"
          >
            View Analytics
            <ChevronRight className="w-4 h-4" />
          </Link>
        }
      />

      <div className="p-6 lg:p-7 flex flex-col lg:flex-row gap-6 items-center">
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-5 w-full">
          {fleetStats.map((stat) => (
            <div
              key={stat.label}
              className="flex items-center justify-between rounded-2xl bg-[#F5F1E7] border border-[#E7E1D3] p-5"
            >
              <div>
                <p className="text-xs text-[#747B83]">{stat.label}</p>
                <p className="text-xl font-bold text-[#16263A]">{stat.value}</p>
              </div>
              <IconBox icon={stat.icon} tone={stat.iconTone} />
            </div>
          ))}
        </div>
      </div>
    </Card>

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