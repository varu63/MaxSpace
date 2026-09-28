/* ============================================================
   POSTGRESQL CONNECTION DIAGNOSTICS
   Small, dependency-free helpers for turning a failed `pg`
   connection into a message an operator can act on.

   Why this exists: Node reports a failed dual-stack (IPv4 + IPv6)
   connect attempt as an `AggregateError` whose `message` is an EMPTY
   STRING and whose real detail lives in `code` / `errors[]`. Rendering
   only `${error.message}` therefore produced the useless

       [data] PostgreSQL repository unavailable: — refusing to start.

   with the actual reason (ECONNREFUSED, 28P01, 3D000, ETIMEDOUT, …)
   silently dropped. These helpers flatten whatever `pg` threw —
   AggregateError, pool timeout, or a server-side SQLSTATE error — into
   the code/message/address/hint that explain the failure.
   ============================================================ */

/* Log-safe view of a connection string. Keeps host, port, database and
   user (the parts needed to diagnose a misconfiguration) and replaces the
   password, so a connection URL can safely appear in logs. */
export const redactDatabaseUrl = (databaseUrl) => {
  if (!databaseUrl) return "(unset)";
  try {
    const url = new URL(databaseUrl);
    if (url.password) url.password = "REDACTED";
    return url.toString();
  } catch {
    return "(unparseable DATABASE_URL — check the value in backend/.env)";
  }
};

/* Likely cause per error code, so the log says what to do next. */
const CAUSE_HINTS = {
  ECONNREFUSED: "nothing is listening on that host/port — start PostgreSQL (docker compose up -d)",
  ENOTFOUND: "host could not be resolved — check the hostname in DATABASE_URL",
  EAI_AGAIN: "DNS lookup failed — check the hostname/network in DATABASE_URL",
  ECONNRESET: "socket was accepted then closed — check the port is really PostgreSQL and inspect the server log",
  ETIMEDOUT: "connection timed out — check the port is reachable and not firewalled",
  EHOSTUNREACH: "host is unreachable from this machine",
  ENETUNREACH: "network is unreachable from this machine",
  "28P01": "authentication failed — wrong username or password in DATABASE_URL",
  "28000": "authentication rejected — the role is not allowed to log in",
  "3D000": "database does not exist — check the database name in DATABASE_URL",
  "42P01": "relation does not exist — schema is missing or migrations were not applied to this database",
  "3F000": "schema does not exist — check the search_path / LEGACY_SCHEMA",
  "53300": "too many connections — the server connection limit is exhausted",
  "57P03": "the server is still starting up and cannot accept connections yet",
};

/* Readable, password-free description of a thrown PostgreSQL error.
   Works for plain Errors, pg SQLSTATE errors, and Node AggregateErrors
   from a multi-address connect attempt. */
export const describeConnectionError = (error) => {
  if (!error) return "unknown error (nothing was thrown)";
  if (typeof error === "string") return error;

  /* Node puts the per-attempt failures of a dual-stack connect in
     `errors[]`; the AggregateError itself carries only `code`. */
  const nested = (Array.isArray(error.errors) ? error.errors : []).filter(Boolean);
  const message = typeof error.message === "string" ? error.message.trim() : "";
  const name = error.name || error.constructor?.name || "Error";

  const parts = [message || `${name} (no message provided)`];

  for (const sub of nested) {
    const subMessage = typeof sub?.message === "string" ? sub.message.trim() : "";
    const subCode = sub?.code || sub?.errno;
    const line = [subMessage, subCode ? `(${subCode})` : ""].filter(Boolean).join(" ");
    if (line && !parts.includes(line)) parts.push(`  · ${line}`);
  }

  const code = error.code ?? nested.find((sub) => sub?.code)?.code;
  const fields = [
    ["code", code],
    ["syscall", error.syscall],
    ["address", error.address],
    ["port", error.port],
    ["errno", error.errno],
    ["severity", error.severity],
    ["detail", error.detail],
    ["hint", error.hint],
    ["routine", error.routine],
    ["schema", error.schema],
    ["table", error.table],
  ].filter(([, value]) => value !== undefined && value !== null && value !== "");

  parts.push(
    fields.length
      ? `  · ${fields.map(([key, value]) => `${key}=${value}`).join(" ")}`
      : `  · ${name}`
  );

  const cause = CAUSE_HINTS[code] || CAUSE_HINTS[nested.find((sub) => sub?.code)?.code];
  if (cause) parts.push(`  → likely cause: ${cause}`);

  return parts.join("\n");
};
