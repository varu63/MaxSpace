import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  User,
  Battery,
  MapPin,
  Calendar,
  CheckCircle2,
  UserPlus,
  AlertCircle,
  BadgeCheck,
  Phone,
  Mail,
  Hash,
  Zap,
  Gauge,
  TrendingUp,
  Wrench,
  Activity,
  Circle,
  X,
} from "lucide-react";

import { useAdmin } from "../../context/AdminContext";
import { fetchAdminService, getErrorMessage } from "../../services/adminApi";
import { Card } from "../../components/common";
import { Modal } from "../../components/common/Modal";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import StatusBadge from "../../components/admin/StatusBadge";
import {
  SERVICE_STATUS_FLOW,
  statusLabel,
  formatDate,
} from "../../components/admin/adminUtils";

const AdminServiceDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { servicePersons, acceptService, assignServicePerson, updateServiceStatus, approveServiceCompletion } = useAdmin();

  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    const loadService = async () => {
      try {
        const data = await fetchAdminService(id);
        setService(data);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    loadService();
  }, [id]);

  const timeline = useMemo(() => {
    if (!service) return [];
    const flow = SERVICE_STATUS_FLOW;
    const currentIdx = flow.indexOf(service.status);
    const isCancelled = service.status === "Cancelled";

    return flow.map((step, idx) => {
      let state;
      if (isCancelled) {
        state = idx === 0 ? "done" : "pending";
        if (service.status === step) state = "done";
      } else {
        if (idx < currentIdx) state = "done";
        else if (idx === currentIdx) state = "active";
        else state = "pending";
      }
      return { step, state };
    });
  }, [service]);

  const handleAccept = async () => {
    if (!service) return;
    setActionLoading("accept");
    try {
      const updated = await acceptService(service.id);
      setService((prev) => ({ ...prev, ...updated }));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading("");
    }
  };

  const handleAssign = async () => {
    if (!selectedPersonId || !service) return;
    setActionLoading("assign");
    try {
      const updated = await assignServicePerson(service.id, selectedPersonId);
      setService((prev) => ({ ...prev, ...updated }));
      setAssignOpen(false);
      setSelectedPersonId("");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading("");
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (!service) return;
    setActionLoading("status");
    try {
      const updated = await updateServiceStatus(service.id, newStatus);
      setService((prev) => ({ ...prev, ...updated }));
      setConfirmCancel(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading("");
    }
  };

  const handleApprove = async () => {
    if (!service) return;
    setActionLoading("approve");
    try {
      const updated = await approveServiceCompletion(service.id);
      setService((prev) => ({ ...prev, ...updated }));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading("");
    }
  };

  const activePersons = servicePersons.filter((sp) => sp.status === "active");

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error && !service) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
        <p className="text-sm text-red-700">{error}</p>
        <button
          type="button"
          onClick={() => navigate("/admin/services")}
          className="mt-4 text-sm font-bold text-[#173B5C] hover:text-[#B48611] transition-colors"
        >
          ← Back to Service Requests
        </button>
      </div>
    );
  }

  if (!service) return null;

  return (
    <div className="space-y-6">
      {/* Back button + header */}
      <div>
        <button
          type="button"
          onClick={() => navigate("/admin/services")}
          className="inline-flex items-center gap-2 text-sm font-bold text-[#173B5C] hover:text-[#B48611] mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Service Requests
        </button>

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl lg:text-3xl font-bold text-[#16263A]">
                {service.ticketNumber}
              </h1>
              <StatusBadge status={service.status} />
            </div>
            <p className="text-sm text-[#747B83] mt-1">
              {service.serviceType} · Request ID: <span className="font-mono">{service.id}</span>
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            {service.status === "Confirmed" && (
              <button
                type="button"
                onClick={handleAccept}
                disabled={actionLoading === "accept"}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-green-600 text-white font-bold text-sm hover:bg-green-700 transition-colors shadow-sm disabled:opacity-60"
              >
                {actionLoading === "accept" ? (
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Accept Request
              </button>
            )}

            {service.status === "Accepted" && (
              <button
                type="button"
                onClick={() => setAssignOpen(true)}
                disabled={actionLoading === "assign"}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#B48611] text-white font-bold text-sm hover:bg-[#9A8240] transition-colors shadow-sm disabled:opacity-60"
              >
                <UserPlus className="w-4 h-4" />
                Assign Battery Technician
              </button>
            )}

            {service.status === "Waiting for Admin Approval" && (
              <button
                type="button"
                onClick={handleApprove}
                disabled={actionLoading === "approve"}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-green-600 text-white font-bold text-sm hover:bg-green-700 transition-colors shadow-sm disabled:opacity-60"
              >
                {actionLoading === "approve" ? (
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <BadgeCheck className="w-4 h-4" />
                )}
                Approve Completion
              </button>
            )}

            {service.status !== "Completed" &&
              service.status !== "Cancelled" &&
              service.status !== "Confirmed" &&
              service.status !== "Accepted" &&
              service.status !== "Waiting for Admin Approval" && (
                <button
                  type="button"
                  onClick={() => setConfirmCancel(true)}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#F5F1E7] text-red-700 border border-red-200 font-bold text-sm hover:bg-red-50 transition-colors"
                >
                  Cancel Service
                </button>
              )
            }
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
          <button
            type="button"
            onClick={() => setError("")}
            className="ml-auto text-red-500 font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* Service Timeline */}
      <Card padded={false} className="overflow-hidden">
        <div className="p-6 lg:p-7 border-b border-[#EEE9DA]">
          <h2 className="font-bold text-lg text-[#16263A] flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-[#B48611]" />
            Service Lifecycle Timeline
          </h2>
          <p className="text-xs text-[#747B83] mt-0.5">
            Track real-time status progression from booking through completion
          </p>
        </div>
        <div className="p-6 lg:p-8">
          <div className="space-y-0">
            {timeline.map((item, idx) => {
              return (
                <div key={item.step} className="flex gap-4 relative">
                  {/* Vertical line */}
                  {idx < timeline.length - 1 && (
                    <div className="absolute left-[11px] top-6 w-[2px] h-full bg-[#E7E1D3]" />
                  )}

                  {/* Dot */}
                  <div className="relative z-10 shrink-0 mt-0.5">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        item.state === "done"
                          ? "bg-green-500 text-white"
                          : item.state === "active"
                          ? "bg-[#173B5C] text-white ring-4 ring-[#173B5C]/20"
                          : "bg-[#E7E1D3] text-[#8A9096]"
                      }`}
                    >
                      {item.state === "done" ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <Circle
                          className={`w-2 h-2 ${
                            item.state === "active"
                              ? "fill-white text-white"
                              : "fill-[#8A9096] text-[#8A9096]"
                          }`}
                        />
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="pb-8 min-w-0">
                    <p
                      className={`text-sm font-bold ${
                        item.state === "active"
                          ? "text-[#173B5C]"
                          : item.state === "done"
                          ? "text-[#16263A]"
                          : "text-[#8A9096]"
                      }`}
                    >
                      {statusLabel(item.step)}
                    </p>
                    <p className="text-xs text-[#8A9096] mt-0.5">
                      {item.state === "done" && "Step completed successfully"}
                      {item.state === "active" && "Current operational phase"}
                      {item.state === "pending" && "Pending prerequisite steps"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Info grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Customer Information */}
        <Card padded={false} className="overflow-hidden">
          <div className="p-6 border-b border-[#EEE9DA]">
            <h2 className="font-bold text-lg text-[#16263A] flex items-center gap-2.5">
              <User className="w-5 h-5 text-[#B48611]" />
              Customer Information
            </h2>
          </div>
          <div className="p-6 space-y-3">
            {[
              { label: "Name", value: service.customer?.name || "—", icon: User },
              { label: "Email", value: service.customer?.email || "—", icon: Mail },
              { label: "Phone", value: service.mobileNumber || "—", icon: Phone },
              { label: "Location", value: service.center || "—", icon: MapPin },
            ].map((row) => {
              const Icon = row.icon;
              return (
                <div
                  key={row.label}
                  className="rounded-2xl bg-[#F5F1E7] border border-[#E7E1D3] p-3.5 flex items-center gap-3.5"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#FFFDF8] border border-[#E7E1D3] flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-[#173B5C]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#8A9096]">
                      {row.label}
                    </p>
                    <p className="text-sm font-semibold text-[#16263A] truncate mt-0.5">
                      {row.value}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Battery Information */}
        <Card padded={false} className="overflow-hidden">
          <div className="p-6 border-b border-[#EEE9DA]">
            <h2 className="font-bold text-lg text-[#16263A] flex items-center gap-2.5">
              <Battery className="w-5 h-5 text-[#B48611]" />
              Battery Information
            </h2>
          </div>
          <div className="p-6 space-y-3">
            {[
              { label: "Model", value: service.battery?.modelName || service.batteryName || "—", icon: Battery },
              { label: "Chemistry", value: service.battery?.chemistry || "—", icon: Zap },
              { label: "Barcode / Serial", value: service.battery?.barcode || service.batteryId || "—", icon: Hash },
              { label: "Capacity", value: service.battery?.capacityKwh ? `${service.battery.capacityKwh} kWh` : "—", icon: Gauge },
              { label: "Health (SoH)", value: service.battery?.stateOfHealth ? `${service.battery.stateOfHealth}%` : "—", icon: TrendingUp },
              { label: "Location", value: service.battery?.location || "—", icon: MapPin },
            ].map((row) => {
              const Icon = row.icon;
              return (
                <div
                  key={row.label}
                  className="rounded-2xl bg-[#F5F1E7] border border-[#E7E1D3] p-3.5 flex items-center gap-3.5"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#FFFDF8] border border-[#E7E1D3] flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-[#173B5C]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#8A9096]">
                      {row.label}
                    </p>
                    <p className="text-sm font-semibold text-[#16263A] truncate mt-0.5">
                      {row.value}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Service Information */}
        <Card padded={false} className="overflow-hidden">
          <div className="p-6 border-b border-[#EEE9DA]">
            <h2 className="font-bold text-lg text-[#16263A] flex items-center gap-2.5">
              <Wrench className="w-5 h-5 text-[#B48611]" />
              Service Information
            </h2>
          </div>
          <div className="p-6 space-y-3">
            {[
              { label: "Service Type", value: service.serviceType },
              { label: "Priority", value: service.priority || "Normal" },
              { label: "Service Center", value: service.center },
              { label: "Cost", value: service.cost },
              { label: "Technician", value: service.technician || "Not yet assigned" },
              { label: "Notes", value: service.notes || "—" },
            ].map((row) => (
              <div
                key={row.label}
                className="rounded-2xl bg-[#F5F1E7] border border-[#E7E1D3] p-3.5"
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#8A9096]">
                  {row.label}
                </p>
                <p className="text-sm font-semibold text-[#16263A] mt-0.5">
                  {row.value}
                </p>
              </div>
            ))}
          </div>
        </Card>

        {/* Booking Information */}
        <Card padded={false} className="overflow-hidden">
          <div className="p-6 border-b border-[#EEE9DA]">
            <h2 className="font-bold text-lg text-[#16263A] flex items-center gap-2.5">
              <Calendar className="w-5 h-5 text-[#B48611]" />
              Booking Information
            </h2>
          </div>
          <div className="p-6 space-y-3">
            {[
              { label: "Ticket Number", value: service.ticketNumber },
              { label: "Created", value: formatDate(service.createdAt) },
              { label: "Scheduled Date", value: formatDate(service.scheduledDate) },
              { label: "Scheduled Time", value: service.scheduledTime },
              { label: "Current Status", value: statusLabel(service.status) },
              { label: "Battery ID", value: service.batteryId },
            ].map((row) => (
              <div
                key={row.label}
                className="rounded-2xl bg-[#F5F1E7] border border-[#E7E1D3] p-3.5"
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#8A9096]">
                  {row.label}
                </p>
                <p className="text-sm font-semibold text-[#16263A] mt-0.5">
                  {row.value}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Cancel confirmation modal */}
      {confirmCancel && (
        <Modal isOpen={true} onClose={() => setConfirmCancel(false)}>
          <div className="relative w-full max-w-md bg-[#FFFDF8] rounded-3xl shadow-xl border border-[#EEE9DA] p-6 sm:p-8">
            <button
              type="button"
              onClick={() => setConfirmCancel(false)}
              className="absolute top-5 right-5 w-9 h-9 rounded-xl bg-[#F5F1E7] flex items-center justify-center text-[#16263A] hover:bg-[#E7E1D3] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="font-bold text-lg sm:text-xl text-[#16263A] mb-2">
              Cancel Service Request?
            </h3>
            <p className="text-sm text-[#747B83] leading-relaxed mb-6">
              This will cancel ticket {service.ticketNumber}. The customer will
              be notified. This action cannot be undone.
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
                onClick={() => setConfirmCancel(false)}
                className="flex-1 py-3 rounded-2xl bg-[#F5F1E7] text-[#16263A] font-bold text-sm border border-[#E7E1D3] hover:bg-[#E7E1D3] transition-colors"
              >
                Keep Service
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange("Cancelled")}
                disabled={actionLoading === "status"}
                className="flex-1 py-3 rounded-2xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition-colors shadow-sm disabled:opacity-60"
              >
                {actionLoading === "status" ? "Cancelling…" : "Cancel Service"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Assign Modal */}
      {assignOpen && (
        <Modal isOpen={true} onClose={() => setAssignOpen(false)}>
          <div className="relative w-full max-w-md bg-[#FFFDF8] rounded-3xl shadow-xl border border-[#EEE9DA] p-6 sm:p-8">
            <button
              type="button"
              onClick={() => setAssignOpen(false)}
              className="absolute top-5 right-5 w-9 h-9 rounded-xl bg-[#F5F1E7] flex items-center justify-center text-[#16263A] hover:bg-[#E7E1D3] transition-colors"
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
                  Ticket {service.ticketNumber}
                </p>
              </div>
            </div>

            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1 mb-6">
              {activePersons.length === 0 ? (
                <p className="text-sm text-[#747B83] text-center py-6">
                  No active battery technicians found.
                </p>
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
                      name="sp"
                      checked={selectedPersonId === person.id}
                      onChange={() => setSelectedPersonId(person.id)}
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
                      <p className="text-sm font-semibold text-[#16263A]">
                        {person.name}
                      </p>
                      <p className="text-[11px] text-[#747B83]">
                        {person.specialization || "—"}
                      </p>
                    </div>
                  </label>
                ))
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setAssignOpen(false)}
                className="flex-1 py-3 rounded-2xl bg-[#F5F1E7] text-[#16263A] font-bold text-sm border border-[#E7E1D3] hover:bg-[#E7E1D3] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAssign}
                disabled={!selectedPersonId || actionLoading === "assign"}
                className="flex-1 py-3 rounded-2xl bg-[#173B5C] text-white font-bold text-sm hover:bg-[#102F4A] transition-colors shadow-sm disabled:opacity-60"
              >
                {actionLoading === "assign" ? "Assigning…" : "Assign Technician"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AdminServiceDetailsPage;
