import { useBattery } from "../../context/BatteryContext";
import { useAdmin } from "../../context/AdminContext";
import { useBatteryTechnician } from "../../context/BatteryTechnicianContext";

import {
  LayoutDashboard,
  Wrench,
  User,
  QrCode,
  PlusCircle,
  ShieldCheck,
  Zap,
  Activity,
  X,
  BarChart3,
  ChevronRight,
  Settings,
  LogOut,
  UserCheck,
  Users,
  HardHat,
} from "lucide-react";

import { useLocation, useNavigate } from "react-router-dom";

export const Sidebar = ({ role = "user", onNavigateProfile, onLogout }) => {
  const battery = useBattery();
  const admin = useAdmin();
  const tech = useBatteryTechnician();

  const navigate = useNavigate();
  const location = useLocation();

  const isAdmin = role === "admin";
  const isTech = role === "battery-technician";

  const isSidebarOpen = isAdmin ? admin.isSidebarOpen : isTech ? tech.isSidebarOpen : battery.isSidebarOpen;

  const closeSidebar = () => {
    if (isAdmin) admin.setIsSidebarOpen(false);
    else if (isTech) tech.setIsSidebarOpen(false);
    else battery.setIsSidebarOpen(false);
  };

  /* ---------- role-aware nav items ---------- */
  const navItems = isAdmin
    ? [
        { id: "dashboard", label: "Dashboard", description: "Service Management Overview", icon: LayoutDashboard, path: "/admin", badge: null },
        { id: "services", label: "Service Requests", description: "Bookings & Assignments", icon: Wrench, path: "/admin/services", badge: admin.services?.filter((s) => s.status === "Confirmed").length || 0, badgeColor: "bg-amber-100 text-amber-900 border-amber-300", hideZeroBadge: false },
        { id: "service-persons", label: "Battery Technicians", description: "Manage Technicians", icon: UserCheck, path: "/admin/service-persons", badge: null },
        { id: "customers", label: "Customers", description: "Registered Customers", icon: Users, path: "/admin/customers", badge: null },
        { id: "analytics", label: "Analytics", description: "Service Insights", icon: BarChart3, path: "/admin/analytics", badge: null },
        { id: "profile", label: "Admin Profile", description: "Account & Settings", icon: User, path: "/admin/profile", badge: null },
      ]
    : isTech
    ? [
        { id: "dashboard", label: "Dashboard", description: "Service Operations", icon: LayoutDashboard, path: "/battery-technician", badge: null },
        { id: "services", label: "My Services", description: "Assigned Services", icon: Wrench, path: "/battery-technician/services", badge: tech.services?.filter((s) => !["Completed", "Cancelled"].includes(s.status)).length || 0, badgeColor: "bg-amber-100 text-amber-900 border-amber-300", hideZeroBadge: false },
      ]
    : [
        { id: "home", label: "Home", description: "Fleet & Battery Passports", icon: LayoutDashboard, path: "/home", badge: battery.stats.totalBatteries, badgeColor: "bg-yellow-100 text-yellow-900 border-yellow-300" },
        { id: "services", label: "Services & Maintenance", description: "Bookings & Diagnostics", icon: Wrench, path: "/services", badge: battery.stats.upcomingServices > 0 ? battery.stats.upcomingServices : null, badgeColor: "bg-amber-100 text-amber-900 border-amber-300" },
        { id: "analytics", label: "Analytics", description: "Battery Performance & Insights", icon: BarChart3, path: "/analytics", badge: null },
        { id: "profile", label: "User Profile", description: "Operator Info & Settings", icon: User, path: "/profile", badge: null },
        { id: "settings", label: "Settings", description: "Preferences & Security", icon: Settings, path: "/settings", badge: null },
      ];

  const handleNavClick = (path) => {
    navigate(path);
    closeSidebar();
  };

  const profile = isAdmin ? admin.adminUser : isTech ? tech.batteryTechnicianUser : battery.userProfile;
  const profileName = profile?.name || (isAdmin ? "Admin" : isTech ? "Technician" : "User");
  const profileSubtitle = isAdmin ? "Administrator" : isTech ? "Battery Technician" : "";

  const handleProfileClick = () => {
    closeSidebar();
    if (onNavigateProfile) {
      onNavigateProfile();
      return;
    }
    if (isAdmin) navigate("/admin/profile");
    else if (isTech) navigate("/battery-technician/services");
    else navigate("/profile");
  };

  const handleLogout = () => {
    closeSidebar();
    if (onLogout) {
      onLogout();
      return;
    }
    if (isAdmin) {
      admin.adminLogout();
      navigate("/admin/login");
    } else if (isTech) {
      tech.batteryTechnicianLogout();
      navigate("/battery-technician/login");
    } else {
      battery.signOut();
      navigate("/signin");
    }
  };

  const sidebarContent = (
    <div className="flex flex-col h-full justify-between overflow-y-auto bg-[#FFFDF8] text-[#16263A] select-none">

      {/* =====================================================
          TOP SECTION
      ====================================================== */}
      <div>

        {/* Logo */}
        <div className="flex items-center justify-between p-6 border-b border-[#EEE9DA]">

          <div
            className="flex items-center space-x-3 cursor-pointer group"
            onClick={() => handleNavClick(isAdmin ? "/admin" : isTech ? "/battery-technician" : "/home")}
          >
            <div className="relative flex items-center justify-center w-11 h-11 rounded-full bg-white dark:bg-white p-0.5 shadow-md group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-white dark:bg-white rounded-[14px] flex items-center justify-center">
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
                {isAdmin ? (
                  <>
                    <ShieldCheck className="w-3 h-3 text-[#B48611]" />
                    Admin Panel
                  </>
                ) : isTech ? (
                  <>
                    <HardHat className="w-3 h-3 text-[#B48611]" />
                    Technician Panel
                  </>
                ) : (
                  "Battery Passport System"
                )}
              </p>
            </div>
          </div>

          {/* Close */}
          <button
            type="button"
            onClick={closeSidebar}
            className="p-2 text-[#8A9096] hover:text-[#16263A] rounded-xl hover:bg-[#F5F1E7] transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>

        </div>


        {/* =====================================================
            MAIN NAVIGATION
        ====================================================== */}
        <div className="p-4 space-y-1.5">

          <p className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-[#8A9096]">
            {isAdmin ? "Administration" : isTech ? "Service Operations" : "Main Menu"}
          </p>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || (item.path !== "/admin" && item.path !== "/battery-technician" && location.pathname.startsWith(item.path));

            const showBadge = item.badge !== null && item.badge !== undefined && item.badge !== 0;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.path)}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-left transition-all duration-200 group ${isActive
                  ? "bg-[#F8F2DE] text-[#16263A] font-extrabold shadow-sm shadow-[#B48611]/20"
                  : "text-[#747B83] hover:text-[#16263A] hover:bg-[#F5F1E7] font-semibold"
                  }`}
              >

                <div className="flex items-center space-x-3 min-w-0">

                  <div
                    className={`p-2 rounded-xl transition-colors ${isActive
                      ? "bg-[#173B5C] text-[#FBF1C9]"
                      : "bg-[#F5F1E7] text-[#8A7A4A] group-hover:bg-[#F8F2DE] group-hover:text-[#B48611]"
                      }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="truncate">

                    <span className="text-xs sm:text-sm block leading-tight">
                      {item.label}
                    </span>

                    <span
                      className={`text-[10px] block font-normal mt-0.5 ${isActive
                        ? "text-[#16263A]/70"
                        : "text-[#8A9096]"
                        }`}
                    >
                      {item.description}
                    </span>

                  </div>

                </div>

                {showBadge && (
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-bold border ${isActive
                        ? "bg-[#16263A]/10 text-[#16263A] border-[#16263A]/20"
                        : item.badgeColor
                        }`}
                    >
                      {item.badge}
                    </span>
                  )}

              </button>
            );
          })}

        </div>

        {/* =====================================================
            QUICK ACTIONS
        ====================================================== */}
        {!isAdmin && !isTech && (
          <div className="px-4 py-2 space-y-2">

            <p className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-[#8A9096]">
              Quick Actions
            </p>

            {/* Scanner */}
            <button
              type="button"
              onClick={() => {
                closeSidebar();
                battery.openScanner();
              }}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-[#FBF1C9] hover:bg-[#F0E6C8] text-[#A77A08] border border-[#F0E6C8] font-bold text-xs transition-all group shadow-sm"
            >

              <div className="flex items-center space-x-2.5">
                <QrCode className="w-4 h-4 text-[#B48611] group-hover:rotate-12 transition-transform" />
                <span>Scan QR / Barcode</span>
              </div>

              <span className="font-mono text-[10px] bg-[#F0E6C8] px-1.5 py-0.5 rounded text-[#8A7A4A]">
                ⌘K
              </span>

            </button>


            {/* Add Battery */}
            <button
              type="button"
              onClick={() => {
                closeSidebar();
                battery.openAddBattery();
              }}
              className="w-full flex items-center justify-start space-x-2.5 px-3.5 py-2.5 rounded-2xl bg-[#F5F1E7] hover:bg-[#E7E1D3] text-[#16263A] border border-[#E7E1D3] font-bold text-xs transition-all shadow-sm"
            >
              <PlusCircle className="w-4 h-4 text-[#B48611]" />
              <span>Register New Battery</span>
            </button>

          </div>
        )}

      </div>


      {/* =====================================================
          BOTTOM SECTION
      ====================================================== */}
      <div className="p-4 space-y-3 border-t border-[#EEE9DA]">

        {!isAdmin && !isTech && (
          <div className="p-3 rounded-2xl bg-[#F5F1E7] border border-[#E7E1D3] text-xs space-y-2">

            <div className="flex items-center justify-between">

              <span className="text-[11px] text-[#747B83] font-semibold flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-[#B48611]" />
                Total Storage
              </span>

              <span className="font-mono font-black text-[#16263A]">
                {battery.stats.totalCapacityKwh} kWh
              </span>

            </div>


            <div className="flex items-center justify-between">

              <span className="text-[11px] text-[#747B83] font-semibold flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-[#B48611]" />
                Avg Fleet Health
              </span>

              <span className="font-mono font-black text-[#A77A08]">
                {battery.stats.avgHealth}% SoH
              </span>

            </div>


            <div className="pt-1.5 border-t border-[#E7E1D3]/80 flex items-center justify-between text-[10px] text-[#747B83]">

              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-[#B48611]" />
                EU DPP 2023/1542
              </span>

              <span className="font-bold text-[#B48611]">
                Online
              </span>

            </div>

          </div>
        )}

        {/* Profile preview */}
        <div
          onClick={handleProfileClick}
          className="flex items-center justify-between p-2.5 rounded-2xl bg-[#F5F1E7] hover:bg-[#E7E1D3]/70 border border-[#E7E1D3] cursor-pointer transition-all"
        >
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#173B5C] text-[#FBF1C9] flex items-center justify-center text-[11px] font-black shrink-0">
              {profileName
                .split(" ")
                .slice(0, 2)
                .map((n) => n[0])
                .join("")
                .toUpperCase()}
            </div>
            <div className="truncate">
              <p className="text-xs font-bold text-[#16263A] truncate leading-tight">
                {profileName}
              </p>
              {profileSubtitle && (
                <p className="text-[10px] text-[#B48611] font-semibold uppercase tracking-wide">
                  {profileSubtitle}
                </p>
              )}
            </div>
          </div>

          <ChevronRight className="w-4 h-4 text-[#8A9096] shrink-0" />
        </div>

        {/* Logout */}
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center justify-center space-x-2 px-3.5 py-2.5 rounded-2xl text-red-600 hover:bg-red-50 border border-red-200 font-bold text-xs transition-all shadow-sm"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>

      </div>

    </div>
  );


  return (
    <>

      {/* =====================================================
          OVERLAY
      ====================================================== */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 flex animate-in fade-in duration-200">

          {/* Background */}
          <div
            className="fixed inset-0 bg-[#16263A]/60 backdrop-blur-sm"
            onClick={closeSidebar}
          />

          {/* Sidebar */}
          <aside className="relative w-72 max-w-[85vw] bg-[#FFFDF8] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-300">
            {sidebarContent}
          </aside>

        </div>
      )}
    </>
  );
};

export default Sidebar;