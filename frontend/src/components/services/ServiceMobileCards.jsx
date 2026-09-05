import React from "react";
import {
  MapPin,
  ChevronRight,
} from "lucide-react";

const ServiceMobileCards = ({
  batteries,
  bookings,
  getBatteryId,
  getServiceStatus,
  getStatusStyle,
  onSelectBattery,
}) => {
  return (
    <div className="lg:hidden p-4 sm:p-6 space-y-4">

      {batteries.map((battery, index) => {

        const batteryId =
          getBatteryId(battery);

        const serviceStatus =
          getServiceStatus(battery);

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
              border border-[#ECE7DB]
              bg-[#FFFEFA]
              p-5
            "
          >

            <div className="
              flex items-start
              justify-between
              gap-4
            ">

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

                <h3 className="mt-3 text-lg font-bold">
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

              <div className="bg-[#F5F1E7] rounded-xl p-4">

                <p className="text-xs text-[#777E85]">
                  Chemistry
                </p>

                <p className="mt-1 font-semibold">
                  {battery.chemistry || "LFP"}
                </p>

              </div>

              <div className="bg-[#F5F1E7] rounded-xl p-4">

                <p className="text-xs text-[#777E85]">
                  Services
                </p>

                <p className="mt-1 font-semibold">
                  {serviceCount}
                </p>

              </div>

            </div>

            <div className="
              flex items-center gap-2
              mt-4
              text-sm
              text-[#69717A]
            ">
              <MapPin className="w-4 h-4" />
              {battery.location || "Warehouse"}
            </div>

            <button
              onClick={() =>
                onSelectBattery(battery)
              }
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

export default ServiceMobileCards;