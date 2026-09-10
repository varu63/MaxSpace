import { useCallback, useMemo, useState } from "react";

import { Battery } from "lucide-react";

import { useBattery } from "../context/BatteryContext";
import { bookingsFromServices } from "../data/dummyData";
import { isActiveBooking } from "../data/serviceStatuses";
import { PageHeader, Card, EmptyState } from "../components/common";
import ServiceStats from "../components/services/ServiceStats";
import ServiceFilters from "../components/services/ServiceFilters";
import ServiceTable from "../components/services/ServiceTable";
import ServiceMobileCards from "../components/services/ServiceMobileCards";
import ServiceInfoCards from "../components/services/ServiceInfoCards";
import BatteryServiceModal from "../components/services/BatteryServiceModal";
import BookServiceModal from "../components/services/BookServiceModal";

const ServicePage = () => {
  const {
    batteries = [],
    services,
    bookService,
    openScanner,
    getBatteryServiceStatus,
  } = useBattery();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedBattery, setSelectedBattery] = useState(null);
  const [expandedBatteryId, setExpandedBatteryId] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);

  const [bookingForm, setBookingForm] = useState({
    serviceType: "Regular Maintenance",
    date: "",
    time: "",
    mobileNumber: "",
    notes: "",
  });

  const bookings = useMemo(() => bookingsFromServices(services), [services]);

  const getBatteryId = useCallback(
    (battery) => battery?.id || battery?.batteryId || battery?.serialNumber || "",
    []
  );

  const getServiceStatus = useCallback(
    (battery) => getBatteryServiceStatus(battery),
    [getBatteryServiceStatus]
  );

  const isBatteryBooked = useCallback(
    (battery) => {
      const batteryId = getBatteryId(battery);

      // Book a battery only when it has no active service in the pipeline.
      return bookings.some(
        (booking) =>
          booking.batteryId === batteryId &&
          isActiveBooking(booking.status)
      );
    },
    [bookings, getBatteryId]
  );

  const getBatteryBooking = useCallback(
    (battery) => {
      const batteryId = getBatteryId(battery);
      return bookings.find(
        (booking) =>
          booking.batteryId === batteryId &&
          isActiveBooking(booking.status)
      );
    },
    [bookings, getBatteryId]
  );

  const filteredBatteries = useMemo(() => {
    const query = search.trim().toLowerCase();

    return batteries.filter((battery) => {
      const batteryId = getBatteryId(battery);
      const serviceStatus = getServiceStatus(battery);

      const matchesSearch = !query || batteryId.toLowerCase().includes(query);
      const matchesStatus =
        statusFilter === "All" || serviceStatus.toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [batteries, search, statusFilter, getBatteryId, getServiceStatus]);

  const serviceStats = useMemo(() => {
    let active = 0;
    let pending = 0;

    for (const battery of batteries) {
      const status = getServiceStatus(battery);
      if (status === "Active") active += 1;
      else if (status === "Pending") pending += 1;
    }

    return { active, pending };
  }, [batteries, getServiceStatus]);

  const openBookingModal = useCallback(() => {
    if (!selectedBattery || isBatteryBooked(selectedBattery)) return;

    setBookingForm({
      serviceType: "Regular Maintenance",
      date: "",
      time: "",
      mobileNumber: "",
      notes: "",
    });

    setShowBookingModal(true);
  }, [selectedBattery, isBatteryBooked]);

  const handleBookingChange = useCallback((e) => {
    const { name, value } = e.target;
    setBookingForm((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleBookService = useCallback(
    (e) => {
      e.preventDefault();
      if (!selectedBattery || !bookingForm.date || !bookingForm.time) return;

      if (isBatteryBooked(selectedBattery)) {
        setShowBookingModal(false);
        return;
      }

      bookService({
        batteryId: getBatteryId(selectedBattery),
        serviceType: bookingForm.serviceType,
        scheduledDate: bookingForm.date,
        scheduledTime: bookingForm.time,
        mobileNumber: bookingForm.mobileNumber,
        notes: bookingForm.notes,
      });

      setShowBookingModal(false);
    },
    [selectedBattery, bookingForm, isBatteryBooked, bookService, getBatteryId]
  );

  const handleToggleExpand = useCallback((batteryId) => {
    setExpandedBatteryId((prev) => (prev === batteryId ? null : batteryId));
  }, []);

  return (
    <div className="w-full space-y-8">
      <div className="mb-2">
        <PageHeader
          icon={Battery}
          title="Service Center"
          subtitle="Monitor battery service requests, bookings and maintenance activities."
          actions={
            <button
              onClick={openScanner}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#173B5C] px-5 py-3 text-white font-semibold hover:bg-[#102F4A] transition-all shadow-sm"
            >
              <Battery className="w-5 h-5" />
              Scan Battery
            </button>
          }
        />
      </div>

      <ServiceStats stats={serviceStats} />

      <Card padded={false} className="overflow-hidden">
        <ServiceFilters
          search={search}
          setSearch={setSearch}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
        />

        <ServiceTable
          batteries={filteredBatteries}
          bookings={bookings}
          getBatteryId={getBatteryId}
          getServiceStatus={getServiceStatus}
          onSelectBattery={setSelectedBattery}
          expandedId={expandedBatteryId}
          onToggle={handleToggleExpand}
        />

        <ServiceMobileCards
          batteries={filteredBatteries}
          bookings={bookings}
          getBatteryId={getBatteryId}
          getServiceStatus={getServiceStatus}
          onSelectBattery={setSelectedBattery}
          expandedId={expandedBatteryId}
          onToggle={handleToggleExpand}
        />

        {filteredBatteries.length === 0 && (
          <EmptyState
            icon={Battery}
            title="No service requests found"
            description="Try changing your search or filter."
          />
        )}
      </Card>

      <ServiceInfoCards />

      {selectedBattery && (
        <BatteryServiceModal
          battery={selectedBattery}
          booking={getBatteryBooking(selectedBattery)}
          isBooked={isBatteryBooked(selectedBattery)}
          getBatteryId={getBatteryId}
          getServiceStatus={getServiceStatus}
          onClose={() => setSelectedBattery(null)}
          onBook={openBookingModal}
        />
      )}

      {showBookingModal && selectedBattery && (
        <BookServiceModal
          battery={selectedBattery}
          form={bookingForm}
          onChange={handleBookingChange}
          onSubmit={handleBookService}
          onClose={() => setShowBookingModal(false)}
          getBatteryId={getBatteryId}
        />
      )}
    </div>
  );
};

export default ServicePage;
