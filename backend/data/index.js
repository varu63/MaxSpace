/* ============================================================
   DATA SOURCE FACADE
   Single entry point for all persistence.

   Current development mode   → "mock"     (in-memory seeded store)
   Future production mode     → "postgres" (PostgreSQL repository)

   Existing controllers import the default export exactly like they
   previously imported backend/data/store.js:
       import store from "../data/index.js";

   In mock mode the default IS the in-memory seeded store, so the
   app keeps working today with zero behavior change. Setting
   DATA_SOURCE=postgres (plus DATABASE_URL) switches the whole app
   to the PostgreSQL repository — and if the DB/driver is missing,
   this facade logs a warning and falls back to the seeded mock
   store so the app never crashes.

   The PostgreSQL repository is loaded lazily via a dynamic import,
   so the `pg` driver is only required when postgres mode is on.
============================================================ */
import config from "../config/app.js";
import mockStore from "./store.js";

let activeStorePromise = null;
let fallbackWarned = false;

/* Await this when the storage layer may be async (postgres mode). */
export const getStore = () => {
  if (activeStorePromise) return activeStorePromise;

  if (config.db.dataSource === "postgres") {
    activeStorePromise = loadPostgresStore();
  } else {
    activeStorePromise = Promise.resolve(mockStore);
  }

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

/* PostgreSQL-mode loader with safe fallback to the mock store. */
const loadPostgresStore = async () => {
  if (!config.db.databaseUrl) {
    console.warn(
      "[data] DATA_SOURCE=postgres set but DATABASE_URL is missing. Falling back to the seeded in-memory store (mock mode)."
    );
  } else {
    try {
      const { createPostgresStore } = await import("./postgres/index.js");
      const store = await createPostgresStore({
        databaseUrl: config.db.databaseUrl,
      });
      await pingWithTimeout(store);
      console.log("[data] Using PostgreSQL repository.");
      return store;
    } catch (error) {
      if (!fallbackWarned) {
        fallbackWarned = true;
        console.warn(
          `[data] PostgreSQL repository unavailable (${error.message}). Falling back to the seeded in-memory store (mock mode).`
        );
      }
    }
  }

  return mockStore;
};

/* Live connectivity check for the health endpoint. Returns true when the
   postgres pool answers a ping, false when it is unreachable, and null in
   mock mode (in-memory store, no database involved). */
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
export const getMode = () => config.db.dataSource;

/* Default export mirrors the old `import store from "../data/store.js"`
   surface so existing controllers keep working unchanged. When the
   PostgreSQL repository is enabled (DATA_SOURCE=postgres), the default
   export is the active postgres store; otherwise it stays the seeded
   in-memory store. Because the postgres methods are async, controllers
   should `await` each store call — awaiting a plain value (mock mode)
   is a no-op, so the same code works for both data sources. */
const activeStore = await getStore();
export default activeStore;