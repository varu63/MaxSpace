import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Wrench,
  Clock,
  CheckCircle2,
  PlayCircle,
  ArrowRight,
  Eye,
  Calendar,
  MapPin,
} from "lucide-react";

import { useBatteryTechnician } from "../../context/BatteryTechnicianContext";
import { PageHeader, Card, StatCard, EmptyState } from "../../components/common";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import StatusBadge from "../../components/admin/StatusBadge";
import { formatDate } from "../../components/admin/adminUtils";

const BatteryTechnicianDashboardPage = () => {
  const { services, stats, loading } = useBatteryTechnician();
  const navigate = useNavigate();

  const recentServices = useMemo(() => {
    return [...services]
      .sort((a, b) => {
        const order = {
          "In Progress": 0,
          "On The Way": 1,
          "Accepted": 2,
          "Assigned": 3,
          "Waiting for Admin Approval": 4,
        };
        return (order[a.status] ?? 99) - (order[b.status] ?? 99);
      })
      .slice(0, 5);
  }, [services]);

  if (loading && services.length === 0) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        icon={LayoutDashboard}
        title="Technician Dashboard"
        subtitle={`${stats.total} total service jobs assigned to your queue`}
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
        <StatCard
          icon={Wrench}
          value={stats.total}
          label="Total Assigned"
          description="Assigned service tickets"
          tone="primary"
        />
        <StatCard
          icon={Clock}
          value={stats.pending}
          label="Pending Action"
          description="Waiting for acceptance"
          tone="accent"
        />
        <StatCard
          icon={PlayCircle}
          value={stats.inProgress + stats.onTheWay}
          label="In Progress"
          description="Active en-route or repair"
          tone="accent"
        />
        <StatCard
          icon={CheckCircle2}
          value={stats.completed}
          label="Completed"
          description="Successfully finished"
          tone="primary"
        />
      </div>

      {/* Quick status breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Assigned", count: stats.pending, color: "bg-[#F5F1E7] text-[#173B5C] border-[#E7E1D3]" },
          { label: "Accepted", count: stats.accepted, color: "bg-[#F5F1E7] text-[#173B5C] border-[#E7E1D3]" },
          { label: "On The Way", count: stats.onTheWay, color: "bg-[#FBF1C9] text-[#A77A08] border-[#F0E6C8]" },
          { label: "In Progress", count: stats.inProgress, color: "bg-[#FBF1C9] text-[#A77A08] border-[#F0E6C8]" },
          { label: "Awaiting Approval", count: stats.waitingApproval, color: "bg-[#F5F1E7] text-[#173B5C] border-[#E7E1D3]" },
        ].map((item) => (
          <div
            key={item.label}
            className={`flex items-center justify-between p-3.5 rounded-2xl border ${item.color}`}
          >
            <span className="text-xs font-bold">{item.label}</span>
            <span className="text-lg font-black font-mono">{item.count}</span>
          </div>
        ))}
      </div>

      {/* Recent Assigned Services */}
      <Card padded={false} className="overflow-hidden">
        <div className="p-6 lg:p-7 border-b border-[#EEE9DA]">
          <h2 className="font-bold text-lg sm:text-xl text-[#16263A] flex items-center gap-2.5">
            <Wrench className="w-5 h-5 text-[#B48611]" />
            Recent Service Assignments
          </h2>
          <p className="text-xs text-[#747B83] mt-0.5">
            Your prioritized queue of active and upcoming field operations
          </p>
        </div>

        {recentServices.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title="No Assigned Services"
            description="You don't have any services assigned yet. New bookings assigned to you will appear here."
          />
        ) : (
          <>
            {/* Mobile cards */}
            <div className="lg:hidden p-4 space-y-3">
              {recentServices.map((service) => (
                <div
                  key={service.id}
                  className="rounded-2xl bg-[#F5F1E7] border border-[#E7E1D3] p-5 cursor-pointer hover:border-[#173B5C] transition-colors"
                  onClick={() => navigate(`/battery-technician/services/${service.id}`)}
                >
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span className="font-mono text-xs font-bold text-[#173B5C]">
                      {service.ticketNumber}
                    </span>
                    <StatusBadge status={service.status} />
                  </div>
                  <p className="text-sm font-bold text-[#16263A] truncate">
                    {service.battery?.modelName || service.batteryName}
                  </p>
                  <p className="text-xs text-[#747B83] truncate mt-0.5">
                    {service.serviceType}
                  </p>
                  <div className="flex items-center gap-3 mt-3 text-[11px] text-[#8A9096]">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-[#8A7A4A]" />
                      {formatDate(service.scheduledDate)} · {service.scheduledTime}
                    </span>
                    {service.center && (
                      <span className="flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 text-[#8A7A4A] shrink-0" />
                        <span className="truncate">{service.center}</span>
                      </span>
                    )}
                  </div>
                  <div className="mt-3.5 pt-3 border-t border-[#E7E1D3] flex items-center justify-between">
                    <span className="text-xs font-bold text-[#173B5C]">Open Details</span>
                    <ArrowRight className="w-4 h-4 text-[#B48611]" />
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F5F1E7] text-[#747B83] text-xs font-semibold uppercase tracking-wider border-b border-[#EEE9DA]">
                    <th className="px-6 py-4 text-left">Ticket Number</th>
                    <th className="px-6 py-4 text-left">Customer</th>
                    <th className="px-6 py-4 text-left">Battery Asset</th>
                    <th className="px-6 py-4 text-left">Service Type</th>
                    <th className="px-6 py-4 text-left">Location</th>
                    <th className="px-6 py-4 text-left">Scheduled</th>
                    <th className="px-6 py-4 text-left">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEE9DA]">
                  {recentServices.map((service) => (
                    <tr
                      key={service.id}
                      className="hover:bg-[#F5F1E7]/60 transition-colors cursor-pointer"
                      onClick={() => navigate(`/battery-technician/services/${service.id}`)}
                    >
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs font-bold text-[#173B5C]">
                          {service.ticketNumber}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-semibold text-[#16263A]">
                          {service.customer?.name || "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-semibold text-[#16263A] truncate block max-w-[160px]">
                          {service.battery?.modelName || service.batteryName}
                        </span>
                        <span className="text-[11px] text-[#8A9096] font-mono">
                          {service.batteryId}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs text-[#16263A] truncate block max-w-[180px]">
                          {service.serviceType}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs text-[#747B83] truncate block max-w-[160px]">
                          {service.center || "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-semibold text-[#16263A]">
                          {formatDate(service.scheduledDate)}
                        </span>
                        <span className="block text-[11px] text-[#8A9096]">
                          {service.scheduledTime}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={service.status} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/battery-technician/services/${service.id}`);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-[#173B5C] text-white text-xs font-bold hover:bg-[#102F4A] transition-colors shadow-sm inline-flex items-center gap-1.5"
                          title="View details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* View all link */}
            <div className="p-4 border-t border-[#EEE9DA] bg-[#FBF8F0]/60 text-center">
              <button
                type="button"
                onClick={() => navigate("/battery-technician/services")}
                className="text-sm font-bold text-[#173B5C] hover:text-[#B48611] transition-colors inline-flex items-center gap-1.5"
              >
                View all assigned services <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};

export default BatteryTechnicianDashboardPage;
