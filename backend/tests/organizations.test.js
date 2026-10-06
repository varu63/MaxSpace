import test from "node:test";
import assert from "node:assert/strict";

/* Which facilities a role may see on the network map is policy, not data:
   it is asserted here without a database, while the store-backed filtering
   that consumes this matrix is covered by tests/map.test.js. */
import {
  ORGANIZATION_TYPES,
  ROLE_ORG_TYPES,
  allowedTypesForRole,
} from "../utils/organizationAccess.js";
import { ownerScopeFor, NO_OWNER_MATCH } from "../utils/ownerScope.js";

test("the organisation types a marker can carry are a fixed vocabulary", () => {
  for (const t of ["Manufacturer", "Service Provider", "Reseller", "Recycler", "Collection Center"]) {
    assert.ok(ORGANIZATION_TYPES.includes(t), `missing organisation type ${t}`);
  }
});

test("ADMIN is the only role allowed to see the whole organisation network", () => {
  // null is the "everything" marker; every other role must carry a list.
  assert.equal(ROLE_ORG_TYPES.ADMIN, null);
  for (const [role, allowed] of Object.entries(ROLE_ORG_TYPES)) {
    if (role === "ADMIN") continue;
    assert.ok(Array.isArray(allowed), `${role} must not fall back to the whole network`);
  }
});

test("USER and EMPLOYEE see only Service Providers, never company facilities", () => {
  assert.deepEqual(ROLE_ORG_TYPES.USER, ["Service Provider"]);
  assert.deepEqual(ROLE_ORG_TYPES.EMPLOYEE, ["Service Provider"]);
});

test("an EPR partner sees no facility network at all", () => {
  // A partner reaches a battery through its end-of-life assignment, not
  // through the facility map. Falling back to "everything" here would hand
  // an external company the whole MaxSpace facility network.
  assert.deepEqual(ROLE_ORG_TYPES.PARTNER, []);
  assert.deepEqual(allowedTypesForRole("PARTNER"), []);
});

test("an unrecognised role fails closed instead of inheriting ADMIN's reach", () => {
  // A role added to the users table later must start with no visibility.
  // Being absent from the matrix is safe precisely because the lookup
  // resolves it to an empty list rather than to "everything".
  for (const role of ["", "SOMETHING_NEW", "partner", "technician", undefined, null]) {
    assert.deepEqual(allowedTypesForRole(role), [], `role ${role} must see no facilities`);
  }
  assert.notEqual(allowedTypesForRole(undefined), null);
});

test("owner scope never widens a partner to the whole fleet", () => {
  // null means "no owner filter" = every battery. That is right for the
  // operator roles and for an anonymous public read, and wrong for a
  // partner, who must match nothing here.
  assert.equal(ownerScopeFor({ user: { role: "ADMIN" } }), null);
  assert.equal(ownerScopeFor({ user: { role: "EMPLOYEE" } }), null);
  assert.equal(ownerScopeFor({ user: null }), null);

  assert.equal(ownerScopeFor({ user: { role: "USER", id: "u-1" } }), "u-1");
  assert.equal(ownerScopeFor({ user: { role: "PARTNER", id: "ptr-1" } }), NO_OWNER_MATCH);
  assert.ok(NO_OWNER_MATCH < 0, "the sentinel must not be a real owner id");
});