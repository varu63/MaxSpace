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
  User,
  MapPin,
  Calendar,
  HardHat,
  FileText,
  BadgeCheck,
} from "lucide-react";

import { useAdmin } from "../../context/AdminContext";
import { PageHeader, Card, EmptyState } from "../../components/common";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import StatusBadge from "../../components/admin/StatusBadge";
import {
  formatDate,
} from "../../components/admin/adminUtils";
import { getErrorMessage } from "../../services/adminApi";
import { STATUS_FILTER_OPTIONS } from "../../data/serviceStatuses";

/* ============================================================
   Assign Battery Technician Modal
============================================================ */
const AssignModal = ({ service, servicePersons, onAssign, onClose }) => {
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const activePersons = servicePersons.filter((p) => p.status === "active");

  const handleAssign = async () => {
    if (!selectedPersonId) {
          setError("Please select a battery technician.");
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
              Assign Battery Technician
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
            Battery Technician
          </label>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {activePersons.length === 0 ? (
              <div className="rounded-xl bg-[#FBF1C9] border border-[#F0E6C8] p-4 text-center">
                <p className="text-sm font-bold text-[#A77A08]">
                  No active battery technicians available.
                </p>
                <p className="text-xs text-[#8A7A4A] mt-1">
                  Add a technician in "Battery Technicians" first.
                </p>
              </div>
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
   Admin Control Modals
============================================================ */
const ConfirmActionModal = ({ service, type, onConfirm, onClose }) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isAccept = type === "accept";
  const isApprove = type === "approve";

  const title = isAccept ? "Accept Service Request" : isApprove ? "Approve Completion" : "";
  const description = isAccept
    ? "Accepting this request moves it to the next stage, where you can assign a battery technician."
    : isApprove
    ? "The battery technician has finished this service. Confirm to mark this service as COMPLETED."
    : "";

  const handleConfirm = async () => {
    setSubmitting(true);
    setError("");
    try {
      await onConfirm();
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
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
              isApprove ? "bg-green-600" : "bg-[#173B5C]"
            }`}
          >
            <BadgeCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-[#16263A]">{title}</h3>
            <p className="text-xs text-[#747B83]">
              Ticket {service.ticketNumber}
            </p>
          </div>
        </div>

        <p className="text-sm text-[#16263A] mb-4">{description}</p>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

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
            onClick={handleConfirm}
            disabled={submitting}
            className={`flex-1 py-2.5 rounded-xl text-white font-bold text-sm transition-colors disabled:opacity-60 ${
              isApprove
                ? "bg-green-600 hover:bg-green-700"
                : "bg-[#173B5C] hover:bg-[#102F4A]"
            }`}
          >
            {submitting
              ? "Processing…"
              : isApprove
              ? "Approve Completion"
              : "Accept Request"}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ============================================================
   Admin "View All" action button (opens full record)
============================================================ */
const ViewAllButton = ({ service }) => {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(`/admin/services/${service.id}`)}
      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#173B5C] text-white text-xs font-bold hover:bg-[#102F4A] transition-colors"
    >
      <Eye className="w-3.5 h-3.5" />
      View All
    </button>
  );
};

/* ============================================================
   Service Card — shown on ALL screen sizes
============================================================ */
const ServiceCard = ({ service, onAccept, onApprove, onAssign, onUpdateStatus }) => {
  const [statusOpen, setStatusOpen] = useState(false);

  const canCancel = !["Completed", "Cancelled"].includes(service.status);

  const handleStatusUpdate = async (status) => {
    await onUpdateStatus(service.id, status);
    setStatusOpen(false);
  };

  return (
    <Card padded={false} className="overflow-hidden">
      {/* Card header */}
      <div className="p-5 sm:p-6 border-b border-[#EEE9DA]">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#173B5C] flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="font-mono text-xs font-bold text-[#173B5C]">
                {service.ticketNumber}
              </p>
              <p className="text-[11px] text-[#8A9096]">
                Request ID: {service.id} · Created {formatDate(service.createdAt)}
              </p>
            </div>
          </div>
          <StatusBadge status={service.status} />
        </div>
      </div>

      {/* Card body — key info only */}
      <div className="p-5 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Customer */}
          <div className="flex items-start gap-2.5 rounded-xl bg-[#F5F1E7] border border-[#E7E1D3] p-3">
            <User className="w-4 h-4 text-[#B48611] shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#8A9096]">
                Customer
              </p>
              <p className="text-sm font-semibold text-[#16263A] truncate">
                {service.customer?.name || "—"}
              </p>
            </div>
          </div>

          {/* Battery */}
          <div className="flex items-start gap-2.5 rounded-xl bg-[#F5F1E7] border border-[#E7E1D3] p-3">
            <Wrench className="w-4 h-4 text-[#B48611] shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#8A9096]">
                Battery
              </p>
              <p className="text-sm font-semibold text-[#16263A] truncate">
                {service.battery?.modelName || service.batteryName || "—"}
              </p>
              <p className="text-[11px] text-[#8A9096] font-mono truncate">
                {service.batteryId}
              </p>
            </div>
          </div>

          {/* Service type */}
          <div className="flex items-start gap-2.5 rounded-xl bg-[#F5F1E7] border border-[#E7E1D3] p-3 sm:col-span-2">
            <Wrench className="w-4 h-4 text-[#B48611] shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#8A9096]">
                Service Type
              </p>
              <p className="text-sm font-semibold text-[#16263A] truncate">
                {service.serviceType}
              </p>
            </div>
          </div>

          {/* Location */}
          <div className="flex items-start gap-2.5 rounded-xl bg-[#F5F1E7] border border-[#E7E1D3] p-3">
            <MapPin className="w-4 h-4 text-[#B48611] shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#8A9096]">
                Service Location
              </p>
              <p className="text-sm font-semibold text-[#16263A] truncate">
                {service.center || service.battery?.location || "—"}
              </p>
            </div>
          </div>

          {/* Scheduled */}
          <div className="flex items-start gap-2.5 rounded-xl bg-[#F5F1E7] border border-[#E7E1D3] p-3">
            <Calendar className="w-4 h-4 text-[#B48611] shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#8A9096]">
                Scheduled
              </p>
              <p className="text-sm font-semibold text-[#16263A]">
                {formatDate(service.scheduledDate)}
                <span className="block text-[11px] text-[#8A9096] font-normal">
                  {service.scheduledTime}
                </span>
              </p>
            </div>
          </div>

          {/* Technician */}
          <div className="flex items-start gap-2.5 rounded-xl bg-[#F5F1E7] border border-[#E7E1D3] p-3 sm:col-span-2">
            <HardHat className="w-4 h-4 text-[#B48611] shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#8A9096]">
                Battery Technician
              </p>
              <p className="text-sm font-semibold text-[#16263A] truncate">
                {service.technician || "Not yet assigned"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Card footer — actions */}
      <div className="px-5 sm:px-6 py-4 border-t border-[#EEE9DA] bg-[#FBF8F0]/60">
        <div className="flex items-center gap-2 flex-wrap">
          <ViewAllButton service={service} />

          {service.status === "Confirmed" && (
            <button
              type="button"
              onClick={() => onAccept(service)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-green-600 text-white text-xs font-bold hover:bg-green-700 transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Accept
            </button>
          )}

          {service.status === "Accepted" && (
            <button
              type="button"
              onClick={() => onAssign(service)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#B48611] text-white text-xs font-bold hover:bg-[#9A8240] transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Assign
            </button>
          )}

          {service.status === "Waiting for Admin Approval" && (
            <button
              type="button"
              onClick={() => onApprove(service)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-green-600 text-white text-xs font-bold hover:bg-green-700 transition-colors"
            >
              <BadgeCheck className="w-3.5 h-3.5" />
              Approve Completion
            </button>
          )}

          {canCancel && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setStatusOpen(!statusOpen)}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-[#F5F1E7] text-[#16263A] border border-[#E7E1D3] text-xs font-bold hover:bg-[#E7E1D3] transition-colors"
              >
                More
                <ChevronDown className={`w-3 h-3 transition-transform ${statusOpen ? "rotate-180" : ""}`} />
              </button>

              {statusOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setStatusOpen(false)}
                  />
                  <div className="absolute right-0 mt-1 w-48 bg-[#FFFDF8] border border-[#EEE9DA] rounded-xl shadow-lg z-40 py-1">
                    <button
                      type="button"
                      onClick={() => handleStatusUpdate("Cancelled")}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 transition-colors"
                    >
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      Cancel Service
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
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
    approveServiceCompletion,
    refreshServices,
  } = useAdmin();

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
          (s.id || "").toLowerCase().includes(q) ||
          (s.batteryName || "").toLowerCase().includes(q) ||
          (s.battery?.modelName || "").toLowerCase().includes(q) ||
          (s.batteryId || "").toLowerCase().includes(q) ||
          (s.serviceType || "").toLowerCase().includes(q) ||
          (s.customer?.name || "").toLowerCase().includes(q) ||
          (s.center || "").toLowerCase().includes(q)
      );
    }

    return list;
  }, [services, search, statusFilter]);

  const handleAccept = async (service) => {
    setActionError("");
    setConfirmModal({ type: "accept", service });
  };

  const confirmAccept = async () => {
    const svc = confirmModal?.service;
    if (!svc) return;
    try {
      await acceptService(svc.id);
    } catch (err) {
      setActionError(getErrorMessage(err));
    }
  };

  const handleApprove = async (service) => {
    setActionError("");
    setConfirmModal({ type: "approve", service });
  };

  const confirmApprove = async () => {
    const svc = confirmModal?.service;
    if (!svc) return;
    try {
      await approveServiceCompletion(svc.id);
    } catch (err) {
      setActionError(getErrorMessage(err));
    }
  };

  const handleAssign = async (serviceId, servicePersonId) => {
    await assignServicePerson(serviceId, servicePersonId);
  };

  if (loading && services.length === 0) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        icon={Wrench}
        title="Service Records"
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

      {/* Service cards — all screen sizes */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No Service Records Found"
          description={
            search || statusFilter !== "All"
              ? "No services match your current filters."
              : "New customer service requests will appear here."
          }
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              onAccept={handleAccept}
              onApprove={handleApprove}
              onAssign={setAssignModal}
              onUpdateStatus={updateServiceStatus}
            />
          ))}
        </div>
      )}

      {/* Assign modal */}
      {assignModal && (
        <AssignModal
          service={assignModal}
          servicePersons={servicePersons}
          onAssign={handleAssign}
          onClose={() => setAssignModal(null)}
        />
      )}

      {/* Confirm action modal */}
      {confirmModal && (
        <ConfirmActionModal
          service={confirmModal.service}
          type={confirmModal.type}
          onConfirm={confirmModal.type === "approve" ? confirmApprove : confirmAccept}
          onClose={() => setConfirmModal(null)}
        />
      )}
    </div>
  );
};

export default AdminServiceRequestsPage;