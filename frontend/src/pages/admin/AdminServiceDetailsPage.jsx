import React, { useState, useEffect, useMemo } from "react";
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
  ChevronRight,
  Phone,
  Mail,
  Hash,
  Zap,
  Gauge,
  TrendingUp,
  Wrench,
  Activity,
  Circle,
} from "lucide-react";

import { useAdmin } from "../../context/AdminContext";
import { fetchAdminService, getErrorMessage } from "../../services/adminApi";
import { Card } from "../../components/common";
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
  const { servicePersons, acceptService, assignServicePerson, updateServiceStatus } = useAdmin();

  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState("");

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
          className="mt-4 text-sm font-bold text-[#B48611] hover:text-[#8A7A4A]"
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
          className="flex items-center gap-1.5 text-sm font-bold text-[#B48611] hover:text-[#8A7A4A] mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Service Requests
        </button>

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-[#16263A]">
                {service.ticketNumber}
              </h1>
              <StatusBadge status={service.status} />
            </div>
            <p className="text-sm text-[#747B83] mt-1">
              {service.serviceType}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {service.status === "Confirmed" && (
              <button
                type="button"
                onClick={handleAccept}
                disabled={actionLoading === "accept"}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-600 text-white font-bold text-sm hover:bg-green-700 transition-colors disabled:opacity-60"
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
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#B48611] text-white font-bold text-sm hover:bg-[#9A8240] transition-colors disabled:opacity-60"
              >
                <UserPlus className="w-4 h-4" />
                Assign Service Person
              </button>
            )}

            {service.status !== "Completed" && service.status !== "Cancelled" && (
              <div className="relative">
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) handleStatusChange(e.target.value);
                  }}
                  className="appearance-none px-4 py-2 pr-8 rounded-xl bg-[#F5F1E7] text-[#16263A] border border-[#E7E1D3] font-bold text-sm hover:bg-[#E7E1D3] transition-colors cursor-pointer"
                >
                  <option value="" disabled>
                    Update Status
                  </option>
                  {SERVICE_STATUS_FLOW.filter((s) => s !== service.status).map(
                    (s) => {
                      const currentIdx = SERVICE_STATUS_FLOW.indexOf(service.status);
                      const sIdx = SERVICE_STATUS_FLOW.indexOf(s);
                      if (sIdx < currentIdx) return null;
                      return (
                        <option key={s} value={s}>
                          → {statusLabel(s)}
                        </option>
                      );
                    }
                  )}
                  <option value="Cancelled">Cancel Service</option>
                </select>
                <ChevronRight className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8A9096] pointer-events-none rotate-90" />
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
          <button
            type="button"
            onClick={() => setError("")}
            className="ml-auto text-red-500"
          >
            ×
          </button>
        </div>
      )}

      {/* Service Timeline */}
      <Card padded={false}>
        <div className="p-6 lg:p-7 border-b border-[#EEE9DA]">
          <h2 className="font-bold text-lg text-[#16263A] flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#B48611]" />
            Service Timeline
          </h2>
        </div>
        <div className="p-6 lg:p-7">
          <div className="space-y-0">
            {timeline.map((item, idx) => {
              return (
                <div key={item.step} className="flex gap-4 relative">
                  {/* Vertical line */}
                  {idx < timeline.length - 1 && (
                    <div className="absolute left-[9px] top-5 w-[2px] h-full bg-[#E7E1D3]" />
                  )}

                  {/* Dot */}
                  <div className="relative z-10 shrink-0 mt-1">
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center ${
                        item.state === "done"
                          ? "bg-green-500"
                          : item.state === "active"
                          ? `bg-[#173B5C] ring-4 ring-[#173B5C]/20`
                          : "bg-[#E7E1D3]"
                      }`}
                    >
                      {item.state === "done" ? (
                        <CheckCircle2 className="w-3 h-3 text-white" />
                      ) : (
                        <Circle
                          className={`w-2 h-2 ${
                            item.state === "active"
                              ? "text-white fill-white"
                              : "text-[#8A9096] fill-[#8A9096]"
                          }`}
                        />
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="pb-8">
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
                    <p className="text-[11px] text-[#8A9096] mt-0.5">
                      {item.state === "done" && "Completed"}
                      {item.state === "active" && "Current status"}
                      {item.state === "pending" && "Pending"}
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
        <Card padded={false}>
          <div className="p-6 border-b border-[#EEE9DA]">
            <h2 className="font-bold text-lg text-[#16263A] flex items-center gap-2">
              <User className="w-5 h-5 text-[#B48611]" />
              Customer Information
            </h2>
          </div>
          <div className="p-6 space-y-4">
            {[
              { label: "Name", value: service.customer?.name || "Alex Rivera", icon: User },
              { label: "Email", value: service.customer?.email || "alex.rivera@maxspace-energy.com", icon: Mail },
              { label: "Phone", value: service.mobileNumber || "—", icon: Phone },
              { label: "Location", value: service.center || "—", icon: MapPin },
            ].map((row) => {
              const Icon = row.icon;
              return (
                <div key={row.label} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#F5F1E7] border border-[#E7E1D3] flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 text-[#8A7A4A]" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-[#8A9096] uppercase tracking-wide">
                      {row.label}
                    </p>
                    <p className="text-sm font-semibold text-[#16263A]">
                      {row.value}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Battery Information */}
        <Card padded={false}>
          <div className="p-6 border-b border-[#EEE9DA]">
            <h2 className="font-bold text-lg text-[#16263A] flex items-center gap-2">
              <Battery className="w-5 h-5 text-[#B48611]" />
              Battery Information
            </h2>
          </div>
          <div className="p-6 space-y-4">
            {[
              { label: "Model", value: service.battery?.modelName || service.batteryName || "—", icon: Battery },
              { label: "Chemistry", value: service.battery?.chemistry || "—", icon: Zap },
              { label: "Barcode", value: service.battery?.barcode || service.batteryId || "—", icon: Hash },
              { label: "Capacity", value: service.battery?.capacityKwh ? `${service.battery.capacityKwh} kWh` : "—", icon: Gauge },
              { label: "Health (SoH)", value: service.battery?.stateOfHealth ? `${service.battery.stateOfHealth}%` : "—", icon: TrendingUp },
              { label: "Location", value: service.battery?.location || "—", icon: MapPin },
            ].map((row) => {
              const Icon = row.icon;
              return (
                <div key={row.label} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#F5F1E7] border border-[#E7E1D3] flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 text-[#8A7A4A]" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-[#8A9096] uppercase tracking-wide">
                      {row.label}
                    </p>
                    <p className="text-sm font-semibold text-[#16263A]">
                      {row.value}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Service Information */}
        <Card padded={false}>
          <div className="p-6 border-b border-[#EEE9DA]">
            <h2 className="font-bold text-lg text-[#16263A] flex items-center gap-2">
              <Wrench className="w-5 h-5 text-[#B48611]" />
              Service Information
            </h2>
          </div>
          <div className="p-6 space-y-4">
            {[
              { label: "Service Type", value: service.serviceType },
              { label: "Priority", value: service.priority || "Normal" },
              { label: "Service Center", value: service.center },
              { label: "Cost", value: service.cost },
              { label: "Technician", value: service.technician || "Not yet assigned" },
              { label: "Notes", value: service.notes || "—" },
            ].map((row) => (
              <div key={row.label}>
                <p className="text-[11px] font-semibold text-[#8A9096] uppercase tracking-wide">
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
        <Card padded={false}>
          <div className="p-6 border-b border-[#EEE9DA]">
            <h2 className="font-bold text-lg text-[#16263A] flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#B48611]" />
              Booking Information
            </h2>
          </div>
          <div className="p-6 space-y-4">
            {[
              { label: "Ticket Number", value: service.ticketNumber },
              { label: "Created", value: formatDate(service.createdAt) },
              { label: "Scheduled Date", value: formatDate(service.scheduledDate) },
              { label: "Scheduled Time", value: service.scheduledTime },
              { label: "Current Status", value: statusLabel(service.status) },
              { label: "Battery ID", value: service.batteryId },
            ].map((row) => (
              <div key={row.label}>
                <p className="text-[11px] font-semibold text-[#8A9096] uppercase tracking-wide">
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

      {/* Assign Modal */}
      {assignOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-[#16263A]/60 backdrop-blur-sm"
            onClick={() => setAssignOpen(false)}
          />
          <div className="relative w-full max-w-md bg-[#FFFDF8] rounded-2xl shadow-xl border border-[#EEE9DA] p-6">
            <button
              type="button"
              onClick={() => setAssignOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-[#F5F1E7] flex items-center justify-center hover:bg-[#E7E1D3] transition-colors"
            >
              ×
            </button>

            <h3 className="font-bold text-lg text-[#16263A] mb-4">
              Assign Service Person
            </h3>

            <div className="space-y-2 max-h-48 overflow-y-auto mb-4">
              {activePersons.length === 0 ? (
                <p className="text-sm text-[#747B83] text-center py-4">
                  No active service persons.
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
                      name="sp"
                      checked={selectedPersonId === person.id}
                      onChange={() => setSelectedPersonId(person.id)}
                      className="sr-only"
                    />
                    <div className="w-8 h-8 rounded-lg bg-[#173B5C] text-[#FBF1C9] flex items-center justify-center text-xs font-black shrink-0">
                      {person.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#16263A]">
                        {person.name}
                      </p>
                      <p className="text-[11px] text-[#747B83]">
                        {person.specialization}
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
                className="flex-1 py-2.5 rounded-xl bg-[#F5F1E7] text-[#16263A] font-bold text-sm border border-[#E7E1D3]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAssign}
                disabled={!selectedPersonId || actionLoading === "assign"}
                className="flex-1 py-2.5 rounded-xl bg-[#173B5C] text-white font-bold text-sm hover:bg-[#102F4A] disabled:opacity-60"
              >
                {actionLoading === "assign" ? "Assigning…" : "Assign"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminServiceDetailsPage;