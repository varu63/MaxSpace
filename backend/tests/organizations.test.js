import test from "node:test";
import assert from "node:assert/strict";
import {
  ORGANIZATION_LOCATIONS,
  ORGANIZATION_TYPES,
  filterOrganizations,
  organizationsForRole,
} from "../utils/organizationLocations.js";

test("organization locations cover the 6 required development cities", () => {
  const cities = ORGANIZATION_LOCATIONS.map((o) => o.city.toLowerCase());
  for (const required of ["delhi", "noida", "gurugram", "mumbai", "pune", "bengaluru"]) {
    assert.ok(cities.includes(required), `missing dev marker for ${required}`);
  }
});

test("every organization marker has a valid type, coordinates and compliance status", () => {
  for (const o of ORGANIZATION_LOCATIONS) {
    assert.ok(ORGANIZATION_TYPES.includes(o.type), `bad type ${o.type}`);
    assert.equal(typeof o.latitude, "number", `${o.key} latitude`);
    assert.equal(typeof o.longitude, "number", `${o.key} longitude`);
    assert.ok(o.name, `${o.key} name`);
    assert.ok(o.compliance, `${o.key} compliance`);
  }
});

test("the five example organisation types are all represented", () => {
  const types = new Set(ORGANIZATION_LOCATIONS.map((o) => o.type));
  for (const t of ["Manufacturer", "Service Provider", "Reseller", "Recycler", "Collection Center"]) {
    assert.ok(types.has(t), `missing marker type ${t}`);
  }
});

test("filterOrganizations filters by type and returns all for empty", () => {
  assert.equal(filterOrganizations("").length, ORGANIZATION_LOCATIONS.length);
  assert.ok(filterOrganizations("Recycler").every((o) => o.type === "Recycler"));
  assert.equal(filterOrganizations("Recycler").length, 1);
  assert.equal(filterOrganizations("Not A Real Type").length, 0);
});

test("ADMIN sees the whole organisation network", () => {
  const all = organizationsForRole("ADMIN", "");
  assert.equal(all.length, ORGANIZATION_LOCATIONS.length);
  const withType = organizationsForRole("ADMIN", "Recycler");
  assert.equal(withType.length, 1);
  assert.equal(withType[0].type, "Recycler");
});

test("USER sees only Service Provider facilities, never company network data", () => {
  const userOrgs = organizationsForRole("USER", "");
  assert.ok(userOrgs.length > 0, "user should see relevant service locations");
  assert.ok(userOrgs.every((o) => o.type === "Service Provider"));
  assert.ok(userOrgs.every((o) => !["Manufacturer", "Reseller", "Recycler", "Collection Center"].includes(o.type)));
});

test("EMPLOYEE (technician) sees only Service Provider facilities as their work sites", () => {
  const techOrgs = organizationsForRole("EMPLOYEE", "");
  assert.ok(techOrgs.every((o) => o.type === "Service Provider"));
});

test("Users/technicians cannot enumerate company facilities via the type filter", () => {
  assert.equal(organizationsForRole("USER", "Manufacturer").length, 0);
  assert.equal(organizationsForRole("EMPLOYEE", "Recycler").length, 0);
  const userServiceProviders = organizationsForRole("USER", "Service Provider");
  assert.ok(userServiceProviders.every((o) => o.type === "Service Provider"));
});