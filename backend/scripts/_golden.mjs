/* Capture golden API responses from whichever DATABASE_URL is configured.
   Usage: node _golden.mjs <outfile.json> */
import fs from "node:fs";
import { signToken } from "../utils/auth.js";

const out = process.argv[2];
if (!out) {
  console.error("usage: node _golden.mjs <outfile.json>");
  process.exit(1);
}

const TOKENS = {
  admin: signToken("user-1789798606613", "ADMIN"),
  user: signToken("user-1789799302203", "USER"),
  employee: signToken("emp-1790243875265", "EMPLOYEE"),
};

const BASE = process.env.CAPTURE_BASE || "http://localhost:5173";

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

const results = {};
for (const [method, path, tok] of CASES) {
  const url = BASE + path;
  const res = await fetch(url, {
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

fs.writeFileSync(out, JSON.stringify(results, null, 2));
console.log(`captured ${CASES.length} responses -> ${out}`);
for (const [k, v] of Object.entries(results)) {
  const size = JSON.stringify(v.body).length;
  console.log(`  ${String(v.status).padEnd(4)} ${k}  (${size} bytes)`);
}
