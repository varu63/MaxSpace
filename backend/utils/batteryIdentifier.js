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

/* Parse a physical QR payload (key: value lines or JSON) into structured fields.
   Returns null when the string is not a key/value QR payload. */
export const parseBatteryQrPayload = (value) => {
  const clean = String(value || "").trim();
  if (!clean) return null;

  // JSON payload support
  if (clean.startsWith("{") && clean.endsWith("}")) {
    try {
      const obj = JSON.parse(clean);
      if (typeof obj === "object" && obj !== null) {
        return {
          batteryId: obj.batteryId || obj.battery_id || obj.id || null,
          model: obj.model || obj.modelName || obj.model_name || null,
          modalId: obj.modalId || obj.modal_id || null,
          serialNumber: obj.serialNumber || obj.serial_number || obj.serial || null,
          hangStatus: obj.hangStatus != null ? String(obj.hangStatus) : (obj.hang_status != null ? String(obj.hang_status) : null),
          overallStatus: obj.overallStatus || obj.overall_status || null,
        };
      }
    } catch {
      // Not JSON, continue to text patterns
    }
  }

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

  // App route: /battery/:id or /battery/:id/passport
  const appRouteMatch = clean.match(
    /^https?:\/\/[^/]+\/battery\/([^/?#]+)(?:\/passport)?/i
  );
  if (appRouteMatch) return appRouteMatch[1].split(/[?#]/)[0];

  // /passports/<code>, /passport/<code>, /id/<code>, /serial/<code>, /barcode/<code>
  const routeMatch = clean.match(
    /^https?:\/\/[^/]+\/(?:passports?|ids?|serial|barcode|battery)\/([^/?#]+)/i
  );
  if (routeMatch) return routeMatch[1].split(/[?#]/)[0];

  // Any other http(s) payload → check if trailing segment is "passport"
  if (/^https?:\/\//i.test(clean)) {
    const segments = clean.split("/").filter(Boolean);
    if (segments.length > 0) {
      const last = segments[segments.length - 1] || "";
      if (/^passports?$/i.test(last) && segments.length > 1) {
        return segments[segments.length - 2].split(/[?#]/)[0];
      }
      return last.split(/[?#]/)[0];
    }
  }

  // Query-style payloads such as passport?identifier=CODE
  const queryMatch = clean.match(/(?:identifier|code|barcode|serial|battery_id|batteryId|modal_id|modalId)=([^&#]+)/i);
  if (queryMatch) return decodeURIComponent(queryMatch[1]);

  return clean;
};

/* Resolve a raw scanned identifier to a battery record in the store.
   Tries id first, then barcode/serial/modal-id (case-insensitive).
   An optional ownerId enforces per-user isolation when explicitly requested. */
export const resolveBatteryByIdentifier = async (store, rawValue, ownerId = null) => {
  const identifier = normalizeBatteryIdentifier(rawValue);
  if (!identifier) return null;

  let battery = await store.getBatteryById(identifier, ownerId);
  if (!battery) {
    battery = await store.findBatteryByBarcodeOrSerial(identifier, ownerId);
  }

  // If not found and identifier starts with "batt-", try without "batt-" prefix
  if (!battery && identifier.startsWith("batt-")) {
    const stripped = identifier.replace(/^batt-/, "");
    battery = await store.findBatteryByBarcodeOrSerial(stripped, ownerId);
  }

  // If not found and identifier doesn't start with "batt-", try with "batt-" prefix
  if (!battery && !identifier.startsWith("batt-")) {
    battery = await store.getBatteryById(`batt-${identifier}`, ownerId);
    if (!battery) {
      battery = await store.findBatteryByBarcodeOrSerial(`batt-${identifier}`, ownerId);
    }
  }

  return battery || null;
};