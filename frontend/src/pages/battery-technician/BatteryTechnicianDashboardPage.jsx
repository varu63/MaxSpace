import React, { useMemo } from "react";
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
import { PageHeader, Card, StatCard } from "../../components/common";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import EmptyState from "../../components/common/EmptyState";
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
    <div className="space-y-6">
      <PageHeader
        icon={LayoutDashboard}
        title="Battery Technician Dashboard"
        subtitle={`${stats.total} total services assigned to you`}
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Wrench}
          value={stats.total}
          label="Assigned Services"
          description="Total services assigned"
        />
        <StatCard
          icon={Clock}
          value={stats.pending}
          label="Pending"
          description="Waiting for acceptance"
          tone="accent"
        />
        <StatCard
          icon={PlayCircle}
          value={stats.inProgress + stats.onTheWay}
          label="In Progress"
          description="Active service jobs"
          tone="accent"
        />
        <StatCard
          icon={CheckCircle2}
          value={stats.completed}
          label="Completed"
          description="Successfully finished"
        />
      </div>

      {/* Quick status row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Assigned", count: stats.pending, color: "bg-violet-100 text-violet-800 border-violet-200" },
          { label: "Accepted", count: stats.accepted, color: "bg-blue-100 text-blue-800 border-blue-200" },
          { label: "On The Way", count: stats.onTheWay, color: "bg-amber-100 text-amber-800 border-amber-200" },
          { label: "In Progress", count: stats.inProgress, color: "bg-orange-100 text-orange-800 border-orange-200" },
          { label: "Awaiting Approval", count: stats.waitingApproval, color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
        ].map((item) => (
          <div
            key={item.label}
            className={`flex items-center justify-between p-3 rounded-2xl border ${item.color}`}
          >
            <span className="text-xs font-bold">{item.label}</span>
            <span className="text-lg font-black">{item.count}</span>
          </div>
        ))}
      </div>

      {/* Recent Assigned Services */}
      <Card padded={false}>
        <div className="p-6 border-b border-[#EEE9DA]">
          <h2 className="font-bold text-lg text-[#16263A] flex items-center gap-2">
            <Wrench className="w-5 h-5 text-[#B48611]" />
            Assigned Services
          </h2>
          <p className="text-xs text-[#747B83] mt-1">
            Your most recent service assignments
          </p>
        </div>

        {recentServices.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title="No Assigned Services"
            description="You don't have any services assigned yet. Check back later."
          />
        ) : (
          <>
            {/* Mobile cards */}
            <div className="lg:hidden divide-y divide-[#EEE9DA]">
              {recentServices.map((service) => (
                <div
                  key={service.id}
                  className="p-5 hover:bg-[#F5F1E7]/50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/battery-technician/services/${service.id}`)}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
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
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-[#8A9096]">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(service.scheduledDate)} · {service.scheduledTime}
                    </span>
                    {service.center && (
                      <span className="flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate">{service.center}</span>
                      </span>
                    )}
                  </div>
                  <div className="mt-3">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#B48611]">
                      View Details <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F5F1E7] text-[#747B83] text-[11px] font-bold uppercase tracking-wider">
                    <th className="px-5 py-3 text-left">Ticket</th>
                    <th className="px-5 py-3 text-left">Customer</th>
                    <th className="px-5 py-3 text-left">Battery</th>
                    <th className="px-5 py-3 text-left">Service Type</th>
                    <th className="px-5 py-3 text-left">Location</th>
                    <th className="px-5 py-3 text-left">Scheduled</th>
                    <th className="px-5 py-3 text-left">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEE9DA]">
                  {recentServices.map((service) => (
                    <tr
                      key={service.id}
                      className="hover:bg-[#F5F1E7]/50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/battery-technician/services/${service.id}`)}
                    >
                      <td className="px-5 py-3">
                        <span className="font-mono text-xs font-bold text-[#173B5C]">
                          {service.ticketNumber}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs font-semibold text-[#16263A]">
                          {service.customer?.name || "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs font-semibold text-[#16263A] truncate block max-w-[160px]">
                          {service.battery?.modelName || service.batteryName}
                        </span>
                        <span className="text-[11px] text-[#8A9096] font-mono">
                          {service.batteryId}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs text-[#16263A] truncate block max-w-[180px]">
                          {service.serviceType}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs text-[#747B83] truncate block max-w-[160px]">
                          {service.center || "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs text-[#16263A]">
                          {formatDate(service.scheduledDate)}
                        </span>
                        <span className="block text-[11px] text-[#8A9096]">
                          {service.scheduledTime}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={service.status} />
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/battery-technician/services/${service.id}`);
                          }}
                          className="p-1.5 rounded-lg bg-[#F5F1E7] text-[#16263A] hover:bg-[#E7E1D3] transition-colors"
                          title="View details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* View all link */}
            <div className="p-4 border-t border-[#EEE9DA] text-center">
              <button
                type="button"
                onClick={() => navigate("/battery-technician/services")}
                className="text-sm font-bold text-[#B48611] hover:text-[#8A7A4A] transition-colors"
              >
                View all services →
              </button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};

export default BatteryTechnicianDashboardPage;
