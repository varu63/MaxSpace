import React from "react";
import {
  ChevronRight,
  MapPin,
  Layers,
} from "lucide-react";
import { IconBox } from "../common";

const ServiceTable = ({
  batteries,
  bookings,
  getBatteryId,
  onSelectBattery,
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

            const serviceCount =
              bookings.filter(
                (booking) =>
                  booking.batteryId === batteryId &&
                  booking.status !== "Cancelled"
              ).length;

            return (
              <tr
                key={batteryId || index}
                className="
                  border-t
                  border-[#EEE9DA]
                  hover:bg-[#F5F1E7]
                  transition
                "
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
                <td className="px-7 py-5 text-right">
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
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default React.memo(ServiceTable);
