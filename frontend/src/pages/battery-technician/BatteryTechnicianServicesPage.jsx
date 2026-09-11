import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Eye,
  Wrench,
  Filter,
  X,
  Calendar,
  MapPin,
  ArrowRight,
} from "lucide-react";

import { useBatteryTechnician } from "../../context/BatteryTechnicianContext";
import { PageHeader, Card, EmptyState } from "../../components/common";
import LoadingSpinner from "../../components/common/LoadingSpinner";
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <div className="space-y-8">
      <PageHeader
        icon={Wrench}
        title="Assigned Service Queue"
        subtitle={`${services.length} services currently assigned to your account`}
      />

      {/* Filters Card */}
      <Card padded={false} className="p-5 lg:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A9096]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ticket, battery, service type, location…"
              className="w-full h-12 pl-11 pr-10 rounded-2xl bg-[#F5F1E7] border border-[#E7E1D3] outline-none text-sm text-[#16263A] placeholder:text-[#8A9096] focus:border-[#173B5C] transition"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8A9096] hover:text-[#16263A]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 px-3.5 rounded-2xl bg-[#F5F1E7] border border-[#E7E1D3] sm:w-56 h-12">
            <Filter className="w-4 h-4 text-[#8A9096] shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-transparent text-sm font-medium text-[#16263A] focus:outline-none cursor-pointer"
            >
              {BATTERY_TECHNICIAN_STATUS_FILTERS.map((s) => (
                <option key={s} value={s}>
                  {s === "All" ? "All Statuses" : s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#EEE9DA]/60">
          <span className="text-xs font-semibold text-[#747B83] mr-1">Status:</span>
          {BATTERY_TECHNICIAN_STATUS_FILTERS.slice(0, 6).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition ${
                statusFilter === status
                  ? "bg-[#173B5C] text-white border-[#173B5C] shadow-sm"
                  : "bg-[#FFFDF8] text-[#747B83] border-[#E7E1D3] hover:bg-[#F5F1E7] hover:text-[#16263A]"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </Card>

      {/* Mobile cards */}
      <div className="lg:hidden space-y-3.5">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title="No Services Found"
            description={
              search || statusFilter !== "All"
                ? "No services match your current filter parameters."
                : "You don't have any assigned service jobs."
            }
          />
        ) : (
          filtered.map((service) => (
            <div
              key={service.id}
              className="bg-[#FFFDF8] border border-[#EEE9DA] rounded-3xl p-6 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
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

              <div className="flex items-center gap-3 mt-3 text-[11px] text-[#8A9096]">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-[#8A7A4A]" />
                  {formatDate(service.scheduledDate)} · {service.scheduledTime}
                </span>
              </div>
              {service.center && (
                <p className="text-[11px] text-[#8A9096] mt-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-[#8A7A4A] shrink-0" />
                  <span className="truncate">{service.center}</span>
                </p>
              )}

              <div className="mt-4 pt-3 border-t border-[#EEE9DA] flex items-center justify-between">
                <span className="text-xs font-bold text-[#173B5C]">Manage Job</span>
                <ArrowRight className="w-4 h-4 text-[#B48611]" />
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
              <tr className="bg-[#F5F1E7] text-[#747B83] text-xs font-semibold uppercase tracking-wider border-b border-[#EEE9DA]">
                <th className="px-6 py-4 text-left">Ticket Number</th>
                <th className="px-6 py-4 text-left">Customer</th>
                <th className="px-6 py-4 text-left">Battery Asset</th>
                <th className="px-6 py-4 text-left">Chemistry</th>
                <th className="px-6 py-4 text-left">Service Type</th>
                <th className="px-6 py-4 text-left">Location</th>
                <th className="px-6 py-4 text-left">Scheduled</th>
                <th className="px-6 py-4 text-left">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEE9DA]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-6 py-14 text-center text-[#747B83]">
                    <Wrench className="w-8 h-8 text-[#8A9096] mx-auto mb-2 opacity-50" />
                    <p className="font-semibold text-sm">No services match your filters</p>
                    <p className="text-xs text-[#8A9096] mt-0.5">Try changing your search query or status filter</p>
                  </td>
                </tr>
              ) : (
                filtered.map((service) => (
                  <tr
                    key={service.id}
                    className="hover:bg-[#F5F1E7]/60 transition-colors cursor-pointer"
                    onClick={() => navigate(`/battery-technician/services/${service.id}`)}
                  >
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs font-bold text-[#173B5C]">
                        {service.ticketNumber}
                      </span>
                      <span className="block text-[11px] text-[#8A9096] mt-0.5">
                        {formatDate(service.createdAt)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-semibold text-[#16263A]">
                        {service.customer?.name || "—"}
                      </span>
                      <span className="block text-[11px] text-[#8A9096] truncate max-w-[140px]">
                        {service.customer?.email || "—"}
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
                      <span className="text-[11px] font-mono font-medium text-[#747B83] bg-[#F5F1E7] px-2.5 py-1 rounded-lg border border-[#E7E1D3]">
                        {service.battery?.chemistry || "—"}
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
                        Details
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
