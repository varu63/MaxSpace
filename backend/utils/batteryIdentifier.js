/* ============================================================
   BATTERY IDENTIFIER HELPERS
   A scanned QR payload can be any one of:
     • internal id            → batt-1
     • barcode                → BATT-EV-9823-LFP
     • serial number          → SN-2024-EV-88390
     • EU DPP passport URI    → https://passport.battery-eu.org/passports/BATT-EV-9823-LFP
   These helpers normalize the raw scanned string into the bare
   battery code used for database lookups, so scanning the physical
   QR sticker resolves to the correct battery record.
============================================================ */

/* Extract the bare battery code from a QR payload string. */
export const normalizeBatteryIdentifier = (value) => {
  let clean = String(value || "").trim();
  if (!clean) return "";

  // /passports/<code>, /passport/<code>, /id/<code>, /serial/<code> …
  const routeMatch = clean.match(
    /^https?:\/\/[^/]+\/(?:passports?|ids?|serial|barcode)\/([^/?#]+)/i
  );
  if (routeMatch) return routeMatch[1].split(/[?#]/)[0];

  // Any other http(s) payload → use the last path segment (the code).
  if (/^https?:\/\//i.test(clean)) {
    const segments = clean.split("/").filter(Boolean);
    const last = segments[segments.length - 1] || "";
    return last.split(/[?#]/)[0];
  }

  // Query-style payloads such as passport?identifier=CODE
  const queryMatch = clean.match(/(?:identifier|code|barcode|serial)=([^&#]+)/i);
  if (queryMatch) return queryMatch[1];

  return clean;
};

/* Resolve a raw scanned identifier to a battery record in the store.
   Tries id first, then barcode/serial (case-insensitive). */
export const resolveBatteryByIdentifier = async (store, rawValue) => {
  const identifier = normalizeBatteryIdentifier(rawValue);
  if (!identifier) return null;

  let battery = await store.getBatteryById(identifier);
  if (!battery) {
    battery = await store.findBatteryByBarcodeOrSerial(identifier);
  }
  return battery || null;
};