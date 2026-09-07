import React from "react";
import {
  MapPin,
  ChevronRight,
  Layers,
  Wrench,
} from "lucide-react";
import { getStatusStyle } from "./status";

const ServiceMobileCards = ({
  batteries,
  bookings,
  getBatteryId,
  getServiceStatus,
  onSelectBattery,
}) => {
  return (
    <div className="lg:hidden p-4 sm:p-6 space-y-4">
      {batteries.map((battery, index) => {
        const batteryId = getBatteryId(battery);

        const serviceStatus = getServiceStatus(battery);

        const serviceCount =
          bookings.filter(
            (booking) =>
              booking.batteryId === batteryId &&
              booking.status !== "Cancelled"
          ).length;

        return (
          <div
            key={batteryId || index}
            className="
              rounded-2xl
              border border-[#EEE9DA]
              bg-[#FFFDF8]
              p-5
              shadow-sm
            "
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="
                  inline-flex
                  px-3 py-2
                  rounded-full
                  bg-[#173B5C]
                  text-xs
                  font-semibold
                  text-white
                ">
                  {batteryId}
                </span>

                <h3 className="mt-3 text-lg font-bold text-[#16263A]">
                  {battery.model || "ESS"}
                </h3>
              </div>

              <span
                className={`
                  px-3 py-1.5
                  rounded-full
                  text-xs
                  font-semibold
                  whitespace-nowrap
                  ${getStatusStyle(serviceStatus)}
                `}
              >
                {serviceStatus}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-5">
              <div className="flex items-center gap-3 bg-[#F5F1E7] border border-[#E7E1D3] rounded-xl p-4">
                <div className="w-9 h-9 rounded-lg bg-[#FFFDF8] border border-[#E7E1D3] flex items-center justify-center shrink-0">
                  <Layers className="w-4 h-4 text-[#173B5C]" />
                </div>

                <div>
                  <p className="text-xs text-[#747B83]">Chemistry</p>
                  <p className="mt-0.5 font-semibold text-[#16263A]">
                    {battery.chemistry || "LFP"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-[#F5F1E7] border border-[#E7E1D3] rounded-xl p-4">
                <div className="w-9 h-9 rounded-lg bg-[#FFFDF8] border border-[#E7E1D3] flex items-center justify-center shrink-0">
                  <Wrench className="w-4 h-4 text-[#B48611]" />
                </div>

                <div>
                  <p className="text-xs text-[#747B83]">Services</p>
                  <p className="mt-0.5 font-semibold text-[#16263A]">
                    {serviceCount}
                  </p>
                </div>
              </div>
            </div>

            <div className="
              flex items-center gap-2
              mt-4
              text-sm
              text-[#747B83]
            ">
              <MapPin className="w-4 h-4" />
              {battery.location || "Warehouse"}
            </div>

            <button
              onClick={() => onSelectBattery(battery)}
              className="
                w-full mt-5
                h-12
                rounded-xl
                bg-[#173B5C]
                text-white
                font-semibold
                flex items-center
                justify-center
                gap-2
                hover:bg-[#102F4A]
                transition
              "
            >
              View Service Details
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default React.memo(ServiceMobileCards);

