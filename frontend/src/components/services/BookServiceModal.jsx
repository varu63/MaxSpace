
import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Battery,
  CalendarDays,
  Check,
  Clock3,
  X,
} from "lucide-react";

const BookServiceModal = ({
  battery,
  form,
  onChange,
  onSubmit,
  onClose,
  getBatteryId,
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
        z-[9999]
        flex items-center justify-center
        px-6 sm:px-10 lg:px-20
        py-6
      "
    >
      {/* Background overlay */}
      <div
        className="
          absolute inset-0
          bg-[#16263A]/60
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
            p-6
            border-b border-[#ECE7DB]
            flex items-center
            justify-between
            bg-[#FFFDF8]
          "
        >
          <div>
            <p
              className="
                text-xs
                font-semibold
                text-[#9A8240]
              "
            >
              SERVICE BOOKING
            </p>

            <h2 className="mt-1 text-2xl font-bold">
              Book Service
            </h2>

            <p className="mt-1 text-sm text-[#747B83]">
              Battery: {getBatteryId(battery)}
            </p>
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
              hover:bg-[#E8E4DA]
            "
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={onSubmit}
          className="
            flex-1
            overflow-y-auto
            p-6 sm:p-8
          "
        >
          {/* Battery */}
          <div
            className="
              rounded-2xl
              bg-[#F5F1E7]
              p-5
              mb-6
            "
          >
            <div className="flex items-center gap-3">
              <div
                className="
                  w-11 h-11
                  rounded-xl
                  bg-[#173B5C]
                  flex items-center
                  justify-center
                "
              >
                <Battery className="w-5 h-5 text-white" />
              </div>

              <div>
                <p className="font-bold">
                  {getBatteryId(battery)}
                </p>

                <p className="text-sm text-[#747B83]">
                  {battery.model || "ESS"} •{" "}
                  {battery.chemistry || "LFP"}
                </p>
              </div>
            </div>
          </div>

          {/* Service Type */}
          <div className="mb-5">
            <label className="block text-sm font-semibold mb-2">
              Service Type
            </label>

            <select
              name="serviceType"
              value={form.serviceType}
              onChange={onChange}
              className="
                w-full h-12
                px-4
                rounded-xl
                bg-white
                border border-[#DDD9CF]
                outline-none
                focus:border-[#173B5C]
              "
            >
              <option>Regular Maintenance</option>
              <option>Battery Inspection</option>
              <option>Repair Service</option>
              <option>Cell Replacement</option>
              <option>Electrical Check</option>
              <option>Emergency Service</option>
              <option>Other</option>
            </select>
          </div>

          {/* Date / Time */}
          <div
            className="
              grid grid-cols-1
              sm:grid-cols-2
              gap-4
              mb-5
            "
          >
            {/* Date */}
            <div>
              <label className="block text-sm font-semibold mb-2">
                Service Date
              </label>

              <div className="relative">
                <CalendarDays
                  className="
                    absolute
                    left-4
                    top-1/2
                    -translate-y-1/2
                    w-5 h-5
                    text-[#858C92]
                  "
                />

                <input
                  type="date"
                  name="date"
                  value={form.date}
                  onChange={onChange}
                  min={new Date().toISOString().split("T")[0]}
                  required
                  className="
                    w-full h-12
                    pl-12 pr-4
                    rounded-xl
                    bg-white
                    border border-[#DDD9CF]
                    outline-none
                    focus:border-[#173B5C]
                  "
                />
              </div>
            </div>

            {/* Time */}
            <div>
              <label className="block text-sm font-semibold mb-2">
                Service Time
              </label>

              <div className="relative">
                <Clock3
                  className="
                    absolute
                    left-4
                    top-1/2
                    -translate-y-1/2
                    w-5 h-5
                    text-[#858C92]
                  "
                />

                <input
                  type="time"
                  name="time"
                  value={form.time}
                  onChange={onChange}
                  required
                  className="
                    w-full h-12
                    pl-12 pr-4
                    rounded-xl
                    bg-white
                    border border-[#DDD9CF]
                    outline-none
                    focus:border-[#173B5C]
                  "
                />
              </div>
            </div>
          </div>

          {/* Mobile Number */}
          <div className="mb-5">
            <label className="block text-sm font-semibold mb-2">
              Mobile Number
            </label>

            <input
              type="text"
              name="mobileNumber"
              value={form.mobileNumber || ""}
              onChange={onChange}
              inputMode="numeric"
              placeholder="00000-00000"
              maxLength="10"
              className="
                w-full h-12
                px-4
                rounded-xl
                bg-white
                border border-[#DDD9CF]
                outline-none
                focus:border-[#173B5C]
              "
            />
          </div>

          {/* Notes */}
          <div className="mb-6">
            <label className="block text-sm font-semibold mb-2">
              Service Notes
              <span className="font-normal text-[#92979C]">
                {" "} (Optional)
              </span>
            </label>

            <textarea
              name="notes"
              value={form.notes}
              onChange={onChange}
              rows="4"
              placeholder="Describe the service requirement..."
              className="
                w-full
                px-4 py-3
                rounded-xl
                bg-white
                border border-[#DDD9CF]
                outline-none
                resize-none
                focus:border-[#173B5C]
              "
            />
          </div>

          {/* Buttons */}
          <div
            className="
              flex flex-col
              sm:flex-row
              gap-3
            "
          >
            <button
              type="button"
              onClick={onClose}
              className="
                flex-1 h-12
                rounded-xl
                bg-[#F1EEE6]
                text-[#5F6871]
                font-semibold
                hover:bg-[#E8E4DA]
              "
            >
              Cancel
            </button>

            <button
              type="submit"
              className="
                flex-1 h-12
                rounded-xl
                bg-[#173B5C]
                text-white
                font-semibold
                flex items-center
                justify-center
                gap-2
                hover:bg-[#102F4A]
              "
            >
              <Check className="w-5 h-5" />
              Confirm Booking
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default BookServiceModal;

