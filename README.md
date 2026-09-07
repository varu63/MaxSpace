# MaxSpace — Digital Battery Passport System

A modern single-page web application for managing battery fleets and generating **EU-compliant Digital Battery Passports** under the [EU Battery Regulation 2023/1542](https://eur-lex.europa.eu/eli/reg/2023/1542).

MaxSpace lets fleet directors register batteries, track health metrics, book services, scan QR/barcodes, view analytics, and export full EU Battery Passport data — all from one dashboard.

---

## Table of Contents

- [Features](#features)
- [Demo Screenshots](#demo-screenshots)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Available Scripts](#available-scripts)
- [Application Architecture](#application-architecture)
  - [Routing](#routing)
  - [State Management](#state-management)
  - [Data Persistence](#data-persistence)
- [Pages & Components](#pages--components)
  - [Pages](#pages)
  - [Key Components](#key-components)
- [Battery Data Model](#battery-data-model)
- [Design System](#design-system)
- [Configuration Files](#configuration-files)
- [Known Limitations](#known-limitations)
- [License](#license)

---

## Features

### Battery Management
- Register and manage batteries across four categories: **EV**, **Stationary ESS**, **E-Bike/LEV**, and **Commercial Transport**
- View detailed battery specs: State of Health (SoH), State of Charge (SoC), cycle count, chemistry, capacity, voltage, and dimensions
- Track warranty status (Active / Expiring / Expired) with expiry dates and coverage details
- View health history timeline with dated health snapshots
- Dismantling instructions and recycled content percentages per battery

### EU Digital Battery Passport
- Auto-generated compliance passports for every registered battery
- Full-screen passport view with gold-framed layout including:
  - **Manufacturer Identifier** — company name, country, registration ID
  - **Battery Descriptor** — type, chemistry, capacity, voltage, weight
  - **Battery Identifier** — unique ID, serial number, barcode, EU QR code URL
  - **Material Composition** — detailed breakdown (lithium, cobalt, nickel, manganese, graphite, etc.)
  - **Carbon Footprint** — total CO2 emissions, manufacturing/transport/recycling breakdown
  - **Dynamic Data** — SoH, SoC, cycle count, temperature, last service date
- EU compliance standards listed per battery (IEC 62619, UN 38.3, EU Reg 2023/1542, ISO 26262)

### QR / Barcode Scanner
- Built-in scanner modal with multiple input methods:
  - **Camera mode** — real-time camera feed for scanning
  - **Quick samples** — preset barcode buttons for demo/testing
  - **Manual entry** — type barcode or serial number directly
  - **Image upload** — upload a photo containing a barcode
- Automatic battery lookup on scan (existing) or registration prompt (new)

### Service Management
- Book, view, and manage service/maintenance appointments
- Service statuses: **Confirmed**, **In Progress**, **Completed**, **Cancelled**
- Filter and search services by status, location, or battery
- Service stats: total, active, completed, and total cost
- Auto-generated ticket numbers (`SRV-YYYY-####`)

### Analytics Dashboard
- Fleet health overview with aggregate statistics
- Battery health distribution charts (built with Tailwind — no charting library)
- Service analytics and battery performance metrics
- Analysis table with sortable/filterable data

### User Profile & Settings
- Operator profile with avatar, company info, and fleet details
- Notification preferences and activity log
- Settings panel:
  - **General** — language, timezone
  - **Account** — email, password management
  - **Appearance** — dark mode toggle, accent color picker
  - **Security** — two-factor authentication toggle
  - **Data & Backup** — export all fleet data as JSON, restore from backup

### Other
- Dark mode support with full theme override
- Responsive layout (desktop sidebar + mobile cards)
- Code-splitting with `React.lazy()` for fast initial load
- Confetti animations on battery registration and service booking
- Floating download button for app store placeholder links
- Sign In / Sign Up pages with form validation (local auth only)

---

## Tech Stack

| Layer            | Technology                                  |
|------------------|---------------------------------------------|
| **Language**     | JavaScript (ES Modules, JSX)                |
| **UI Framework** | React 19                                    |
| **Build Tool**   | Vite 8                                      |
| **Routing**      | React Router DOM 7                          |
| **Styling**      | Tailwind CSS 3 + PostCSS + Autoprefixer     |
| **Icons**        | Lucide React                                |
| **Animations**   | Canvas Confetti                             |
| **Linting**      | Oxlint (React + OXC plugins)               |
| **State**        | React Context API                           |
| **Persistence**  | localStorage (browser)                      |
| **Fonts**        | Inter (UI) + JetBrains Mono (identifiers)   |

> **No backend** — this is a fully client-side application. All data lives in the browser's `localStorage`.

---

## Project Structure

```
MaxSpace/
├── README.md
└── frontend/
    ├── index.html                  # HTML entry point
    ├── package.json                # Dependencies & scripts
    ├── vite.config.js              # Vite + React plugin
    ├── tailwind.config.js          # Design tokens & theme
    ├── postcss.config.js           # Tailwind + Autoprefixer
    ├── .oxlintrc.json              # Linter config
    ├── .gitignore
    ├── public/
    │   ├── Logo.png                # App logo
    │   ├── favicon.svg             # Browser tab icon
    │   └── icons.svg               # SVG sprite
    ├── dist/                       # Production build output
    └── src/
        ├── main.jsx                # App bootstrap (React root + Router)
        ├── App.jsx                 # Route definitions + layout shell
        ├── index.css               # Global styles + dark mode overrides
        │
        ├── context/
        │   └── BatteryContext.jsx   # Global state provider (all app logic)
        │
        ├── data/
        │   └── dummyData.js         # Sample batteries, services, user profile
        │
        ├── pages/
        │   ├── HomePage.jsx         # Fleet overview dashboard
        │   ├── BatteryDetailPage.jsx    # Full battery specifications
        │   ├── BatteryPassportPage.jsx  # EU Digital Battery Passport (full-screen)
        │   ├── ServicePage.jsx      # Service center
        │   ├── AnalyticsPage.jsx    # Charts & analytics
        │   ├── ProfilePage.jsx      # Operator profile
        │   ├── SettingPage.jsx      # App settings
        │   ├── SignInPage.jsx       # Login form
        │   └── SignUpPage.jsx       # Registration form
        │
        └── components/
            ├── common/             # Shared UI primitives
            │   ├── Card.jsx        # Card, IconBox, PageHeader, StatCard, etc.
            │   ├── DetailRow.jsx
            │   ├── InfoBlock.jsx
            │   ├── Modal.jsx
            │   ├── EmptyState.jsx
            │   ├── Sidebar.jsx     # Navigation sidebar
            │   ├── Header.jsx      # Top header bar
            │   ├── Footer.jsx
            │   ├── NotificationToast.jsx
            │   ├── DownloadAppButton.jsx
            │   ├── FloatingDownloadButton.jsx
            │   ├── storeLinks.js
            │   └── index.js        # Barrel exports
            │
            ├── home/
            │   └── BatteryCard.jsx
            │
            ├── scanner/
            │   └── QRBarcodeScannerModal.jsx
            │
            ├── profile/
            │   ├── UserProfileView.jsx
            │   └── EditProfileModal.jsx
            │
            ├── services/
            │   ├── BookServiceModal.jsx
            │   ├── BatteryServiceModal.jsx
            │   ├── BookedServices.jsx
            │   ├── ServiceTable.jsx
            │   ├── ServiceMobileCards.jsx
            │   ├── ServiceStats.jsx
            │   ├── ServiceFilters.jsx
            │   ├── ServiceInfoCards.jsx
            │   └── status.js
            │
            └── analytics/
                ├── AnalyticsStats.jsx
                ├── BatteryHealthChart.jsx
                ├── ServiceAnalytics.jsx
                ├── BatteryPerformance.jsx
                └── AnalyticsTable.jsx
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- npm (comes with Node.js)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/MaxSpace.git
cd MaxSpace

# Navigate to the frontend directory
cd frontend

# Install dependencies
npm install
```

### Development Server

```bash
npm run dev
```

Opens the app at [http://localhost:5173](http://localhost:5173) with hot module replacement.

### Production Build

```bash
npm run build
npm run preview
```

Outputs optimized static files to `frontend/dist/`. The preview command serves the built output locally.

---

## Available Scripts

| Command              | Description                                      |
|----------------------|--------------------------------------------------|
| `npm run dev`        | Start Vite dev server with HMR                   |
| `npm run build`      | Create production build in `dist/`                |
| `npm run preview`    | Preview the production build locally              |
| `npm run lint`       | Run Oxlint linter (React + OXC rules)            |

---

## Application Architecture

### Routing

Defined in `App.jsx` using React Router 7 with `BrowserRouter`:

| Route                         | Component              | Auth Required | Description                          |
|-------------------------------|------------------------|---------------|--------------------------------------|
| `/signin`                     | SignInPage              | No            | Login form                           |
| `/signup`                     | SignUpPage              | No            | Registration form                    |
| `/home`                       | HomePage                | Yes           | Fleet overview dashboard             |
| `/battery/:id`                | BatteryDetailPage       | Yes           | Battery specs & health details       |
| `/battery/:id/passport`       | BatteryPassportPage     | Yes           | Full-screen EU Battery Passport      |
| `/services`                   | ServicePage             | Yes           | Service center                       |
| `/analytics`                  | AnalyticsPage           | Yes           | Charts & analytics                   |
| `/profile`                    | ProfilePage             | Yes           | Operator profile                     |
| `/settings`                   | SettingPage             | Yes           | App settings                         |
| `*`                           | Redirect → `/home`      | Yes           | Catch-all redirect                   |

- **ProtectedRoute** — redirects unauthenticated users to `/signin`
- **PublicOnlyRoute** — redirects authenticated users to `/home`
- All pages except the passport use `MainLayout` (Sidebar + Header + Footer)

### State Management

All global state lives in **`BatteryContext.jsx`** via React Context. It provides:

- **Batteries** — CRUD operations (`addBattery`, `updateBattery`, `deleteBattery`, `findBatteryByBarcode`)
- **Services** — booking, status tracking, filtering (`bookService`, `getBatteryServiceStatus`)
- **User Profile** — `updateProfile`
- **Auth** — `signIn`, `signUp`, `signOut` (local-only, no backend)
- **UI State** — sidebar toggle, scanner modal, passport modal, toasts, add-battery modal
- **Computed Stats** — memoized fleet statistics (total batteries, SoH averages, service counts, warranty counts)
- **Reset** — `resetToSampleData` restores all data to initial dummy data

### Data Persistence

All data is stored in the browser's `localStorage` under these keys:

| Key                          | Contents                    |
|------------------------------|-----------------------------|
| `maxspace_batteries`         | Battery array (JSON)        |
| `maxspace_services`          | Service records (JSON)      |
| `maxspace_user_profile`      | Operator profile (JSON)     |
| `maxspace_auth`              | Auth flag (`true`/`false`)  |

Changes persist automatically via `useEffect` watchers in the context provider.

---

## Pages & Components

### Pages

| Page                     | Description                                                              |
|--------------------------|--------------------------------------------------------------------------|
| **HomePage**             | Fleet dashboard with stat cards, fleet status summary, battery card grid |
| **BatteryDetailPage**    | Full battery specs: SoH, SoC, cycles, warranty, compliance, health history |
| **BatteryPassportPage**  | Full-screen EU Battery Passport with gold-framed compliance layout       |
| **ServicePage**          | Service center: stats, booked services, filterable table + mobile cards  |
| **AnalyticsPage**        | Analytics: fleet health chart, service analytics, performance metrics    |
| **ProfilePage**          | Operator profile with hero, account info, notifications, activity log    |
| **SettingPage**          | Multi-section settings: general, account, appearance, security, data     |
| **SignInPage**           | Login form with validation and trust badges                              |
| **SignUpPage**           | Registration form with validation and trust badges                       |

### Key Components

| Component                  | Location                           | Purpose                                      |
|----------------------------|------------------------------------|----------------------------------------------|
| `Sidebar`                  | `components/common/Sidebar.jsx`    | Navigation menu with links and actions        |
| `Header`                   | `components/common/Header.jsx`     | Top bar with search, notifications, user menu |
| `Modal`                    | `components/common/Modal.jsx`      | Reusable overlay modal                       |
| `Card`                     | `components/common/Card.jsx`       | Card, StatCard, PageHeader, SectionHeader     |
| `NotificationToast`       | `components/common/NotificationToast.jsx` | Toast notification system              |
| `BatteryCard`              | `components/home/BatteryCard.jsx`  | Battery summary card for the fleet grid      |
| `QRBarcodeScannerModal`   | `components/scanner/QRBarcodeScannerModal.jsx` | QR/barcode scanner with camera/manual/upload |
| `BookServiceModal`        | `components/services/BookServiceModal.jsx` | Service booking form                    |
| `ServiceTable`             | `components/services/ServiceTable.jsx` | Desktop service records table            |
| `BatteryHealthChart`      | `components/analytics/BatteryHealthChart.jsx` | Health distribution chart            |

---

## Battery Data Model

Each battery object in the system contains these fields:

```
Battery {
  id                  — unique identifier
  name                — display name (e.g., "MaxVolt UltraPack 820")
  category            — "EV" | "ESS" | "LEV" | "Commercial"
  chemistry           — "LFP" | "NMC 811" | "LiFePO4" | "NCA"
  barcode             — unique barcode string
  euQrUrl             — EU passport URL (passport.battery-eu.org/...)

  // Specifications
  capacity            — kWh (e.g., 82.5)
  voltage             — V (e.g., 355.2)
  weight              — kg (e.g., 485)
  dimensions          — { length, width, height } in mm
  maxDischargeRate    — kW
  operatingTempRange  — { min, max } in °C

  // Health
  stateOfHealth       — SoH percentage
  stateOfCharge       — SoC percentage
  cycleCount          — charge/discharge cycles
  healthHistory       — array of { date, soh } snapshots

  // Warranty
  warranty            — { status, expiryDate, coverageDetails }

  // Compliance
  complianceStandards — array of strings
  dismantlingManual   — string
  recycledContent     — { percentage, materials: string[] }

  // EU Passport
  passport            — { manufacturerId, batteryDescriptor, batteryId,
                          materialComposition, carbonFootprint, dynamicData }

  // Meta
  serialNumber        — auto-generated (SN-YYYY-...)
  registrationDate    — ISO date string
  lastServiceDate     — ISO date string or null
}
```

---

## Design System

Defined in `tailwind.config.js` with a warm cream/navy/gold palette:

| Token           | Value        | Usage                               |
|-----------------|--------------|-------------------------------------|
| `page`          | `#F8F2DE`    | Page background                     |
| `surface`       | `#FFFDF8`    | Card and surface backgrounds        |
| `brand-navy`    | `#173B5C`    | Primary brand color (buttons, text) |
| `brand-gold`    | `#B48611`    | Accent / highlight color            |
| `ink-900`       | `#1A1A1A`    | Primary text                        |
| `ink-600`       | `#4A4A4A`    | Secondary text                      |
| `yellow-50` to `yellow-900` | Various | Status colors (optimal, good, attention) |

- **Fonts:** Inter (UI text), JetBrains Mono (serial numbers, identifiers)
- **Dark mode:** Full theme override via `dark:` Tailwind variants
- **Accent colors:** Configurable from settings (currently gold, emerald, blue, purple)

---

## Configuration Files

| File                   | Purpose                                                  |
|------------------------|----------------------------------------------------------|
| `vite.config.js`      | Vite build configuration with React plugin               |
| `tailwind.config.js`  | Tailwind theme tokens, font families, content paths      |
| `postcss.config.js`   | PostCSS plugins (Tailwind + Autoprefixer)                |
| `.oxlintrc.json`      | Oxlint rules (React hooks, export components)            |
| `package.json`        | Project metadata, dependencies, npm scripts              |
| `index.html`          | HTML shell — title, Google Fonts, root div               |

---

## Known Limitations

- **No backend** — all data is stored in `localStorage` and resets if the browser cache is cleared
- **No real authentication** — sign in/sign up only sets a local flag; no credential verification
- **Add Battery modal is unfinished** — the context state (`isAddBatteryOpen`) exists but no modal component is wired to render it
- **No test suite** — no testing framework or test files are configured
- **Store links are placeholders** — download buttons use `YOUR_APP_ID` placeholders
- **Scanner camera requires HTTPS** — camera-based scanning will not work on plain HTTP (e.g., `localhost`)

---

## License

This project is for demonstration/educational purposes. No license file is included.
