# MaxSpace Frontend

The web app people use. It runs in the browser and talks to the
[MaxSpace backend API](../backend/README.md).

> No database knowledge needed to work on this folder — the frontend only ever
> speaks HTTP to the backend, which owns the data.

---

## 1. What is this app?

MaxSpace is a **Digital Battery Passport** system. It is **three apps in one**,
each with its own login:

| Panel            | Who uses it                        | Login URL                    |
| ---------------- | ---------------------------------- | ---------------------------- |
| **Customer app** | Battery owners / customers         | `http://localhost:5173`      |
| **Admin panel**  | MaxSpace admins                    | `http://localhost:5173/admin/login` |
| **Technician**   | Battery technicians                | `http://localhost:5173/battery-technician/login` |

A "battery passport" = one screen that shows everything about a battery: who owns
it, model and specs, state of health, warranty, recycled content, compliance
certificates, and its full service history.

---

## 2. Quick start

```bash
cd frontend
npm install

# optional: copy for custom API URL / Google client id
cp .env.example .env

npm run dev          # starts Vite dev server at http://localhost:5173
```

The dev server **automatically proxies** `/api` to `http://localhost:5000`, so
no API URL config is needed on a machine where the backend runs on port 5000.
If the backend is elsewhere (e.g. testing from a phone), set `VITE_API_URL`.

### Demo logins (mock backend mode)

| Panel       | Email                             | Password      |
| ----------- | --------------------------------- | ------------- |
| Admin       | admin@maxspace.com                | admin123      |
| Customer    | alex.rivera@maxspace-energy.com   | password123   |
| Technician  | markus.vance@maxspace.com         | employee123   |

> Same emails/passwords work when the backend runs against the bundled
> `maxvolt_prod` PostgreSQL database (see backend README §2).

---

## 3. How the app is organised

```
frontend/
├── index.html                    # HTML shell
├── vite.config.js                # dev server + /api proxy (see §2)
├── src/
│   ├── main.jsx                  # bootstrap: providers + <App/>
│   ├── App.jsx                   # ALL routes + lazy loading + auth guards
│   ├── index.css                 # global styles/tokens
│   ├── context/                  # global React state (see §6)
│   │   ├── BatteryContext.jsx         # customer login + batteries/services state
│   │   ├── AdminContext.jsx           # admin login state
│   │   └── BatteryTechnicianContext.jsx  # technician login state
│   ├── services/                 # how we talk to the backend (see §4)
│   │   ├── client.js                  # fetch wrapper (token + errors)
│   │   ├── api.js                     # customer endpoints
│   │   ├── adminApi.js                # admin endpoints
│   │   └── batteryTechnicianApi.js    # technician endpoints
│   ├── components/common/         # reusable UI pieces
│   │   ├── Sidebar.jsx                # left navigation menu
│   │   ├── Header.jsx                 # top bar (search, notifications, profile)
│   │   ├── Modal.jsx                  # popup dialogs
│   │   ├── Pagination.jsx             # page 1 2 3 … controls
│   │   └── ...                        # buttons, cards, badges, empty states…
│   └── pages/                     # one folder per panel, one file per screen
│       ├── user/                       # customer screens (Home, SignIn, SignUp,
│       │                               #   Battery, Passport, Service, Profile…)
│       ├── admin/                      AdminLoginPage, AdminLayout, AdminDashboardPage,
│       │                               AdminServiceRequestsPage, AdminServiceDetailsPage,
│       │                               AdminServicePersonsPage, AdminCustomersPage,
│       │                               AdminBatteriesPage, AdminUsersPage, …
│       └── battery-technician/         TechnicianLoginPage, Dashboard, Services…
```

**The golden rule:** a *page* is a screen you can reach via a URL. A *component*
is a piece used inside pages. If you add a new screen, add a file under
`src/pages/…` and register a route in `src/App.jsx`.

---

## 4. How the app talks to the backend

All requests go through `src/services/client.js`:

- adds your token as `Authorization: Bearer <token>` (when logged in),
- sends `Content-Type: application/json`,
- unwraps `response.json()`,
- throws a readable error (`error.message`) when the backend answers with a
  non-2xx status, and
- clears your login if the backend says **401** (token expired).

The three API files paper over the specifics:
- `api.js` — customer screens (`signIn`, `signUp`, `fetchBatteries`, `getBatteryPassport`, `createService`, …)
- `adminApi.js` — admin screens (`adminLogin`, `fetchServices`, `fetchCustomers`, `fetchUsersPaginated`, `fetchAdminBatteriesPaginated`, …)
- `technicianApi.js` — technician screens (`technicianLogin`, `fetchAssignedServices`, `updateServiceStatus`, …)

**Convention:** admin list screens use the paginated endpoints
(`?page=1&limit=20&search=…`). The backend answers with
`{ success, data: [...], pagination: {...} }` — the shared
`Pagination` component + the helper in each page read that envelope.

---

## 5. Where everything lives (map of screens)

### Customer app (`/`)
| Route                 | Page / file                       | What it does |
| --------------------- | --------------------------------- | ------------ |
| `/signin`, `/signup`  | `pages/user/SignInPage.jsx`, `pages/user/SignUpPage.jsx` | Sign in / create an account |
| `/reset-password`     | `pages/user/ResetPasswordPage.jsx` | Set a new password (alias `/auth/reset-password` still works) |
| `/home`               | `pages/user/HomePage.jsx`         | Landing / dashboard |
| `/battery/:id`        | `pages/user/BatteryDetailPage.jsx`| One battery |
| `/battery/:id/passport` | `pages/user/BatteryPassportPage.jsx` | The digital passport view (full-screen) |
| `/services`           | `pages/user/ServicePage.jsx`      | My service requests |
| `/analytics`          | `pages/user/AnalyticsPage.jsx`    | My fleet stats |
| `/profile`            | `pages/user/ProfilePage.jsx`      | My account settings |
| `/settings`           | `pages/user/SettingPage.jsx`      | App preferences |

> Scanning a battery QR/barcode does **not** live on its own route — it is the
> `QRBarcodeScannerModal` component opened from the header (`Header.jsx`), and
> "add battery" is the `AddBatteryModal` in `MainLayout` (`App.jsx`).

### Admin panel (`/admin`)
| Route                        | Page / file                        | What it does |
| ---------------------------- | ---------------------------------- | ------------ |
| `/admin/login`               | `admin/AdminLoginPage.jsx`         | Admin sign-in |
| `/admin`                     | `admin/AdminDashboardPage.jsx`     | KPIs: batteries, services, customers |
| `/admin/services`            | `admin/AdminServiceRequestsPage.jsx` | All service requests |
| `/admin/services/:id`        | `admin/AdminServiceDetailsPage.jsx` | Accept / assign / approve |
| `/admin/service-persons`     | `admin/AdminServicePersonsPage.jsx` | Technicians & service persons |
| `/admin/customers`           | `admin/AdminCustomersPage.jsx`     | Read-only customer registry |
| `/admin/batteries`           | `admin/AdminBatteriesPage.jsx`     | **Read-only full fleet registry** (every field + owner) |
| `/admin/users`               | `admin/AdminUsersPage.jsx`         | **Read-only all accounts** (ADMIN/USER/EMPLOYEE) |
| `/admin/analytics`           | `admin/AdminAnalyticsPage.jsx`     | Charts/statistics |
| `/admin/profile`             | `admin/AdminProfilePage.jsx`       | Admin account settings |

The admin layout (`admin/AdminLayout.jsx`) renders the shared `Sidebar` with the
menu items for all of the above. The two newest pages (`AdminBatteriesPage`,
`AdminUsersPage`) are **view-only** — they read the registries and show a
"View all" modal with every field; there are no edit controls, by design.

### Technician portal (`/battery-technician`)
| Route                        | Page / file                                   | What it does |
| ---------------------------- | --------------------------------------------- | ------------ |
| `/battery-technician/login`  | `battery-technician/BatteryTechnicianLoginPage.jsx` | Technician sign-in |
| `/battery-technician`        | `battery-technician/BatteryTechnicianDashboardPage.jsx` | My assigned work (summary + stats) |
| `/battery-technician/services` | `battery-technician/BatteryTechnicianServicesPage.jsx` | Assigned service list |
| `/battery-technician/services/:id` | `battery-technician/BatteryTechnicianServiceDetailsPage.jsx` | Update service status |

---

## 6. Login state (the three contexts)

There are **three separate logins** because each panel has a different role
(USER / ADMIN / EMPLOYEE):

- `BatteryContext` — the customer session. It reads the token from `api.js`
  (stored in **localStorage**) so a refresh keeps you logged in, and clears it
  when the backend answers a **401**. It also holds the customer's batteries,
  services, and profile state.
- `AdminContext` — admin session. Same pattern, separate `localStorage` key.
- `BatteryTechnicianContext` — technician session. Same pattern.

`App.jsx` wraps the three providers and uses route guards
(`ProtectedRoute` / `PublicOnlyRoute` for customers, `AdminPrivateRoute`,
`BatteryTechnicianPrivateRoute`, plus their public-only twins).

## 7. Environment variables (frontend/.env)

| Variable                 | Purpose                                        | Default in dev     |
| ------------------------ | ---------------------------------------------- | ------------------ |
| `VITE_API_URL`           | Backend API base URL (see §2)                  | `/api` (proxied)   |
| `VITE_GOOGLE_CLIENT_ID`  | Enables the "Continue with Google" button      | empty (disabled)   |

Values starting with `VITE_` are the **only** ones that reach the browser —
do not put secrets in this file.

## 8. Useful commands

```bash
npm run dev       # development server (hot reload)  → http://localhost:5173
npm run build     # production bundle               → dist/
npm run preview   # serve the built dist/ locally
npm run lint      # eslint — rule of thumb: 0 errors, warnings are ok to fix
```

Quick workflow when adding a screen:
1. Put the page in `src/pages/<panel>/` matching the existing style.
2. Add a lazy import + `<Route …>` in `src/App.jsx`.
3. If it lives behind a nav menu, add the item to `components/common/Sidebar.jsx`.
4. If it needs data, add a function in the matching `src/services/*Api.js`.
5. Run `npm run lint` and `npm run build` before you're done.