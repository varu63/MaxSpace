import React, { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Wrench,
  Users,
  UserCheck,
  BarChart3,
  UserCircle,
  LogOut,
  Menu,
  X,
  ShieldCheck,
} from "lucide-react";

import { useAdmin } from "../../context/AdminContext";
import { getAvatarText } from "../../components/admin/adminUtils";

const navItems = [
  { to: "/admin", end: true, label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/services", end: false, label: "Service Requests", icon: Wrench },
  { to: "/admin/service-persons", end: false, label: "Service Persons", icon: UserCheck },
  { to: "/admin/customers", end: false, label: "Customers", icon: Users },
  { to: "/admin/analytics", end: false, label: "Analytics", icon: BarChart3 },
  { to: "/admin/profile", end: false, label: "Admin Profile", icon: UserCircle },
];

const AdminSidebarContent = ({ onNavigate }) => {
  const { adminUser, adminLogout, services } = useAdmin();
  const navigate = useNavigate();

  const pendingCount =
    services?.filter((s) => s.status === "Confirmed").length || 0;

  const handleLogout = async () => {
    await adminLogout();
    navigate("/admin/login", { replace: true });
  };

  return (
    <div className="flex flex-col h-full justify-between overflow-y-auto bg-[#FFFDF8] text-[#16263A] select-none">
      <div>
        {/* Logo */}
        <div className="flex items-center justify-between p-6 border-b border-[#EEE9DA]">
          <div
            className="flex items-center space-x-3 cursor-pointer"
            onClick={() => {
              onNavigate?.();
              navigate("/admin");
            }}
          >
            <div className="relative flex items-center justify-center w-11 h-11 rounded-full bg-white p-0.5 shadow-md">
              <div className="w-full h-full bg-white rounded-full flex items-center justify-center overflow-hidden">
                <img
                  src="/Logo.png"
                  alt="logo"
                  className="w-full h-full object-scale-down"
                />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-black text-xl tracking-tight text-[#16263A]">
                  MaxSpace
                </span>
              </div>
              <p className="text-[11px] text-[#747B83] font-medium flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-[#B48611]" />
                Admin Panel
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onNavigate}
            className="p-2 text-[#8A9096] hover:text-[#16263A] rounded-xl hover:bg-[#F5F1E7] transition-colors lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <div className="p-4 space-y-1.5">
          <p className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-[#8A9096]">
            Administration
          </p>

          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => onNavigate?.()}
                className={({ isActive }) => `
                  w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-left transition-all duration-200
                  ${
                    isActive
                      ? "bg-[#F8F2DE] text-[#16263A] font-extrabold shadow-sm shadow-[#B48611]/20"
                      : "text-[#747B83] hover:text-[#16263A] hover:bg-[#F5F1E7] font-semibold"
                  }
                `}
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center space-x-3 min-w-0">
                      <div
                        className={`p-2 rounded-xl transition-colors ${
                          isActive
                            ? "bg-[#173B5C] text-[#FBF1C9]"
                            : "bg-[#F5F1E7] text-[#8A7A4A] group-hover:bg-[#F8F2DE] group-hover:text-[#B48611]"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-xs sm:text-sm block leading-tight">
                        {item.label}
                      </span>
                    </div>

                    {item.to === "/admin/services" && pendingCount > 0 && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300">
                        {pendingCount}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* Bottom section */}
      <div className="p-4 space-y-3 border-t border-[#EEE9DA]">
        <div className="flex items-center justify-between p-3 rounded-2xl bg-[#F5F1E7] border border-[#E7E1D3]">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#173B5C] text-[#FBF1C9] flex items-center justify-center text-xs font-black shrink-0">
              {getAvatarText(adminUser?.name)}
            </div>
            <div className="truncate min-w-0">
              <p className="text-xs font-bold text-[#16263A] truncate leading-tight">
                {adminUser?.name || "Admin"}
              </p>
              <p className="text-[10px] text-[#B48611] font-semibold uppercase tracking-wide">
                Administrator
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center justify-center space-x-2 px-3.5 py-2.5 rounded-2xl text-red-600 hover:bg-red-50 border border-red-200 font-bold text-xs transition-all shadow-sm"
        >
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

const AdminLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  // Close the mobile drawer on navigation
  React.useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex bg-[#F8F2DE] text-[#16263A]">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-72 shrink-0 border-r border-[#EEE9DA] bg-[#FFFDF8] sticky top-0 h-screen">
        <AdminSidebarContent />
      </aside>

      {/* Mobile drawer */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 flex animate-in fade-in duration-200 lg:hidden">
          <div
            className="fixed inset-0 bg-[#16263A]/60 backdrop-blur-sm"
            onClick={() => setIsSidebarOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] bg-[#FFFDF8] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-300">
            <AdminSidebarContent onNavigate={() => setIsSidebarOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-40 bg-[#FFFDF8]/95 backdrop-blur border-b border-[#EEE9DA] px-4 py-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 rounded-xl bg-[#F5F1E7] text-[#16263A]"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-2">
            <img src="/Logo.png" alt="" className="w-7 h-7 object-scale-down" />
            <span className="font-black tracking-tight text-[#16263A]">
              Admin Panel
            </span>
          </div>

          <div className="w-9" />
        </header>

        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          <Outlet />
        </main>

        <footer className="px-6 py-4 text-center text-[11px] text-[#747B83] border-t border-[#EEE9DA]">
          MaxSpace Admin Panel · Authorized personnel only
        </footer>
      </div>
    </div>
  );
};

export default AdminLayout;