import {
  User,
  MapPin,
  Wrench,
  Calendar,
  Eye,
} from "lucide-react";

import StatusBadge from "../admin/StatusBadge";
import { formatDate } from "../admin/adminUtils";

/* Small labelled info tile inside each assignment card. */
export const InfoCell = ({ icon: Icon, label, value, sub, tone = "primary" }) => {
  const tones = {
    primary: "text-[#173B5C]",
    accent: "text-[#B48611]",
  };

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-[#F5F1E7] border border-[#E7E1D3] p-4 min-w-0">
      <div className="w-9 h-9 rounded-lg bg-[#FFFDF8] border border-[#E7E1D3] flex items-center justify-center shrink-0">
        <Icon className={`w-4 h-4 ${tones[tone]}`} />
      </div>

      <div className="min-w-0">
        <p className="text-xs text-[#747B83]">{label}</p>
        <p className="mt-0.5 text-sm font-bold text-[#16263A] truncate">
          {value}
        </p>
        {sub && (
          <p className="text-[11px] text-[#8A9096] truncate">
            {sub}
          </p>
        )}
      </div>
    </div>
  );
};

/* Individual service assignment card. */
const ServiceAssignmentCard = ({ service, onOpen }) => (
  <div className="rounded-3xl bg-[#FFFDF8] border border-[#EEE9DA] p-5 shadow-sm hover:shadow-md transition-shadow">
    {/* Top */}
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <span className="inline-flex items-center rounded-full bg-[#173B5C] px-3 py-1 text-[10px] font-semibold text-white tracking-wide">
          {service.ticketNumber}
        </span>

        <h3 className="mt-2 text-lg font-bold text-[#16263A] truncate">
          {service.battery?.modelName || service.battery?.name || service.batteryName || "Battery"}
        </h3>

        <p className="text-[11px] text-[#8A9096] font-mono truncate">
          Battery ID · {service.batteryId}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <StatusBadge status={service.status} />

        <p className="mt-1.5 text-[10px] text-[#8A9096]">
          Request ID · {service.id}
        </p>
      </div>
    </div>

    {/* Information */}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
      <InfoCell
        icon={User}
        label="Customer"
        value={service.customer?.name || "—"}
      />

      <InfoCell
        icon={MapPin}
        label="Service Location"
        value={service.center || service.battery?.location || "—"}
        tone="accent"
      />

      <InfoCell
        icon={Wrench}
        label="Service Type"
        value={service.serviceType}
      />

      <InfoCell
        icon={Calendar}
        label="Scheduled"
        value={formatDate(service.scheduledDate)}
        sub={service.scheduledTime}
        tone="accent"
      />
    </div>

    {/* Action */}
    <button
      type="button"
      onClick={onOpen}
      className="w-full mt-4 h-10 rounded-xl bg-[#173B5C] text-white text-xs font-semibold hover:bg-[#102F4A] transition"
    >
      <span className="flex items-center justify-center gap-1.5">
        <Eye className="w-3.5 h-3.5" />
        View Details
      </span>
    </button>
  </div>
);

export default ServiceAssignmentCard;