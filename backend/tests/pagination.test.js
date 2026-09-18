/* MaxSpace backend unit tests (Node's built-in test runner).
   Run: npm test  (from backend/) — no database or live server required. */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  parsePagination,
  buildPagination,
  paginateArray,
  matchesSearch,
  compareSorted,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from "../utils/pagination.js";
import {
  assertServiceIntegrity,
  normalizeTicketNumber,
  VALID_PRIORITIES,
} from "../utils/serviceValidation.js";

const errorStatus = (fn) => {
  try {
    fn();
    return null;
  } catch (err) {
    return err.statusCode;
  }
};

test("parsePagination: empty/absent query falls back to defaults", () => {
  const p = parsePagination();
  assert.equal(p.page, DEFAULT_PAGE);
  assert.equal(p.limit, DEFAULT_LIMIT);
  assert.equal(p.offset, 0);
  assert.equal(p.sort, "");
  assert.equal(p.order, "asc");

  const empty = parsePagination({});
  assert.deepEqual(empty, p);
});

test("parsePagination: parses valid page/limit/sort/order", () => {
  const p = parsePagination({ page: "2", limit: "50", sort: "createdAt", order: "desc" });
  assert.equal(p.page, 2);
  assert.equal(p.limit, 50);
  assert.equal(p.offset, 50);
  assert.equal(p.sort, "createdAt");
  assert.equal(p.order, "desc");
});

test("parsePagination: clamps invalid and out-of-range values", () => {
  assert.equal(parsePagination({ page: "0" }).page, 1);
  assert.equal(parsePagination({ page: "-3" }).page, 1);
  assert.equal(parsePagination({ page: "abc" }).page, 1);
  assert.equal(parsePagination({ limit: "-5" }).limit, DEFAULT_LIMIT);
  assert.equal(parsePagination({ limit: "abc" }).limit, DEFAULT_LIMIT);
  assert.equal(parsePagination({ limit: "999" }).limit, MAX_LIMIT);
  assert.equal(parsePagination({ page: "0", limit: "999" }).offset, 0);
});

test("parsePagination: order is normalized to asc/desc only", () => {
  assert.equal(parsePagination({ order: "DESC" }).order, "desc");
  assert.equal(parsePagination({ order: "garbage" }).order, "asc");
});

test("buildPagination: empty result set has 0 total pages", () => {
  const p = buildPagination(1, 20, 0);
  assert.equal(p.total, 0);
  assert.equal(p.totalPages, 0);
  assert.equal(p.hasNextPage, false);
  assert.equal(p.hasPreviousPage, false);
  assert.equal(p.nextPage, null);
  assert.equal(p.previousPage, null);
});

test("buildPagination: computes pages and next/prev correctly", () => {
  const last = buildPagination(5, 20, 100); // exactly 5 pages
  assert.equal(last.totalPages, 5);
  assert.equal(last.hasNextPage, false);
  assert.equal(last.nextPage, null);
  assert.equal(last.hasPreviousPage, true);
  assert.equal(last.previousPage, 4);

  const mid = buildPagination(2, 20, 61); // 4 pages, 1 row on the last
  assert.equal(mid.totalPages, 4);
  assert.equal(mid.hasNextPage, true);
  assert.equal(mid.nextPage, 3);

  const first = buildPagination(1, 20, 61);
  assert.equal(first.hasPreviousPage, false);
  assert.equal(first.previousPage, null);
});

test("paginateArray: slices in memory and reports totals", () => {
  const items = Array.from({ length: 25 }, (_, i) => ({ i }));
  const { data, pagination } = paginateArray(items, { page: 2, limit: 10 });
  assert.equal(data.length, 10);
  assert.equal(data[0].i, 10);
  assert.equal(pagination.total, 25);
  assert.equal(pagination.totalPages, 3);
  assert.equal(pagination.hasNextPage, true);
});

test("matchesSearch: case-insensitive substring matching", () => {
  assert.equal(matchesSearch("Periodic Health Diagnostic", "health"), true);
  assert.equal(matchesSearch("Periodic Health Diagnostic", "HEALTH"), true);
  assert.equal(matchesSearch("Periodic Health Diagnostic", ""), true);
  assert.equal(matchesSearch("Periodic Health Diagnostic", "xyz"), false);
  assert.equal(matchesSearch(null, "x"), false);
});

test("compareSorted: numeric, date, and string ordering", () => {
  const rows = [
    { id: "a", count: 3, createdAt: "2026-01-02" },
    { id: "b", count: 1, createdAt: "2026-01-03" },
    { id: "c", count: 2, createdAt: "2026-01-01" },
  ];
  const byCountAsc = [...rows].sort((a, b) => compareSorted(a, b, "count", "asc"));
  assert.deepEqual(byCountAsc.map((r) => r.id), ["b", "c", "a"]);

  const byCountDesc = [...rows].sort((a, b) => compareSorted(a, b, "count", "desc"));
  assert.deepEqual(byCountDesc.map((r) => r.id), ["a", "c", "b"]);

  // default field is createdAt (falls back when sortBy is unknown)
  const byDate = [...rows].sort((a, b) => compareSorted(a, b, "nope", "asc"));
  assert.deepEqual(byDate.map((r) => r.id), ["c", "a", "b"]);
});

test("assertServiceIntegrity: accepts valid status + priority", () => {
  assert.doesNotThrow(() => assertServiceIntegrity({ status: "Accepted", priority: "High" }));
  assert.doesNotThrow(() => assertServiceIntegrity({ status: "Completed" }));
});

test("assertServiceIntegrity: rejects invalid status with 400", () => {
  const status = errorStatus(() => assertServiceIntegrity({ status: "Not A Status" }));
  assert.equal(status, 400);
});

test("assertServiceIntegrity: rejects invalid priority with 400", () => {
  const priority = errorStatus(() =>
    assertServiceIntegrity({ status: "Confirmed", priority: "Extreme" })
  );
  assert.equal(priority, 400);
  assert.ok(VALID_PRIORITIES.includes("Normal"));
});

test("normalizeTicketNumber: returns unique values unchanged", () => {
  assert.equal(normalizeTicketNumber("SRV-2026-1234", ["SRV-2026-9999"]), "SRV-2026-1234");
  assert.equal(normalizeTicketNumber("", []), "");
});

test("normalizeTicketNumber: suffixes duplicates", () => {
  const existing = ["SRV-2026-1234"];
  const next = normalizeTicketNumber("SRV-2026-1234", existing);
  assert.notEqual(next, "SRV-2026-1234");
  assert.ok(next.startsWith("SRV-2026-1234-"));
});