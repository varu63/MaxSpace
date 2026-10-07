/* MaxSpace backend unit tests (Node's built-in test runner).
   Run: npm test  (from backend/) — no database or live server required. */
import { test } from "node:test";
import assert from "node:assert/strict";

import { parseBookingLocation, hasBookingLocation } from "../utils/serviceBookingLocation.js";
import { mapNominatimPlace } from "../utils/nominatim.js";

const statusOf = (fn) => {
  try {
    fn();
    return null;
  } catch (err) {
    return err.statusCode;
  }
};

const FULL = {
  address: "42, MG Road, Ashok Nagar, Bengaluru, Karnataka 560001, India",
  city: "Bengaluru",
  state: "Karnataka",
  pincode: "560001",
  latitude: 12.9716,
  longitude: 77.5946,
};

test("parseBookingLocation: full location round-trips with numbers", () => {
  const loc = parseBookingLocation({ location: FULL });
  assert.equal(loc.address, FULL.address);
  assert.equal(loc.city, "Bengaluru");
  assert.equal(loc.state, "Karnataka");
  assert.equal(loc.pincode, "560001");
  assert.equal(loc.latitude, 12.9716);
  assert.equal(loc.longitude, 77.5946);
});

test("parseBookingLocation: accepts flat input as well as { location }", () => {
  const nested = parseBookingLocation({ location: FULL });
  const flat = parseBookingLocation(FULL);
  assert.deepEqual(flat, nested);
});

test("parseBookingLocation: missing location is not an error (booking must not be blocked)", () => {
  for (const input of [undefined, null, {}, { location: null }, { location: {} }]) {
    const loc = parseBookingLocation(input);
    assert.equal(loc.address, null);
    assert.equal(loc.latitude, null);
    assert.equal(loc.longitude, null);
    assert.equal(hasBookingLocation(loc), false);
  }
  assert.equal(hasBookingLocation(parseBookingLocation(FULL)), true);
});

test("parseBookingLocation: sanitises control characters, tags and whitespace", () => {
  const loc = parseBookingLocation({
    address: "  42,\u0000\n MG\u003cscript\u003e Road   ",
    city: "<b>Bengaluru</b>",
    state: "Karnataka\u0007",
  });
  assert.equal(loc.address, "42, MGscript Road");
  assert.equal(loc.city, "bBengaluru/b");
  assert.equal(loc.state, "Karnataka");
});

test("parseBookingLocation: hard-caps overlong strings", () => {
  const loc = parseBookingLocation({
    address: "x".repeat(1000),
    city: "c".repeat(300),
    state: "s".repeat(300),
    pincode: "12345678901234567890",
  });
  assert.equal(loc.address.length, 400);
  assert.equal(loc.city.length, 100);
  assert.equal(loc.state.length, 100);
  assert.equal(loc.pincode.length, 12);
});

test("parseBookingLocation: pincode keeps only postal characters", () => {
  assert.equal(parseBookingLocation({ ...FULL, pincode: "560 001 <x>" }).pincode, "560 001 x");
  assert.equal(parseBookingLocation({ ...FULL, pincode: "!!!@@@###" }).pincode, null);
});

test("parseBookingLocation: coordinates are range-checked (never trusted raw)", () => {
  assert.equal(statusOf(() => parseBookingLocation({ ...FULL, latitude: 91 })), 400);
  assert.equal(statusOf(() => parseBookingLocation({ ...FULL, latitude: -91 })), 400);
  assert.equal(statusOf(() => parseBookingLocation({ ...FULL, longitude: 181 })), 400);
  assert.equal(statusOf(() => parseBookingLocation({ ...FULL, latitude: "abc" })), 400);
  assert.equal(statusOf(() => parseBookingLocation({ ...FULL, longitude: "abc" })), 400);
});

test("parseBookingLocation: coordinates must come together", () => {
  assert.equal(
    statusOf(() => parseBookingLocation({ address: FULL.address, latitude: 12.9 })),
    400
  );
  assert.equal(
    statusOf(() => parseBookingLocation({ address: FULL.address, longitude: 77.5 })),
    400
  );
});

test("parseBookingLocation: coordinates are rounded to NUMERIC(9,6) precision", () => {
  const loc = parseBookingLocation({
    address: "somewhere",
    latitude: 28.6280004999,
    longitude: 77.3649005,
  });
  assert.equal(loc.latitude, 28.628);
  assert.equal(loc.longitude, 77.364901);
});

test("parseBookingLocation: string coordinates from JSON clients are accepted", () => {
  const loc = parseBookingLocation({ ...FULL, latitude: "12.9716", longitude: "77.5946" });
  assert.equal(loc.latitude, 12.9716);
  assert.equal(loc.longitude, 77.5946);
});

/* ---------- Nominatim result shaping ---------- */

test("mapNominatimPlace: builds house / area / city / state / pincode parts", () => {
  const mapped = mapNominatimPlace({
    place_id: 123,
    osm_type: "way",
    osm_id: 999,
    lat: "12.9716000",
    lon: "77.5946000",
    display_name: "42, MG Road, Ashok Nagar, Bengaluru, Karnataka 560001, India",
    address: {
      building: "Prestige Tower",
      house_number: "42",
      road: "MG Road",
      neighbourhood: "Ashok Nagar",
      city: "Bengaluru",
      state: "Karnataka",
      postcode: "560001",
      country: "India",
    },
  });
  assert.equal(mapped.id, "way/999");
  assert.equal(mapped.house, "Prestige Tower 42 MG Road");
  assert.equal(mapped.area, "Ashok Nagar");
  assert.equal(mapped.city, "Bengaluru");
  assert.equal(mapped.state, "Karnataka");
  assert.equal(mapped.pincode, "560001");
  assert.equal(mapped.latitude, 12.9716);
  assert.equal(mapped.longitude, 77.5946);
  assert.equal(mapped.address, mapped.label);
});

test("mapNominatimPlace: rejects malformed / out-of-range upstream rows", () => {
  assert.equal(mapNominatimPlace(null), null);
  assert.equal(mapNominatimPlace({}), null);
  assert.equal(
    mapNominatimPlace({ display_name: "x", lat: "999", lon: "0", address: {} }),
    null
  );
  assert.equal(
    mapNominatimPlace({ display_name: "x", lat: "abc", lon: "0", address: {} }),
    null
  );
});
