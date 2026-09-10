import React, { useState, useEffect, useMemo } from "react";
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
          className="mt-4 text-sm font-bold text-[#B48611] hover:text-[#8A7A4A]"
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
          className="flex items-center gap-1.5 text-sm font-bold text-[#B48611] hover:text-[#8A7A4A] mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to My Services
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
            {action && (
              <button
                type="button"
                onClick={handleAction}
                disabled={actionLoading === action.nextStatus}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-white font-bold text-sm transition-colors disabled:opacity-60 ${action.color}`}
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
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition-colors disabled:opacity-60"
              >
                {actionLoading === "Cancelled" ? (
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                Cancel
              </button>
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

      {/* Waiting for Admin Approval notice */}
      {service.status === "Waiting for Admin Approval" && (
        <div className="flex items-start gap-3 rounded-2xl border border-[#F0E6C8] bg-[#FBF1C9] px-5 py-4">
          <div className="w-10 h-10 rounded-xl bg-[#A77A08] flex items-center justify-center shrink-0">
            <Hourglass className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-[#A77A08]">
              Waiting for Admin Approval
            </p>
            <p className="text-xs text-[#8A7A4A] mt-0.5">
              You marked this service as finished. An admin will now review and
              approve the completion. No further action is needed from you.
            </p>
          </div>
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
                  {idx < timeline.length - 1 && (
                    <div className="absolute left-[9px] top-5 w-[2px] h-full bg-[#E7E1D3]" />
                  )}

                  <div className="relative z-10 shrink-0 mt-1">
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center ${
                        item.state === "done"
                          ? "bg-green-500"
                          : item.state === "active"
                          ? "bg-[#173B5C] ring-4 ring-[#173B5C]/20"
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
    </div>
  );
};

export default BatteryTechnicianServiceDetailsPage;
