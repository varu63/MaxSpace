import React, {
  useMemo,
  useState,
} from "react";

import { Battery } from "lucide-react";

import { useBattery } from "../context/BatteryContext";
import ServiceStats from "../components/services/ServiceStats";
import BookedServices from "../components/services/BookedServices";
import ServiceFilters from "../components/services/ServiceFilters";
import ServiceTable from "../components/services/ServiceTable";
import ServiceMobileCards from "../components/services/ServiceMobileCards";
import ServiceInfoCards from "../components/services/ServiceInfoCards";
import BatteryServiceModal from "../components/services/BatteryServiceModal";
import BookServiceModal from "../components/services/BookServiceModal";



const ServicePage = () => {

  const {
    batteries = [],
    openScanner,
  } = useBattery();


  /* ==========================================================
     STATE
  ========================================================== */

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("All");

  const [selectedBattery, setSelectedBattery] =
    useState(null);

  const [showBookingModal, setShowBookingModal] =
    useState(false);

  const [bookings, setBookings] =
    useState([]);


  const [bookingForm, setBookingForm] =
    useState({
      serviceType: "Regular Maintenance",
      date: "",
      time: "",
      mobileNumber:"",
      notes: "",
    });


  /* ==========================================================
     SAMPLE BATTERIES
  ========================================================== */

  const sampleBatteries = [
    {
      id: "MVBE0000871",
      model: "ESS",
      chemistry: "LFP",
      cells: 4,
      status: "FG PENDING",
      serviceCount: 0,
      manufacturingDate: "16 Apr 2026",
      location: "Warehouse",
    },
    {
      id: "MVAE0014036",
      model: "ESS",
      chemistry: "LFP",
      cells: 4,
      status: "FG PENDING",
      serviceCount: 0,
      manufacturingDate: "16 Apr 2026",
      location: "Warehouse",
    },
    {
      id: "MVAE0014037",
      model: "ESS",
      chemistry: "LFP",
      cells: 4,
      status: "FG PENDING",
      manufacturingDate: "16 Apr 2026",
      location: "Warehouse",
    },
    {
      id: "MVAE0014038",
      model: "ESS",
      chemistry: "LFP",
      cells: 4,
      status: "FG PENDING",
      serviceCount: 0,
      manufacturingDate: "16 Apr 2026",
      location: "Warehouse",
    },
    {
      id: "MVAE0014039",
      model: "ESS",
      chemistry: "LFP",
      cells: 4,
      status: "FG PENDING",
      serviceCount: 0,
      manufacturingDate: "16 Apr 2026",
      location: "Warehouse",
    },
  ];


  const serviceBatteries =
    batteries.length > 0
      ? batteries
      : sampleBatteries;


  /* ==========================================================
     HELPERS
  ========================================================== */

  const getBatteryId = (battery) =>
    battery?.id ||
    battery?.batteryId ||
    battery?.serialNumber ||
    "";


  /*
   * Get service count for one battery.
   */
  const getServiceCount = (battery) => {

    const batteryId =
      getBatteryId(battery);

    /*
     * Count previous bookings.
     */
    const bookingCount =
      bookings.filter(
        (booking) =>
          booking.batteryId === batteryId &&
          booking.status !== "Cancelled"
      ).length;

    /*
     * If your BatteryContext already has
     * serviceCount, use it as the base count.
     */
    const existingCount =
      Number(battery?.serviceCount) || 0;

    /*
     * We use the larger value to avoid
     * accidentally decreasing existing history.
     */
    return Math.max(
      existingCount,
      bookingCount
    );
  };


  /*
   * Service status.
   */
  const getServiceStatus = (battery) => {

    const batteryId =
      getBatteryId(battery);

    const hasBooking =
      bookings.some(
        (booking) =>
          booking.batteryId === batteryId &&
          booking.status === "Booked"
      );

    if (hasBooking) {
      return "Booked";
    }

    return (
      battery?.serviceStatus ||
      battery?.status ||
      "Pending"
    );
  };


  /*
   * Is currently booked?
   */
  const isBatteryBooked = (battery) => {

    const batteryId =
      getBatteryId(battery);

    return bookings.some(
      (booking) =>
        booking.batteryId === batteryId &&
        booking.status === "Booked"
    );
  };


  /*
   * Find current booking.
   */
  const getBatteryBooking = (battery) => {

    const batteryId =
      getBatteryId(battery);

    return bookings.find(
      (booking) =>
        booking.batteryId === batteryId &&
        booking.status === "Booked"
    );
  };


  /* ==========================================================
     FILTER
  ========================================================== */

  const filteredBatteries = useMemo(() => {

    return serviceBatteries.filter(
      (battery) => {

        const batteryId =
          getBatteryId(battery);

        const serviceStatus =
          getServiceStatus(battery);

        const matchesSearch =
          batteryId
            .toLowerCase()
            .includes(
              search.toLowerCase()
            );

        const matchesStatus =
          statusFilter === "All" ||
          serviceStatus
            .toLowerCase() ===
            statusFilter.toLowerCase();

        return (
          matchesSearch &&
          matchesStatus
        );
      }
    );

  }, [
    serviceBatteries,
    search,
    statusFilter,
    bookings,
  ]);


  /* ==========================================================
     SERVICE STATS
  ========================================================== */

  const serviceStats = useMemo(() => {

    const active =
      serviceBatteries.filter(
        (battery) => {

          const status =
            getServiceStatus(
              battery
            ).toLowerCase();

          return (
            status === "active" ||
            status === "in progress"
          );
        }
      ).length;


    const pending =
      serviceBatteries.filter(
        (battery) => {

          const status =
            getServiceStatus(
              battery
            ).toLowerCase();

          return (
            status === "pending" ||
            status === "fg pending"
          );
        }
      ).length;


    const booked =
      bookings.filter(
        (booking) =>
          booking.status === "Booked"
      ).length;


    const completed =
      bookings.filter(
        (booking) =>
          booking.status === "Completed"
      ).length;


    return {
      active,
      pending,
      booked,
      completed,
    };

  }, [
    serviceBatteries,
    bookings,
  ]);


  /* ==========================================================
     STATUS STYLE
  ========================================================== */

  const getStatusStyle = (status) => {

    const value =
      status?.toLowerCase();

    if (
      value === "completed" ||
      value === "complete"
    ) {
      return "bg-green-100 text-green-700";
    }

    if (
      value === "in progress" ||
      value === "active"
    ) {
      return "bg-blue-100 text-blue-700";
    }

    if (value === "booked") {
      return "bg-purple-100 text-purple-700";
    }

    if (
      value === "pending" ||
      value === "fg pending"
    ) {
      return "bg-[#FBF1C9] text-[#A77A08]";
    }

    return "bg-slate-100 text-slate-600";
  };


  /* ==========================================================
     BOOKING
  ========================================================== */

  const openBookingModal = () => {

    if (!selectedBattery) {
      return;
    }

    if (
      isBatteryBooked(
        selectedBattery
      )
    ) {
      return;
    }

    setBookingForm({
      serviceType:
        "Regular Maintenance",
      date: "",
      time: "",
      notes: "",
    });

    setShowBookingModal(true);
  };


  const handleBookingChange = (e) => {

    const {
      name,
      value,
    } = e.target;

    setBookingForm(
      (prev) => ({
        ...prev,
        [name]: value,
      })
    );
  };


  const handleBookService = (e) => {

    e.preventDefault();

    if (
      !selectedBattery ||
      !bookingForm.date ||
      !bookingForm.time
    ) {
      return;
    }

    const batteryId =
      getBatteryId(
        selectedBattery
      );


    const alreadyBooked =
      bookings.some(
        (booking) =>
          booking.batteryId === batteryId &&
          booking.status === "Booked"
      );


    if (alreadyBooked) {
      setShowBookingModal(false);
      return;
    }


    const newBooking = {

      id: `SRV-${Date.now()}`,

      batteryId,

      model:
        selectedBattery.model ||
        "ESS",

      chemistry:
        selectedBattery.chemistry ||
        "LFP",

      location:
        selectedBattery.location ||
        "Warehouse",

      serviceType:
        bookingForm.serviceType,

      date:
        bookingForm.date,

      time:
        bookingForm.time,

      notes:
        bookingForm.notes,

      status:
        "Booked",

      createdAt:
        new Date().toISOString(),
    };


    setBookings(
      (prev) => [
        ...prev,
        newBooking,
      ]
    );


    setShowBookingModal(false);
  };


  /* ==========================================================
     COMPLETE / CANCEL
  ========================================================== */

  const handleCompleteBooking = (
    bookingId
  ) => {

    setBookings(
      (prev) =>
        prev.map(
          (booking) =>
            booking.id === bookingId
              ? {
                  ...booking,
                  status:
                    "Completed",
                }
              : booking
        )
    );
  };


  const handleCancelBooking = (
    bookingId
  ) => {

    setBookings(
      (prev) =>
        prev.map(
          (booking) =>
            booking.id === bookingId
              ? {
                  ...booking,
                  status:
                    "Cancelled",
                }
              : booking
        )



    );
  };


  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <div className="w-full space-y-8">

      {/* ======================================================
          HEADER
      ======================================================= */}

      <div className="mb-8">

        <div className="
          flex flex-col
          lg:flex-row
          lg:items-center
          lg:justify-between
          gap-5
        ">

          <div>

            <p className="
              text-sm
              font-medium
              text-[#9A8240]
              mb-2
              pt-2
            ">
              Service Management
            </p>

            <h1 className="
              text-3xl
              lg:text-4xl
              font-bold
            ">
              Service Center
            </h1>

            <p className="
              mt-2
              text-[#6C747D]
            ">
              Monitor battery service requests,
              bookings and maintenance activities.
            </p>

          </div>

          <button
            onClick={openScanner}
            className="
              inline-flex
              items-center
              justify-center
              gap-2
              rounded-xl
              bg-[#173B5C]
              px-5 py-3.5
              text-white
              font-semibold
              hover:bg-[#102F4A]
              transition-all
            "
          >
            <Battery className="w-5 h-5" />
            Scan Battery
          </button>

        </div>
      </div>


      {/* ======================================================
          STATS
      ======================================================= */}

      <ServiceStats
        stats={serviceStats}
      />


      {/* ======================================================
          BOOKINGS
      ======================================================= */}

      <BookedServices
        bookings={bookings}
        onComplete={
          handleCompleteBooking
        }
        onCancel={
          handleCancelBooking
        }
      />


      {/* ======================================================
          REQUESTS
      ======================================================= */}

      <section className="
        bg-[#FFFDF8]
        border border-[#EEE8D8]
        rounded-3xl
        shadow-sm
        overflow-hidden
      ">

        <ServiceFilters
          search={search}
          setSearch={setSearch}
          statusFilter={
            statusFilter
          }
          setStatusFilter={
            setStatusFilter
          }
        />


        {/* Desktop */}
        <ServiceTable
          batteries={
            filteredBatteries
          }
          bookings={bookings}
          getBatteryId={
            getBatteryId
          }
          getServiceStatus={
            getServiceStatus
          }
          getStatusStyle={
            getStatusStyle
          }
          onSelectBattery={
            setSelectedBattery
          }
        />


        {/* Mobile */}
        <ServiceMobileCards
          batteries={
            filteredBatteries
          }
          bookings={bookings}
          getBatteryId={
            getBatteryId
          }
          getServiceStatus={
            getServiceStatus
          }
          getStatusStyle={
            getStatusStyle
          }
          onSelectBattery={
            setSelectedBattery
          }
        />


        {filteredBatteries.length ===
          0 && (
          <div className="
            p-12
            text-center
          ">

            <Battery className="
              w-10 h-10
              mx-auto
              text-[#7D858C]
            " />

            <h3 className="
              mt-4
              text-lg
              font-bold
            ">
              No service requests found
            </h3>

            <p className="
              mt-1
              text-sm
              text-[#747B83]
            ">
              Try changing your search
              or filter.
            </p>

          </div>
        )}

      </section>


      {/* ======================================================
          INFO CARDS
      ======================================================= */}

      <ServiceInfoCards/>


      {/* ======================================================
          BATTERY MODAL
      ======================================================= */}

      {selectedBattery && (
        <BatteryServiceModal
          battery={
            selectedBattery
          }
          booking={
            getBatteryBooking(
              selectedBattery
            )
          }
          isBooked={
            isBatteryBooked(
              selectedBattery
            )
          }
          getBatteryId={
            getBatteryId
          }
          getServiceStatus={
            getServiceStatus
          }
          onClose={() =>
            setSelectedBattery(null)
          }
          onBook={
            openBookingModal
          }
        />
      )}


      {/* ======================================================
          BOOKING MODAL
      ======================================================= */}

      {showBookingModal &&
        selectedBattery && (
          <BookServiceModal
            battery={
              selectedBattery
            }
            form={
              bookingForm
            }
            onChange={
              handleBookingChange
            }
            onSubmit={
              handleBookService
            }
            onClose={() =>
              setShowBookingModal(
                false
              )
            }
            getBatteryId={
              getBatteryId
            }
          />
        )}

    </div>
  );
};


export default ServicePage;