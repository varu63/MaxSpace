/* ============================================================
   ORGANIZATION LOCATION MAP — visual compliance network map.
   Purpose is VISUAL ONLY: markers show where MaxSpace partner
   organisations sit (Manufacturer / Service Provider / Reseller /
   Recycler / Collection Center). No navigation, no GPS, no geocoding.

   Data comes from the BACKEND (GET /api/map/organizations) via the
   injected role-scoped `fetcher` — nothing is hardcoded in React.

   Props:
     fetcher      — role-scoped fetcher (fetchUserOrganizations / …)
     showFilters  — render the All/Manufacturer/… type filter chips
     height       — map container height (px number or CSS length, e.g. "min(68vh, 640px)")
 ============================================================ */
import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./fleetMap.css";
import { ORG_CODES, pinIconFor } from "./mapPins";

const TILE_URL =
  (import.meta.env.VITE_MAP_TILE_URL || "").trim() ||
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

const DEFAULT_VIEW = [20.5937, 78.9629];
const DEFAULT_ZOOM = 4;

export const ORGANIZATION_TYPES = [
  "Manufacturer",
  "Service Provider",
  "Reseller",
  "Recycler",
  "Collection Center",
];

export const TYPE_COLORS = {
  Manufacturer: "#B48611",
  "Service Provider": "#173B5C",
  Reseller: "#7C3AED",
  Recycler: "#2E7D32",
  "Collection Center": "#C0392B",
};

export const iconFor = (type, key) => {
  const color = TYPE_COLORS[type] || "#8A9096";
  return pinIconFor({ color, code: ORG_CODES[type] || "", key });
};

export const orgPopupElement = (org) => {
  const root = document.createElement("div");
  root.className = "maxspace-popup text-[13px] text-[#16263A]";
  root.style.minWidth = "220px";

  const line = (text, cls, margin = "0 0 3px") => {
    const p = document.createElement("p");
    p.className = cls;
    p.textContent = text;
    p.style.margin = margin;
    root.appendChild(p);
  };

  line(org.name || "Organization", "font-black text-[#173B5C] text-sm");
  line(`Type: ${org.type || "—"}`, "text-[#16263A] font-semibold");
  line(
    `Location: ${[org.city, org.state].filter(Boolean).join(", ") || "—"}`,
    "text-[#747B83]"
  );
  if (org.address) line(org.address, "text-[#8A9096]");
  line(`Compliance: ${org.compliance || "Not tracked"}`, "text-[#747B83]", "0 0 0");

  const btn = document.createElement("a");
  btn.textContent = "View on OpenStreetMap →";
  btn.href = `https://www.openstreetmap.org/?mlat=${org.latitude}&mlon=${org.longitude}#map=13/${org.latitude}/${org.longitude}`;
  btn.target = "_blank";
  btn.rel = "noopener noreferrer";
  btn.style.cssText =
    "display:block;margin-top:9px;text-align:center;background:#173B5C;color:#FBF1C9;border:0;border-radius:10px;padding:6px 10px;font-size:12px;font-weight:800;text-decoration:none;";
  root.appendChild(btn);

  return root;
};

export default function OrganizationLocationMap({
  fetcher,
  showFilters = false,
  height = 420,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerLayerRef = useRef(null);
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [type, setType] = useState("");

  useEffect(() => {
    let mounted = true;
    fetcher()
      .then((res) => {
        if (mounted) setOrgs(res?.data || []);
      })
      .catch((err) => {
        if (mounted) setError(err?.message || "Could not load organization locations.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [fetcher]);

  const plotted = useMemo(
    () => (type ? orgs.filter((o) => o.type === type) : orgs),
    [orgs, type]
  );

  /* One Leaflet map per mount, strict-mode safe. */
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
    const layer = L.layerGroup().addTo(map);
    mapRef.current = map;
    markerLayerRef.current = layer;
    return () => {
      map.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
    };
  }, []);

  /* Re-draw markers when the plot list changes. */
  useEffect(() => {
    const layer = markerLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    plotted.forEach((org) => {
      const lat = Number(org.latitude);
      const lng = Number(org.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const marker = L.marker([lat, lng], {
        icon: iconFor(org.type, org.key || org.name),
        title: org.name,
      });
      marker.bindPopup(() => orgPopupElement(org), { maxWidth: 320 });
      layer.addLayer(marker);
    });
  }, [plotted]);

  const hasMarkers = plotted.length > 0;

  const notFound =
    type && ![...new Set(orgs.map((o) => o.type))].includes(type);

  return (
    <div className="space-y-3">
      {showFilters && (
        <div className="flex flex-wrap gap-2">
          {["", ...ORGANIZATION_TYPES].map((t) => {
            const active = t === type;
            return (
              <button
                key={t || "all"}
                type="button"
                onClick={() => setType(t)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full border text-xs font-bold transition-colors ${
                  active
                    ? "bg-[#173B5C] text-white border-[#173B5C] shadow-sm"
                    : "bg-[#FFFDF8] text-[#747B83] border-[#E7E1D3] hover:bg-[#F5F1E7] hover:text-[#16263A]"
                }`}
              >
                {t ? (
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: TYPE_COLORS[t] || "#8A9096" }}
                  />
                ) : null}
                {t || "All"}
              </button>
            );
          })}
        </div>
      )}

      <div className="relative w-full rounded-2xl overflow-hidden border border-[#E7E1D3] shadow-sm" style={{ height }}>
        <div ref={containerRef} className="absolute inset-0 z-0" />
        <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center px-4">
          {loading ? (
            <div className="bg-[#FFFDF8]/95 border border-[#EEE9DA] rounded-xl px-4 py-2.5 text-sm font-bold text-[#747B83] shadow-lg">
              Loading organization locations…
            </div>
          ) : notFound ? (
            <div className="bg-[#FFFDF8]/95 border border-[#EEE9DA] rounded-xl px-5 py-3 text-sm font-bold text-[#747B83] shadow-lg text-center">
              No {type} organization is configured yet.
            </div>
          ) : !hasMarkers ? (
            <div className="bg-[#FFFDF8]/95 border border-[#EEE9DA] rounded-xl px-5 py-3 text-sm font-bold text-[#747B83] shadow-lg text-center">
              No organization locations available.
            </div>
          ) : null}
        </div>
      </div>

      {error && (
        <p className="text-xs font-bold text-[#8A1D1D]">{error}</p>
      )}

      {!loading && hasMarkers && (
        <p className="text-[11px] text-[#747B83] font-medium">
          {plotted.length} organization{plotted.length === 1 ? "" : "s"} · OSM + Leaflet · visual indicator only (no navigation)
        </p>
      )}
    </div>
  );
}