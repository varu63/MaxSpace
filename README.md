# MaxSpace — Digital Battery Passport System

A modern single-page web application for managing battery fleets and generating **EU-compliant Digital Battery Passports** under the [EU Battery Regulation 2023/1542](https://eur-lex.europa.eu/eli/reg/2023/1542).

MaxSpace lets fleet directors register batteries, track health metrics, book services, scan QR/barcodes, and view analytics — all from one dashboard. It ships with three separate role-based panels: **Customer**, **Admin**, and **Battery Technician**.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Frontend](#frontend)
- [Backend](#backend)
- [Authentication & Authorization](#authentication--authorization)
- [API Reference](#api-reference)
- [Database](#database)
- [Application Workflows](#application-workflows)
- [Configuration & Environment Variables](#configuration--environment-variables)
- [Local Development Setup](#local-development-setup)
- [Development Commands](#development-commands)
- [Troubleshooting](#troubleshooting)
- [Known Limitations / Future Improvements](#known-limitations--future-improvements)
- [License](#license)

---

## Project Overview

### What is MaxSpace?

MaxSpace is a full-stack fleet-management and compliance application for **stationary and mobile battery assets**. Each battery is registered once and receives an automatically generated **EU Digital Battery Passport** — a compliance document that captures who manufactured it, what it is made of, its carbon footprint, its health, and its service history.

### What problem does it solve?

Under EU Battery Regulation 2023/1542, batteries sold in Europe must carry a Digital Product Passport covering material composition, second-life readiness, recycled content, and health data. Manually assembling this data across many batteries is error-prone. MaxSpace centralizes it:

- **Registration** — Batteries are added once; a passport, serial number, and EU passport QR URL are generated automatically.
- **Health tracking** — State of Health (SoH), State of Charge (SoC), cycle count, and a dated health-history timeline are stored per battery.
- **Service lifecycle** — Customers book maintenance, admins accept and assign it, technicians execute it, and every status change is appended to an auditable service history.
- **Traceability** — A physical QR/barcode on the battery can be scanned (camera, image upload, or manual entry) and resolved to the correct record, even from a full passport QR URI.

### What does "Digital Product Passport" mean here?

A Digital Product Passport (DPP) is the EU's data record that accompanies a product through its lifecycle. In MaxSpace the **Digital Battery Passport** is rendered per battery and contains:

- **Manufacturer identifier** — company, country, registration ID.
- **Battery descriptor** — type, chemistry, capacity, voltage, weight.
- **Battery identifier** — internal ID, serial number, barcode, EU passport QR URL.
- **Material composition** — lithium, cobalt, nickel, manganese, graphite, etc.
- **Carbon footprint** — total CO₂ and the manufacturing/transport/recycling split.
- **Dynamic data** — SoH, SoC, cycle count, temperature, last service date.
- **Compliance standards** — e.g. IEC 62619, UN 38.3, ISO 26262, EU Reg 2023/1542.

The passport is available as a full-screen page at `/battery/:id/passport`, and each battery carries an EU passport URL (`passport.battery-eu.org/passports/<barcode>`) that mirrors this data.

### What is the Battery Management System (BMS)?

MaxSpace is a **software-level fleet/BMS management platform**, not onboard vehicle hardware. It ingests and displays the same telemetry a hardware BMS produces:

- State of Health (SoH) and State of Charge (SoC).
- Cycle count, maximum rated cycles, internal resistance, operating temperature.
- BMS diagnostics and firmware updates as service types.

It answers "is my fleet healthy, and which batteries need attention or servicing?" In this project, **Battery Management** therefore means tracking every battery's health, warranty, and maintenance state in one place.

### Who is the application designed for?

- **Fleet directors / operators** — the customer app (`/home`, `/services`, `/analytics`, `/profile`).
- **Administrators** — the admin panel (`/admin`) that reviews, accepts, and assigns service requests, manages battery technicians and customers, and reviews analytics.
- **Battery technicians (service persons)** — the technician panel (`/battery-technician`) for viewing assigned services and advancing them through the field-workflow.

### Main capabilities

- Battery registration and EU Digital Battery Passport generation.
- QR / barcode scanning (camera, image upload, presets, manual entry).
- Service booking and a full status-driven service lifecycle.
- Fleet health analytics and battery performance tables.
- Role-based authentication with **JWT + Google Sign-In**.
- Two persistence backends: a seeded in-memory store (zero-setup default) and a fully implemented PostgreSQL repository, switched by a single env var.

---

## Features

### Battery Management
- Register and manage batteries across **seven** categories: EV, Stationary Storage (ESS), Light Electric Vehicle (LEV), Commercial Transport, Aerial & UAV, Industrial Cordless Equipment, and Material Handling.
- Track SoH, SoC, cycle count, chemistry, capacity, voltage, dimensions, and temperature.
- Warranty tracking with status (Active / Expiring Soon / Expired), expiry dates, coverage terms, and certificate numbers.
- Health-history timeline with dated SoH snapshots.
- Dismantling / safety instructions and recycled-content percentages per battery.

### EU Digital Battery Passport
- Auto-generated compliance passports for every registered battery (full-screen page at `/battery/:id/passport`).
- Gold-framed layout with manufacturer, descriptor, identifier, material composition, carbon footprint, and dynamic data.
- Per-battery EU compliance standards (IEC 62619, UN 38.3, EU Reg 2023/1542, ISO 26262, …).
- Passport lookups accept an internal ID, a barcode, a serial number, **or a full EU QR payload URI** (see [Battery identifier resolution](#battery-identifier-resolution)).

### QR / Barcode Scanner
- Scanner modal with four input methods: live camera, quick sample presets, manual entry, and image upload.
- Uses `jsqr` to decode from the camera feed or an uploaded image.
- Resolves the scanned value to a battery via `/api/batteries/lookup`; unknown codes open the registration modal pre-filled.

### Service Management
- Book, view, and manage service appointments with ticket numbers (`SRV-YYYY-####`).
- Full lifecycle statuses: **Confirmed → Accepted → Assigned → On The Way → In Progress → Waiting for Admin Approval → Completed** (plus **Cancelled**).
- Filtering and search by status, battery, or location; mobile cards + desktop table.
- Admin **Service Requests** page lists every request as an expandable card with search, status tabs/dropdown, and inline actions (`accept`, `assign`, `approve`, `reject`).
- Customer, admin, and technician views of the same service records.

### Analytics Dashboard
- Fleet health overview: total batteries, optimal/good/attention SoH buckets, total capacity, average health.
- Service analytics (booked/in-progress/completed/cancelled) and per-battery performance.
- Admin analytics: status breakdown, completion rate, recent services, customer/technician/battery totals.

### User Profile & Settings
- Profile with avatar, company info, fleet details, EU operator ID, and notification preferences.
- Settings: language, timezone, account / password change, dark mode, accent color, export fleet data as JSON.
- Per-user activity log (passport views, service bookings, scans).

### Other
- Dark mode with full Tailwind theme override.
- Responsive layout (desktop sidebar + mobile cards).
- Code-splitting with `React.lazy()` for fast initial load.
- Confetti on battery registration and service booking.
- Google Sign-In (ID-token verification) for customer accounts.

---

## Tech Stack

### Frontend

| Layer            | Technology                                  |
|------------------|---------------------------------------------|
| **Language**     | JavaScript (ES Modules, JSX)                |
| **UI Framework** | React 19                                    |
| **Build Tool**   | Vite 8                                      |
| **Routing**      | React Router DOM 7                          |
| **Styling**      | Tailwind CSS 3 + PostCSS + Autoprefixer     |
| **Icons**        | Lucide React                                |
| **Scanner**      | jsQR                                        |
| **Animations**   | Canvas Confetti                             |
| **Linting**      | Oxlint                                      |
| **State**        | React Context API                           |

### Backend

| Layer          | Technology                                        |
|----------------|---------------------------------------------------|
| **Runtime**    | Node.js (ES Modules) + Express 5                  |
| **Auth**       | JWT + Google Identity Services ID-token verification |
| **Passwords**  | bcryptjs (bcrypt, cost 10)                        |
| **Storage**    | Seeded in-memory store **and** a PostgreSQL repository (`pg`), switched by `DATA_SOURCE` |
| **Security**   | Helmet, CORS, rate limiting on auth routes        |
| **Validation** | Manual validation in controllers + service-layer duplicate checks |

> **Storage is pluggable.** The default (`.env.example`) is `DATA_SOURCE=mock`, which needs no database. When `DATA_SOURCE=postgres` is set (with a valid `DATABASE_URL`), the app uses the fully implemented PostgreSQL repository. If postgres is unavailable, the app logs a warning and **falls back to the mock store** so it never crashes at boot. See [Database](#database).

---

## Architecture

```
React Frontend (Customer / Admin / Technician panels)
      ↓  fetch() with JWT in Authorization header
API Layer (frontend/src/services/*)
      ↓
Express Backend (backend/index.js)
      ↓
Middleware (helmet, cors, rate limit → protect → requireAdmin/requireEmployee)
      ↓
Routes → Controllers → Store facade
      ↓
Data Source Facade (backend/data/index.js)
      ↓
mock (in-memory seed)  |  PostgreSQL repository (pg pool)
                                ↓
                       PostgreSQL (docker-compose.yaml)
```

### Layer responsibilities

| Layer | Responsibility |
|-------|----------------|
| **React Frontend** | Renders three role-based UIs. Holds global state in React Contexts and calls the API layer; never touches the database. |
| **API Layer** (`frontend/src/services/`) | Thin wrappers around `fetch()`. Attaches the correct JWT per role, JSON-encodes bodies, normalizes errors. |
| **Express Backend** | HTTP server, security headers, CORS, body parsing, rate limiting, route mounting, health endpoint. |
| **Auth / Authorization** | `protect` verifies the JWT and loads the user; `requireAdmin` / `requireEmployee` enforce roles on exclusive routes. |
| **Controllers** | Business logic: input validation, status-transition rules, enrichment of related data, activity logging. |
| **Routes** | Pure URL → controller mapping. |
| **Data Source Facade** (`backend/data/index.js`) | Single import point for controllers. Returns either the mock store or the PostgreSQL repository. |
| **PostgreSQL** | Persistent storage (users, batteries, services, service persons, profile). |

### Request flow

```
Frontend request
       ↓
Route (backend/routes/*)
       ↓
Middleware (protect → role guard where required)
       ↓
Controller (validation + business rules)
       ↓
Store facade (backend/data/index.js)
       ↓
mock store | postgres repository
       ↓
Response → Frontend
```

### Data flow — how database data reaches the frontend

1. On login the frontend stores the JWT in `localStorage` (`client.js`).
2. On mount (and after login) each Context fetches its data: `BatteryContext` calls `fetchBatteries()`, `fetchServices()`, `fetchProfile()`; `AdminContext` calls the admin endpoints; `BatteryTechnicianContext` calls the technician endpoints.
3. Every request carries `Authorization: Bearer <token>`; the backend validates it and returns role-appropriate data.
4. The Context holds the arrays; pages read from context (via `useBattery()` / `useAdmin()` / `useBatteryTechnician()`), and components render them.

### Three panels, one backend

| Panel | Route base | Auth role | Backend routes |
|-------|------------|-----------|----------------|
| Customer | `/` (user pages) | any authenticated `USER` | `/api/auth`, `/api/batteries`, `/api/services`, `/api/profile`, `/api/analytics`, `/api/data` |
| Admin | `/admin` | `ADMIN` | `/api/admin/*` |
| Battery Technician | `/battery-technician` | `EMPLOYEE` | `/api/battery-technician/*` |

Wall-clock precedent: old `/service-man/*` URLs are aliases that redirect (frontend) or resolve (backend `/api/service-man`) to the battery-technician panel, kept for backward compatibility.

---

## Project Structure

```
MaxSpace/
├── README.md
├── docker-compose.yaml        # PostgreSQL 17 service (for DATA_SOURCE=postgres)
├── maxtrace_backup.dump       # Legacy pg_dump from a separate project (NOT used by the app)
├── docs/
│   └── DATABASE_MIGRATION.md  # Data-source switch guide (mock ↔ postgres)
│
├── backend/
│   ├── index.js               # Express server entry
│   ├── package.json           # Dependencies & scripts
│   ├── .env.example           # Documented env template (no secrets)
│   ├── config/app.js          # Env-based config (port, JWT, data source)
│   ├── constants/serviceStatuses.js   # Canonical service statuses (backend)
│   ├── controllers/           # Business logic per resource
│   ├── routes/                # URL → controller mapping
│   ├── middleware/            # auth (JWT + roles), error handling, async wrapper
│   ├── utils/                 # auth, googleAuth, batteryIdentifier, date helpers
│   ├── data/
│   │   ├── index.js           # DATA SOURCE FACADE (mock ↔ postgres)
│   │   ├── store.js           # In-memory seeded store
│   │   ├── seedData.js        # Seed datasets (mirrors frontend dummyData.js)
│   │   └── postgres/index.js  # PostgreSQL repository (fully implemented)
│   └── sql/schema.sql         # PostgreSQL schema (users, batteries, services, …)
│
└── frontend/
    ├── index.html             # HTML entry point
    ├── package.json           # Dependencies & scripts
    ├── vite.config.js         # Vite + React plugin + /api dev proxy
    ├── tailwind.config.js     # Design tokens & theme
    ├── postcss.config.js      # Tailwind + Autoprefixer
    ├── .oxlintrc.json         # Oxlint rules
    ├── .env.example           # VITE_API_URL + VITE_GOOGLE_CLIENT_ID
    ├── public/                # Logo, favicon, SVG sprite
    ├── dist/                  # Production build output
    └── src/
        ├── main.jsx           # React root + BrowserRouter
        ├── App.jsx            # Route definitions + guards + layout shells
        ├── index.css          # Global styles + dark mode overrides
        ├── context/           # BatteryContext, AdminContext, BatteryTechnicianContext
        ├── services/          # client.js + user/admin/technician API wrappers
        ├── data/              # dummyData.js, serviceStatuses.js
        ├── pages/             # user/, admin/, battery-technician/ page components
        └── components/        # common/, user/, admin/ UI components
```

### Folder responsibilities

| Folder | Contains | Why it exists |
|--------|----------|---------------|
| `backend/config` | `app.js` | Single place that reads env vars and builds the app config. |
| `backend/constants` | `serviceStatuses.js` | Single source of truth for service statuses, shared by controllers. |
| `backend/controllers` | One controller per resource (auth, batteries, services, admin, analytics, profile, data, technician). | Business logic and validation, kept out of routes. |
| `backend/routes` | One router per resource. | URL mapping only. |
| `backend/middleware` | `auth.js` (JWT + roles), `errorMiddleware.js`, `asyncHandler.js`. | Cross-cutting concerns: security and consistent error handling. |
| `backend/utils` | JWT/password helpers, Google token verification, battery-identifier normalization, date helpers. | Reusable, side-effect-free logic. |
| `backend/data` | Store facade + mock store + seed data + postgres repository. | **The persistence layer.** Controllers only ever import `data/index.js`. |
| `backend/sql` | `schema.sql`. | PostgreSQL DDL mirroring the mock entities. |
| `frontend/src/context` | Three providers. | Global state (data + auth + UI state) shared across pages. |
| `frontend/src/services` | `client.js` + API wrappers. | The only files that call `fetch()`; centralizes JWT + error handling. |
| `frontend/src/pages` | Page components grouped by panel. | Router targets; compose components and read context. |
| `frontend/src/components` | Reusable UI primitives (`common/`) and domain components (`user/`, `admin/`). | Keep pages small and consistent. |

---

## Frontend

### Entry point

- `src/main.jsx` mounts `<App />` inside `BrowserRouter` and `React.StrictMode`.
- `src/App.jsx` declares every route, the three providers (`BatteryProvider`, `AdminProvider`, `BatteryTechnicianProvider`), three route-guard styles, and the shared layout with lazy-loaded pages.

### Routing

| Route | Component | Guard | Description |
|-------|-----------|-------|-------------|
| `/signin` | `SignInPage` | PublicOnly | Customer login (email/password or Google) |
| `/signup` | `SignUpPage` | PublicOnly | Customer registration |
| `/home` | `HomePage` | Protected | Fleet overview dashboard |
| `/battery/:id` | `BatteryDetailPage` | Protected | Battery specs & health |
| `/battery/:id/passport` | `BatteryPassportPage` | Protected | Full-screen EU Digital Battery Passport |
| `/services` | `ServicePage` | Protected | Service center |
| `/analytics` | `AnalyticsPage` | Protected | Charts & analytics |
| `/profile` | `ProfilePage` | Protected | Operator profile |
| `/settings` | `SettingPage` | Protected | App settings |
| `/admin/login` | `AdminLoginPage` | AdminPublicOnly | Admin login |
| `/admin` | `AdminLayout` + children | AdminPrivate | Admin dashboard, services, service-persons, customers, analytics, profile |
| `/battery-technician/login` | `BatteryTechnicianLoginPage` | TechPublicOnly | Technician login |
| `/battery-technician` | `BatteryTechnicianLayout` + children | TechPrivate | Technician dashboard + services |
| `/service-man/*` | redirect | – | Legacy aliases → battery-technician |
| `*` | `MainLayout` catch-all → `/home` | Protected | Everything else |

- **ProtectedRoute** → redirects to `/signin` when no user token.
- **PublicOnlyRoute** → redirects authenticated users to `/home`.
- **Admin/TechPrivateRoute** → shows a loader while the stored token is verified against `/api/admin/me` || `/api/battery-technician/me`, then redirects to the login page on failure.
- All customer pages share `MainLayout` (Sidebar + Header + Footer + scanner modal + add-battery modal). The passport page is the only full-screen (no chrome) customer page.

### Context / state management

Three React Contexts own all shared state:

| Context | State | Used by |
|---------|-------|---------|
| `BatteryContext` | Auth (`signIn`, `signUp`, `signInWithGoogle`, `signOut`), `batteries`, `services`, `userProfile`, `stats` (memoized fleet metrics), toasts, scanner/passport/add-battery modal state, sidebar, CRUD actions, `resetToSampleData` | Customer pages and components |
| `AdminContext` | Admin auth, `services`, `servicePersons`, `customers`, `analytics`, service lifecycle actions (accept/assign/status/approve), technician management | Admin pages and sidebar |
| `BatteryTechnicianContext` | Technician auth, assigned `services`, computed per-status `stats`, status-advance action | Technician pages and sidebar |

Conventions worth knowing:

- `loadAllData` (`BatteryContext`) fetches batteries + services + profile in parallel with `Promise.all`; a 401-style error clears the token and logs the user out.
- `resetToSampleData` calls `POST /api/data/reset` then reloads.
- A cached copy of the profile is kept in `localStorage` so auth pages render instantly while the API syncs.
- Toasts auto-dismiss after 4.5 s; confetti fires on `addBattery` and `bookService`.

### API communication

- `services/client.js` is the shared `fetch` wrapper. `BASE_URL = VITE_API_URL || "/api"`.
- It picks the right token by role: `maxspace_auth_token`, `maxspace_admin_token`, `maxspace_battery_technician_token`.
- In dev, Vite proxies `/api` → `http://localhost:5000`, so the browser always makes same-origin requests. In production, `VITE_API_URL` points directly at the deployed API.

### Important components

| Component | Purpose | Notes |
|-----------|---------|-------|
| `Sidebar` | Role-aware drawer (user/admin/technician). | Opens scanner / add-battery modals; logout delegates to the right context. |
| `Header` | Top bar with search, scanner button, notifications, profile menu. | Hides on scroll down; click-outside to close. |
| `Modal` | Reusable overlay dialog (portal + escape + scroll lock). | z-index locked to Tailwind-safe values. |
| `NotificationToast` | Global toast stack. | Reads `toasts` from `BatteryContext`. |
| `BatteryCard` | Fleet-grid battery summary card. | Derives per-battery service status. |
| `QRBarcodeScannerModal` | QR/barcode scanner. | jsQR decode loop, camera cleanup, code cooldown; resolves via `api.lookupBattery`. |
| `BookServiceModal` | Service booking form. | Date/time/mobile/notes; submit calls `bookService`. |
| `ServiceTable` / `ServiceMobileCards` | Desktop table / mobile cards for service records. | Expandable detail panel with status timeline. |
| `ServiceTracking` | Delivery-style status timeline. | Milestones derived by `tracking.js`. |
| `BatteryHealthChart` | Horizontal SoH distribution bars. | No charting library — pure Tailwind. |
| `AddBatteryModal` | "Register New Battery" form. | Used by the scanner flow to register unknown batteries. |
| `GoogleSignInButton` | Google Identity Services button. | Loads the GIS script once; never fabricates a successful login without a real client ID. |
| `StatusBadge` | Admin status chip. | Uses `statusStyle(status)`. |
| `AdminServiceRequestsPage` | Admin "Service Requests" list. | Card-based, expandable six-section details (customer, battery, service, location, technician, progress timeline), search box, status dropdown + filter tabs, status-specific actions (accept, assign, approve, reject, cancel) via modals. |

---

## Backend

### Server entry point (`backend/index.js`)

- Boots Express 5 with Helmet (security headers), CORS (origin allowed from `FRONTEND_URL`/`CLIENT_URL`), JSON body parsing (1 MB limit), and rate limiting on auth routes (100 req / 15 min).
- Mounts all routers under `/api/*`. The admin and technician login routes get their own stricter limiter (20 req / 15 min).
- `GET /` is a health endpoint reporting version, `dataSource`, whether a database URL is configured, and live DB connectivity.
- `notFound` + `errorHandler` middleware produce consistent JSON errors.

### Middleware

| Middleware | File | Purpose |
|------------|------|---------|
| `asyncHandler` | `middleware/asyncHandler.js` | Wraps async controllers so rejections reach the error handler. |
| `protect` | `middleware/auth.js` | Verifies `Authorization: Bearer <jwt>`, loads the user, attaches `req.user`. |
| `requireAdmin` | `middleware/auth.js` | 403 unless `req.user.role === "ADMIN"`. |
| `requireEmployee` | `middleware/auth.js` | 403 unless `req.user.role === "EMPLOYEE"`. |
| `errorHandler` | `middleware/errorMiddleware.js` | Sends `err.message` with the HTTP status set by controllers (default 500). |
| `notFound` | `middleware/errorMiddleware.js` | 404 for unknown routes. |

> Controllers set `res.status(code)` and throw — the error handler reads `res.statusCode` to return the intended error.

### Controllers

| Controller | Resource | Notable logic |
|------------|----------|---------------|
| `authController.js` | Sign in/up, Google, forgot/reset password, me, logout | Email + password + email-regex + 6-char password validation; bcrypt hashing; anti-enumeration on forgot-password; hashed reset tokens. |
| `batteryController.js` | CRUD + passport + health history | Auto ID/barcode/serial/QR generation; DPP defaults; duplicate detection (Postgres unique-violation → 409). |
| `serviceController.js` | Service CRUD + per-battery status | Users may only set status to `Cancelled`; admins/technicians advance it elsewhere. |
| `adminController.js` | Admin login, service workflow, service persons, technicians, customers, analytics | Service accept/assign/status/approve; technician creation = `service_person` + `EMPLOYEE` user pair; uniqueness checks. |
| `batteryTechnicianController.js` | Technician login (email + password), assigned services, status updates | `EMPLOYEE_ALLOWED_TRANSITIONS` whitelist enforces the field workflow. |
| `analyticsController.js` | Fleet stats, service analytics, performance, combined summary | Pure in-memory aggregations over the store data. |
| `profileController.js` | Profile CRUD, notifications, password change, activity, export | Password change verifies current password; export returns user + batteries + services. |
| `dataController.js` | `POST /api/data/reset` | Re-seeds the dataset to the sample state. |

### Data layer

- Controllers import the default export of `backend/data/index.js` (never `store.js`/`postgres` directly).
- The facade resolves `DATA_SOURCE`:
  - `mock` → the in-memory `Store` seeded from `seedData.js` (returned as a resolved promise).
  - `postgres` → dynamically imports `pg`, creates a pool, calls `createPostgresStore()`, and **ping-checks** it. On any failure (no URL, missing driver, no DB) it logs a warning and falls back to mock.
- Because postgres methods are async, controllers `await` store calls — awaiting a plain value (mock) is a no-op, so the same controller code works for both backends.

### Why each layer exists

- **Routes are dumb** so URLs never leak into business logic.
- **Controllers hold rules** because validation and status transitions are per-resource concerns.
- **The store facade decouples persistence** so a database swap is an env change, not a code change.
- **Middleware isolates auth** so every route gets consistent JWT/role enforcement.

---

## Authentication & Authorization

All auth uses **stateless JWTs** signed with `JWT_SECRET`. The frontend stores the token per role in `localStorage` and sends it as `Authorization: Bearer <token>`.

### Registration

```
User submits signup form (name, email, password, confirmPassword)
       ↓
POST /api/auth/signup
       ↓
Backend validates (name, email regex, password ≥ 6 chars, password match)
       ↓
Rejects if the email already exists (409)
       ↓
bcrypt.hash(password, 10)
       ↓
Creates a USER account + signs a JWT
       ↓
Frontend stores token → authenticated
```

### Login

```
POST /api/auth/login  (or /api/auth/signin)
       ↓
Backend looks up the user, checks role and password
       ↓
Signs a JWT (7-day expiry by default) → { token, user }
       ↓
Frontend stores token in localStorage → auth state = true
       ↓
Contexts load batteries/services/profile from the API
```

### Google Sign-In (ID-token flow)

- The frontend uses **Google Identity Services**; the browser receives an ID token, which is posted to `/api/auth/google` (customers).
- The backend verifies the token with `google-auth-library` against the configured `GOOGLE_CLIENT_ID`, checks the audience, and requires a Google-verified email. User-submitted profile fields are never trusted.
- Users: a new Google email creates a USER account; an existing account with the same email is linked to Google (never duplicated).
- Battery Technicians sign in with their MaxSpace **email + password** only. Google Sign-In is reserved for customer accounts — there is no `/api/battery-technician/google` route.

### Password hashing

- New passwords are hashed with `bcryptjs` (cost 10).
- `matchesPassword` in `utils/auth.js` supports both bcrypt hashes and plain-text seeds so the demo dataset works without re-hashing.

### Protected routes

- Frontend: `ProtectedRoute` / `AdminPrivateRoute` / `TechPrivateRoute` guard the UI; tokens are re-verified against the backend on mount.
- Backend: `protect` guards every business route; role guards strictly restrict admin and employee endpoints. The frontend guard is UX only — the backend is the authority.

### Role-based authorization

| Role | Can |
|------|-----|
| `USER` | Batteries, services (book + cancel), profile, analytics, data reset |
| `ADMIN` | Everything under `/api/admin/*` (service workflow, service persons, technicians, customers, analytics) |
| `EMPLOYEE` | Assigned services only; status transitions limited to the technician whitelist |

### Forgot / reset password

- `POST /api/auth/forgot-password` generates a random 32-byte token, stores a **SHA-256 hash** + 30-minute expiry on the user record, and always returns the same response (preventing email enumeration).
- No SMTP is configured for this build; the reset link is appended to a local log file for development (see [Known Limitations](#known-limitations--future-improvements)).
- `POST /api/auth/reset-password` validates the token hash and expiry, updates the password, and clears the token.

### Logout

- Clear the token from `localStorage` (each context has its own key). The JWT is stateless, so the `/logout` endpoint is best-effort; Google One-Tap is also disabled client-side on logout.

### Why these mechanisms exist

- **JWT** gives the three panels a stateless, shared identity without server sessions.
- **Role guards** are enforced server-side so role privileges cannot be bypassed by editing frontend code.
- **bcrypt** makes stored passwords resistant to offline cracking.
- **Google token verification** never trusts the browser ID_token blindly; only Google-signed tokens for this app's client are accepted.
- **Reset-token hashing** means a leaked DB dump cannot be replayed to reset passwords.

---

## API Reference

All endpoints are JSON. Protected endpoints require `Authorization: Bearer <token>`. Errors return `{ message }` with the appropriate status code.

### Health

```
GET /
Purpose: Server heartbeat + data-source status.
Authentication: Not required.
Response: version, dataSource, databaseConfigured, databaseConnected, endpoints.
```

### Auth — `/api/auth`

| Method | Endpoint | Purpose | Auth | DB tables |
|--------|----------|---------|------|-----------|
| POST | `/signin` | Login with email + password | – | `users` |
| POST | `/signup` | Register a new USER account | – | `users` |
| POST | `/google` | Google Sign-In (ID token) | – | `users`, `profiles` |
| POST | `/forgot-password` | Request a password reset | – | `users` |
| POST | `/reset-password` | Consume reset token + set new password | – | `users` |
| POST | `/logout` | Best-effort logout | bearer | – |
| GET | `/me` | Current user | bearer | `users` |

### Batteries — `/api/batteries` (all protected)

| Method | Endpoint | Purpose | DB tables |
|--------|----------|---------|-----------|
| GET | `/` | List batteries; `?barcode=` filters to a single match | `batteries` |
| POST | `/` | Register a new battery + mint its passport | `batteries` |
| GET | `/lookup?code=` (or `barcode`/`serial`/`id`) | Resolve a scanned code to a battery | `batteries` |
| GET | `/:id` | Single battery (accepts id/barcode/serial/QR URI) | `batteries` |
| PUT | `/:id` | Update battery fields | `batteries` |
| DELETE | `/:id` | Remove a battery | `batteries` |
| GET | `/:id/passport` | Structured DPP + related service history | `batteries`, `services` |
| GET | `/:id/health-history` | SoH timeline | `batteries` |

```
GET /api/batteries/:id/passport
Purpose:          Returns a battery with its service history and a generated
                  passport payload (used by the full-screen passport page).
Authentication:   Bearer token required.
Request:          :id may be an internal id, barcode, serial number, or QR URI.
Response:         { battery, serviceHistory, generatedAt, qrUrl }
Errors:           400 (no identifier) / 404 (not found) / 401 (not authorized)
```

### Services — `/api/services` (all protected)

| Method | Endpoint | Purpose | Notes |
|--------|----------|---------|-------|
| GET | `/` | List services; `?batteryId=&status=` filter | |
| POST | `/` | Book a service (status starts `Confirmed`) | Requires `batteryId` |
| GET | `/:id` | Single service | |
| PATCH | `/:id` | Update; **users may only set status to `Cancelled`** | Other statuses → 403 |
| DELETE | `/:id` | Delete a service record | |
| GET | `/battery/:batteryId/status` | Derived per-battery status (`Pending`/`Active`/`Booked`/`Completed`) | |

### Profile — `/api/profile` (all protected)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/` | Current profile |
| PUT | `/` | Update profile fields |
| PUT | `/notifications` | Merge notification settings |
| POST | `/password` | Change password (verifies current password) |
| GET | `/activity` | Activity logs |
| GET | `/export` | Export user + batteries + services as JSON |

### Analytics — `/api/analytics` (all protected)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/` | Combined `{ batteries (with service counts), services }` |
| GET | `/fleet-stats` | Fleet health/warranty/service aggregates |
| GET | `/services` | Service counts + pending percentage |
| GET | `/batteries/performance` | Per-battery health/voltage/capacity/service-count rows |

### Data — `/api/data` (protected + ADMIN)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/reset` | Restore the sample dataset |

### Admin — `/api/admin`

Public: `POST /login` (rate-limited to 20/15 min).

All others require `protect` + `requireAdmin`:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/me` | Current admin |
| POST | `/logout` | Best-effort logout |
| GET | `/services` | Services enriched with battery (warranty, barcode, manufacturer, location), customer (phone/location from profile), and assigned technician (from FK or service person's `assignedServices`) |
| GET | `/services/:id` | Single enriched service |
| PATCH | `/services/:id/accept` | `Confirmed` → `Accepted` |
| PATCH | `/services/:id/assign` | `Accepted` → `Assigned` (+ service person) |
| PATCH | `/services/:id/status` | Set any valid status |
| PATCH | `/services/:id/approve` | `Waiting for Admin Approval` → `Completed` |
| GET | `/service-persons` | Service persons with assigned/completed/active counts |
| POST | `/service-persons` | Create a service person |
| PATCH | `/service-persons/:id` | Update a service person |
| GET | `/technicians` | Technicians with workload stats |
| GET | `/technicians/:id` | Single technician + assigned services |
| POST | `/technicians` | Create technician (service person + EMPLOYEE user) |
| PATCH | `/technicians/:id` | Update technician (syncs linked EMPLOYEE user) |
| PATCH | `/technicians/:id/reset-password` | Reset the technician login password |
| GET | `/customers` | Customers with service stats |
| GET | `/analytics` | Dashboard analytics (bookings, completion rate, status breakdown) |

### Battery Technician — `/api/battery-technician`

Public: `POST /login` (rate-limited).

All others require `protect` + `requireEmployee`:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/me` | Current technician + service-person record |
| POST | `/logout` | Best-effort logout |
| GET | `/services` | Services assigned to this technician |
| GET | `/services/:id` | Assigned service detail (403 if not assigned) |
| PATCH | `/services/:id/status` | Advance status — **only** Assigned→Accepted, Accepted→On The Way, On The Way→In Progress, In Progress→Waiting for Admin Approval (or Cancelled) |

```
PATCH /api/battery-technician/services/:id/status
Purpose:          Advance the field workflow for an assigned service.
Authentication:   EMPLOYEE bearer token; service must be assigned to the caller.
Request:          { "status": "In Progress" }
Response:         Updated service object.
Errors:           400 (invalid/forbidden transition) / 403 (not assigned) / 404.
DB:               services (status + history append), profiles (activity log).
```

---

## Database

### Engine & configuration

- **PostgreSQL** via the `pg` driver, enabled when `DATA_SOURCE=postgres` and `DATABASE_URL` are set.
- `docker-compose.yaml` runs PostgreSQL 17 (`maxspace_user` / `maxspace_password` / `maxspace_db`, port `5432`, named volume).
- DDL lives in `backend/sql/schema.sql`.
- The backend also ships a **mock** in-memory store that uses the same entity shapes (from `backend/data/seedData.js`, which mirrors `frontend/src/data/dummyData.js`).

### Tables

#### `users`
| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | e.g. `admin-1`, `user-1`, `emp-1` |
| `name`, `email` | TEXT | email is `UNIQUE` |
| `password_hash` | TEXT | bcrypt (empty for Google-only accounts) |
| `role` | TEXT | `USER` / `ADMIN` / `EMPLOYEE` (CHECK) |
| `service_person_id` | TEXT | FK → `service_persons.id` (EMPLOYEE only) |
| `google_id` | TEXT UNIQUE | Google subject ID for linked accounts |
| `auth_provider` | TEXT | `local` / `google` |
| `reset_token_hash`, `reset_token_expires_at` | TEXT / TIMESTAMPTZ | password reset |

Index: `idx_users_reset_token (reset_token_hash)`.

#### `service_persons`
| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | e.g. `sp-1` |
| `technician_id` | TEXT UNIQUE | e.g. `TECH-2024-0001` |
| `name`, `email`, `phone`, `certification` | TEXT | email UNIQUE |
| `specializations`, `assigned_services` | JSONB | `assigned_services` holds service ids |
| `status` | TEXT | `active` / `inactive` |

Relation: an `EMPLOYEE` user points to one `service_persons` row via `service_person_id`.

#### `batteries`
| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | e.g. `batt-1` |
| `barcode`, `serial_number` | TEXT UNIQUE | scanned to identify a battery |
| `qr_code` | TEXT | EU passport URL |
| `name`, `model_name`, `model`, `type`, `manufacturer` | TEXT | |
| `chemistry`, `capacity_kwh`, `capacity`, `nominal_voltage`, `voltage`, `weight_kg`, `dimensions_mm`, `cells` | misc | specs |
| `state_of_health`, `state_of_charge`, `cycle_count`, `max_rated_cycles`, `internal_resistance_mohms`, `operating_temp_c` | NUMERIC/INT | health/telemetry |
| `carbon_footprint_kg_per_kwh` | NUMERIC | |
| `recycled_content`, `warranty`, `compliance_standards`, `health_history` | JSONB | embedded documents |
| `dismantling_manual` | TEXT | safety |

Indexes: `idx_batteries_barcode`, `idx_batteries_serial`.

#### `services`
| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | e.g. `srv-101` |
| `ticket_number` | TEXT UNIQUE | `SRV-YYYY-####` |
| `battery_id` | TEXT FK → `batteries.id` | `ON DELETE SET NULL` |
| `service_type`, `center`, `scheduled_date`, `scheduled_time`, `mobile_number` | TEXT | booking details |
| `status`, `priority`, `technician`, `estimated_arrival` | TEXT | lifecycle |
| `customer_id` | TEXT FK → `users.id` | |
| `assigned_service_person_id` | TEXT FK → `service_persons.id` | |
| `admin_approved_at`, `approved_by` | TEXT | completion approval |
| `notes`, `cost`, `history` (JSONB) | TEXT/JSONB | audit history array |

Indexes: `idx_services_battery`, `idx_services_status`, `idx_services_customer`.

#### `profiles`
Single row keyed by `user_id` (FK → `users.id`, `ON DELETE CASCADE`): operator profile plus `notification_settings` and `activity_logs` (JSONB).

### Relationships

```
users (EMPLOYEE) ──service_person_id──▶ service_persons
batteries ◀──battery_id────── services ──customer_id──▶ users
profiles ──user_id──▶ users
```

### Model ↔ table mapping

The postgres repository (`backend/data/postgres/index.js`) maps `snake_case` rows to the **camelCase** objects the controllers expect (`mapUserRow`, `mapServicePersonRow`, `mapBatteryRow`, `mapServiceRow`, `mapProfileRow`). JSONB columns store nested objects (`warranty`, `healthHistory`, `history`, `activityLogs`, `specializations`).

### Seed dataset

`backend/data/seedData.js` (and its frontend mirror `frontend/src/data/dummyData.js`) ships:

- **7 batteries** across EV / ESS / LEV / Commercial Transport / Aerial & UAV / Industrial Cordless / Material Handling categories, with one expiring warranty and assorted SoH values for meaningful dashboards.
- **6 services** deliberately spanning the lifecycle: Confirmed, Accepted, Assigned, On The Way, In Progress, Completed.
- **5 service persons** (4 active, 1 inactive), each with an **EMPLOYEE** login.
- **1 admin** (`admin@maxspace.com`) and **1 regular customer** (`alex.rivera@maxspace-energy.com`).

`POST /api/data/reset` (`store.reset()`) restores this sample state on demand.

### `maxtrace_backup.dump`

This file at the repository root is a **`pg_dump` (custom format) of a separate, older database named `maxvolt_prod`** whose schema (cells, cell_gradings, battery_models, bms_inventory, spot_welding_data, laser_welding_data, pdi_reports, pack_testing_reports, battery_cell_mapping, dispatch_records) belongs to an unrelated battery-manufacturing traceability system.

- It is **not used by the MaxSpace application**, does not match the current `users`/`batteries`/`services` schema, and is **untracked** in git.
- Treat it as a legacy backup of another project. Do not restore it into the MaxSpace database. If you want to keep it out of the repo, add it to a root `.gitignore`.

### Data consistency contract

Entity shapes are intentionally mirrored across three layers so behavior is identical in both backends and the UI:

- Frontend: `frontend/src/data/dummyData.js` + `frontend/src/data/serviceStatuses.js`
- Backend: `backend/data/seedData.js` + `backend/constants/serviceStatuses.js`
- Database: `backend/sql/schema.sql`

Keep them in sync when an entity's shape changes. Service status strings are always referenced through the shared constants, never hard-coded.

---

## Application Workflows

### Battery workflow

```
Battery created
   ↓
Scanned (camera / upload / presets / manual) or registered in Add Battery modal
   ↓
POST /api/batteries → id + barcode + serial + QR URL generated, passport minted
   ↓
Stored (mock memory or batteries table) + activity log entry
   ↓
Displayed on Home (BatteryCard grid) and /battery/:id (specs, health, compliance)
   ↓
Tracked via health history, warranty status, and analytics
   ↓
Serviced through the service lifecycle below
```

### Service workflow

```
Customer books (POST /api/services)            → status "Confirmed"
   ↓
Admin reviews (Admin → Service Requests)
   ↓
Admin accepts (PATCH /accept)                  → status "Accepted"
   ↓
Admin assigns a technician (PATCH /assign)     → status "Assigned"
   ↓
Technician accepts (PATCH /status)             → "Accepted"
   ↓
Technician dispatches (PATCH /status)          → "On The Way"
   ↓
Technician starts work (PATCH /status)         → "In Progress"
   ↓
Technician finishes (PATCH /status)            → "Waiting for Admin Approval"
   ↓
Admin finalizes (PATCH /approve)               → "Completed" (with approvedBy timestamp)
```

Customers may cancel a confirmed booking at any of the non-completed stages; admins can also cancel. Every transition appends to the service `history` (performed by, notes, timestamp) and a subset writes to the profile activity log.

### User workflow

```
Register / log in (email or Google)
   ↓
Dashboard (/home) — fleet stats and battery cards
   ↓
Battery passport (/battery/:id/passport) — EU DPP compliance view
   ↓
Service (/services) — book, track, cancel
   ↓
Profile & settings (/profile, /settings)
```

### Admin workflow

```
Log in (/admin/login)
   ↓
Dashboard — bookings, completion rate, status breakdown
   ↓
Service Requests — accept → assign technician → approve completion
   ↓
Service Persons / Technicians — create, update, toggle active, reset password
   ↓
Customers — view accounts with service history
   ↓
Analytics — fleet + service KPIs
```

### Technician workflow

```
Log in (/battery-technician/login, email + password)
   ↓
Dashboard — prioritized assigned-queue
   ↓
Service detail — advance status (accept → on the way → in progress → finishing)
   ↓
Finish Service → "Waiting for Admin Approval" → admin approves → Completed
```

Battery Technician authentication and data all come from the backend API:

- **Sign-in** is email + password against the `users` table (bcrypt hash verified server-side). There is no Google/third-party option; the login page renders only the credential form.
- On login the backend returns a short-lived `EMPLOYEE` JWT plus the linked `service_persons` record stored in the `maxspace_battery_technician_token` token slot.
- `BatteryTechnicianContext` never stores batteries/services locally — `/me`, `/services`, and `/services/:id` are fetched from `/api/battery-technician/*`, and status changes go through `PATCH /services/:id/status` (only the technician assigned to the service may update it).
- Servicing against PostgreSQL: with `DATA_SOURCE=postgres` the same endpoints read/write the `maxspace_db` tables (`users`, `service_persons`, `services`, `batteries`).

---

## Configuration & Environment Variables

### Backend (`backend/.env` — copy from `backend/.env.example`)

| Variable | Purpose |
|----------|---------|
| `PORT` | HTTP port for the API (default `5000`). |
| `JWT_SECRET` | Secret signing key for JWTs. **Required** (the app refuses to boot without it). Use a long random value in production. |
| `JWT_EXPIRES_IN` | Token lifetime, e.g. `7d`. |
| `FRONTEND_URL` / `CLIENT_URL` | Allowed CORS origin(s) for the frontend (default `http://localhost:5173`). |
| `DATA_SOURCE` | `mock` (default, no DB) or `postgres`. |
| `DATABASE_URL` | PostgreSQL connection string; only required with `DATA_SOURCE=postgres`. |
| `GOOGLE_CLIENT_ID` | OAuth client ID for Google Sign-In (must match `VITE_GOOGLE_CLIENT_ID`). Leave blank to disable Google login. |
| `GOOGLE_CLIENT_SECRET` | Not used by the current ID-token flow; reserved for server-side OAuth code exchange. |
| `GOOGLE_CALLBACK_URL` | Optional; only needed for the old authorization-code flow. |

### Frontend (`frontend/.env` — copy from `frontend/.env.example`)

| Variable | Purpose |
|----------|---------|
| `VITE_API_URL` | Backend API base URL (default `http://localhost:5000/api`; `/api` works when using the dev proxy). |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client ID for the "Continue with Google" button (must match `GOOGLE_CLIENT_ID`). |

> ⚠️ Never commit real secrets. `backend/.env` is git-ignored; `frontend/.env` is committed and must only contain non-sensitive values.

---

## Local Development Setup

### Requirements

- **Node.js** `^20.19.0` or `>=22.12.0` (required by Vite 8; Node 22 LTS recommended).
- **npm** (bundled with Node).
- **PostgreSQL + Docker** — only needed for `DATA_SOURCE=postgres`. The default `mock` mode requires nothing.

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-username/MaxSpace.git
cd MaxSpace

# 2. Install + configure the backend
cd backend
npm install
cp .env.example .env

# 3. Install + configure the frontend
cd ../frontend
npm install
cp .env.example .env
```

### Run without a database (mock mode — default)

```bash
# Terminal 1 — backend on http://localhost:5000
cd backend
npm run dev

# Terminal 2 — frontend on http://localhost:5173
cd frontend
npm run dev
```

Open http://localhost:5173. Dev mode proxies `/api` calls to the backend, so no CORS setup or separate API URL is needed.

### Run with PostgreSQL (optional)

```bash
# 1. Start PostgreSQL 17
docker compose up -d postgres

# 2. Use postgres mode (edit backend/.env)
DATA_SOURCE=postgres
DATABASE_URL=postgresql://maxspace_user:maxspace_password@localhost:5432/maxspace_db

# 3. Apply the schema
docker compose exec -T postgres psql -U maxspace_user -d maxspace_db < backend/sql/schema.sql

# 4. Start the backend — expect "Using PostgreSQL repository."
cd backend
npm run dev

# Verify the health endpoint reports dataSource: "postgres"
curl http://localhost:5000
```

### Demo accounts (seed data)

| Role | Email | Password |
|------|-------|----------|
| Customer | `alex.rivera@maxspace-energy.com` | `password123` |
| Admin | `admin@maxspace.com` | `admin123` |
| Battery Technician | `markus.vance@maxspace.com` (or any `emp-*`) | `employee123` |

---

## Development Commands

| Action | Command (from `frontend/` or `backend/`) |
|--------|------------------------------------------|
| Install dependencies | `npm install` |
| Run frontend dev server | `npm run dev` (frontend) |
| Run backend dev server | `npm run dev` (backend) — nodemon |
| Run backend in production mode | `npm start` (backend) |
| Build the frontend | `npm run build` (frontend → `dist/`) |
| Lint the frontend | `npm run lint` (frontend — Oxlint) |
| Preview a production build | `npm run preview` (frontend) |
| Start PostgreSQL | `docker compose up -d postgres` (repo root) |
| Apply the DB schema | `docker compose exec -T postgres psql -U maxspace_user -d maxspace_db < backend/sql/schema.sql` |
| Check the API health | `curl http://localhost:5000` |
| Restore sample data | `POST /api/data/reset` (via the settings page or API, admin token) |

There is **no test suite** configured in this repository.

---

## Troubleshooting

```
Backend won't start / "JWT_SECRET environment variable is required"
→ backend/.env is missing the JWT_SECRET value. Copy .env.example → .env
  and provide a strong secret.

Frontend cannot reach the backend ("Cannot reach the server")
→ Start the backend (npm run dev in backend/). Check VITE_API_URL
  (frontend/.env) and that port 5000 is listening.

Database connection failed
→ Only relevant if DATA_SOURCE=postgres. Check the container is up
  (docker compose ps), DATABASE_URL matches docker-compose.yaml,
  and the schema is applied. The API falls back to mock mode and logs
  a warning if postgres is unreachable — see the startup log.

JWT/authentication failed (401 "Not authorized")
→ The stored token is invalid or expired. Sign out and sign in again;
  confirm JWT_SECRET did not change (tokens are invalidated when it does).

Google Sign-In button does nothing
→ GOOGLE_CLIENT_ID (backend/.env) and VITE_GOOGLE_CLIENT_ID
  (frontend/.env) must match, be non-empty, and the origin
  http://localhost:5173 must be in the Google OAuth "Authorized
  JavaScript origins". Camera scanning also requires HTTPS or localhost.

Scanner camera not working
→ getUserMedia requires a secure context (HTTPS) except on localhost.
  Use the sample presets, manual entry, or image upload instead.

Lint warnings about setState inside effects
→ Expected; oxlint currently reports ~12 React Compiler warnings
  (0 errors) in the existing context providers. Not blocking.

"Your Google account has no email" / "email is not verified"
→ Google Sign-In only accepts accounts with a verified email; use
  another Google account or the standard email/password login.
```

---

## Known Limitations / Future Improvements

Status markers (`TODO`/`FIXME`/`HACK`/`XXX`) were searched: **none exist** in the source. The following are intentional or known gaps:

- **Frontend password-reset page is incomplete.** The backend fully implements forgot/reset password, but the reset link (`/auth/reset-password?token=…`) points to a route the frontend does not define yet. Emails are logged to a temp file instead of being sent via SMTP.
- **Mock mode is ephemeral.** With `DATA_SOURCE=mock`, data resets to the seed on server restart. Use `DATA_SOURCE=postgres` for persistence.
- **No automated test suite.** No test framework or test files are configured for either side.
- **No real SMTP / email integration.** Reset links are development-only; no transactional email is sent.
- **Store links are placeholders.** Download buttons use `YOUR_APP_ID` placeholders in `storeLinks.js`.
- **Scanner camera requires HTTPS** (or localhost) due to `getUserMedia` secure-context rules.
- **Google auth requires configuration.** The login buttons render regardless, but sign-in only completes after real Google credentials are set in both `.env` files.
- **Single shared profile.** In this build `profiles` holds one operator profile row; multi-operator profiles would need a schema extension.
- **Oxlint warnings.** ~12 React Compiler "setState in effect" warnings exist in the context providers (0 errors).
- **Legacy dump file.** `maxtrace_backup.dump` (old `maxvolt_prod` database) is unrelated to MaxSpace and untracked; consider adding it to a root `.gitignore` or deleting it.

---

## License

This project is for demonstration/educational purposes. No license file is included.