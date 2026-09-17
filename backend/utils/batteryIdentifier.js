/* ============================================================
   BATTERY IDENTIFIER HELPERS
   A scanned QR payload can be any one of:
     • internal id            → batt-1
     • barcode                → BATT-EV-9823-LFP
     • serial number          → SN-2024-EV-88390
     • EU DPP passport URI    → https://passport.battery-eu.org/passports/BATT-EV-9823-LFP
     • physical QR payload    → "Battery ID: MVAE0014036\nModel: 12.8V 100AH ...\n..."
   These helpers normalize the raw scanned string into the bare
   battery code used for database lookups, so scanning the physical
   QR sticker resolves to the correct battery record.
============================================================ */

/* Parse a physical QR payload (key: value lines) into structured fields.
   Returns null when the string is not a key/value QR payload. */
export const parseBatteryQrPayload = (value) => {
  const clean = String(value || "").trim();
  if (!clean) return null;

  const grab = (pattern) => {
    const match = clean.match(pattern);
    return match && match[1] ? match[1].trim() : null;
  };

  return {
    batteryId: grab(/Battery\s+ID:\s*([^\r\n]+)/i),
    model: grab(/Model:\s*([^\r\n]+)/i),
    modalId: grab(/Modal\s+ID:\s*([^\r\n]+)/i),
    serialNumber: grab(/Serial(?:\s+Number)?:\s*([^\r\n]+)/i),
    hangStatus: grab(/Hang\s+Status:\s*([^\r\n]+)/i),
    overallStatus: grab(/Overall\s+Status:\s*([^\r\n]+)/i),
  };
};

export const isBatteryQrPayload = (value) => {
  const parsed = parseBatteryQrPayload(value);
  return Boolean(parsed && (parsed.batteryId || parsed.modalId || parsed.serialNumber));
};

/* Prefer the strongest identifier embedded in a QR payload. */
export const getBatteryPayloadIdentifier = (value) => {
  const parsed = parseBatteryQrPayload(value);
  if (!parsed) return "";
  return (parsed.batteryId || parsed.modalId || parsed.serialNumber || "").trim();
};

/* Extract the bare battery code from a QR payload string. */
export const normalizeBatteryIdentifier = (value) => {
  let clean = String(value || "").trim();
  if (!clean) return "";

  // Physical QR payload → use its embedded Battery / Modal ID or serial.
  if (isBatteryQrPayload(clean)) {
    return getBatteryPayloadIdentifier(clean);
  }

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
   Tries id first, then barcode/serial/modal-id (case-insensitive).
   An optional ownerId enforces per-user isolation — batteries owned
   by another user are never returned. */
export const resolveBatteryByIdentifier = async (store, rawValue, ownerId = null) => {
  const identifier = normalizeBatteryIdentifier(rawValue);
  if (!identifier) return null;

  let battery = await store.getBatteryById(identifier, ownerId);
  if (!battery) {
    battery = await store.findBatteryByBarcodeOrSerial(identifier, ownerId);
  }
  return battery || null;
};