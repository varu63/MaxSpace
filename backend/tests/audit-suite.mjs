/* MaxSpace complete API audit test — run against a live backend.
   Requires DATA_SOURCE=postgres (seeded via POST /api/data/reset).
   DANGEROUS: this suite TRUNCATEs the app tables and replants demo seed
   data (see section 0). It must ONLY run against a disposable dev
   database, so it refuses to run unless ALLOW_DB_RESET=true. On the
   production database (maxvolt_prod) /api/data/reset is locked and this
   suite is inert by design.
   Run: npm run test:audit  (backed by the ./server entry that reads .env)
*/
import { config as readDotenv } from "dotenv";
readDotenv({ path: new URL("../.env", import.meta.url) });
if (process.env.ALLOW_DB_RESET !== "true") {
  console.log(
    "SKIP: audit-suite is destructive (TRUNCATE + seed). Set ALLOW_DB_RESET=true in backend/.env on a disposable dev DB to run it."
  );
  process.exit(0);
}
const ROOT = "http://localhost:5000";
const BASE = `${ROOT}/api`;

let pass = 0, fail = 0;
const results = [];
const name = (n) => n.padEnd(72, " ");
const check = (cond, label, extra = "") => {
  if (cond) { pass++; console.log(`  PASS  ${label}${extra ? "  ->  " + extra : ""}`); }
  else { fail++; console.log(`  FAIL  ${label}  ${extra}`); }
};

const req = async (path, { method = "GET", token, body } = {}) => {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  return { status: res.status, data };
};
const rootReq = async (path, opts = {}) => req(path, { ...opts, ...{} }) && null; // placeholder
const rawFetch = async (url, opts = {}) => {
  const res = await fetch(url, { method: opts.method || "GET", headers: opts.headers, body: opts.body });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
};

const uid = Date.now().toString().slice(-8);
const tempEmail = `audit.${uid}@example.com`;

console.log("\n# 0. Server health");
const health = await rawFetch(ROOT + "/");
check(health.status === 200 && health.data?.message === "MaxSpace API is running", name("GET / health"), `dataSource=${health.data?.dataSource}`);
check(health.data?.databaseConnected === true, name("database connected"), `db=${health.data?.databaseConfigured}`);
check(health.data?.dataSource === "postgres", name("active data source is postgres"), health.data?.dataSource);

// Reset to a known seed baseline so test expectations hold regardless of prior drift
let adminToken = null;
let r0 = await req("/admin/login", { method: "POST", body: { email: "admin@maxspace.com", password: "admin123" } });
adminToken = r0.data?.token;
r0 = await req("/data/reset", { method: "POST", token: adminToken });
check(r0.status === 200 && r0.data?.message, name("data reset to seed baseline"), r0.data?.message || r0.status);

console.log("\n# 1. User auth");
let r = await req("/auth/signin", { method: "POST", body: { email: "alex.rivera@maxspace-energy.com", password: "password123" } });
check(r.status === 200 && r.data?.token, name("user signin"), r.data?.user?.role || r.status);
let userToken = r.data?.token;
check(userToken && r.data?.user?.password === undefined, name("user object sanitized (no password)"));
check(r.data?.user?.email === "alex.rivera@maxspace-energy.com", name("user role + email in payload"));

r = await req("/auth/signin", { method: "POST", body: { email: "alex.rivera@maxspace-energy.com", password: "WRONG" } });
check(r.status === 401, name("user signin wrong password -> 401"), r.status);

r = await req("/auth/signup", { method: "POST", body: { name: "Audit Tester", email: tempEmail, password: "secret123", confirmPassword: "secret123" } });
check(r.status === 201 && r.data?.token, name("user signup"), `created ${tempEmail}`);
const tempUserToken = r.data?.token;
check(r.data?.user?.password === undefined, name("signup user sanitized"));

r = await req("/auth/signup", { method: "POST", body: { name: "Dup", email: tempEmail, password: "secret123" } });
check(r.status === 400 || r.status === 409, name("duplicate signup rejected"), r.status);

// Google sign-in errors must surface as structured envelopes (not HTML / 500s)
r = await req("/auth/google", { method: "POST" });
check(r.status === 400, name("google signin missing credential -> 400"), r.status);
check(r.data?.success === false && typeof r.data?.message === "string", name("google 400 body is structured"), JSON.stringify(r.data));

r = await req("/auth/google", { method: "POST", body: { credential: "fake-id-token" } });
check(r.status === 503, name("google signin unconfigured -> 503"), r.status);
check(r.data?.success === false && r.data?.status === 503 && typeof r.data?.message === "string", name("google 503 body is structured"), JSON.stringify(r.data));

r = await req("/auth/forgot-password", { method: "POST", body: { email: tempEmail } });
check(r.status === 200, name("forgot-password enqueue-safe response"), r.status);

let resetToken = null;
const logPath = process.env.TEMP ? `${process.env.TEMP}\\maxspace-reset-links.log` : "/tmp/maxspace-reset-links.log";
const fs = await import("node:fs");
const lines = fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8").trim().split(/\r?\n/) : [];
const linkLine = lines.filter((l) => l.includes(tempEmail)).pop();
resetToken = linkLine ? linkLine.split("token=")[1] : null;
check(Boolean(resetToken), name("reset token logged for dev flow"), resetToken ? "token captured" : "no token");

r = await req("/auth/reset-password", { method: "POST", body: { token: "bogus", newPassword: "newpass123" } });
check(r.status === 400, name("reset-password bogus token -> 400"), r.status);

if (resetToken) {
  r = await req("/auth/reset-password", { method: "POST", body: { token: resetToken, newPassword: "newsecret456" } });
  check(r.status === 200, name("reset-password success"), r.status);
  r = await req("/auth/signin", { method: "POST", body: { email: tempEmail, password: "newsecret456" } });
  check(r.status === 200 && r.data?.token, name("signin with new password"), r.status);
}

r = await req("/auth/me", { token: userToken });
check(r.status === 200 && r.data?.user?.id === "user-1", name("GET /auth/me"), r.data?.user?.id);

r = await req("/auth/me", {});
check(r.status === 401, name("GET /auth/me without token -> 401"), r.status);

r = await req("/auth/logout", { method: "POST", token: userToken });
check(r.status === 200, name("POST /auth/logout"), r.status);

console.log("\n# 2. Batteries (user)");
r = await req("/batteries", { token: userToken });
check(r.status === 200 && Array.isArray(r.data) && r.data.length === 7, name("GET /batteries (7 seeded)"), `${r.data?.length} rows`);
check(r.data?.some((b) => b.barcode === "BATT-EV-9823-LFP"), name("batteries include barcode field"));
check(r.data?.every((b) => typeof b.stateOfHealth === "number" || typeof b.stateOfHealth === "string"), name("battery health numeric/string (pg numeric)"));

r = await req("/batteries/batt-1", { token: userToken });
check(r.status === 200 && r.data?.serialNumber, name("GET /batteries/:id"), r.data?.modelName);

r = await req("/batteries/lookup?code=BATT-EV-9823-LFP", { token: userToken });
check(r.status === 200 && r.data?.id === "batt-1", name("GET /batteries/lookup by barcode"), r.data?.id);

r = await req("/batteries/batt-1/passport", { token: userToken });
check(r.status === 200 && r.data?.battery && r.data?.qrUrl, name("GET /batteries/:id/passport"));

r = await req("/batteries/batt-1/health-history", { token: userToken });
check(r.status === 200 && Array.isArray(r.data?.history ?? r.data), name("GET /batteries/:id/health-history"));

let tempBatteryId = null;
r = await req("/batteries", { method: "POST", token: userToken, body: {
  name: "Audit Test Cell", modelName: "AuditCell 1", type: "EV",
  barcode: `AUDIT-BAR-${uid}`, serialNumber: `AUDIT-SN-${uid}`, chemistry: "LFP",
  capacityKwh: "42", stateOfHealth: "95", stateOfCharge: "80", cycleCount: 5,
} });
tempBatteryId = r.data?.id;
check(r.status === 201 && tempBatteryId, name("POST /batteries (create)"), tempBatteryId || r.status);

r = await req(`/batteries/${tempBatteryId}`, { method: "PUT", token: userToken, body: { name: "Audit Test Cell Renamed" } });
check(r.status === 200 && r.data?.name === "Audit Test Cell Renamed", name("PUT /batteries/:id (update)"), r.data?.name);

r = await req(`/batteries/${tempBatteryId}`, { token: userToken });
check(r.status === 200 && r.data?.name === "Audit Test Cell Renamed", name("updated battery persisted"));

console.log("\n# 3. Services (user)");
r = await req("/services", { token: userToken });
check(r.status === 200 && Array.isArray(r.data), name("GET /services"), `${r.data?.length} rows`);

r = await req("/services/battery/batt-1/status", { token: userToken });
check(r.status === 200 && typeof r.data?.status === "string", name("GET /services/battery/:id/status"), r.data?.status);

let tempServiceId = null;
r = await req("/services", { method: "POST", token: userToken, body: {
  batteryId: tempBatteryId, serviceType: "BMS Diagnostics",
  center: "Audit Centre", scheduledDate: "2026-10-01", scheduledTime: "09:00",
} });
tempServiceId = r.data?.id;
check(r.status === 201 && r.data?.ticketNumber && tempServiceId, name("POST /services (book)"), `ticket=${r.data?.ticketNumber} id=${tempServiceId}`);

r = await req(`/services/${tempServiceId}`, { method: "PATCH", token: userToken, body: { status: "Cancelled" } });
check(r.status === 200 && r.data?.status === "Cancelled", name("user cancels service"), r.data?.status);

r = await req(`/services/${tempServiceId}`, { method: "PATCH", token: userToken, body: { status: "Assigned" } });
check(r.status === 403, name("user cannot advance status -> 403"), r.status);

r = await req(`/services/${tempServiceId}`, { method: "DELETE", token: userToken });
check(r.status === 200, name("DELETE /services/:id"));

console.log("\n# 4. Profile");
r = await req("/profile", { token: userToken });
check(r.status === 200 && r.data, name("GET /profile"), r.data?.email);

r = await req("/profile", { method: "PUT", token: userToken, body: { phone: "+1-555-AUDIT" } });
check(r.status === 200 && r.data?.profile?.phone === "+1-555-AUDIT", name("PUT /profile update"), r.data?.profile?.phone);

r = await req("/profile/notifications", { method: "PUT", token: userToken, body: { emailAlerts: false } });
check(r.status === 200, name("PUT /profile/notifications"), r.status);

r = await req("/profile/password", { method: "POST", token: userToken, body: { currentPassword: "password123", newPassword: "brandnewpw1" } });
check(r.status === 200, name("POST /profile/password"), r.status);
r = await req("/auth/signin", { method: "POST", body: { email: "alex.rivera@maxspace-energy.com", password: "brandnewpw1" } });
check(r.status === 200, name("signin with rotated password"));
r = await req("/auth/signin", { method: "POST", body: { email: "alex.rivera@maxspace-energy.com", password: "password123" } });
check(r.status === 401, name("old password now rejected"));
userToken = r.data?.token || userToken; // keep old token; JWT still valid statelessly

r = await req("/profile/activity", { token: userToken });
check(r.status === 200, name("GET /profile/activity"), r.status);

r = await req("/profile/export", { token: userToken });
check(r.status === 200 && r.data, name("GET /profile/export"));

console.log("\n# 5. Analytics (user)");
for (const p of ["/analytics", "/analytics/fleet-stats", "/analytics/services", "/analytics/batteries/performance"]) {
  r = await req(p, { token: userToken });
  check(r.status === 200, `GET ${p}`, r.status);
}

console.log("\n# 6. RBAC / authorization");
r = await req("/admin/services", { token: userToken });
check(r.status === 403, name("user token on admin route -> 403"), r.status);
r = await req("/data/reset", { method: "POST", token: userToken });
check(r.status === 403, name("user token on data/reset -> 403"), r.status);
r = await req("/batteries", { token: "not-a-jwt" });
check(r.status === 401, name("malformed token on protected route -> 401"), r.status);
r = await req("/batteries", {});
check(r.status === 401, name("no token on protected route -> 401"), r.status);

console.log("\n# 7. Admin");
// adminToken was captured during the section-0 baseline reset
r = await req("/admin/me", { token: adminToken });
check(r.status === 200 && r.data?.user?.role === "ADMIN", name("GET /admin/me"), r.data?.user?.role);

r = await req("/admin/services", { token: adminToken });
check(r.status === 200 && Array.isArray(r.data), name("GET /admin/services"), `${r.data?.length} rows`);
check(r.data?.every((s) => s.customer && s.battery !== undefined), name("admin services enriched (customer/battery)"));

r = await req("/admin/services/srv-101", { token: adminToken });
check(r.status === 200 && r.data?.ticketNumber, name("GET /admin/services/:id"), r.data?.ticketNumber);

console.log("  -- admin flow: accept -> assign -> technician works -> approve on srv-101 --");
r = await req("/admin/services/srv-101/accept", { method: "PATCH", token: adminToken });
check(r.status === 200 && r.data?.status === "Accepted", name("admin accept srv-101"), r.data?.status);

r = await req("/admin/services/srv-101/assign", { method: "PATCH", token: adminToken, body: { servicePersonId: "sp-1" } });
check(r.status === 200 && r.data?.status === "Assigned" && r.data?.assignedServicePersonId === "sp-1", name("admin assign srv-101 -> sp-1"), r.data?.status);

// wrong-transition guards
r = await req("/admin/services/srv-101/status", { method: "PATCH", token: adminToken, body: { status: "Not A Status" } });
check(r.status === 400, name("admin invalid status -> 400"), r.status);

r = await req("/admin/service-persons", { token: adminToken });
check(r.status === 200 && Array.isArray(r.data) && r.data.length === 5, name("GET /admin/service-persons"), `${r.data?.length} rows`);

let tempTechId = null;
r = await req("/admin/service-persons", { method: "POST", token: adminToken, body: {
  technicianId: `TECH-AUDIT-${uid}`, name: "Audit Person", email: `sp.${uid}@maxspace.com`,
  phone: "+49 111 2222", certification: "Level 3", specializations: ["EV", "ESS"], status: "active",
} });
tempTechId = r.data?.id;
check(r.status === 201 && tempTechId, name("POST /admin/service-persons"), tempTechId || r.status);

r = await req(`/admin/service-persons/${tempTechId}`, { method: "PATCH", token: adminToken, body: { status: "inactive" } });
check(r.status === 200 && r.data?.status === "inactive", name("PATCH /admin/service-persons/:id"), r.data?.status);

r = await req("/admin/technicians", { token: adminToken });
check(r.status === 200 && Array.isArray(r.data), name("GET /admin/technicians"), `${r.data?.length} rows`);

r = await req("/admin/technicians/sp-1", { token: adminToken });
check(r.status === 200 && r.data, name("GET /admin/technicians/:id"));

r = await req("/admin/technicians", { method: "POST", token: adminToken, body: {
  name: "Audit Engineer", email: `tech.${uid}@maxspace.com`, password: "techpass123", confirmPassword: "techpass123",
  technicianId: `TECH-AUD2-${uid}`, phone: "+49 333 4444", specializations: ["Industrial"],
} });
check(r.status === 201 && r.data, name("POST /admin/technicians (creates EMPLOYEE + person)"), r.data?.servicePerson?.id);
const newTechId = r.data?.servicePerson?.id;
const newTechPerson = r.data?.servicePerson;

r = await req(`/admin/technicians/${newTechId}`, { method: "PATCH", token: adminToken, body: { status: "inactive" } });
check(r.status === 200, name("PATCH /admin/technicians/:id"), r.status);

r = await req(`/admin/technicians/${newTechId}/reset-password`, { method: "PATCH", token: adminToken, body: { password: "newTechPass1" } });
check(r.status === 200, name("PATCH /admin/technicians/:id/reset-password"), r.status);

r = await req("/admin/customers", { token: adminToken });
check(r.status === 200 && Array.isArray(r.data), name("GET /admin/customers"), `${r.data?.length} rows`);

r = await req("/admin/analytics", { token: adminToken });
check(r.status === 200 && r.data, name("GET /admin/analytics"), r.status);

console.log("\n# 8. Battery technician");
r = await req("/battery-technician/login", { method: "POST", body: { email: "markus.vance@maxspace.com", password: "employee123" } });
check(r.status === 200 && r.data?.token, name("technician login"), r.data?.user?.role);
const techToken = r.data?.token;

r = await req("/battery-technician/me", { token: techToken });
check(r.status === 200 && r.data?.user?.role === "EMPLOYEE", name("GET /battery-technician/me"), r.data?.user?.servicePerson?.name);

// markus (sp-1) is assigned srv-101 (after admin assign) + srv... sp-1 seed assigned only srv-101
r = await req("/battery-technician/services", { token: techToken });
check(r.status === 200 && Array.isArray(r.data), name("GET /battery-technician/services"), `${r.data?.length} rows`);
check(r.data?.some((s) => s.id === "srv-101"), name("assigned services include srv-101"));
check(r.data?.every((s) => s.id === "srv-101"), name("only own assigned services are returned"), r.data?.map((s) => s.id).join(","));

r = await req("/battery-technician/services/srv-101", { token: techToken });
check(r.status === 200 && r.data?.ticketNumber === "SRV-2026-9012", name("GET /battery-technician/services/:id"), r.data?.ticketNumber);

// wrong technician cannot see it
r = await req("/battery-technician/login", { method: "POST", body: { email: "lars.devries@maxspace.com", password: "employee123" } });
const larsToken = r.data?.token;
r = await req("/battery-technician/services/srv-101", { token: larsToken });
check(r.status === 403, name("other technician cannot open srv-101 -> 403"), r.status);

// forbidden transition
r = await req("/battery-technician/services/srv-101/status", { method: "PATCH", token: techToken, body: { status: "Completed" } });
check(r.status === 400, name("tech forbidden jump -> 400"), r.status);

// full field workflow
const flow = [["Accepted", "Assigned->Accepted"], ["On The Way", "Accepted->On The Way"], ["In Progress", "On The Way->In Progress"], ["Waiting for Admin Approval", "In Progress->Waiting"]];
for (const [to, label] of flow) {
  r = await req("/battery-technician/services/srv-101/status", { method: "PATCH", token: techToken, body: { status: to } });
  check(r.status === 200 && r.data?.status === to, `tech status ${label}`, r.status);
}

// admin approves completion
r = await req("/admin/services/srv-101/approve", { method: "PATCH", token: adminToken });
check(r.status === 200 && r.data?.status === "Completed", name("admin approve completion"), r.data?.status);
check(r.data?.adminApprovedAt || r.data?.approvedBy, name("approval records approvedBy/at"));

// completed service appears in tech + admin lists
r = await req("/battery-technician/services", { token: techToken });
check(r.data?.find((s) => s.id === "srv-101" && s.status === "Completed"), name("tech sees srv-101 as Completed"));
r = await req("/admin/services", { token: adminToken });
check(r.data?.find((s) => s.id === "srv-101" && s.status === "Completed"), name("admin sees srv-101 as Completed"));

// tech status guard on completed service
r = await req("/battery-technician/services/srv-101/status", { method: "PATCH", token: techToken, body: { status: "In Progress" } });
check(r.status === 400, name("tech cannot re-open completed -> 400"), r.status);

console.log("\n# 9. Pagination (DB-level list endpoints + envelope)");
// user batteries: page size, totals (7 seed + 1 temp battery), flags
r = await req("/batteries?page=1&limit=4", { token: userToken });
check(r.status === 200 && r.data?.success === true && Array.isArray(r.data?.data) && r.data?.data.length === 4, name("GET /batteries?page=1&limit=4 (envelope)"), `rows=${r.data?.data?.length}`);
check(r.data?.pagination?.total === 8 && r.data?.pagination?.totalPages === 2, name("battery pagination total/totalPages"), `total=${r.data?.pagination?.total} pages=${r.data?.pagination?.totalPages}`);
check(r.data?.pagination?.hasNextPage === true && r.data?.pagination?.hasPreviousPage === false, name("battery pagination flags"));
// defaults + clamping
r = await req("/batteries?page=2", { token: userToken });
check(r.data?.pagination?.page === 2 && r.data?.pagination?.limit === 20, name("battery default limit 20"), `page=${r.data?.pagination?.page} limit=${r.data?.pagination?.limit}`);
r = await req("/batteries?page=0&limit=999", { token: userToken });
check(r.data?.pagination?.page === 1 && r.data?.pagination?.limit === 100, name("battery clamp page<=1 / limit<=100"), `page=${r.data?.pagination?.page} limit=${r.data?.pagination?.limit}`);
// user services envelope
r = await req("/services?page=1&limit=2", { token: userToken });
check(r.status === 200 && r.data?.success === true && r.data?.data?.length === 2 && r.data?.pagination?.total === 6, name("GET /services?page=1&limit=2 (envelope)"), `total=${r.data?.pagination?.total}`);
// profile activity envelope
r = await req("/profile/activity?page=1&limit=10", { token: userToken });
check(r.status === 200 && r.data?.success === true && Array.isArray(r.data?.data) && r.data?.pagination?.total >= 1, name("GET /profile/activity?page=1&limit=10 (envelope)"), `total=${r.data?.pagination?.total}`);
// admin services envelope + status filter (seed srv-103 is Completed; srv-101
// was just approved, so Completed >= 1 and every returned row must match)
r = await req("/admin/services?page=1&limit=2&status=Completed", { token: adminToken });
check(r.status === 200 && r.data?.success === true && Array.isArray(r.data?.data) && r.data?.data?.length >= 1 && r.data?.pagination?.total >= 1, name("GET /admin/services?status=Completed (envelope)"), `total=${r.data?.pagination?.total}`);
check(r.data?.data?.every?.((s) => s.status === "Completed"), name("admin services filtered by status"));
r = await req("/admin/services", { token: adminToken });
check(Array.isArray(r.data) && r.data.every?.((s) => s.customer && s.battery !== undefined), name("legacy /admin/services still bare + enriched"), `${r.data?.length} rows`);
// admin customers envelope
r = await req("/admin/customers?page=1&limit=2", { token: adminToken });
check(r.status === 200 && r.data?.success === true && Array.isArray(r.data?.data) && r.data?.data?.length === 2, name("GET /admin/customers?page=1&limit=2 (envelope)"), `total=${r.data?.pagination?.total}`);
check(r.data?.pagination?.total >= 2 && r.data?.pagination?.totalPages >= 1, name("admin customers totals consistent"));
// admin service persons + search
r = await req("/admin/service-persons?page=1&limit=2&search=Audit", { token: adminToken });
check(r.status === 200 && r.data?.success === true && Array.isArray(r.data?.data), name("GET /admin/service-persons?search=Audit (envelope)"), `total=${r.data?.pagination?.total}`);
check(r.data?.data?.every?.((sp) => String(sp?.name || "").toLowerCase().includes("audit")) && r.data?.data?.length <= 2, name("service-persons search applied + page size"));
// admin technicians envelope (7 persons: 5 seed + Audit Person + Audit Engineer)
r = await req("/admin/technicians?page=1&limit=2", { token: adminToken });
check(r.status === 200 && r.data?.success === true && r.data?.data?.length === 2 && r.data?.pagination?.total === 7, name("GET /admin/technicians?page=1&limit=2 (envelope)"), `total=${r.data?.pagination?.total}`);
// technician's own assigned services envelope (sp-1 -> srv-101 only)
r = await req("/battery-technician/services?page=1&limit=5", { token: techToken });
check(r.status === 200 && r.data?.success === true && r.data?.data?.length === 1 && r.data?.data?.[0]?.id === "srv-101" && r.data?.pagination?.total === 1, name("GET /battery-technician/services (envelope)"), `total=${r.data?.pagination?.total}`);

console.log("\n# 10. Data integrity (FK / CHECK / structured errors)");
// FK guard: booking a service against a battery the user doesn't own is rejected with a structured 400
r = await req("/services", { method: "POST", token: userToken, body: { batteryId: "batt-does-not-exist", serviceType: "BMS Diagnostics" } });
check(r.status === 400 && r.data?.success === false && typeof r.data?.message === "string", name("service with unknown battery rejected (FK guard)"), `${r.status} ${r.data?.message || ""}`);
// CHECK mirror: invalid priority is rejected (services_priority_check / assertServiceIntegrity)
r = await req("/services", { method: "POST", token: userToken, body: { batteryId: tempBatteryId, serviceType: "BMS Diagnostics", priority: "Extreme" } });
check(r.status === 400 && r.data?.success === false, name("service with invalid priority rejected (CHECK)"), r.status);
// structured 404 envelope
r = await req("/batteries/batt-not-real", { token: userToken });
check(r.status === 404 && r.data?.success === false && typeof r.data?.message === "string", name("404 returns structured error body"), `${r.status}`);
// structured 401 envelope
r = await req("/batteries", {});
check(r.status === 401 && r.data?.success === false, name("401 returns structured error body"), `${r.status}`);

console.log("\n# 11. Cleanup");
r = await req("/data/reset", { method: "POST", token: adminToken });
check(r.status === 200, name("POST /data/reset restores seed"), r.status);
r = await req("/batteries", { token: userToken });
check(r.data?.length === 7, name("batteries back to 7 after reset"), `${r.data?.length}`);
r = await req("/admin/services", { token: adminToken });
check(r.data?.find((s) => s.id === "srv-101" && s.status === "Confirmed"), name("srv-101 back to Confirmed (seed)"));

console.log(`\n===== RESULT: ${pass} passed, ${fail} failed =====`);
process.exit(fail ? 1 : 0);