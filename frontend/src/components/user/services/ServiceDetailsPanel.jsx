import React from "react";
import {
  CalendarDays,
  Clock3,
  MapPin,
  User,
  Wrench,
  Hash,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import ServiceTracking from "./ServiceTracking";
import { getStatusStyle } from "../../common/status";

/* ============================================================
   ServiceDetailsPanel
   Expandable service-details panel rendered directly under a
   battery row/card. Derives everything from the existing
   booking/service data. Shows a progress tracker when a service
   is booked, and a "No service booked" notice otherwise.
 ============================================================ */

const Info = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3">
    <div className="w-8 h-8 rounded-lg bg-[#FFFDF8] border border-[#E7E1D3] flex items-center justify-center shrink-0">
      <Icon className="w-4 h-4 text-[#173B5C]" />
    </div>
    <div className="min-w-0">
      <p className="text-[11px] text-[#747B83]">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-[#16263A] break-words">
        {value || "—"}
      </p>
    </div>
  </div>
);

const ServiceDetailsPanel = ({ booking, status }) => {
  const hasBooking = Boolean(booking);
  // Prefer the granular booking/service status for the tracking timeline so
  // stages (Accepted / Assigned / On The Way) are preserved, and fall back
  // to the derived per-battery status only for display.
  const trackingStatus = booking?.status || status;
  const displayStatus = status || booking?.status;

  return (
    <div className="p-6 lg:p-7 bg-[#F5F1E7]/40 border-t border-[#EEE9DA]">
      <div className="flex flex-col gap-6">
        {!hasBooking ? (
          <div className="flex items-center gap-3 rounded-2xl bg-[#FFFDF8] border border-[#EEE9DA] p-5">
            <div className="w-10 h-10 rounded-xl bg-[#F5F1E7] flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5 text-[#747B83]" />
            </div>
            <div>
              <p className="font-bold text-[#16263A]">No service booked</p>
              <p className="mt-0.5 text-sm text-[#747B83]">
                This battery does not have an active service appointment.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Status pill */}
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`
                  inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full
                  text-xs font-semibold ${getStatusStyle(displayStatus)}
                `}
              >
                {displayStatus?.toLowerCase() === "completed" ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : displayStatus?.toLowerCase() === "cancelled" ? (
                  <AlertCircle className="w-4 h-4" />
                ) : (
                  <Clock3 className="w-4 h-4" />
                )}
                {displayStatus || "Booked"}
              </span>
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Info icon={Hash} label="Service ID" value={booking.ticketNumber || booking.id} />
              <Info icon={Wrench} label="Service Type" value={booking.serviceType} />
              <Info icon={CalendarDays} label="Booking Date" value={booking.date || booking.scheduledDate} />
              <Info icon={Clock3} label="Scheduled Date / Time" value={booking.date ? `${booking.date} · ${booking.time || ""}` : booking.scheduledDate} />
              <Info icon={User} label="Current Status" value={displayStatus || booking.status} />
              <Info icon={MapPin} label="Service Location" value={booking.center || booking.location} />
            </div>

            {/* Assigned tech + estimate (when available) */}
            {(booking.technician || booking.estimatedArrival) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Info icon={User} label="Assigned Battery Technician" value={booking.technician} />
                <Info icon={Clock3} label="Estimated Arrival" value={booking.estimatedArrival} />
              </div>
            )}

            {/* Tracking timeline */}
            <div className="rounded-2xl bg-[#FFFDF8] border border-[#EEE9DA] p-5">
              <ServiceTracking
                status={trackingStatus}
                timestamps={{
                  Booked: { time: booking.date || "" },
                  Completed: { time: booking.scheduledDate || "" },
                }}
                label="Service Progress"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default React.memo(ServiceDetailsPanel);
