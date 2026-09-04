import React from "react";
import {
  Battery,
  Calendar,
  CalendarDays,
  Timer,
  MapPin,
  Check,
} from "lucide-react";

const BookedServices = ({
  bookings,
  onComplete,
  onCancel,
}) => {
  const activeBookings = bookings.filter(
    (booking) => booking.status === "Booked"
  );

  if (activeBookings.length === 0) {
    return null;
  }

  return (
    <section className="
      mb-8
      bg-[#FFFDF8]
      border border-[#EEE8D8]
      rounded-3xl
      shadow-sm
      overflow-hidden
  
    ">

      <div className="p-6 lg:p-7 border-b border-[#ECE7DA] h-full w-full">

        <div className="flex items-center justify-between gap-4">

          <div>
            <h2 className="text-xl lg:text-2xl font-bold">
              Booked Services
            </h2>

            <p className="mt-1 text-sm text-[#747B83]">
              Scheduled battery service appointments.
            </p>
          </div>

          <div className="
            w-11 h-11
            rounded-xl
            bg-purple-100
            flex items-center justify-center
          ">
            <Calendar className="w-5 h-5 text-purple-700" />
          </div>

        </div>
      </div>

      <div className="divide-y divide-[#EEEAE0]">

        {activeBookings.map((booking) => (
          <div
            key={booking.id}
            className="p-6 hover:bg-[#FCFAF4] transition"
          >

            <div className="
              flex flex-col lg:flex-row
              lg:items-center
              lg:justify-between
              gap-5
            ">

              <div className="flex items-start gap-4">

                <div className="
                  w-12 h-12
                  rounded-xl
                  bg-[#173B5C]
                  flex items-center justify-center
                  shrink-0
                ">
                  <Battery className="w-6 h-6 text-white" />
                </div>

                <div>

                  <div className="flex flex-wrap items-center gap-2">

                    <span className="
                      inline-flex
                      px-3 py-1.5
                      rounded-full
                      bg-[#173B5C]
                      text-xs
                      font-semibold
                      text-white
                    ">
                      {booking.batteryId}
                    </span>

                    <span className="
                      inline-flex
                      px-3 py-1.5
                      rounded-full
                      bg-purple-100
                      text-purple-700
                      text-xs
                      font-semibold
                    ">
                      BOOKED
                    </span>

                  </div>

                  <h3 className="mt-2 font-bold text-lg">
                    {booking.serviceType}
                  </h3>

                  <div className="
                    flex flex-wrap
                    gap-4
                    mt-2
                    text-sm
                    text-[#69717A]
                  ">

                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="w-4 h-4" />
                      {booking.date}
                    </span>

                    <span className="flex items-center gap-1.5">
                      <Timer className="w-4 h-4" />
                      {booking.time}
                    </span>

                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4" />
                      {booking.mobileNumber}
                    </span>

                  </div>

                  {booking.notes && (
                    <p className="mt-2 text-sm text-[#747B83]">
                      {booking.notes}
                    </p>
                  )}

                </div>
              </div>

              <div className="flex flex-wrap gap-2">

                <button
                  onClick={() => onComplete(booking.id)}
                  className="
                    inline-flex
                    items-center
                    justify-center
                    gap-2
                    px-4 py-2.5
                    rounded-xl
                    bg-green-600
                    text-white
                    text-sm
                    font-semibold
                    hover:bg-green-700
                    transition
                  "
                >
                  <Check className="w-4 h-4" />
                  Complete
                </button>

                <button
                  onClick={() => onCancel(booking.id)}
                  className="
                    px-4 py-2.5
                    rounded-xl
                    bg-red-50
                    text-red-600
                    border border-red-100
                    text-sm
                    font-semibold
                    hover:bg-red-100
                    transition
                  "
                >
                  Cancel
                </button>

              </div>

            </div>
          </div>
        ))}

      </div>
    </section>
  );
};

export default BookedServices;