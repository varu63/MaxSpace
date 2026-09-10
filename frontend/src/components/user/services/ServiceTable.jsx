import React from "react";
import {
  ChevronRight,
  MapPin,
  Layers,
  ChevronDown,
} from "lucide-react";
import { IconBox } from "../../common";
import ServiceDetailsPanel from "./ServiceDetailsPanel";

const ServiceTable = ({
  batteries,
  bookings,
  getBatteryId,
  onSelectBattery,
  expandedId,
  onToggle,
  getServiceStatus,
}) => {
  return (
    <div className="hidden lg:block overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="bg-[#F5F1E7] text-left">
            <th className="px-7 py-4 text-xs font-semibold text-[#747B83] uppercase tracking-wide">
              Battery
            </th>

            <th className="px-5 py-4 text-xs font-semibold text-[#747B83] uppercase tracking-wide">
              Model
            </th>

            <th className="px-5 py-4 text-xs font-semibold text-[#747B83] uppercase tracking-wide">
              Chemistry
            </th>

            <th className="px-5 py-4 text-xs font-semibold text-[#747B83] uppercase tracking-wide">
              Cells
            </th>

            <th className="px-5 py-4 text-xs font-semibold text-[#747B83] uppercase tracking-wide">
              Service Count
            </th>

            <th className="px-5 py-4 text-xs font-semibold text-[#747B83] uppercase tracking-wide">
              Location
            </th>

            <th className="px-7 py-4 text-xs font-semibold text-[#747B83] uppercase tracking-wide text-right">
              Action
            </th>
          </tr>
        </thead>

        <tbody>
          {batteries.map((battery, index) => {
            const batteryId = getBatteryId(battery);
            const isExpanded = expandedId === batteryId;

            const serviceCount =
              bookings.filter(
                (booking) =>
                  booking.batteryId === batteryId &&
                  booking.status !== "Cancelled"
              ).length;

            const booking = bookings.find(
              (b) => b.batteryId === batteryId
            );
            // Prefer the granular booking status for the details panel so
            // the tracking timeline and status pill reflect the exact stage.
            const status = booking?.status || getServiceStatus?.(battery);

            return (
              <React.Fragment key={batteryId || index}>
                <tr
                  onClick={() => onToggle(batteryId)}
                  className={`
                    border-t border-[#EEE9DA]
                    hover:bg-[#F5F1E7]
                    transition
                    cursor-pointer
                    ${isExpanded ? "bg-[#F5F1E7]" : ""}
                  `}
                >
                  {/* Battery */}
                  <td className="px-7 py-5">
                    <div className="flex items-center gap-3">
                      <IconBox
                        icon={Layers}
                        size="sm"
                        className="bg-[#173B5C]"
                      />

                      <span className="
                        inline-flex
                        px-3.5 py-2
                        rounded-full
                        bg-[#FFFDF8]
                        border border-[#E7E1D3]
                        text-xs
                        font-semibold
                        text-[#173B5C]
                      ">
                        {batteryId}
                      </span>

                      <ChevronDown
                        className={`
                          w-4 h-4 text-[#747B83]
                          transition-transform duration-300
                          ${isExpanded ? "rotate-180" : ""}
                        `}
                      />
                    </div>
                  </td>

                  {/* Model */}
                  <td className="px-5 py-5">
                    <div className="font-semibold text-[#16263A]">
                      {battery.model || "ESS"}
                    </div>
                  </td>

                  {/* Chemistry */}
                  <td className="px-5 py-5">
                    <span className="text-sm text-[#747B83]">
                      {battery.chemistry || "LFP"}
                    </span>
                  </td>

                  {/* Cells */}
                  <td className="px-5 py-5">
                    <span className="font-semibold text-[#16263A]">
                      {battery.cells || battery.totalCells || 4}
                    </span>
                  </td>

                  {/* Service Count */}
                  <td className="px-5 py-5">
                    <span
                      className={`
                        inline-flex
                        px-3 py-1.5
                        rounded-full
                        text-xs
                        font-semibold
                        ${
                          serviceCount > 0
                            ? "bg-purple-100 text-purple-700"
                            : "bg-[#F5F1E7] text-[#747B83]"
                        }
                      `}
                    >
                      {serviceCount === 0
                        ? "No Service"
                        : `${serviceCount} ${
                            serviceCount === 1 ? "Service" : "Services"
                          }`}
                    </span>
                  </td>

                  {/* Location */}
                  <td className="px-5 py-5">
                    <div className="
                      flex items-center gap-2
                      text-sm text-[#747B83]
                    ">
                      <MapPin className="w-4 h-4" />
                      {battery.location || "Warehouse"}
                    </div>
                  </td>

                  {/* Action */}
                  <td className="px-7 py-5 text-right" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onSelectBattery(battery)}
                      className="
                        inline-flex
                        items-center
                        gap-1.5
                        px-4 py-2.5
                        rounded-xl
                        bg-[#173B5C]
                        text-white
                        text-sm
                        font-semibold
                        hover:bg-[#102F4A]
                        transition
                      "
                    >
                      View
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </td>
                </tr>

                {/* Expandable service details */}
                {isExpanded && (
                  <tr className="border-t border-[#EEE9DA] bg-[#F5F1E7]/40">
                    <td colSpan={7} className="p-0">
                      <div className="animate-expand">
                        <ServiceDetailsPanel booking={booking} status={status} />
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default React.memo(ServiceTable);
