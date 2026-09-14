import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import Sidebar from "../../components/common/Sidebar";
import Header from "../../components/common/Header";
import Footer from "../../components/common/Footer";
import { PageContainer } from "../../components/common/PageContainer";

import { useAdmin } from "../../context/AdminContext";

const AdminLayout = () => {
  const { isSidebarOpen, setIsSidebarOpen, adminLogout } = useAdmin();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setIsSidebarOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const handleLogout = async () => {
    await adminLogout();
    navigate("/admin/login", { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden bg-[#F8F2DE] text-[#16263A]">
      <Sidebar role="admin" />

      <Header
        role="admin"
        onOpenSidebar={() => setIsSidebarOpen(true)}
        onNavigateProfile={() => navigate("/admin/profile")}
        onLogout={handleLogout}
        showScanner={false}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
      />

      <PageContainer>
        <Outlet />
      </PageContainer>

      <Footer panelText="Admin Panel · Authorized personnel only" />
    </div>
  );
};

export default AdminLayout;