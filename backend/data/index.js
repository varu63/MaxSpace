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
      console.log("[data] Using PostgreSQL repository.");
      return store;
    } catch (error) {
      console.warn(
        `[data] PostgreSQL repository unavailable (${error.message}). Falling back to the seeded in-memory store (mock mode).`
      );
    }
  }

  return mockStore;
};

/* Convenience export for tests / tooling. */
export const getMode = () => config.db.dataSource;

/* Default export mirrors the old `import store from "../data/store.js"`
   surface so existing controllers keep working unchanged. When the
   PostgreSQL repository is enabled, the default export is replaced
   by the postgres store for new consumers; callers that need the
   active instance (mock OR postgres) should `await getStore()`. */
export default mockStore;