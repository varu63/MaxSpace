import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ChevronUp } from "lucide-react";

import { BatteryProvider } from "./context/BatteryContext";

import Sidebar from "./components/common/Sidebar";
import Header from "./components/common/Header";
import Footer from "./components/common/Footer";
import { NotificationToast } from "./components/common/NotificationToast";
import { QRBarcodeScannerModal } from "./components/scanner/QRBarcodeScannerModal";

import HomePage from "./pages/HomePage";
import ServicePage from "./pages/ServicePage";
import AnalyticsPage from "./pages/AnalyticsPage";
import ProfilePage from "./pages/ProfilePage";
import SettingsPage from "./pages/SettingPage";
import BatteryDetailPage from "./pages/BatteryDetailPage";
import BatteryPassportPage from "./pages/BatteryPassportPage";

const ScrollToTopButton = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShow(window.scrollY > 300);
    };
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

const MainLayout = () => {
  return (
    <div className="min-h-screen flex flex-col bg-[#F8F2DE] text-[#16263A]">
      {/* Sidebar */}
      <Sidebar />

      {/* Header */}
      <Header />

      {/* Page Content */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <Routes>
          <Route path="/home" element={<HomePage />} />
          <Route path="/battery/:id" element={<BatteryDetailPage />} />
          <Route path="/battery/:id/passport" element={<BatteryPassportPage />} />
          <Route path="/services" element={<ServicePage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </main>

      {/* Footer */}
      <Footer />

      {/* Scroll to Top */}
      <ScrollToTopButton />

      {/* Scanner Modal */}
      <QRBarcodeScannerModal />
    </div>
  );
};

const App = () => {
  return (
    <BatteryProvider>
      <MainLayout />
      <NotificationToast />
    </BatteryProvider>
  );
};

export default App;
