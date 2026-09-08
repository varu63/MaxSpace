import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Eye,
  CheckCircle2,
  UserPlus,
  ChevronDown,
  Filter,
  X,
  AlertCircle,
  Wrench,
} from "lucide-react";

import { useAdmin } from "../../context/AdminContext";
import { PageHeader, Card } from "../../components/common";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import StatusBadge from "../../components/admin/StatusBadge";
import {
  SERVICE_STATUS_FLOW,
  statusStyle,
  statusLabel,
  formatDate,
} from "../../components/admin/adminUtils";
import { getErrorMessage } from "../../services/adminApi";
import { STATUS_FILTER_OPTIONS } from "../../data/serviceStatuses";

/* ============================================================
   Assign Service Person Modal
============================================================ */
const AssignModal = ({ service, servicePersons, onAssign, onClose }) => {
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const activePersons = servicePersons.filter((p) => p.status === "active");

  const handleAssign = async () => {
    if (!selectedPersonId) {
      setError("Please select a service person.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await onAssign(service.id, selectedPersonId);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-[#16263A]/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md bg-[#FFFDF8] rounded-2xl shadow-xl border border-[#EEE9DA] p-6">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-[#F5F1E7] flex items-center justify-center hover:bg-[#E7E1D3] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-xl bg-[#173B5C] flex items-center justify-center shrink-0">
            <UserPlus className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-[#16263A]">
              Assign Service Person
            </h3>
            <p className="text-xs text-[#747B83]">
              Ticket {service.ticketNumber} — {service.batteryName}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="mb-5">
          <label className="block text-xs font-bold text-[#16263A] mb-1.5">
            Service Person
          </label>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {activePersons.length === 0 ? (
              <p className="text-sm text-[#747B83] py-4 text-center">
                No active service persons available.
              </p>
            ) : (
              activePersons.map((person) => (
                <label
                  key={person.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedPersonId === person.id
                      ? "border-[#173B5C] bg-[#F8F2DE]"
                      : "border-[#E7E1D3] bg-[#F5F1E7] hover:border-[#B48611]"
                  }`}
                >
                  <input
                    type="radio"
                    name="service-person"
                    value={person.id}
                    checked={selectedPersonId === person.id}
                    onChange={() => {
                      setSelectedPersonId(person.id);
                      if (error) setError("");
                    }}
                    className="sr-only"
                  />
                  <div className="w-8 h-8 rounded-lg bg-[#173B5C] text-[#FBF1C9] flex items-center justify-center text-xs font-black shrink-0">
                    {person.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#16263A] truncate">
                      {person.name}
                    </p>
                    <p className="text-[11px] text-[#747B83] truncate">
                      {person.specialization} · {person.certification}
                    </p>
                  </div>
                  <span className="text-[11px] text-[#8A9096]">
                    {person.assignedServiceCount || 0} assigned
                  </span>
                </label>
              ))
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-[#F5F1E7] text-[#16263A] font-bold text-sm border border-[#E7E1D3] hover:bg-[#E7E1D3] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAssign}
            disabled={submitting || activePersons.length === 0}
            className="flex-1 py-2.5 rounded-xl bg-[#173B5C] text-white font-bold text-sm hover:bg-[#102F4A] transition-colors disabled:opacity-60"
          >
            {submitting ? "Assigning…" : "Assign"}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ============================================================
   Status Update Dropdown
============================================================ */
const StatusDropdown = ({ service, statuses, onUpdate }) => {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const allowedStatuses = useMemo(() => {
    if (service.status === "Cancelled" || service.status === "Completed") return [];
    return statuses.filter((s) => {
      if (s === "Cancelled") return true;
      if (s === service.status) return false;
      const currentIdx = SERVICE_STATUS_FLOW.indexOf(service.status);
      const sIdx = SERVICE_STATUS_FLOW.indexOf(s);
      if (sIdx === -1) return true;
      if (currentIdx === -1) return true;
      return sIdx >= currentIdx;
    });
  }, [service.status, statuses]);

  if (allowedStatuses.length === 0) return null;

  const handleUpdate = async (status) => {
    setSubmitting(true);
    try {
      await onUpdate(service.id, status);
      setOpen(false);
    } catch {
      // error handled in context
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#F5F1E7] text-[#16263A] border border-[#E7E1D3] text-[11px] font-bold hover:bg-[#E7E1D3] transition-colors"
      >
        Status
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 mt-1 w-48 bg-[#FFFDF8] border border-[#EEE9DA] rounded-xl shadow-lg z-40 py-1">
            {allowedStatuses.map((s) => {
              const { dot } = statusStyle(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleUpdate(s)}
                  disabled={submitting}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[#16263A] hover:bg-[#F5F1E7] transition-colors disabled:opacity-50"
                >
                  <span className={`w-2 h-2 rounded-full ${dot}`} />
                  {statusLabel(s)}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

/* ============================================================
   Mobile Card
============================================================ */
const ServiceCard = ({ service, onAccept, onAssign, onUpdateStatus }) => {
  const navigate = useNavigate();
  return (
    <div className="bg-[#FFFDF8] border border-[#EEE9DA] rounded-3xl p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="font-mono text-xs font-bold text-[#173B5C]">
          {service.ticketNumber}
        </span>
        <StatusBadge status={service.status} />
      </div>

      <div
        className="cursor-pointer"
        onClick={() => navigate(`/admin/services/${service.id}`)}
      >
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
        <p className="text-[11px] text-[#8A9096] mt-1">
          {formatDate(service.scheduledDate)} · {service.scheduledTime}
        </p>
      </div>

      <div className="flex items-center gap-2 mt-4 flex-wrap">
        <button
          type="button"
          onClick={() => navigate(`/admin/services/${service.id}`)}
          className="px-3 py-1.5 rounded-lg bg-[#F5F1E7] text-[#16263A] border border-[#E7E1D3] text-[11px] font-bold hover:bg-[#E7E1D3] transition-colors"
        >
          <Eye className="w-3 h-3 inline mr-1" />
          View
        </button>

        {service.status === "Confirmed" && (
          <button
            type="button"
            onClick={() => onAccept(service.id)}
            className="px-3 py-1.5 rounded-lg bg-[#173B5C] text-white text-[11px] font-bold hover:bg-[#102F4A] transition-colors"
          >
            <CheckCircle2 className="w-3 h-3 inline mr-1" />
            Accept
          </button>
        )}

        {service.status === "Accepted" && (
          <button
            type="button"
            onClick={() => onAssign(service)}
            className="px-3 py-1.5 rounded-lg bg-[#B48611] text-white text-[11px] font-bold hover:bg-[#9A8240] transition-colors"
          >
            <UserPlus className="w-3 h-3 inline mr-1" />
            Assign
          </button>
        )}

        <StatusDropdown
          service={service}
          statuses={STATUS_FILTER_OPTIONS.filter((s) => s !== "All")}
          onUpdate={onUpdateStatus}
        />
      </div>
    </div>
  );
};

/* ============================================================
   Main Page
============================================================ */
const AdminServiceRequestsPage = () => {
  const {
    services,
    servicePersons,
    loading,
    acceptService,
    assignServicePerson,
    updateServiceStatus,
    refreshServices,
  } = useAdmin();

  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [assignModal, setAssignModal] = useState(null);

  const [actionLoading, setActionLoading] = useState(null);
  const [actionError, setActionError] = useState("");

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

  const handleAccept = async (serviceId) => {
    setActionLoading(serviceId);
    setActionError("");
    try {
      await acceptService(serviceId);
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setActionLoading(null);
    }
  };

  const handleAssign = async (serviceId, servicePersonId) => {
    await assignServicePerson(serviceId, servicePersonId);
  };

  if (loading && services.length === 0) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Wrench}
        title="Service Requests"
        subtitle={`${services.length} total bookings across the fleet`}
      />

      {actionError && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {actionError}
        </div>
      )}

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
            {STATUS_FILTER_OPTIONS.map((s) => (
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
          <div className="text-center py-12">
            <p className="text-sm text-[#747B83]">No service requests found.</p>
          </div>
        ) : (
          filtered.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              onAccept={handleAccept}
              onAssign={setAssignModal}
              onUpdateStatus={updateServiceStatus}
            />
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
                  <td
                    colSpan="9"
                    className="px-5 py-12 text-center text-[#747B83]"
                  >
                    No service requests match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((service) => (
                  <tr
                    key={service.id}
                    className="hover:bg-[#F5F1E7]/50 transition-colors"
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
                        {service.center || service.battery?.location || "—"}
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
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            navigate(`/admin/services/${service.id}`)
                          }
                          className="p-1.5 rounded-lg bg-[#F5F1E7] text-[#16263A] hover:bg-[#E7E1D3] transition-colors"
                          title="View details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {service.status === "Confirmed" && (
                          <button
                            type="button"
                            onClick={() => handleAccept(service.id)}
                            disabled={actionLoading === service.id}
                            className="p-1.5 rounded-lg bg-green-100 text-green-700 border border-green-200 hover:bg-green-200 transition-colors disabled:opacity-50"
                            title="Accept request"
                          >
                            {actionLoading === service.id ? (
                              <span className="w-3.5 h-3.5 border-2 border-green-400 border-t-green-800 rounded-full animate-spin inline-block" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}

                        {service.status === "Accepted" && (
                          <button
                            type="button"
                            onClick={() => setAssignModal(service)}
                            className="p-1.5 rounded-lg bg-violet-100 text-violet-700 border border-violet-200 hover:bg-violet-200 transition-colors"
                            title="Assign service person"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <StatusDropdown
                          service={service}
                          statuses={STATUS_FILTER_OPTIONS.filter(
                            (s) => s !== "All"
                          )}
                          onUpdate={updateServiceStatus}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Assign modal */}
      {assignModal && (
        <AssignModal
          service={assignModal}
          servicePersons={servicePersons}
          onAssign={handleAssign}
          onClose={() => setAssignModal(null)}
        />
      )}
    </div>
  );
};

export default AdminServiceRequestsPage;