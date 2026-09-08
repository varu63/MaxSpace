import React, { useMemo } from "react";
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Wrench,
  Users,
  UserCheck,
  BarChart3,
  UserCircle,
  LogOut,
  X,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { useAdmin } from "../../context/AdminContext";
import { getAvatarText } from "./adminUtils";

export const adminNavItems = [
  { to: "/admin", end: true, label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/services", end: false, label: "Service Requests", icon: Wrench },
  { to: "/admin/service-persons", end: false, label: "Service Persons", icon: UserCheck },
  { to: "/admin/customers", end: false, label: "Customers", icon: Users },
  { to: "/admin/analytics", end: false, label: "Analytics", icon: BarChart3 },
  { to: "/admin/profile", end: false, label: "Admin Profile", icon: UserCircle },
];

/**
 * Checks whether a given path is currently active.
 * Handles child routes (e.g. /admin/services/:id activates /admin/services).
 */
export const isRouteActive = (targetPath, currentPath, end = false) => {
  if (end) {
    return currentPath === targetPath || currentPath === `${targetPath}/`;
  }
  return (
    currentPath === targetPath ||
    currentPath.startsWith(`${targetPath}/`) ||
    currentPath.startsWith(`${targetPath}?`)
  );
};

export const AdminSidebar = ({
  onClose,
  isCollapsed = false,
  onToggleCollapse,
  isMobile = false,
}) => {
  const { adminUser, adminLogout, services } = useAdmin();
  const navigate = useNavigate();
  const location = useLocation();

  const pendingCount = useMemo(() => {
    return services?.filter((s) => s.status === "Confirmed").length || 0;
  }, [services]);

  const handleLogout = async () => {
    if (onClose) onClose();
    await adminLogout();
    navigate("/admin/login", { replace: true });
  };

  const handleNavClick = () => {
    if (onClose) {
      onClose();
    }
  };

  // When rendered in a mobile drawer, it is never collapsed
  const collapsed = isMobile ? false : isCollapsed;

  return (
    <div
      className={`flex flex-col h-full justify-between overflow-y-auto overflow-x-hidden bg-[#FFFDF8] text-[#16263A] select-none transition-all duration-300 ${
        collapsed ? "w-20" : "w-72"
      }`}
    >
      <div>
        {/* =====================================================
            TOP HEADER / BRAND
        ====================================================== */}
        <div
          className={`flex items-center border-b border-[#EEE9DA] transition-all duration-300 ${
            collapsed ? "p-3 justify-center" : "p-5 justify-between"
          }`}
        >
          <Link
            to="/admin"
            onClick={handleNavClick}
            aria-label="MaxSpace Admin Panel Dashboard"
            title={collapsed ? "MaxSpace Admin Panel" : undefined}
            className={`flex items-center cursor-pointer group rounded-2xl transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173B5C] focus-visible:ring-offset-2 ${
              collapsed ? "justify-center p-1" : "space-x-3 p-1.5 -m-1.5 hover:bg-[#F5F1E7]/70"
            }`}
          >
            <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-white p-0.5 shadow-md shrink-0 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-white rounded-full flex items-center justify-center overflow-hidden">
                <img
                  src="/Logo.png"
                  alt="MaxSpace logo"
                  className="w-full h-full object-scale-down"
                />
              </div>
            </div>

            {!collapsed && (
              <div className="min-w-0">
                <div className="flex items-center space-x-1.5">
                  <span className="font-black text-xl tracking-tight text-[#16263A] truncate">
                    MaxSpace
                  </span>
                </div>
                <p className="text-[11px] text-[#747B83] font-medium flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-[#B48611] shrink-0" />
                  <span>Admin Panel</span>
                </p>
              </div>
            )}
          </Link>

          {/* Mobile close button */}
          {isMobile && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-[#8A9096] hover:text-[#16263A] rounded-xl hover:bg-[#F5F1E7] cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173B5C] focus-visible:ring-offset-2"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* =====================================================
            COLLAPSE / EXPAND TOGGLE (DESKTOP ONLY)
        ====================================================== */}
        {!isMobile && onToggleCollapse && (
          <div className={`px-3 pt-3 flex ${collapsed ? "justify-center" : "justify-end"}`}>
            <button
              type="button"
              onClick={onToggleCollapse}
              className="p-1.5 text-[#8A9096] hover:text-[#16263A] hover:bg-[#F5F1E7] rounded-xl cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173B5C] focus-visible:ring-offset-2"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <div className="flex items-center gap-1 text-[11px] font-semibold text-[#8A9096] hover:text-[#16263A] px-1">
                  <span>Collapse</span>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </div>
              )}
            </button>
          </div>
        )}

        {/* =====================================================
            NAVIGATION ITEMS
        ====================================================== */}
        <nav aria-label="Admin Navigation" className="p-3 space-y-1.5">
          {!collapsed && (
            <p className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-[#8A9096]">
              Administration
            </p>
          )}

          {adminNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = isRouteActive(item.to, location.pathname, item.end);
            const isServiceRoute = item.to === "/admin/services";

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={handleNavClick}
                aria-label={
                  isServiceRoute && pendingCount > 0
                    ? `${item.label} (${pendingCount} pending)`
                    : item.label
                }
                aria-current={isActive ? "page" : undefined}
                title={collapsed ? item.label : undefined}
                className={`group relative w-full flex items-center rounded-2xl cursor-pointer text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173B5C] focus-visible:ring-offset-2 ${
                  collapsed
                    ? "justify-center p-2.5"
                    : "justify-between px-3.5 py-3"
                } ${
                  isActive
                    ? "bg-[#F8F2DE] text-[#16263A] font-extrabold shadow-sm shadow-[#B48611]/20"
                    : "text-[#747B83] hover:text-[#16263A] hover:bg-[#F5F1E7] font-semibold"
                }`}
              >
                <div
                  className={`flex items-center min-w-0 ${
                    collapsed ? "justify-center" : "space-x-3"
                  }`}
                >
                  <div
                    className={`relative p-2 rounded-xl transition-colors shrink-0 ${
                      isActive
                        ? "bg-[#173B5C] text-[#FBF1C9]"
                        : "bg-[#F5F1E7] text-[#8A7A4A] group-hover:bg-[#F8F2DE] group-hover:text-[#B48611]"
                    }`}
                  >
                    <Icon className="w-4 h-4" />

                    {/* Pending badge indicator in collapsed mode */}
                    {collapsed && isServiceRoute && pendingCount > 0 && (
                      <span
                        className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-mono font-bold flex items-center justify-center ring-2 ring-[#FFFDF8]"
                        title={`${pendingCount} pending requests`}
                      >
                        {pendingCount > 9 ? "9+" : pendingCount}
                      </span>
                    )}
                  </div>

                  {!collapsed && (
                    <span className="text-xs sm:text-sm block leading-tight truncate">
                      {item.label}
                    </span>
                  )}
                </div>

                {/* Pending count pill in expanded mode */}
                {!collapsed && isServiceRoute && pendingCount > 0 && (
                  <span
                    className="text-[11px] px-2 py-0.5 rounded-full font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300 shrink-0 ml-2"
                    aria-label={`${pendingCount} pending requests`}
                  >
                    {pendingCount}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* =====================================================
          BOTTOM SECTION (PROFILE + LOGOUT)
      ====================================================== */}
      <div className={`p-3 space-y-2.5 border-t border-[#EEE9DA] ${collapsed ? "items-center" : ""}`}>
        {/* Admin Profile Link */}
        <NavLink
          to="/admin/profile"
          onClick={handleNavClick}
          aria-label={`Admin Profile: ${adminUser?.name || "Administrator"}`}
          title={collapsed ? `Admin Profile: ${adminUser?.name || "Administrator"}` : undefined}
          className={({ isActive }) => `
            group w-full flex items-center rounded-2xl cursor-pointer border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173B5C] focus-visible:ring-offset-2
            ${
              collapsed
                ? "justify-center p-2"
                : "justify-between p-3"
            }
            ${
              isActive
                ? "bg-[#F8F2DE] border-[#B48611]/30 shadow-sm"
                : "bg-[#F5F1E7] hover:bg-[#EAE4D5] border-[#E7E1D3]"
            }
          `}
        >
          <div
            className={`flex items-center min-w-0 ${
              collapsed ? "justify-center" : "space-x-2.5"
            }`}
          >
            <div
              className="w-8 h-8 rounded-xl bg-[#173B5C] text-[#FBF1C9] flex items-center justify-center text-xs font-black shrink-0 group-hover:scale-105 transition-transform"
              aria-hidden="true"
            >
              {getAvatarText(adminUser?.name)}
            </div>

            {!collapsed && (
              <div className="truncate min-w-0">
                <p className="text-xs font-bold text-[#16263A] truncate leading-tight group-hover:text-[#102F4A]">
                  {adminUser?.name || "Admin"}
                </p>
                <p className="text-[10px] text-[#B48611] font-semibold uppercase tracking-wide">
                  Administrator
                </p>
              </div>
            )}
          </div>
        </NavLink>

        {/* Logout Button */}
        <button
          type="button"
          onClick={handleLogout}
          aria-label="Logout of Admin Panel"
          title={collapsed ? "Logout" : undefined}
          className={`w-full flex items-center justify-center rounded-2xl text-red-600 hover:bg-red-50 hover:text-red-700 active:bg-red-100 border border-red-200 font-bold text-xs cursor-pointer transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 ${
            collapsed ? "p-2.5" : "space-x-2 px-3.5 py-2.5"
          }`}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );
};

export default AdminSidebar;
