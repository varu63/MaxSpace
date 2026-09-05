
import { useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Battery,
  Calendar,
  Check,
  Plus,
  X,
} from "lucide-react";

const BatteryServiceModal = ({
  battery,
  booking,
  isBooked,
  getBatteryId,
  getServiceStatus,
  onClose,
  onBook,
}) => {
  useEffect(() => {
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  if (!battery) return null;

  return createPortal(
    <div
      className="
        fixed inset-0
        z-[9998]
        flex items-center justify-center
        px-6 sm:px-10 lg:px-20
        py-6
      "
    >
      {/* Background overlay */}
      <div
        className="
          absolute inset-0
          bg-[#16263A]/50
          backdrop-blur-sm
        "
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="
          relative
          w-full
          max-w-4xl
          max-h-[95vh]
          flex flex-col
          bg-[#FFFDF8]
          rounded-2xl
          shadow-2xl
          overflow-hidden
        "
      >
        {/* Header */}
        <div
          className="
            shrink-0
            flex items-center
            justify-between
            p-6
            border-b border-[#ECE7DB]
            bg-[#FFFDF8]
          "
        >
          <div>
            <p className="text-xs text-[#7B8289]">
              SERVICE DETAILS
            </p>

            <h2 className="mt-1 text-xl font-bold">
              {getBatteryId(battery)}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="
              w-10 h-10
              rounded-xl
              bg-[#F3F0E8]
              flex items-center
              justify-center
              hover:bg-[#EAE5D9]
            "
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div
          className="
            flex-1
            overflow-y-auto
            p-6 sm:p-8
          "
        >
          {/* Battery */}
          <div className="flex items-center gap-3">
            <span
              className="
                w-12 h-12
                rounded-xl
                bg-[#173B5C]
                flex items-center
                justify-center
                shrink-0
              "
            >
              <Battery className="w-6 h-6 text-white" />
            </span>

            <div>
              <h3 className="font-bold text-lg">
                {battery.model || "ESS"}
              </h3>

              <p className="text-sm text-[#747B83]">
                {battery.chemistry || "LFP"} Chemistry
              </p>
            </div>
          </div>

          {/* Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
            <Detail
              label="Service Status"
              value={getServiceStatus(battery)}
            />

            <Detail
              label="Service Count"
              value={booking ? "1+" : "0"}
            />

            <Detail
              label="Total Cells"
              value={
                battery.cells ||
                battery.totalCells ||
                4
              }
            />

            <Detail
              label="Location"
              value={
                battery.location ||
                "Warehouse"
              }
            />
          </div>

          {/* Booking */}
          {booking && (
            <div
              className="
                mt-6
                rounded-2xl
                border border-purple-200
                bg-purple-50
                p-5
              "
            >
              <div className="flex items-start gap-3">
                <div
                  className="
                    w-10 h-10
                    rounded-xl
                    bg-purple-600
                    flex items-center
                    justify-center
                    shrink-0
                  "
                >
                  <Calendar className="w-5 h-5 text-white" />
                </div>

                <div>
                  <p className="font-bold text-purple-900">
                    Service Booked
                  </p>

                  <p className="mt-1 text-sm text-purple-700">
                    {booking.serviceType}
                  </p>

                  <div
                    className="
                      flex flex-wrap
                      gap-3
                      mt-2
                      text-xs
                      text-purple-700
                    "
                  >
                    <span>
                      Date: {booking.date}
                    </span>

                    <span>
                      Time: {booking.time}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Book Service / Already Booked */}
          {!isBooked ? (
            <button
              type="button"
              onClick={onBook}
              className="
                w-full mt-6
                h-14
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
              <Plus className="w-5 h-5" />
              Book Service
            </button>
          ) : (
            <div
              className="
                mt-6
                rounded-xl
                bg-green-50
                border border-green-200
                p-4
                flex items-center
                gap-3
              "
            >
              <div
                className="
                  w-9 h-9
                  rounded-full
                  bg-green-600
                  flex items-center
                  justify-center
                  shrink-0
                "
              >
                <Check className="w-5 h-5 text-white" />
              </div>

              <div>
                <p className="font-semibold text-green-800">
                  Service Successfully Booked
                </p>

                <p className="text-sm text-green-700">
                  This battery already has a service appointment.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

const Detail = ({ label, value }) => {
  return (
    <div className="rounded-xl bg-[#F5F1E7] p-4">
      <p className="text-xs text-[#747B83]">
        {label}
      </p>

      <p className="mt-2 font-bold">
        {value}
      </p>
    </div>
  );
};

export default BatteryServiceModal;
