/* ============================================================
   MAP PIN ICONS — shared Google-Maps-style location pins.
   One SVG pin source (PIN_PATH) reused by FleetMap (battery +
   organisation markers), OrganizationLocationMap, ServiceLocationMap
   and the compliance-legend glyphs. Per-facility codes make
   Manufacturer / Service Provider / Reseller / Recycler /
   Collection Center visually distinct at a glance.

   Plain divIcons — no default Leaflet icon image URLs.
   ============================================================ */
import L from "leaflet";

export const PIN_PATH =
  "M15 2c-6.9 0-12.5 5.4-12.5 12.2C2.5 23 15 38 15 38s12.5-15 12.5-23.8C27.5 7.4 22 2 15 2z";

export const ORG_CODES = {
  Manufacturer: "M",
  "Service Provider": "S",
  Reseller: "R",
  Recycler: "RC",
  "Collection Center": "CC",
};

export const pinSvg = (color, code = "") => {
  const multi = code.length > 1;
  const inner = code
    ? `<circle cx="15" cy="14.5" r="6.4" fill="#FFFDF8"/><text x="15" y="${multi ? 16.6 : 17.4}" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="${multi ? 6.5 : 9}" font-weight="800" fill="${color}">${code}</text>`
    : `<circle cx="15" cy="14.5" r="6.4" fill="#FFFDF8"/>`;
  return (
    `<svg width="30" height="42" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
    `<path d="${PIN_PATH}" fill="${color}" stroke="#FFFDF8" stroke-width="2.5"/>${inner}</svg>`
  );
};

/* Standard Leaflet divIcon pin. Anchor is the pin tip (the exact
   coordinate), so the popup hangs above the pin head. */
export const pinIconFor = ({ color, code = "", key = null }) =>
  L.divIcon({
    className: "maxspace-marker",
    html: `<div class="maxspace-marker-pin"${key ? ` data-key="${key}"` : ""}>${pinSvg(color, code)}</div>`,
    iconSize: [30, 42],
    iconAnchor: [15, 42],
    popupAnchor: [0, -36],
  });

export default pinIconFor;