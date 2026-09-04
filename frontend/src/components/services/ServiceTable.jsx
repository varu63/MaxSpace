import React from "react";
import {
  ChevronRight,
  MapPin,
} from "lucide-react";

const ServiceTable = ({
  batteries,
  bookings,
  getBatteryId,
  getServiceStatus,
  getStatusStyle,
  onSelectBattery,
}) => {
  return (
    <div className="hidden lg:block overflow-x-auto">

      <table className="w-full">

        <thead>
          <tr className="bg-[#F7F3E9] text-left">

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

            const batteryId =
              getBatteryId(battery);

            const serviceStatus =
              getServiceStatus(battery);

            /*
             * Count ALL services for this battery.
             * Cancelled bookings are excluded.
             */
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
                  border-[#EEEAE0]
                  hover:bg-[#FCFAF4]
                  transition
                "
              >

                {/* Battery */}
                <td className="px-7 py-5">

                  <span className="
                    inline-flex
                    px-3.5 py-2
                    rounded-full
                    bg-[#173B5C]
                    text-xs
                    font-semibold
                    text-white
                  ">
                    {batteryId}
                  </span>

                </td>

                {/* Model */}
                <td className="px-5 py-5">
                  <div className="font-semibold">
                    {battery.model || "ESS"}
                  </div>
                </td>

                {/* Chemistry */}
                <td className="px-5 py-5">
                  <span className="text-sm text-[#616A73]">
                    {battery.chemistry || "LFP"}
                  </span>
                </td>

                {/* Cells */}
                <td className="px-5 py-5">
                  <span className="font-semibold">
                    {battery.cells ||
                      battery.totalCells ||
                      4}
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
                          : "bg-slate-100 text-slate-600"
                      }
                    `}
                  >
                    {serviceCount === 0
                      ? "No Service"
                      : `${serviceCount} ${
                          serviceCount === 1
                            ? "Service"
                            : "Services"
                        }`}
                  </span>

                </td>

                {/* Location */}
                <td className="px-5 py-5">

                  <div className="
                    flex items-center gap-2
                    text-sm text-[#69717A]
                  ">
                    <MapPin className="w-4 h-4" />
                    {battery.location || "Warehouse"}
                  </div>

                </td>

                {/* Action */}
                <td className="px-7 py-5 text-right">

                  <button
                    onClick={() =>
                      onSelectBattery(battery)
                    }
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

export default ServiceTable;