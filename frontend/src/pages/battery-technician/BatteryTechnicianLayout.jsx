import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import Sidebar from "../../components/common/Sidebar";
import Header from "../../components/common/Header";
import Footer from "../../components/common/Footer";

import { useBatteryTechnician } from "../../context/BatteryTechnicianContext";

const BatteryTechnicianLayout = () => {
  const { isSidebarOpen, setIsSidebarOpen, batteryTechnicianLogout } = useBatteryTechnician();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setIsSidebarOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const handleLogout = async () => {
    await batteryTechnicianLogout();
    navigate("/battery-technician/login", { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden bg-[#F8F2DE] text-[#16263A]">
      <Sidebar role="battery-technician" />

      <Header
        role="battery-technician"
        onOpenSidebar={() => setIsSidebarOpen(true)}
        onNavigateProfile={() => navigate("/battery-technician/services")}
        onLogout={handleLogout}
        showScanner={false}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
      />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <Outlet />
      </main>

      <Footer panelText="MaxSpace Battery Technician Panel · Authorized personnel only" />
    </div>
  );
};

export default BatteryTechnicianLayout;
