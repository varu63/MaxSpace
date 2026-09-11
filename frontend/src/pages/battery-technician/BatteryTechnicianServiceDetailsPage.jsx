import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  User,
  Battery,
  MapPin,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Phone,
  Mail,
  Hash,
  Zap,
  Gauge,
  TrendingUp,
  Wrench,
  Activity,
  Circle,
  Truck,
  PlayCircle,
  BadgeCheck,
  Hourglass,
} from "lucide-react";

import { useBatteryTechnician } from "../../context/BatteryTechnicianContext";
import { fetchAssignedServiceDetail, getErrorMessage } from "../../services/batteryTechnicianApi";
import { Card } from "../../components/common";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import StatusBadge from "../../components/admin/StatusBadge";
import {
  SERVICE_STATUS_FLOW,
  statusLabel,
  formatDate,
} from "../../components/admin/adminUtils";

/* Battery Technician allowed next-status actions */
const EMPLOYEE_ACTIONS = {
  "Assigned": { label: "Accept Service", nextStatus: "Accepted", icon: CheckCircle2, color: "bg-green-600 hover:bg-green-700" },
  "Accepted": { label: "Start Travel", nextStatus: "On The Way", icon: Truck, color: "bg-amber-600 hover:bg-amber-700" },
  "On The Way": { label: "Start Service", nextStatus: "In Progress", icon: PlayCircle, color: "bg-orange-600 hover:bg-orange-700" },
  "In Progress": { label: "Finish Service", nextStatus: "Waiting for Admin Approval", icon: BadgeCheck, color: "bg-green-600 hover:bg-green-700" },
};

const BatteryTechnicianServiceDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { updateServiceStatus } = useBatteryTechnician();

  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState("");

  useEffect(() => {
    const loadService = async () => {
      try {
        const data = await fetchAssignedServiceDetail(id);
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

  const action = service ? EMPLOYEE_ACTIONS[service.status] : null;
  const canCancel =
    service &&
    service.status !== "Completed" &&
    service.status !== "Cancelled" &&
    service.status !== "Waiting for Admin Approval";

  const handleAction = async () => {
    if (!action || !service) return;
    setActionLoading(action.nextStatus);
    try {
      const updated = await updateServiceStatus(service.id, action.nextStatus);
      setService((prev) => ({ ...prev, ...updated }));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading("");
    }
  };

  const handleCancel = async () => {
    if (!service) return;
    setActionLoading("Cancelled");
    try {
      const updated = await updateServiceStatus(service.id, "Cancelled");
      setService((prev) => ({ ...prev, ...updated }));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading("");
    }
  };

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
          onClick={() => navigate("/battery-technician/services")}
          className="mt-4 text-sm font-bold text-[#173B5C] hover:text-[#B48611] transition-colors"
        >
          ← Back to My Services
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
          onClick={() => navigate("/battery-technician/services")}
          className="inline-flex items-center gap-2 text-sm font-bold text-[#173B5C] hover:text-[#B48611] mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Assigned Services
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
              {service.serviceType} · Battery: <span className="font-mono">{service.batteryId}</span>
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            {action && (
              <button
                type="button"
                onClick={handleAction}
                disabled={actionLoading === action.nextStatus}
                className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-white font-bold text-sm transition-colors shadow-sm disabled:opacity-60 ${action.color}`}
              >
                {actionLoading === action.nextStatus ? (
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <action.icon className="w-4 h-4" />
                )}
                {action.label}
              </button>
            )}

            {canCancel && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={actionLoading === "Cancelled"}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#F5F1E7] text-red-700 border border-red-200 font-bold text-sm hover:bg-red-50 transition-colors disabled:opacity-60"
              >
                {actionLoading === "Cancelled" ? (
                  <span className="w-4 h-4 border-2 border-red-400 border-t-red-700 rounded-full animate-spin" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                Cancel Job
              </button>
            )}
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

      {/* Waiting for Admin Approval notice */}
      {service.status === "Waiting for Admin Approval" && (
        <div className="flex items-start gap-3.5 rounded-3xl border border-[#F0E6C8] bg-[#FBF1C9] p-6 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-[#A77A08] flex items-center justify-center text-white shrink-0">
            <Hourglass className="w-6 h-6" />
          </div>
          <div>
            <p className="text-base font-bold text-[#A77A08]">
              Waiting for Admin Approval
            </p>
            <p className="text-xs text-[#8A7A4A] mt-1 leading-relaxed">
              You marked this service as finished. An administrator will review and
              approve completion. No further action is required from you on this job.
            </p>
          </div>
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
            Track current progress from initial assignment to final approval
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
                      {item.state === "done" && "Step completed"}
                      {item.state === "active" && "Current operational phase"}
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
        <Card padded={false} className="overflow-hidden">
          <div className="p-6 border-b border-[#EEE9DA]">
            <h2 className="font-bold text-lg text-[#16263A] flex items-center gap-2.5">
              <User className="w-5 h-5 text-[#B48611]" />
              Customer Information
            </h2>
          </div>
          <div className="p-6 space-y-3">
            {[
              { label: "Name", value: service.customer?.name || "Alex Rivera", icon: User },
              { label: "Email", value: service.customer?.email || "alex.rivera@maxspace-energy.com", icon: Mail },
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
    </div>
  );
};

export default BatteryTechnicianServiceDetailsPage;
