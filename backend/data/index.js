/* ============================================================
   DATA SOURCE FACADE
   Single entry point for all persistence.

   PostgreSQL is the only supported data source. There is no in-memory
   or seeded fallback: if the database is unreachable or misconfigured
   the process fails to start with a clear, actionable error. That is
   deliberate — a silent fallback is how demo data ends up being served
   to real traffic, and it hides the fact that the database is down.

   Existing controllers import the default export exactly like they
   previously imported backend/data/store.js:
        import store from "../data/index.js";

   The repository methods are async, so controllers must `await` each
   store call.

   The repository is loaded lazily via a dynamic import so the `pg`
   driver is only required at runtime.
   ============================================================ */
import config from "../config/app.js";
import { setTelemetryStore } from "../services/batteryTelemetryService.js";
import { describeConnectionError, redactDatabaseUrl } from "./dbDiagnostics.js";

let activeStorePromise = null;

/* Await this when the storage layer may be async. */
export const getStore = () => {
  if (activeStorePromise) {
    return activeStorePromise;
  }

  activeStorePromise = loadPostgresStore();

  // Give the telemetry service the store to read/write through.
  activeStorePromise.then((s) => setTelemetryStore(s));

  return activeStorePromise;
};

const PING_TIMEOUT_MS = 3000;

const pingWithTimeout = async (store) => {
  await Promise.race([
    store.ping(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("database ping timed out")), PING_TIMEOUT_MS)
    ),
  ]);
};

/* Fails hard when the configuration or the database itself is
   unavailable — there is nothing to fall back to. */
const loadPostgresStore = async () => {
  if (!config.db.databaseUrl) {
    throw new Error(
      "[data] DATABASE_URL is not set. Refusing to run — PostgreSQL is the only data source."
    );
  }

  const { createPostgresStore } = await import("./postgres/index.js");
  const target = redactDatabaseUrl(config.db.databaseUrl);
  console.log(`[data] Connecting to PostgreSQL repository at ${target}`);

  let store;
  try {
    store = await createPostgresStore({
      databaseUrl: config.db.databaseUrl,
    });
    await pingWithTimeout(store);
  } catch (error) {
    /* `error.message` alone is not enough: a refused dual-stack connect is
       an AggregateError with an empty message, which is what produced the
       contentless "unavailable: — refusing to start" line. Report the code,
       address, syscall and likely cause, and keep the original as `cause`
       so the full stack is still reachable. */
    const detail = describeConnectionError(error);
    console.error(`[data] PostgreSQL connection failed for ${target}\n${detail}`);
    throw new Error(
      `[data] PostgreSQL repository unavailable: ${detail} — refusing to start. Check that the database is up and DATABASE_URL is correct.`,
      { cause: error }
    );
  }
  console.log("[data] Using PostgreSQL repository.");
  return store;
};

/* Live connectivity check for the health endpoint. Returns true when the
   postgres pool answers a ping, false when it is unreachable. */
export const isDatabaseConnected = async () => {
  const store = await getStore();
  if (typeof store?.ping !== "function") return null;
  try {
    await pingWithTimeout(store);
    return true;
  } catch {
    return false;
  }
};

/* Convenience export for tests / tooling. */
export const getMode = () => "postgres";

/* Default export mirrors the old `import store from "../data/store.js"`
   surface so existing controllers keep working unchanged. */
const activeStore = await getStore();
export default activeStore;