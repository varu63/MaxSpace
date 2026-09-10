import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Eye,
  Wrench,
  Filter,
  X,
  Calendar,
  MapPin,
} from "lucide-react";

import { useBatteryTechnician } from "../../context/BatteryTechnicianContext";
import { PageHeader, Card } from "../../components/common";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import EmptyState from "../../components/common/EmptyState";
import StatusBadge from "../../components/admin/StatusBadge";
import { formatDate } from "../../components/admin/adminUtils";

const BATTERY_TECHNICIAN_STATUS_FILTERS = [
  "All",
  "Assigned",
  "Accepted",
  "On The Way",
  "In Progress",
  "Waiting for Admin Approval",
  "Completed",
  "Cancelled",
];

const BatteryTechnicianServicesPage = () => {
  const { services, loading, refreshServices } = useBatteryTechnician();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  useEffect(() => {
    refreshServices();
  }, []);

  const filtered = useMemo(() => {
    let list = [...services];

    if (statusFilter !== "All") {
      list = list.filter((s) => s.status === statusFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          (s.ticketNumber || "").toLowerCase().includes(q) ||
          (s.batteryName || "").toLowerCase().includes(q) ||
          (s.battery?.modelName || "").toLowerCase().includes(q) ||
          (s.serviceType || "").toLowerCase().includes(q) ||
          (s.battery?.chemistry || "").toLowerCase().includes(q) ||
          (s.customer?.name || "").toLowerCase().includes(q) ||
          (s.center || "").toLowerCase().includes(q)
      );
    }

    return list;
  }, [services, search, statusFilter]);

  if (loading && services.length === 0) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Wrench}
        title="My Assigned Services"
        subtitle={`${services.length} services assigned to you`}
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex items-center gap-2.5 px-3.5 rounded-xl bg-[#FFFDF8] border border-[#E7E1D3] flex-1 focus-within:border-[#173B5C] transition-colors">
          <Search className="w-4 h-4 text-[#8A9096] shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ticket, battery, type, customer…"
            className="w-full py-3 bg-transparent text-sm text-[#16263A] placeholder:text-[#8A9096] focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="text-[#8A9096] hover:text-[#16263A]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 px-3.5 rounded-xl bg-[#FFFDF8] border border-[#E7E1D3] sm:w-56">
          <Filter className="w-4 h-4 text-[#8A9096] shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full py-3 bg-transparent text-sm text-[#16263A] focus:outline-none"
          >
            {BATTERY_TECHNICIAN_STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s === "All" ? "All Statuses" : s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden space-y-3">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title="No Services Found"
            description={
              search || statusFilter !== "All"
                ? "No services match your current filters."
                : "You don't have any assigned services yet."
            }
          />
        ) : (
          filtered.map((service) => (
            <div
              key={service.id}
              className="bg-[#FFFDF8] border border-[#EEE9DA] rounded-3xl p-5 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/battery-technician/services/${service.id}`)}
            >
              <div className="flex items-center justify-between gap-2 mb-3">
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
              {service.battery?.chemistry && (
                <p className="text-[11px] text-[#8A9096] mt-1 font-mono">
                  {service.battery.chemistry}
                </p>
              )}

              <div className="flex items-center gap-3 mt-2 text-[11px] text-[#8A9096]">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatDate(service.scheduledDate)} · {service.scheduledTime}
                </span>
              </div>
              {service.center && (
                <p className="text-[11px] text-[#8A9096] mt-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">{service.center}</span>
                </p>
              )}

              <div className="mt-4">
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#F5F1E7] text-[#16263A] border border-[#E7E1D3] text-[11px] font-bold hover:bg-[#E7E1D3] transition-colors">
                  <Eye className="w-3 h-3 inline mr-1" />
                  View Details
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop table */}
      <Card padded={false} className="hidden lg:block overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F5F1E7] text-[#747B83] text-[11px] font-bold uppercase tracking-wider">
                <th className="px-5 py-3 text-left">Ticket</th>
                <th className="px-5 py-3 text-left">Customer</th>
                <th className="px-5 py-3 text-left">Battery</th>
                <th className="px-5 py-3 text-left">Chemistry</th>
                <th className="px-5 py-3 text-left">Service Type</th>
                <th className="px-5 py-3 text-left">Location</th>
                <th className="px-5 py-3 text-left">Scheduled</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEE9DA]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-5 py-12 text-center text-[#747B83]">
                    No services match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((service) => (
                  <tr
                    key={service.id}
                    className="hover:bg-[#F5F1E7]/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/battery-technician/services/${service.id}`)}
                  >
                    <td className="px-5 py-3">
                      <span className="font-mono text-xs font-bold text-[#173B5C]">
                        {service.ticketNumber}
                      </span>
                      <span className="block text-[11px] text-[#8A9096]">
                        {formatDate(service.createdAt)}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs font-semibold text-[#16263A]">
                        {service.customer?.name || "—"}
                      </span>
                      <span className="block text-[11px] text-[#8A9096] truncate max-w-[140px]">
                        {service.customer?.email || "—"}
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
                      <span className="text-[11px] font-mono text-[#747B83]">
                        {service.battery?.chemistry || "—"}
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default BatteryTechnicianServicesPage;
