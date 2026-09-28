/* ============================================================
   SERVICE LOCATION MAP — single-marker Leaflet map for a service
   Reuses OpenStreetMap + Leaflet, same tile URL as FleetMap.
   Props: serviceLocation { name, address, city, state, pincode, latitude, longitude }
============================================================ */
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./fleetMap.css";
import { pinIconFor } from "./mapPins";

const TILE_URL =
  (import.meta.env.VITE_MAP_TILE_URL || "").trim() ||
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

export default function ServiceLocationMap({ serviceLocation, height = 320 }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  const loc = serviceLocation;
  const hasCoords = loc && loc.latitude != null && loc.longitude != null;
  const lat = hasCoords ? Number(loc.latitude) : null;
  const lng = hasCoords ? Number(loc.longitude) : null;
  const valid = hasCoords && Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

  useEffect(() => {
    if (!containerRef.current || !valid) return;
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
    const map = L.map(containerRef.current, {
      center: [lat, lng],
      zoom: 13,
      zoomControl: true,
    });
    L.tileLayer(TILE_URL, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    const icon = pinIconFor({ color: "#B48611" });
    const marker = L.marker([lat, lng], { icon }).addTo(map);
    const popupHtml = `<div style="min-width:180px"><strong>${loc.name || "Service Center"}</strong><br/>${[loc.address, loc.city, loc.state, loc.pincode].filter(Boolean).join(", ")}</div>`;
    marker.bindPopup(popupHtml, { maxWidth: 300 }).openPopup();
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [lat, lng, valid, loc]);

  if (!valid) {
    return (
      <div className="rounded-2xl border border-[#E7E1D3] bg-[#F5F1E7] p-6 text-center" style={{ height }}>
        <p className="text-sm font-semibold text-[#747B83]">Location unavailable</p>
        <p className="text-xs text-[#8A9096] mt-1">{loc ? [loc.address, loc.city, loc.state].filter(Boolean).join(", ") || "No coordinates" : "No service location"}</p>
      </div>
    );
  }

  const osmNavUrl = `https://www.openstreetmap.org/directions?from=&to=${lat}%2C${lng}#map=13/${lat}/${lng}`;

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="rounded-2xl border border-[#E7E1D3] overflow-hidden" style={{ height }} />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-[#747B83]">{[loc.name, loc.city, loc.state].filter(Boolean).join(" · ")}</span>
        <a href={osmNavUrl} target="_blank" rel="noreferrer" className="font-bold text-[#173B5C] hover:text-[#B48611]">Open in Maps →</a>
      </div>
    </div>
  );
}
