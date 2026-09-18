import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Wrench,
  Filter,
  X,
  AlertCircle,
} from "lucide-react";

import { useBatteryTechnician } from "../../context/BatteryTechnicianContext";
import { PageHeader, Card, EmptyState, Pagination } from "../../components/common";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import ServiceAssignmentCard from "../../components/battery-technician/ServiceAssignmentCard";
import { getErrorMessage, fetchAssignedServicesPaginated } from "../../services/batteryTechnicianApi";

const BATTERY_TECHNICIAN_STATUS_FILTERS = [
  "All",
  "Assigned",
  "Accepted",
  "On The Way",
  "In Progress",
  "Waiting for Admin Approval",
  "Completed",
  "Cancelled",
];

const BatteryTechnicianServicesPage = () => {
  const { loading: contextLoading } = useBatteryTechnician();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [services, setServices] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState("");

  const total = pagination?.total ?? services.length;

  /* Server-side fetch — the backend filters to this technician's assigned
     services and applies search + status before returning the standard
     { data, pagination } envelope. */
  const fetchPage = async (nextPage = 1, opts = {}) => {
    setFetching(true);
    try {
      const result = await fetchAssignedServicesPaginated({
        page: nextPage,
        limit: 6,
        status: opts.status !== undefined ? opts.status : statusFilter === "All" ? "" : statusFilter,
        search: opts.search !== undefined ? opts.search : search,
      });
      setServices(result.data || []);
      setPagination(result.pagination || null);
      setPage(nextPage);
      setError("");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search → reset to page 1.
  useEffect(() => {
    const timer = setTimeout(() => fetchPage(1, { search }), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const handleStatusFilterChange = (status) => {
    setStatusFilter(status);
    fetchPage(1, { status: status === "All" ? "" : status });
  };

  const handlePageChange = (nextPage) => fetchPage(nextPage);

  if ((fetching || contextLoading) && services.length === 0) {
    return <LoadingSpinner />;
  }

  const hasFilters = Boolean(search.trim()) || statusFilter !== "All";

  return (
    <div className="w-full space-y-8">
      <PageHeader
        icon={Wrench}
        title="Assigned Service Queue"
        subtitle={`${total} service${total === 1 ? "" : "s"} currently assigned to your account`}
      />

      {error && (
        <div className="flex items-center gap-3 rounded-2xl bg-red-50 border border-red-200 px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <p className="text-sm text-red-700 flex-1">{error}</p>
          <button
            type="button"
            onClick={() => fetchPage(page)}
            className="text-xs font-bold text-red-700 hover:text-red-900 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Filters Card */}
      <Card padded={false} className="p-5 lg:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A9096]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ticket, battery, service type, location…"
              className="w-full h-12 pl-11 pr-10 rounded-2xl bg-[#F5F1E7] border border-[#E7E1D3] outline-none text-sm text-[#16263A] placeholder:text-[#8A9096] focus:border-[#173B5C] transition"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8A9096] hover:text-[#16263A]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 px-3.5 rounded-2xl bg-[#F5F1E7] border border-[#E7E1D3] sm:w-56 h-12">
            <Filter className="w-4 h-4 text-[#8A9096] shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => handleStatusFilterChange(e.target.value)}
              className="w-full bg-transparent text-sm font-medium text-[#16263A] focus:outline-none cursor-pointer"
            >
              {BATTERY_TECHNICIAN_STATUS_FILTERS.map((s) => (
                <option key={s} value={s}>
                  {s === "All" ? "All Statuses" : s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#EEE9DA]/60">
          <span className="text-xs font-semibold text-[#747B83] mr-1">Status:</span>
          {BATTERY_TECHNICIAN_STATUS_FILTERS.slice(0, 6).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => handleStatusFilterChange(status)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition ${
                statusFilter === status
                  ? "bg-[#173B5C] text-white border-[#173B5C] shadow-sm"
                  : "bg-[#FFFDF8] text-[#747B83] border-[#E7E1D3] hover:bg-[#F5F1E7] hover:text-[#16263A]"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </Card>

      {/* Service Request Cards */}
      {services.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No Assigned Service Requests Found"
          description={
            hasFilters
              ? "No services match your current search or filter. Try adjusting your filters."
              : "No assigned service requests found. New bookings assigned to you will appear here."
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
            {services.map((service) => (
              <ServiceAssignmentCard
                key={service.id}
                service={service}
                onOpen={() => navigate(`/battery-technician/services/${service.id}`)}
              />
            ))}
          </div>
          <Pagination pagination={pagination} onPageChange={handlePageChange} />
        </>
      )}
    </div>
  );
};

export default BatteryTechnicianServicesPage;