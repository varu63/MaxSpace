import React, { lazy, Suspense, useState, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ChevronUp } from "lucide-react";

import { BatteryProvider, useBattery } from "./context/BatteryContext";

import Sidebar from "./components/common/Sidebar";
import Header from "./components/common/Header";
import Footer from "./components/common/Footer";
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

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <div className="w-8 h-8 border-2 border-[#E7E1D3] border-t-[#173B5C] rounded-full animate-spin" />
  </div>
);

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

const MainLayout = () => {
  const location = useLocation();
  const isFullScreenPage = /^\/battery\/[^/]+\/passport$/.test(location.pathname);

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F2DE] text-[#16263A]">
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
          <Route path="/*" element={<MainLayout />} />
        </Routes>
      </Suspense>
      <NotificationToast />
    </BatteryProvider>
  );
};

export default App;
