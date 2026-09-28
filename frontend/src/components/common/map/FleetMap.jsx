/* ============================================================
   FLEET MAP · shared Leaflet surface
   Renders markers + clusters for the Global Battery & Compliance
   Map. Plain Leaflet (no react-leaflet) because the app targets
   React 19 — no wrapper dependency required or assumed.

   The map is a controlled surface: the parent owns the fetched
   markers + colour mode + filters. This component:
     • initialises ONE Leaflet map per mount (strict-mode safe)
     • draws clustering markers coloured by the active mode
     • shows a popup with the real battery facts + a link to the
       Battery Passport page (/battery/:id)
     • exposes the shared legend as an overlay chip
   ============================================================ */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, Layers, X } from "lucide-react";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "./fleetMap.css";
import { COLOR_MODES, TONE_COLORS } from "./mapConfig";
import { ORGANIZATION_TYPES, TYPE_COLORS, iconFor as orgIconFor, orgPopupElement } from "./OrganizationLocationMap";
import { PIN_PATH, pinIconFor } from "./mapPins";

const TILE_URL =
  (import.meta.env.VITE_MAP_TILE_URL || "").trim() ||
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

const DEFAULT_VIEW = [20.5937, 78.9629];
const DEFAULT_ZOOM = 4;

const pinGlyph = (color) => (
  <svg width="12" height="16.8" viewBox="0 0 30 42" aria-hidden="true" className="shrink-0">
    <path d={PIN_PATH} fill={color} stroke="#FFFDF8" strokeWidth="2.5" />
    <circle cx="15" cy="14.5" r="6.4" fill="#FFFDF8" />
  </svg>
);

/* Append the markercluster overlay so the shared legend toggle + panel
   sit on top of the map. Kept inside the map component so every role's
   map gets the same controls without duplicating markup. The legend is
   COLLAPSED BY DEFAULT: a small toggle chip opens/closes the panel. */
const FleetLegend = ({ open, onToggle, mode, onModeChange, total, plotted, organizationCount, orgSummary }) => {
  const modeConfig = COLOR_MODES[mode] || COLOR_MODES.compliance;
  return (
    <div className="pointer-events-auto absolute top-3 right-3 z-[1000] flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls="fleet-legend-panel"
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FFFDF8]/95 backdrop-blur border border-[#EEE9DA] shadow-lg text-[11px] font-black uppercase tracking-wider text-[#173B5C] hover:bg-[#F5F1E7] transition-colors cursor-pointer"
      >
        <Layers className="w-3.5 h-3.5 text-[#B48611]" />
        Legend
        <ChevronDown className={`w-3.5 h-3.5 text-[#8A9096] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          id="fleet-legend-panel"
          className="w-[calc(100vw-24px)] max-w-[250px] max-h-[min(70vh,440px)] overflow-y-auto bg-[#FFFDF8]/95 backdrop-blur border border-[#EEE9DA] shadow-lg rounded-2xl p-3 text-[#16263A]"
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-[11px] font-black uppercase tracking-wider text-[#8A9096]">
              Compliance Legend
            </p>
            <button
              type="button"
              onClick={onToggle}
              aria-label="Close legend"
              className="text-[#8A9096] hover:text-[#16263A] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-[#747B83]">Colour mode</span>
            <select
              value={mode}
              onChange={(e) => onModeChange(e.target.value)}
              className="text-[11px] font-bold bg-[#F5F1E7] border border-[#E7E1D3] rounded-lg px-1.5 py-1 text-[#16263A] outline-none cursor-pointer"
              aria-label="Map colour mode"
            >
              {Object.keys(COLOR_MODES).map((key) => (
                <option key={key} value={key}>
                  {COLOR_MODES[key].label}
                </option>
              ))}
            </select>
          </div>
          <p className="text-[10px] font-black uppercase tracking-wider text-[#8A9096] mb-1">Batteries · {modeConfig.label}</p>
          <ul className="space-y-1.5">
            {Object.keys(TONE_COLORS).map((tone) => (
              <li key={tone} className="flex items-center gap-2">
                {pinGlyph(TONE_COLORS[tone])}
                <span className="text-[11px] font-semibold text-[#16263A]">
                  {toneLabel(tone)}
                </span>
              </li>
            ))}
          </ul>
          {orgSummary.length > 0 && (
            <>
              <p className="text-[10px] font-black uppercase tracking-wider text-[#8A9096] mt-3 mb-1">Facilities</p>
              <ul className="space-y-1.5">
                {orgSummary.map(({ type, count }) => (
                  <li key={type} className="flex items-center gap-2">
                    {pinGlyph(TYPE_COLORS[type] || "#8A9096")}
                    <span className="text-[11px] font-semibold text-[#16263A]">
                      {type}{count > 1 ? ` × ${count}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="mt-2 pt-1.5 border-t border-[#EEE9DA] text-[10px] text-[#747B83] font-medium">
            {plotted} of {total} located batteries shown
            {organizationCount > 0 ? ` · ${organizationCount} organisations` : ""}
          </p>
        </div>
      )}
    </div>
  );
};

const toneLabel = (tone) =>
  ({
    success: "Compliant",
    warning: "Pending / Warning",
    danger: "Non-Compliant",
    info: "In Service",
    orange: "Service / Defect Hold",
    neutral: "Unknown / Not Tracked",
  })[tone] || tone;

const FleetMap = ({
  markers,
  organizations = [],
  mode = "compliance",
  onModeChange,
  focusBatteryId = null,
  loading = false,
  passportHref = (marker) => `/battery/${encodeURIComponent(marker.batteryId)}`,
}) => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const clusterRef = useRef(null);
  const navigate = useNavigate();

  const modeConfig = COLOR_MODES[mode] || COLOR_MODES.compliance;

  /* One map instance per mount, strict-mode safe (guard on ref). */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: DEFAULT_VIEW,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
      attributionControl: true,
    });
    L.tileLayer(TILE_URL, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      maxClusterRadius: 46,
      iconCreateFunction: (clusterMarker) => {
        const count = clusterMarker.getChildCount();
        return L.divIcon({
          className: "maxspace-cluster",
          html: `<div class="maxspace-cluster-pin"><span>${count}</span></div>`,
          iconSize: [38, 38],
          iconAnchor: [19, 19],
        });
      },
    });
    cluster.addTo(map);
    mapRef.current = map;
    clusterRef.current = cluster;
    return () => {
      map.remove();
      mapRef.current = null;
      clusterRef.current = null;
    };
  }, []);

  /* Re-draw marker layer whenever data / colour mode changes. */
  useEffect(() => {
    const map = mapRef.current;
    const cluster = clusterRef.current;
    if (!map || !cluster) return;
    cluster.clearLayers();

    markers.forEach((marker) => {
      if (marker.location?.latitude === null || marker.location?.longitude === null) return;
      const resolved = modeConfig.toneOf(marker);
      const color = TONE_COLORS[resolved.tone] || TONE_COLORS.neutral;
      const icon = pinIconFor({ color, key: resolved.key });
      const leafletMarker = L.marker(
        [Number(marker.location.latitude), Number(marker.location.longitude)],
        { icon, title: marker.batteryId }
      );
      leafletMarker.bindPopup(() => popupElement(marker, navigate, resolved, passportHref), { maxWidth: 320 });
      cluster.addLayer(leafletMarker);
    });

    organizations.forEach((org) => {
      const lat = Number(org.latitude);
      const lng = Number(org.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const leafletMarker = L.marker(
        [lat, lng],
        { icon: orgIconFor(org.type, org.key || org.name), title: org.name }
      );
      leafletMarker.bindPopup(() => orgPopupElement(org), { maxWidth: 320 });
      cluster.addLayer(leafletMarker);
    });
  }, [markers, organizations, mode, navigate, modeConfig, passportHref]);

  /* Fly to a single battery when the page asks for it (search hit). */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusBatteryId) return;
    const target = markers.find((m) => m.batteryId === focusBatteryId);
    if (target && target.location?.latitude !== null) {
      map.flyTo([Number(target.location.latitude), Number(target.location.longitude)], 13, { duration: 0.9 });
    }
  }, [focusBatteryId, markers]);

  const hasCoordinates = useMemo(
    () => markers.some((m) => m.location?.latitude !== null),
    [markers]
  );

  const plottedOrganizations = useMemo(
    () => organizations.filter((o) => Number.isFinite(Number(o.latitude)) && Number.isFinite(Number(o.longitude))),
    [organizations]
  );

  const orgSummary = useMemo(
    () =>
      ORGANIZATION_TYPES.map((type) => ({
        type,
        count: plottedOrganizations.filter((o) => o.type === type).length,
      })).filter((s) => s.count > 0),
    [plottedOrganizations]
  );

  const [legendOpen, setLegendOpen] = useState(false);

  return (
    <div className="relative w-full h-[62vh] min-h-[400px] sm:h-[calc(100vh-25rem)] sm:min-h-[460px] max-h-[820px] rounded-2xl overflow-hidden border border-[#E7E1D3] shadow-sm">
      <div ref={containerRef} className="absolute inset-0 z-0" />
      <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center px-4">
        {loading ? (
          <div className="bg-[#FFFDF8]/95 border border-[#EEE9DA] rounded-xl px-4 py-2.5 text-sm font-bold text-[#747B83] shadow-lg">
            Loading fleet locations…
          </div>
        ) : !hasCoordinates && plottedOrganizations.length === 0 ? (
          <div className="bg-[#FFFDF8]/95 border border-[#EEE9DA] rounded-xl px-5 py-3 text-sm font-bold text-[#747B83] shadow-lg text-center">
            No battery location data available.
          </div>
        ) : !hasCoordinates ? (
          <div></div>
        ) : null}
      </div>
      <FleetLegend
        open={legendOpen}
        onToggle={() => setLegendOpen((o) => !o)}
        mode={mode}
        onModeChange={onModeChange}
        total={markers.length}
        plotted={hasCoordinates ? markers.filter((m) => m.location?.latitude !== null).length : 0}
        organizationCount={plottedOrganizations.length}
        orgSummary={orgSummary}
      />
    </div>
  );
};

const popupElement = (marker, navigate, resolved, passportHref) => {
  const href = passportHref ? passportHref(marker) : null;
  const root = document.createElement("div");
  root.className = "maxspace-popup text-[13px] text-[#16263A]";
  root.style.minWidth = "220px";

  const lines = [
    [`#${marker.batteryId}`, "font-mono font-black text-[#173B5C] text-sm"],
    [marker.name || "", "font-bold text-[#16263A]"],
    [marker.model ? `Model: ${marker.model}` : "", "text-[#747B83]"],
    [
      [
        marker.location?.siteName,
        [marker.location?.city, marker.location?.state, marker.location?.country].filter(Boolean).join(", "),
      ].filter(Boolean).join(" · "),
      "text-[#747B83]",
    ],
    [
      [
        marker.location?.address ? `Address: ${marker.location.address}` : "",
      ].filter(Boolean).join(" · "),
      "text-[#747B83]",
    ],
  ];

  const facts = [
    { label: "Status", value: marker.overallStatus || "—" },
    { label: "Health", value: marker.stateOfHealth === null ? "Unknown" : `${marker.stateOfHealth}% ${marker.health?.label || ""}` },
    { label: "Lifecycle", value: marker.lifecycle?.label || "Unknown" },
    { label: "Compliance", value: marker.compliance?.bucket?.label || "Not Tracked" },
    { label: "Service", value: marker.service?.status || "None" },
  ];
  if (marker.owner?.id) {
    facts.push({ label: "Owner", value: `${marker.owner.name || marker.owner.email || marker.owner.id}` });
  }

  lines.forEach(([text, cls]) => {
    if (!text) return;
    const p = document.createElement("p");
    p.className = cls;
    p.textContent = text;
    p.style.margin = "0 0 2px";
    root.appendChild(p);
  });

  const grid = document.createElement("div");
  grid.style.cssText = "display:grid;grid-template-columns:auto 1fr;gap:1px 12px;margin-top:8px;";
  facts.forEach(({ label, value }) => {
    const k = document.createElement("span");
    k.textContent = label;
    k.style.cssText = "color:#8A9096;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;";
    k.style.paddingTop = "2px";
    const v = document.createElement("span");
    v.textContent = value;
    v.style.cssText = "color:#16263A;font-weight:600;font-size:12px;";
    v.style.paddingTop = "2px";
    grid.appendChild(k);
    grid.appendChild(v);
  });
  root.appendChild(grid);

  if (href) {
    const btn = document.createElement("button");
    btn.textContent = "Open Battery Passport →";
    btn.type = "button";
    btn.style.cssText =
      "margin-top:10px;width:100%;background:#173B5C;color:#FBF1C9;border:0;border-radius:10px;padding:7px 10px;font-size:12px;font-weight:800;cursor:pointer;";
    btn.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      navigate(href);
    };
    root.appendChild(btn);
  }

  return root;
};

export default FleetMap;