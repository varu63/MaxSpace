import React, { lazy, Suspense, useState, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ChevronUp } from "lucide-react";

import { BatteryProvider, useBattery } from "./context/BatteryContext";
import { AdminProvider, useAdmin } from "./context/AdminContext";

import Sidebar from "./components/common/Sidebar";
import Header from "./components/common/Header";
import Footer from "./components/common/Footer";
import LoadingSpinner from "./components/common/LoadingSpinner";
import { NotificationToast } from "./components/common/NotificationToast";
import { QRBarcodeScannerModal } from "./components/scanner/QRBarcodeScannerModal";
import FloatingDownloadButton from "./components/common/FloatingDownloadButton";

const HomePage = lazy(() => import("./pages/HomePage"));
const ServicePage = lazy(() => import("./pages/ServicePage"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const SettingsPage = lazy(() => import("./pages/SettingPage"));
const BatteryDetailPage = lazy(() => import("./pages/BatteryDetailPage"));
const BatteryPassportPage = lazy(() => import("./pages/BatteryPassportPage"));
const SignInPage = lazy(() => import("./pages/SignInPage"));
const SignUpPage = lazy(() => import("./pages/SignUpPage"));

const AdminLoginPage = lazy(() => import("./pages/admin/AdminLoginPage"));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminDashboardPage = lazy(() => import("./pages/admin/AdminDashboardPage"));
const AdminServiceRequestsPage = lazy(() =>
  import("./pages/admin/AdminServiceRequestsPage")
);
const AdminServiceDetailsPage = lazy(() =>
  import("./pages/admin/AdminServiceDetailsPage")
);
const AdminServicePersonsPage = lazy(() =>
  import("./pages/admin/AdminServicePersonsPage")
);
const AdminCustomersPage = lazy(() => import("./pages/admin/AdminCustomersPage"));
const AdminAnalyticsPage = lazy(() => import("./pages/admin/AdminAnalyticsPage"));
const AdminProfilePage = lazy(() => import("./pages/admin/AdminProfilePage"));

const PageLoader = () => <LoadingSpinner />;

const ThemeSync = () => {
  useEffect(() => {
    const applyTheme = () => {
      try {
        const saved = localStorage.getItem("appSettings");
        const settings = saved ? JSON.parse(saved) : {};
        document.documentElement.classList.toggle("dark", Boolean(settings.darkMode));
      } catch {
        document.documentElement.classList.remove("dark");
      }
    };

    applyTheme();
    window.addEventListener("storage", applyTheme);
    return () => window.removeEventListener("storage", applyTheme);
  }, []);

  return null;
};

const ScrollToTopButton = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handleScroll = () => setShow(window.scrollY > 300);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={`
        fixed bottom-6 right-6 z-50
        w-11 h-11
        rounded-full
        bg-[#173B5C] text-white
        shadow-lg
        flex items-center justify-center
        hover:bg-[#102F4A]
        active:scale-95
        transition-all duration-300
        ${show ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-4 pointer-events-none"}
      `}
      title="Scroll to top"
      aria-label="Scroll to top"
    >
      <ChevronUp className="w-5 h-5" />
    </button>
  );
};

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useBattery();

  if (!isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }

  return children;
};

const PublicOnlyRoute = ({ children }) => {
  const { isAuthenticated } = useBattery();

  if (isAuthenticated) {
    return <Navigate to="/home" replace />;
  }

  return children;
};

/* ============================================================
   ADMIN GUARDS
   - AdminPublicOnlyRoute: /admin/login is only for guests.
   - AdminPrivateRoute: requires an authenticated ADMIN session
     verified against the backend (token + role check).
   Any non-admin user is redirected away from /admin/* entirely.
============================================================ */
const AdminPublicOnlyRoute = ({ children }) => {
  const { isAdminAuthenticated, verifying } = useAdmin();

  if (verifying) {
    return <PageLoader />;
  }

  if (isAdminAuthenticated) {
    return <Navigate to="/admin" replace />;
  }

  return children;
};

const AdminPrivateRoute = ({ children }) => {
  const { isAdminAuthenticated, verifying } = useAdmin();

  if (verifying) {
    return <PageLoader />;
  }

  // Not authenticated as admin (or no stored token) → login.
  // The backend independently enforces the ADMIN role on every
  // admin API via requireAdmin, so we never trust the frontend alone.
  if (!isAdminAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
};

const MainLayout = () => {
  const location = useLocation();
  const isFullScreenPage = /^\/battery\/[^/]+\/passport$/.test(location.pathname);

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden bg-[#F8F2DE] text-[#16263A]">
      {!isFullScreenPage && <Sidebar />}
      {!isFullScreenPage && <Header />}

      <main className={`flex-1 w-full ${isFullScreenPage ? "px-4 sm:px-6 lg:px-8 py-6" : "max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-12"}`}>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route
              path="/home"
              element={
                <ProtectedRoute>
                  <HomePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/battery/:id"
              element={
                <ProtectedRoute>
                  <BatteryDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/battery/:id/passport"
              element={
                <ProtectedRoute>
                  <BatteryPassportPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/services"
              element={
                <ProtectedRoute>
                  <ServicePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/analytics"
              element={
                <ProtectedRoute>
                  <AnalyticsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </Suspense>
      </main>

      {!isFullScreenPage && <Footer />}
      {!isFullScreenPage && <ScrollToTopButton />}
      {!isFullScreenPage && <FloatingDownloadButton />}

      <QRBarcodeScannerModal />
    </div>
  );
};

const App = () => {
  return (
    <BatteryProvider>
      <AdminProvider>
        <ThemeSync />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route
              path="/signin"
              element={
                <PublicOnlyRoute>
                  <SignInPage />
                </PublicOnlyRoute>
              }
            />
            <Route
              path="/signup"
              element={
                <PublicOnlyRoute>
                  <SignUpPage />
                </PublicOnlyRoute>
              }
            />

            {/* ============ ADMIN PANEL ============ */}
            <Route
              path="/admin/login"
              element={
                <AdminPublicOnlyRoute>
                  <AdminLoginPage />
                </AdminPublicOnlyRoute>
              }
            />

            <Route
              path="/admin"
              element={
                <AdminPrivateRoute>
                  <AdminLayout />
                </AdminPrivateRoute>
              }
            >
              <Route index element={<AdminDashboardPage />} />
              <Route path="services" element={<AdminServiceRequestsPage />} />
              <Route
                path="services/:id"
                element={<AdminServiceDetailsPage />}
              />
              <Route path="service-persons" element={<AdminServicePersonsPage />} />
              <Route path="customers" element={<AdminCustomersPage />} />
              <Route path="analytics" element={<AdminAnalyticsPage />} />
              <Route path="profile" element={<AdminProfilePage />} />
            </Route>

            <Route path="/*" element={<MainLayout />} />
          </Routes>
        </Suspense>
        <NotificationToast />
      </AdminProvider>
    </BatteryProvider>
  );
};

export default App;
