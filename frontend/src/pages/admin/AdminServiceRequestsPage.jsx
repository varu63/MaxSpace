import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Eye,
  CheckCircle2,
  UserPlus,
  ChevronDown,
  ChevronUp,
  Filter,
  X,
  AlertCircle,
  Wrench,
  User,
  Battery,
  MapPin,
  Calendar,
  HardHat,
  FileText,
  BadgeCheck,
  Activity,
  XCircle,
  History,
} from "lucide-react";

import { useAdmin } from "../../context/AdminContext";
import { PageHeader, Card, EmptyState, Pagination } from "../../components/common";
import { Modal } from "../../components/common/Modal";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import StatusBadge from "../../components/admin/StatusBadge";
import {
  SERVICE_STATUS_FLOW,
  formatDate,
} from "../../components/admin/adminUtils";
import { getErrorMessage, fetchAdminServicesPaginated } from "../../services/adminApi";

/* ============================================================
   STATUS FILTER OPTIONS (page-specific)
   The visible filter set for the admin Service Requests list.
   "Waiting for Admin Approval" requests are still visible under
   "All" and keep their Approve Completion action.
============================================================ */
const ADMIN_STATUS_FILTER_OPTIONS = [
  "All",
  "Confirmed",
  "Accepted",
  "Assigned",
  "On The Way",
  "In Progress",
  "Completed",
  "Cancelled",
];

const ADMIN_STATUS_TABS = [
  "All",
  "Confirmed",
  "Accepted",
  "Assigned",
  "On The Way",
  "In Progress",
  "Completed",
];

/* ============================================================
   Shared small building blocks for the expandable cards
============================================================ */
const SectionRow = ({ label, value }) => (
  <div className="rounded-xl bg-[#FFFDF8] border border-[#E9E2D0] px-3.5 py-2.5">
    <p className="text-[10px] font-bold uppercase tracking-wider text-[#8A9096]">
      {label}
    </p>
    <p className="text-sm font-semibold text-[#16263A] mt-0.5 break-words">
      {value || "—"}
    </p>
  </div>
);

const ServiceSection = ({ icon: Icon, title, children }) => (
  <div className="rounded-2xl bg-[#F5F1E7] border border-[#E7E1D3] p-4">
    <div className="flex items-center gap-2.5 mb-3">
      <div className="w-8 h-8 rounded-lg bg-[#173B5C] flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-white" />
      </div>
      <h4 className="text-xs font-bold uppercase tracking-wide text-[#16263A]">
        {title}
      </h4>
    </div>
    <div className="space-y-2">{children}</div>
  </div>
);

/* ============================================================
   Service Progress Timeline (compact, responsive)
   Vertical list derived from the shared SERVICE_STATUS_FLOW with
   the real timestamps from the service history where available.
============================================================ */
const ServiceProgressTimeline = ({ service }) => {
  const flow = SERVICE_STATUS_FLOW;
  const history = service.history || [];
  const isCancelled = service.status === "Cancelled";
  const currentIdx = flow.indexOf(service.status);

  const timestamps = {};
  history.forEach((entry) => {
    if (entry.status && !timestamps[entry.status]) {
      timestamps[entry.status] = entry.timestamp;
    }
  });

  return (
    <div>
      {flow.map((step, idx) => {
        let state;
        if (isCancelled) {
          state = "pending";
        } else if (idx < currentIdx) {
          state = "done";
        } else if (idx === currentIdx) {
          state = "active";
        } else {
          state = "pending";
        }

        const ts = timestamps[step];

        return (
          <div
            key={step}
            className="flex gap-3 relative"
          >
            {idx < flow.length - 1 && (
              <div className="absolute left-[7px] top-5 w-[2px] h-full bg-[#E7E1D3]" />
            )}
            <div className="relative z-10 shrink-0 mt-0.5">
              <div
                className={`w-4 h-4 rounded-full flex items-center justify-center ${
                  state === "done"
                    ? "bg-green-500"
                    : state === "active"
                    ? "bg-[#173B5C] ring-4 ring-[#173B5C]/20"
                    : "bg-[#E7E1D3]"
                }`}
              >
                {state === "done" && (
                  <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                )}
              </div>
            </div>
            <div className="pb-2.5 min-w-0">
              <p
                className={`text-xs font-bold ${
                  state === "active"
                    ? "text-[#173B5C]"
                    : state === "done"
                    ? "text-[#16263A]"
                    : "text-[#8A9096]"
                }`}
              >
                {step}
              </p>
              <p className="text-[11px] text-[#8A9096] mt-0.5">
                {state === "done" && ts
                  ? formatDate(ts)
                  : state === "active"
                  ? isCancelled
                    ? "Service was cancelled"
                    : "Current operational phase"
                  : "Pending prerequisite steps"}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

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
    <Modal isOpen={true} onClose={onClose}>
      <div className="relative w-full max-w-lg bg-[#FFFDF8] rounded-3xl shadow-xl border border-[#EEE9DA] p-6 sm:p-8">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 w-9 h-9 rounded-xl bg-[#F5F1E7] flex items-center justify-center text-[#16263A] hover:bg-[#E7E1D3] transition-colors"
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3.5 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-[#173B5C] flex items-center justify-center shrink-0">
            <UserPlus className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-lg sm:text-xl text-[#16263A]">
              Assign Battery Technician
            </h3>
            <p className="text-xs text-[#747B83] mt-0.5">
              Ticket {service.ticketNumber} — {service.batteryName}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-5 flex items-start gap-2 rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="mb-6">
          <label className="block text-xs font-bold uppercase tracking-wider text-[#16263A] mb-2">
            Select Battery Technician
          </label>
          <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
            {activePersons.length === 0 ? (
              <div className="rounded-2xl bg-[#FBF1C9] border border-[#F0E6C8] p-5 text-center">
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
                  className={`flex items-center gap-3.5 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    selectedPersonId === person.id
                      ? "border-[#173B5C] bg-[#F8F2DE] ring-1 ring-[#173B5C]"
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
                  <div className="w-9 h-9 rounded-xl bg-[#173B5C] text-[#FBF1C9] flex items-center justify-center text-xs font-black shrink-0">
                    {(person.name || "?")
                      .split(" ")
                      .filter(Boolean)
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase() || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#16263A] truncate">
                      {person.name}
                    </p>
                    <p className="text-[11px] text-[#747B83] truncate">
                      {person.specialization || "—"} · {person.certification || "—"}
                    </p>
                  </div>
                  <span className="text-[11px] font-medium text-[#8A9096] bg-[#FFFDF8] px-2.5 py-1 rounded-lg border border-[#E7E1D3]">
                    {person.assignedServiceCount || 0} assigned
                  </span>
                </label>
              ))
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl bg-[#F5F1E7] text-[#16263A] font-bold text-sm border border-[#E7E1D3] hover:bg-[#E7E1D3] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAssign}
            disabled={submitting || activePersons.length === 0}
            className="flex-1 py-3 rounded-2xl bg-[#173B5C] text-white font-bold text-sm hover:bg-[#102F4A] transition-colors shadow-sm disabled:opacity-60"
          >
            {submitting ? "Assigning…" : "Assign Technician"}
          </button>
        </div>
      </div>
    </Modal>
  );
};

/* ============================================================
   Confirm action modal — accept, reject, or approve
============================================================ */
const CONFIRM_CONFIGS = {
  accept: {
    title: "Accept Service Request",
    description:
      "Accepting this request moves it to the next stage, where you can assign a battery technician.",
    button: "Accept Request",
    icon: BadgeCheck,
    iconBox: "bg-[#173B5C]",
    accent: "bg-[#173B5C] hover:bg-[#102F4A]",
  },
  reject: {
    title: "Reject Service Request",
    description:
      "Rejecting this request marks the ticket as cancelled and notifies the customer. This action cannot be undone.",
    button: "Reject Request",
    icon: XCircle,
    iconBox: "bg-red-600",
    accent: "bg-red-600 hover:bg-red-700",
  },
  approve: {
    title: "Approve Completion",
    description:
      "The battery technician has finished this service. Confirm to mark this service as COMPLETED.",
    button: "Approve Completion",
    icon: BadgeCheck,
    iconBox: "bg-green-600",
    accent: "bg-green-600 hover:bg-green-700",
  },
};

const ConfirmActionModal = ({ service, type, onConfirm, onClose }) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const config = CONFIRM_CONFIGS[type] || CONFIRM_CONFIGS.accept;
  const Icon = config.icon;

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
    <Modal isOpen={true} onClose={onClose}>
      <div className="relative w-full max-w-md bg-[#FFFDF8] rounded-3xl shadow-xl border border-[#EEE9DA] p-6 sm:p-8">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 w-9 h-9 rounded-xl bg-[#F5F1E7] flex items-center justify-center text-[#16263A] hover:bg-[#E7E1D3] transition-colors"
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3.5 mb-5">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${config.iconBox}`}
          >
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-[#16263A]">{config.title}</h3>
            <p className="text-xs text-[#747B83] mt-0.5">
              Ticket {service.ticketNumber}
            </p>
          </div>
        </div>

        <p className="text-sm text-[#747B83] leading-relaxed mb-6">
          {config.description}
        </p>

        {error && (
          <div className="mb-5 flex items-start gap-2 rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl bg-[#F5F1E7] text-[#16263A] font-bold text-sm border border-[#E7E1D3] hover:bg-[#E7E1D3] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className={`flex-1 py-3 rounded-2xl text-white font-bold text-sm transition-colors shadow-sm disabled:opacity-60 ${config.accent}`}
          >
            {submitting ? "Processing…" : config.button}
          </button>
        </div>
      </div>
    </Modal>
  );
};

/* ============================================================
   Expandable Service Request Card
============================================================ */
const ServiceRequestCard = ({
  service,
  onAccept,
  onReject,
  onApprove,
  onAssign,
  onUpdateStatus,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const navigate = useNavigate();

  const battery = service.battery || {};
  const customer = service.customer || {};
  const tech = service.technician || null;
  const history = service.history || [];

  const canCancel =
    !["Completed", "Cancelled", "Confirmed"].includes(service.status);

  const assignedEntry = history.find(
    (h) => h.status === "Assigned" || h.action === "Service Assigned"
  );
  const lastUpdated = history.length
    ? formatDate(history[history.length - 1].timestamp)
    : formatDate(service.createdAt);

  const handleStatusUpdate = async (status) => {
    setStatusUpdating(true);
    try {
      await onUpdateStatus(service.id, status);
      setStatusOpen(false);
    } finally {
      setStatusUpdating(false);
    }
  };

  /* Status-specific primary actions */
  const statusActions = [];
  const actionPrimaryClass =
    "flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-xs font-bold transition-colors shadow-sm";
  const actionNeutralClass =
    "flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors shadow-sm border";

  switch (service.status) {
    case "Confirmed":
      statusActions.push({
        key: "accept",
        node: (
          <button
            key="accept"
            type="button"
            onClick={() => onAccept(service)}
            className={`${actionPrimaryClass} bg-green-600 hover:bg-green-700`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Accept Request
          </button>
        ),
      });
      statusActions.push({
        key: "reject",
        node: (
          <button
            key="reject"
            type="button"
            onClick={() => onReject(service)}
            className={`${actionNeutralClass} bg-[#F5F1E7] text-red-700 border-red-200 hover:bg-red-50`}
          >
            <XCircle className="w-3.5 h-3.5" />
            Reject Request
          </button>
        ),
      });
      break;

    case "Accepted":
      statusActions.push({
        key: "assign",
        node: (
          <button
            key="assign"
            type="button"
            onClick={() => onAssign(service)}
            className={`${actionPrimaryClass} bg-[#B48611] hover:bg-[#9A8240]`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Assign Technician
          </button>
        ),
      });
      break;

    case "Assigned":
      statusActions.push({
        key: "tech",
        node: (
          <button
            key="tech"
            type="button"
            onClick={() => navigate("/admin/service-persons")}
            className={`${actionNeutralClass} bg-[#F5F1E7] text-[#16263A] border-[#E7E1D3] hover:bg-[#E7E1D3]`}
          >
            <HardHat className="w-3.5 h-3.5" />
            View Technician
          </button>
        ),
      });
      statusActions.push({
        key: "track",
        node: (
          <button
            key="track"
            type="button"
            onClick={() => navigate(`/admin/services/${service.id}`)}
            className={`${actionPrimaryClass} bg-[#173B5C] hover:bg-[#102F4A]`}
          >
            <Activity className="w-3.5 h-3.5" />
            Track Service
          </button>
        ),
      });
      break;

    case "On The Way":
    case "In Progress":
      statusActions.push({
        key: "view",
        node: (
          <button
            key="view"
            type="button"
            onClick={() => setExpanded(true)}
            className={`${actionNeutralClass} bg-[#F5F1E7] text-[#16263A] border-[#E7E1D3] hover:bg-[#E7E1D3]`}
          >
            <Eye className="w-3.5 h-3.5" />
            View Details
          </button>
        ),
      });
      statusActions.push({
        key: "track",
        node: (
          <button
            key="track"
            type="button"
            onClick={() => navigate(`/admin/services/${service.id}`)}
            className={`${actionPrimaryClass} bg-[#173B5C] hover:bg-[#102F4A]`}
          >
            <Activity className="w-3.5 h-3.5" />
            Track Progress
          </button>
        ),
      });
      break;

    case "Waiting for Admin Approval":
      statusActions.push({
        key: "approve",
        node: (
          <button
            key="approve"
            type="button"
            onClick={() => onApprove(service)}
            className={`${actionPrimaryClass} bg-green-600 hover:bg-green-700`}
          >
            <BadgeCheck className="w-3.5 h-3.5" />
            Approve Completion
          </button>
        ),
      });
      break;

    case "Completed":
      statusActions.push({
        key: "details",
        node: (
          <button
            key="details"
            type="button"
            onClick={() => setExpanded(true)}
            className={`${actionPrimaryClass} bg-[#173B5C] hover:bg-[#102F4A]`}
          >
            <Eye className="w-3.5 h-3.5" />
            View Service Details
          </button>
        ),
      });
      statusActions.push({
        key: "history",
        node: (
          <button
            key="history"
            type="button"
            onClick={() => navigate(`/admin/services/${service.id}`)}
            className={`${actionNeutralClass} bg-[#F5F1E7] text-[#16263A] border-[#E7E1D3] hover:bg-[#E7E1D3]`}
          >
            <History className="w-3.5 h-3.5" />
            View Service History
          </button>
        ),
      });
      break;

    default:
      break;
  }

  return (
    <Card padded={false} className="overflow-hidden">
      {/* ── Card header ─────────────────────────────── */}
      <div className="p-6 lg:p-7 border-b border-[#EEE9DA]">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-[#173B5C] flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="font-mono text-sm font-bold text-[#173B5C]">
                {service.ticketNumber}
              </p>
              <p className="text-xs text-[#8A9096] mt-0.5">
                Request ID: {service.id} · Created {formatDate(service.createdAt)}
              </p>
            </div>
          </div>
          <StatusBadge status={service.status} />
        </div>
      </div>

      {/* ── Collapsed summary ───────────────────────── */}
      <div className="p-6 lg:p-7">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="flex items-start gap-3 rounded-2xl bg-[#F5F1E7] border border-[#E7E1D3] p-4">
            <User className="w-4 h-4 text-[#B48611] shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#8A9096]">
                Customer
              </p>
              <p className="text-sm font-semibold text-[#16263A] truncate mt-0.5">
                {customer.name || "—"}
              </p>
              <p className="text-[11px] text-[#8A9096] truncate">
                {customer.email || "—"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl bg-[#F5F1E7] border border-[#E7E1D3] p-4">
            <Battery className="w-4 h-4 text-[#B48611] shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#8A9096]">
                Battery
              </p>
              <p className="text-sm font-semibold text-[#16263A] truncate mt-0.5">
                {battery.modelName || battery.name || service.batteryName || "—"}
              </p>
              <p className="text-[11px] text-[#8A9096] font-mono truncate">
                {service.batteryId}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl bg-[#F5F1E7] border border-[#E7E1D3] p-4 sm:col-span-2">
            <Wrench className="w-4 h-4 text-[#B48611] shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#8A9096]">
                Service Type
              </p>
              <p className="text-sm font-semibold text-[#16263A] truncate mt-0.5">
                {service.serviceType}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl bg-[#F5F1E7] border border-[#E7E1D3] p-4">
            <Calendar className="w-4 h-4 text-[#B48611] shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#8A9096]">
                Scheduled
              </p>
              <p className="text-sm font-semibold text-[#16263A] mt-0.5">
                {formatDate(service.scheduledDate)}
                <span className="block text-[11px] text-[#8A9096] font-normal">
                  {service.scheduledTime}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Expanded details ────────────────────────── */}
      {expanded && (
        <div className="px-6 lg:px-7 pb-6 lg:pb-7 pt-0">
          <div className="border-t border-[#EEE9DA] pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Customer Information */}
              <ServiceSection icon={User} title="Customer Information">
                <SectionRow label="Customer Name" value={customer.name} />
                <SectionRow label="Customer Email" value={customer.email} />
                <SectionRow
                  label="Customer Phone"
                  value={customer.phone || service.mobileNumber}
                />
              </ServiceSection>

              {/* Battery Information */}
              <ServiceSection icon={Battery} title="Battery Information">
                <SectionRow label="Battery ID" value={service.batteryId} />
                <SectionRow
                  label="Battery Model"
                  value={battery.modelName || battery.name || service.batteryName}
                />
                <SectionRow label="Battery Type" value={battery.type} />
                <SectionRow label="Battery Chemistry" value={battery.chemistry} />
                <SectionRow
                  label="Serial Number"
                  value={battery.serialNumber}
                />
              </ServiceSection>

              {/* Service Information */}
              <ServiceSection icon={Wrench} title="Service Information">
                <SectionRow label="Service Type" value={service.serviceType} />
                <SectionRow
                  label="Service Description"
                  value={service.notes || service.description}
                />
                <SectionRow
                  label="Request Date"
                  value={formatDate(service.createdAt)}
                />
                <SectionRow
                  label="Scheduled Date"
                  value={`${formatDate(service.scheduledDate)}${
                    service.scheduledTime
                      ? ` · ${service.scheduledTime}`
                      : ""
                  }`}
                />
                <SectionRow
                  label="Warranty Status"
                  value={battery.warranty?.status}
                />
              </ServiceSection>

              {/* Service Location */}
              <ServiceSection icon={MapPin} title="Service Location">
                <SectionRow label="Service Location" value={service.center} />
                <SectionRow
                  label="Address / City, Country"
                  value={battery.location || battery.assemblyLocation}
                />
              </ServiceSection>

              {/* Technician Information */}
              <ServiceSection icon={HardHat} title="Technician Information">
                <SectionRow
                  label="Assigned Technician"
                  value={tech?.name || service.technician || "Not yet assigned"}
                />
                <SectionRow label="Technician ID" value={tech?.technicianId} />
                <SectionRow
                  label="Technician Contact"
                  value={tech?.phone || tech?.email}
                />
                <SectionRow
                  label="Assignment Date"
                  value={
                    assignedEntry ? formatDate(assignedEntry.timestamp) : ""
                  }
                />
              </ServiceSection>

              {/* Service Progress */}
              <ServiceSection icon={Activity} title="Service Progress">
                <div className="rounded-xl bg-[#FFFDF8] border border-[#E9E2D0] px-3.5 py-2.5 flex items-center justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#8A9096]">
                    Current Status
                  </p>
                  <StatusBadge status={service.status} />
                </div>
                <SectionRow label="Last Updated" value={lastUpdated} />
                <div className="rounded-xl bg-[#FFFDF8] border border-[#E9E2D0] px-3.5 py-3 mt-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#8A9096] mb-2.5">
                    Status Timeline
                  </p>
                  <ServiceProgressTimeline service={service} />
                </div>
              </ServiceSection>
            </div>
          </div>
        </div>
      )}

      {/* ── Card footer — actions ───────────────────── */}
      <div className="px-6 lg:px-7 py-4 border-t border-[#EEE9DA] bg-[#FBF8F0]/60">
        <div className="flex items-center gap-2.5 flex-wrap">
          {statusActions.map((action) => action.node)}

          {canCancel && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setStatusOpen(!statusOpen)}
                disabled={statusUpdating}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#F5F1E7] text-[#16263A] border border-[#E7E1D3] text-xs font-bold hover:bg-[#E7E1D3] transition-colors disabled:opacity-60"
              >
                More
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${
                    statusOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {statusOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setStatusOpen(false)}
                  />
                  <div className="absolute right-0 mt-1 w-48 bg-[#FFFDF8] border border-[#EEE9DA] rounded-2xl shadow-lg z-40 py-1.5 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => {
                        handleStatusUpdate("Cancelled").catch(() => {});
                      }}
                      disabled={statusUpdating}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-red-700 hover:bg-red-50 transition-colors disabled:opacity-60"
                    >
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      Cancel Service
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="ml-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#F5F1E7] text-[#16263A] border border-[#E7E1D3] text-xs font-bold hover:bg-[#E7E1D3] transition-colors"
          >
            {expanded ? "Hide Details" : "View Details"}
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
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
    servicePersons,
    loading: contextLoading,
    acceptService,
    assignServicePerson,
    updateServiceStatus,
    approveServiceCompletion,
  } = useAdmin();

  const [actionError, setActionError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [services, setServices] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(false);
  const [assignModal, setAssignModal] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);

  /* Server-side fetch — the backend applies search + status filters and
     returns the standard { data, pagination } envelope. */
  const fetchPage = async (nextPage = 1, opts = {}) => {
    setLoading(true);
    try {
      const result = await fetchAdminServicesPaginated({
        page: nextPage,
        limit: 10,
        status: opts.status !== undefined ? opts.status : statusFilter === "All" ? "" : statusFilter,
        search: opts.search !== undefined ? opts.search : search,
      });
      setServices(result.data || []);
      setPagination(result.pagination || null);
      setPage(nextPage);
      setActionError("");
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search → reset to page 1.
  useEffect(() => {
    const timer = setTimeout(() => fetchPage(1, { search }), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const handleStatusFilterChange = (status) => {
    setStatusFilter(status);
    fetchPage(1, { status: status === "All" ? "" : status });
  };

  const handlePageChange = (nextPage) => fetchPage(nextPage);

  const handleAccept = async (service) => {
    setActionError("");
    setConfirmModal({ type: "accept", service });
  };

  const handleReject = async (service) => {
    setActionError("");
    setConfirmModal({ type: "reject", service });
  };

  const handleApprove = async (service) => {
    setActionError("");
    setConfirmModal({ type: "approve", service });
  };

  const reloadAfterAction = async () => fetchPage(page);

  const confirmAccept = async () => {
    const svc = confirmModal?.service;
    if (!svc) return;
    await acceptService(svc.id);
  };

  const confirmReject = async () => {
    const svc = confirmModal?.service;
    if (!svc) return;
    await updateServiceStatus(svc.id, "Cancelled");
  };

  const confirmApprove = async () => {
    const svc = confirmModal?.service;
    if (!svc) return;
    await approveServiceCompletion(svc.id);
  };

  const handleAssign = async (serviceId, servicePersonId) => {
    await assignServicePerson(serviceId, servicePersonId);
  };

  const handleUpdateStatus = async (serviceId, status) => {
    setActionError("");
    try {
      await updateServiceStatus(serviceId, status);
    } catch (err) {
      setActionError(getErrorMessage(err));
      throw err;
    }
  };

  if ((loading || contextLoading) && services.length === 0) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        icon={Wrench}
        title="Service Requests"
        subtitle={`${pagination?.total ?? services.length} total service request${
          (pagination?.total ?? services.length) === 1 ? "" : "s"
        } across the fleet`}
      />

      {actionError && (
        <div className="flex items-center gap-2 rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {actionError}
        </div>
      )}

      {/* Filters Card */}
      <Card padded={false} className="p-5 lg:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A9096]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ticket, battery, customer…"
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
              onChange={(e) => handleStatusFilterChange(e.target.value)}
              className="w-full bg-transparent text-sm font-medium text-[#16263A] focus:outline-none cursor-pointer"
            >
              {ADMIN_STATUS_FILTER_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s === "All" ? "All Statuses" : s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#EEE9DA]/60">
          <span className="text-xs font-semibold text-[#747B83] mr-1">
            Filter:
          </span>
          {ADMIN_STATUS_TABS.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => handleStatusFilterChange(status)}
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

      {/* Service request cards — all screen sizes */}
      {services.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No Service Requests Found"
          description={
            search || statusFilter !== "All"
              ? "No service requests match your current filters."
              : "New customer service requests will appear here."
          }
        />
      ) : (
        <div className="space-y-4">
          {services.map((service) => (
            <ServiceRequestCard
              key={service.id}
              service={service}
              onAccept={handleAccept}
              onReject={handleReject}
              onApprove={handleApprove}
              onAssign={setAssignModal}
              onUpdateStatus={handleUpdateStatus}
            />
          ))}
        </div>
      )}

      <Pagination pagination={pagination} onPageChange={handlePageChange} />

      {/* Assign modal */}
      {assignModal && (
        <AssignModal
          service={assignModal}
          servicePersons={servicePersons}
          onAssign={async (serviceId, personId) => {
            await handleAssign(serviceId, personId);
            reloadAfterAction();
          }}
          onClose={() => setAssignModal(null)}
        />
      )}

      {/* Confirm action modal */}
      {confirmModal && (
        <ConfirmActionModal
          service={confirmModal.service}
          type={confirmModal.type}
          onConfirm={
            confirmModal.type === "approve"
              ? confirmApprove
              : confirmModal.type === "reject"
              ? confirmReject
              : confirmAccept
          }
          onClose={() => setConfirmModal(null)}
        />
      )}
    </div>
  );
};

export default AdminServiceRequestsPage;