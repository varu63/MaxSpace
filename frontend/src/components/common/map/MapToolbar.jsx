/* ============================================================
   FLEET MAP TOOLBAR
   Search box + the filter vocabulary (health / lifecycle status /
   compliance / service) rendered above the map. Controlled inputs:
   the parent page owns `filters` + `search` state and refetches
   when they change. Vocabulary mirrors the backend mapConfig.js.
   ============================================================ */
import { MapPin, Search } from "lucide-react";
import {
  HEALTH_FILTERS,
  BATTERY_STATUS_FILTERS,
  COMPLIANCE_FILTERS,
  SERVICE_FILTERS,
} from "./mapConfig";

const selectClass =
  "text-[12px] font-semibold bg-[#FFFDF8] border border-[#E7E1D3] rounded-xl px-2.5 py-2 text-[#16263A] outline-none focus:border-[#B48611] w-full";

const Field = ({ label, value, options, onChange, name }) => (
  <label className="flex flex-col gap-1 min-w-0">
    <span className="text-[10px] font-bold uppercase tracking-wider text-[#8A9096]">{label}</span>
    <select className={selectClass} value={value || ""} onChange={(e) => onChange(name, e.target.value)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </label>
);

const MapToolbar = ({ filters, onChangeFilter, search, onSearchChange, onSearchSubmit }) => {
  return (
    <div className="panel p-3 sm:p-4 space-y-3">
      {/* Search + filters */}
      <div className="flex flex-col lg:flex-row gap-3">
        <form
          className="flex-1 min-w-0 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSearchSubmit();
          }}
        >
          <label className="flex flex-col gap-1 min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8A9096]">
              Search battery
            </span>
            <div className="relative">
              <Search className="w-4 h-4 text-[#8A9096] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Battery ID, site, city, producer…"
                className="w-full text-[12px] font-semibold bg-[#FFFDF8] border border-[#E7E1D3] rounded-xl pl-9 pr-3 py-2 text-[#16263A] outline-none focus:border-[#B48611]"
              />
            </div>
          </label>
          <button
            type="submit"
            className="mt-5 shrink-0 px-4 py-2 rounded-xl bg-[#173B5C] text-[#FBF1C9] text-[12px] font-bold hover:bg-[#102F4A] transition-colors"
          >
            <span className="hidden sm:inline">Search</span>
            <MapPin className="w-4 h-4 sm:hidden" />
          </button>
        </form>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-3">
          <Field label="Health" name="healthStatus" value={filters.healthStatus} options={HEALTH_FILTERS} onChange={onChangeFilter} />
          <Field label="Status" name="batteryStatus" value={filters.batteryStatus} options={BATTERY_STATUS_FILTERS} onChange={onChangeFilter} />
          <Field label="Compliance" name="complianceStatus" value={filters.complianceStatus} options={COMPLIANCE_FILTERS} onChange={onChangeFilter} />
          <Field label="Service" name="serviceStatus" value={filters.serviceStatus} options={SERVICE_FILTERS} onChange={onChangeFilter} />
        </div>
      </div>
    </div>
  );
};

export default MapToolbar;