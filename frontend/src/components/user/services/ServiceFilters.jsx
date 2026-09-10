import React from "react";
import {
  Search,
  Filter,
  ClipboardList,
} from "lucide-react";

const ServiceFilters = ({
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
}) => {
  const filters = [
    "All",
    "Pending",
    "Active",
    "Booked",
    "Completed",
  ];

  return (
    <div className="p-6 lg:p-7 border-b border-[#EEE9DA]">
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#173B5C] flex items-center justify-center shrink-0">
            <ClipboardList className="w-5 h-5 text-white" />
          </div>

          <div>
            <h2 className="text-xl lg:text-2xl font-bold text-[#16263A]">
              Service Requests
            </h2>

            <p className="mt-1 text-sm text-[#747B83]">
              View and manage battery service requirements.
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full xl:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8A9096]" />

          <input
            type="text"
            placeholder="Search battery ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="
              w-full h-12
              pl-12 pr-4
              rounded-xl
              bg-[#FFFDF8]
              border border-[#E7E1D3]
              outline-none
              text-sm text-[#16263A]
              placeholder:text-[#8A9096]
              focus:border-[#173B5C]
              transition
            "
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mt-6">
        <div className="flex items-center gap-2 text-sm text-[#747B83]">
          <Filter className="w-4 h-4" />
          Filter:
        </div>

        {filters.map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`
              px-4 py-2
              rounded-full
              text-sm font-medium
              border
              transition
              ${
                statusFilter === status
                  ? "bg-[#173B5C] text-white border-[#173B5C] shadow-sm"
                  : "bg-[#FFFDF8] text-[#747B83] border-[#E7E1D3] hover:bg-[#F5F1E7]"
              }
            `}
          >
            {status}
          </button>
        ))}
      </div>
    </div>
  );
};

export default React.memo(ServiceFilters);

