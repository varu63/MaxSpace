# MaxSpace — PostgreSQL Migration Guide (Future)

This document explains how MaxSpace is architected for a future switch from the
in-memory mock store to a **PostgreSQL** database, and exactly what to do when
the database layer is ready to be enabled. Nothing in this document needs to be
performed for the app to run today — the app works out of the box on the seeded
mock store.

---

## 1. Current architecture (mock mode — default)

```
frontend/src/services/        → centralized API layer (client.js, api.js,
                                adminApi.js, batteryTechnicianApi.js, index.js)
        │  HTTP (fetch)
        ▼
backend/index.js              → Express server, security headers, rate limiting
backend/routes/*              → URL mapping only (no business logic)
backend/controllers/*         → business logic (reads/writes via the store)
        │
        ▼
backend/data/index.js         → DATA SOURCE FACADE (single import point)
        │   default: mock store (backend/data/store.js)
        ▼
backend/data/store.js         → in-memory seeded store (from data/seedData.js)
```

**Key rule:** controllers `import store from "../data/index.js"`. They never
import `store.js` or the future PostgreSQL repository directly. Swapping the
persistence layer is therefore a configuration change, not a code change.

## 2. How the data-source switch works

| Config                  | Meaning                                        | Requires |
|-------------------------|------------------------------------------------|----------|
| `DATA_SOURCE=mock`      | In-memory seeded store (default)               | nothing  |
| `DATA_SOURCE=postgres`  | PostgreSQL repository (`backend/data/postgres`) | `DATABASE_URL` + `pg` package |

- If `DATA_SOURCE=postgres` but `DATABASE_URL` is missing **or** the `pg`
  package is not installed, the app logs a warning and **falls back to the mock
  store** — it never crashes at boot.
- The health endpoint (`GET /`) reports `dataSource` and `databaseConfigured`.

## 3. What a future switch to PostgreSQL looks like

1. Start PostgreSQL (Docker is already prepared in `docker-compose.yaml`):
   ```bash
   docker compose up -d postgres
   ```
2. In `backend/.env` (copy from `backend/.env.example`):
   ```env
   DATA_SOURCE=postgres
   DATABASE_URL=postgresql://maxspace_user:maxspace_password@localhost:5432/maxspace_db
   ```
3. Install the postgres driver (only needed in postgres mode):
   ```bash
   cd backend && npm install pg
   ```
4. Apply the schema:
   ```bash
   psql "$DATABASE_URL" -f backend/sql/schema.sql
   ```
5. Implement the repository methods in `backend/data/postgres/index.js`.
   Every method maps 1:1 to the mock store interface, so controllers do not
   change. Start with a `ping()` + `getAllUsers()` + `getAllBatteries()` +
   `getAllServices()` to bring the dashboards online, then port the rest.
6. Restart the backend and verify:
   ```bash
   cd backend && npm run dev   # expect: "Using PostgreSQL repository."
   curl http://localhost:5000  # expect: dataSource: "postgres"
   ```

The frontend does **not** change at all — it only talks to the same REST API.

## 4. Frontend service layer

All HTTP access is centralized in `frontend/src/services/`:

- `client.js` — shared `fetch` wrapper, JWT handling, `BASE_URL`
  (from `VITE_API_URL`, default `/api`), token keys for user/admin/technician.
- `api.js` — customer app endpoints (auth, batteries, services, profile).
- `adminApi.js` — admin panel endpoints.
- `batteryTechnicianApi.js` — battery technician panel endpoints.
- `index.js` — barrel export (`import { fetchBatteries } from "../services"`).

To point the whole app at a different API deployment, change `VITE_API_URL`
(`frontend/.env.example`).

## 5. Data consistency (mock ↔ future DB)

The single source of truth for shape:

- Frontend: `frontend/src/data/dummyData.js` + `frontend/src/data/serviceStatuses.js`
- Backend: `backend/data/seedData.js` + `backend/constants/serviceStatuses.js`

`seedData.js` explicitly mirrors `dummyData.js` so the app behaves identically
whether data comes from the API or from local state. Keep both in sync whenever
an entity's shape changes. The PostgreSQL schema (`backend/sql/schema.sql`) is
generated from the same fields, so the three layers stay consistent.

Service status values are shared as constants on both sides
(`SERVICE_STATUSES`). Never hard-code a status string inline.

## 6. Mock data strategy

- `backend/data/seedData.js` seeds the in-memory store at boot.
- `resetData` (`POST /api/data/reset`) restores the seeded dataset on demand.
- The frontend `dummyData.js` is used for instant UI rendering and offline-safe
  defaults; the backend API remains the authoritative source at runtime.

## 7. Checklist before enabling PostgreSQL in production

- [ ] `pg` installed in `backend/` (not required in mock mode)
- [ ] `backend/sql/schema.sql` applied
- [ ] All methods in `backend/data/postgres/index.js` implemented (no
      `not implemented for PostgreSQL yet` errors)
- [ ] Backend smoke-tested: login, battery list, service list/status updates,
      admin analytics, technician flow against the DB
- [ ] `DATA_SOURCE=postgres` + `DATABASE_URL` set in production `.env`
- [ ] `JWT_SECRET` set to a strong value in production