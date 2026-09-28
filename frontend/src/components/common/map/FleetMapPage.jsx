/* ============================================================
   FLEET MAP PAGE · shared full page
   One implementation used by the user, admin and battery-technician
   map pages. The role-scoped fetcher + title/subtitle are injected
   by each page, and the whole hook state is exposed to a render-prop
   child so an admin page can mount extra panels (e.g. the location
   manager) that need to refresh the map.
   ============================================================ */
import { useEffect, useMemo, useState } from "react";
import { Map, RotateCcw, SearchX } from "lucide-react";
import { useFleetMap } from "../../../hooks/useFleetMap";
import { fetchUserOrganizations } from "../../../services";
import FleetMap from "./FleetMap";
import MapToolbar from "./MapToolbar";
import MapStats from "./MapStats";

const termMatches = (marker, term) => {
  const q = term.toLowerCase();
  return (
    String(marker.batteryId || "").toLowerCase().includes(q) ||
    String(marker.location?.siteName || "").toLowerCase().includes(q) ||
    String(marker.location?.city || "").toLowerCase().includes(q)
  );
};

const FleetMapPage = ({
  fetcher,
  organizationsFetcher = fetchUserOrganizations,
  title = "Global Battery Map",
  subtitle = "Fleet locations, compliance, health and lifecycle at a glance.",
  passportHref,
  children,
}) => {
  const map = useFleetMap(fetcher);

  /* Organisation network is static config from the backend (no filters) —
     fetched once per page so the map always shows the MaxVolt partner
     network (Manufacturer / Service Provider / Reseller / Recycler / Collection). */
  const [organizations, setOrganizations] = useState([]);
  useEffect(() => {
    let mounted = true;
    organizationsFetcher()
      .then((res) => {
        if (mounted) setOrganizations(res?.data || []);
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [organizationsFetcher]);

  /* A submitted search flies to the first matching located battery;
     derived during render so the map clears its focus automatically. */
  const focusBatteryId = useMemo(() => {
    if (!map.submittedSearch) return null;
    const hit = map.data.find((m) => termMatches(m, map.submittedSearch));
    return hit ? hit.batteryId : null;
  }, [map.data, map.submittedSearch]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#16263A] flex items-center gap-2">
            <Map className="w-6 h-6 text-[#B48611]" />
            {title}
          </h1>
          <p className="text-sm text-[#747B83] mt-0.5">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={map.reset}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E7E1D3] bg-[#FFFDF8] text-[12px] font-bold text-[#747B83] hover:text-[#16263A] hover:border-[#B48611] transition-colors whitespace-nowrap"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Clear filters
        </button>
      </div>

      <MapToolbar
        filters={map.filters}
        onChangeFilter={map.onChangeFilter}
        search={map.search}
        onSearchChange={map.setSearch}
        onSearchSubmit={map.applySearch}
      />

      <MapStats summary={map.summary} hasFilters={map.hasFilters} />

      {map.error ? (
        <div className="panel p-6 flex items-center gap-3 text-sm font-bold text-[#8A1D1D] bg-red-50 border-red-200">
          <SearchX className="w-5 h-5 shrink-0" />
          {map.error.message || "Could not load the map."} Try clearing your filters.
        </div>
      ) : (
        <FleetMap
          markers={map.data}
          organizations={organizations}
          mode={map.mode}
          onModeChange={map.setMode}
          focusBatteryId={focusBatteryId}
          loading={map.loading}
          passportHref={passportHref}
        />
      )}

      {typeof children === "function" ? children(map) : children}
    </div>
  );
};

export default FleetMapPage;