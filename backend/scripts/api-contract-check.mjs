/* ============================================================
   API CONTRACT REGRESSION CHECK
   ============================================================
   Captures the responses of a fixed set of authenticated endpoints and
   compares them against a previously captured baseline.

   This exists to prove that a schema change did not alter what the API
   returns. Volatile fields (request ids, freshly generated timestamps,
   "generated at" headers) are normalised before comparison so the diff
   reports real behavioural changes only.

   Usage:
     node scripts/api-contract-check.mjs capture <outfile.json>
     node scripts/api-contract-check.mjs compare <baseline.json> [actual.json]

   The base URL defaults to the backend directly; set CAPTURE_BASE to
   point at the Vite proxy instead.
   ============================================================ */

import fs from "node:fs";
import { signToken } from "../utils/auth.js";

const BASE = process.env.CAPTURE_BASE || "http://localhost:5000";

/* The user ids below must exist in the database being captured. They are
   the seeded development accounts. */
const TOKENS = {
  admin: signToken("user-1789798606613", "ADMIN"),
  user: signToken("user-1789799302203", "USER"),
  employee: signToken("emp-1790243875265", "EMPLOYEE"),
};

/* [method, path, tokenKey] */
const CASES = [
  ["GET", "/api/admin/me", "admin"],
  ["GET", "/api/profile", "user"],
  ["GET", "/api/profile/activity", "user"],
  ["GET", "/api/batteries?limit=5", "user"],
  ["GET", "/api/batteries?limit=5&page=2&sort=createdAt&order=desc", "admin"],
  ["GET", "/api/batteries/lookup?code=MVAE0014036", "user"],
  ["GET", "/api/services", "user"],
  ["GET", "/api/admin/services?limit=5", "admin"],
  ["GET", "/api/admin/customers", "admin"],
  ["GET", "/api/admin/analytics", "admin"],
  ["GET", "/api/admin/service-persons", "admin"],
  ["GET", "/api/admin/technicians", "admin"],
  ["GET", "/api/admin/users", "admin"],
  ["GET", "/api/battery-technician/me", "employee"],
  ["GET", "/api/analytics/fleet-stats", "admin"],
  ["GET", "/api/map/batteries?limit=3", "admin"],
  ["GET", "/api/map/organizations", "admin"],
  ["GET", "/api/services/service-centers", "user"],
  ["GET", "/api/auth/me", "user"],
];

/* Keys whose values legitimately change between two captures. */
const VOLATILE_KEYS = new Set([
  "requestId",
  "generatedAt",
  "fetchedAt",
  "xRequestId",
]);

/* ISO timestamps and Date.now()-style ids are normalised: two correct
   runs cannot produce byte-identical ids, and a difference there says
   nothing about a schema change. */
const normalise = (value) => {
  if (Array.isArray(value)) return value.map(normalise);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (VOLATILE_KEYS.has(k)) {
        out[k] = "<volatile>";
        continue;
      }
      out[k] = normalise(v);
    }
    return out;
  }
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/.test(value)) {
      return "<timestamp>";
    }
    if (/^(act|hist|tele|batt|sp|srv|usr|emp)-[\w-]*\d{10,}$/.test(value)) {
      return "<generated-id>";
    }
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC$/.test(value)) {
      return "<timestamp>";
    }
  }
  if (typeof value === "number" && String(value).length >= 13) {
    return "<epoch-ms>";
  }
  return value;
};

const capture = async () => {
  const results = {};
  for (const [method, path, tok] of CASES) {
    const res = await fetch(BASE + path, {
      method,
      headers: { Authorization: `Bearer ${TOKENS[tok]}` },
    });
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    results[`${method} ${path}`] = { status: res.status, body };
  }
  return results;
};

const diff = (a, b, trail = "") => {
  const out = [];
  if (a === b) return out;
  const ta = a === null ? "null" : Array.isArray(a) ? "array" : typeof a;
  const tb = b === null ? "null" : Array.isArray(b) ? "array" : typeof b;
  if (ta !== tb) {
    out.push(`${trail || "<root>"}: type ${ta} -> ${tb}`);
    return out;
  }
  if (ta === "array") {
    if (a.length !== b.length) {
      out.push(`${trail}: length ${a.length} -> ${b.length}`);
    }
    for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
      out.push(...diff(a[i], b[i], `${trail}[${i}]`));
    }
    return out;
  }
  if (ta === "object") {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      if (!(k in a)) out.push(`${trail}.${k}: added (${JSON.stringify(b[k])?.slice(0, 80)})`);
      else if (!(k in b)) out.push(`${trail}.${k}: removed (was ${JSON.stringify(a[k])?.slice(0, 80)})`);
      else out.push(...diff(a[k], b[k], `${trail}.${k}`));
    }
    return out;
  }
  out.push(`${trail}: ${JSON.stringify(a)?.slice(0, 60)} -> ${JSON.stringify(b)?.slice(0, 60)}`);
  return out;
};

const [mode, baselinePath, actualPath] = process.argv.slice(2);

if (mode === "capture") {
  if (!baselinePath) {
    console.error("usage: node scripts/api-contract-check.mjs capture <outfile.json>");
    process.exit(1);
  }
  const results = await capture();
  fs.writeFileSync(baselinePath, JSON.stringify(results, null, 2));
  console.log(`captured ${CASES.length} responses -> ${baselinePath}`);
  for (const [k, v] of Object.entries(results)) {
    console.log(`  ${String(v.status).padEnd(4)} ${k}`);
  }
} else if (mode === "compare") {
  if (!baselinePath) {
    console.error("usage: node scripts/api-contract-check.mjs compare <baseline.json> [actual.json]");
    process.exit(1);
  }
  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  const actual = actualPath ? JSON.parse(fs.readFileSync(actualPath, "utf8")) : await capture();

  let failures = 0;
  const keys = new Set([...Object.keys(baseline), ...Object.keys(actual)]);
  for (const key of keys) {
    const b = baseline[key];
    const a = actual[key];
    if (!b) {
      console.log(`ADDED    ${key}`);
      continue;
    }
    if (!a) {
      console.log(`MISSING  ${key}`);
      failures += 1;
      continue;
    }
    if (b.status !== a.status) {
      console.log(`STATUS   ${key}: ${b.status} -> ${a.status}`);
      failures += 1;
      continue;
    }
    if (b.status !== 200) {
      const deltas = diff(normalise(b.body), normalise(a.body), "body");
      if (deltas.length) {
        console.log(`BODY     ${key} (${b.status}):`);
        deltas.slice(0, 10).forEach((d) => console.log(`           ${d}`));
        failures += 1;
      }
      continue;
    }
    const deltas = diff(normalise(b.body), normalise(a.body), "body");
    if (deltas.length) {
      console.log(`DIFF     ${key}:`);
      deltas.slice(0, 12).forEach((d) => console.log(`           ${d}`));
      if (deltas.length > 12) console.log(`           ...and ${deltas.length - 12} more`);
      failures += 1;
    } else {
      console.log(`OK       ${key}`);
    }
  }
  console.log(failures === 0 ? "\nPASS: no contract differences" : `\nFAIL: ${failures} endpoint(s) differ`);
  process.exit(failures === 0 ? 0 : 1);
} else {
  console.error("usage: node scripts/api-contract-check.mjs <capture|compare> ...");
  process.exit(1);
}
