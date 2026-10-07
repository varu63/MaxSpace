/* ============================================================
   SERVICE LOCATION — shared shape + helpers for the booking form
   The location object stored on a service booking:
     { address, latitude, longitude, city, state, pincode }
   Strings start empty (the backend stores them as NULL) and
   coordinates stay null unless a suggestion / GPS lookup was used.
   ============================================================ */

export const EMPTY_SERVICE_LOCATION = {
  address: "",
  latitude: null,
  longitude: null,
  city: "",
  state: "",
  pincode: "",
};

export const isServiceLocationFilled = (location) =>
  Boolean((location?.address || "").trim());

export const locationHasCoordinates = (location) =>
  Boolean(
    location &&
      Number.isFinite(Number(location.latitude)) &&
      Number.isFinite(Number(location.longitude))
  );

export const formatStructuredLocation = (location) =>
  [location?.city, location?.state, location?.pincode]
    .filter(Boolean)
    .join(", ");