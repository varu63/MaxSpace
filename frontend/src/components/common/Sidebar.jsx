import { useBattery } from "../../context/BatteryContext";

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
} from "lucide-react";

import { useLocation, useNavigate } from "react-router-dom";

export const Sidebar = () => {
  const {
    stats,
    userProfile,
    openScanner,
    openAddBattery,
    isSidebarOpen,
    setIsSidebarOpen,
    signOut,
  } = useBattery();

  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    {
      id: "home",
      label: "Home",
      description: "Fleet & Battery Passports",
      icon: LayoutDashboard,
      path: "/home",
      badge: stats.totalBatteries,
      badgeColor:
        "bg-yellow-100 text-yellow-900 border-yellow-300",
    },

    {
      id: "services",
      label: "Services & Maintenance",
      description: "Bookings & Diagnostics",
      icon: Wrench,
      path: "/services",
      badge:
        stats.upcomingServices > 0
          ? stats.upcomingServices
          : null,
      badgeColor:
        "bg-amber-100 text-amber-900 border-amber-300",
    },

    {
      id: "analytics",
      label: "Analytics",
      description: "Battery Performance & Insights",
      icon: BarChart3,
      path: "/analytics",
      badge: null,
    },

    {
      id: "profile",
      label: "User Profile",
      description: "Operator Info & Settings",
      icon: User,
      path: "/profile",
      badge: null,
    },

    {
      id: "settings",
      label: "Settings",
      description: "Preferences & Security",
      icon: Settings,
      path: "/settings",
      badge: null,
    },
  ];

  // Navigate using React Router
  const handleNavClick = (path) => {
    navigate(path);
    setIsSidebarOpen(false);
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
            onClick={() => handleNavClick("/home")}
          >
            <div className="relative flex items-center justify-center w-11 h-11 rounded-full bg-white dark:bg-white  from-yellow-400 via-amber-300 to-yellow-200 p-0.5 shadow-md group-hover:scale-105 transition-transform">
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

              <p className="text-[11px] text-[#747B83] font-medium">
                Battery Passport System
              </p>
            </div>
          </div>

          {/* Close */}
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
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
            Main Menu
          </p>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

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

                {item.badge !== null &&
                  item.badge !== undefined && (
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
        <div className="px-4 py-2 space-y-2">

          <p className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-[#8A9096]">
            Quick Actions
          </p>

          {/* Scanner */}
          <button
            type="button"
            onClick={() => {
              setIsSidebarOpen(false);
              openScanner();
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
              setIsSidebarOpen(false);
              openAddBattery();
            }}
            className="w-full flex items-center justify-start space-x-2.5 px-3.5 py-2.5 rounded-2xl bg-[#F5F1E7] hover:bg-[#E7E1D3] text-[#16263A] border border-[#E7E1D3] font-bold text-xs transition-all shadow-sm"
          >
            <PlusCircle className="w-4 h-4 text-[#B48611]" />
            <span>Register New Battery</span>
          </button>

        </div>

      </div>


      {/* =====================================================
          BOTTOM SECTION
      ====================================================== */}
      <div className="p-4 space-y-3 border-t border-[#EEE9DA]">

        {/* Fleet Metrics */}
        <div className="p-3 rounded-2xl bg-[#F5F1E7] border border-[#E7E1D3] text-xs space-y-2">

          <div className="flex items-center justify-between">

            <span className="text-[11px] text-[#747B83] font-semibold flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-[#B48611]" />
              Total Storage
            </span>

            <span className="font-mono font-black text-[#16263A]">
              {stats.totalCapacityKwh} kWh
            </span>

          </div>


          <div className="flex items-center justify-between">

            <span className="text-[11px] text-[#747B83] font-semibold flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-[#B48611]" />
              Avg Fleet Health
            </span>

            <span className="font-mono font-black text-[#A77A08]">
              {stats.avgHealth}% SoH
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


        {/* User Profile */}
        <div
          onClick={() => handleNavClick("/profile")}
          className="flex items-center justify-between p-2.5 rounded-2xl bg-[#F5F1E7] hover:bg-[#E7E1D3]/70 border border-[#E7E1D3] cursor-pointer transition-all"
        >

          <div className="flex items-center space-x-2.5 min-w-0">

            <img
              src={userProfile.avatar}
              alt={userProfile.name}
              className="w-8 h-8 rounded-xl object-cover ring-1 ring-yellow-400 shrink-0"
            />

            <div className="truncate">

              <p className="text-xs font-bold text-[#16263A] truncate leading-tight">
                {userProfile.name}
              </p>

            </div>

          </div>

          <ChevronRight className="w-4 h-4 text-[#8A9096] shrink-0" />

        </div>

        {/* Logout */}
        <button
          type="button"
          onClick={() => {
            setIsSidebarOpen(false);
            signOut();
            navigate("/signin");
          }}
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
            onClick={() => setIsSidebarOpen(false)}
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