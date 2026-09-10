import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useBattery } from "../../context/BatteryContext";
import { useAdmin } from "../../context/AdminContext";
import { useBatteryTechnician } from "../../context/BatteryTechnicianContext";
import { QrCode, Bell, Menu, User, LogOut, ChevronDown, ShieldCheck, HardHat } from "lucide-react";
import DownloadAppButton from "./DownloadAppButton";

const ROLE_BADGE = {
  user: null,
  admin: { label: "Admin", icon: ShieldCheck, path: "/admin/profile", home: "/admin" },
  "battery-technician": { label: "Technician", icon: HardHat, path: "/battery-technician/services", home: "/battery-technician" },
};

const Header = ({ role = "user", onOpenSidebar, onNavigateProfile, onLogout, showScanner = true, openScanner: externalOpenScanner, setIsSidebarOpen: externalSetSidebarOpen }) => {
  const battery = useBattery();
  const admin = useAdmin();
  const tech = useBatteryTechnician();

  const navigate = useNavigate();

  const roleConfig = ROLE_BADGE[role] || ROLE_BADGE.user;

  const profile = role === "admin" ? admin.adminUser : role === "battery-technician" ? tech.batteryTechnicianUser : battery.userProfile;
  const name = profile?.name || (role === "admin" ? "Admin" : role === "battery-technician" ? "Technician" : "User");
  const email = role === "user" ? profile?.email || "user@email.com" : profile?.email || "";

  const openSidebar = () => {
    if (role === "user") battery.setIsSidebarOpen(true);
    else if (externalSetSidebarOpen) externalSetSidebarOpen(true);
    else if (onOpenSidebar) onOpenSidebar();
  };

  const handleNavigateProfile = () => {
    setIsProfileOpen(false);
    if (onNavigateProfile) {
      onNavigateProfile();
      return;
    }
    if (role === "user") navigate("/profile");
    else if (role === "admin") navigate("/admin/profile");
    else navigate("/battery-technician/services");
  };

  const handleLogout = () => {
    setIsProfileOpen(false);
    if (onLogout) {
      onLogout();
      return;
    }
    if (role === "admin") {
      admin.adminLogout();
      navigate("/admin/login");
    } else if (role === "battery-technician") {
      tech.batteryTechnicianLogout();
      navigate("/battery-technician/login");
    } else {
      battery.signOut();
      navigate("/signin");
    }
  };

  const handleOpenScanner = () => {
    if (externalOpenScanner) externalOpenScanner();
    else battery.openScanner();
  };

  const [hidden, setHidden] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const lastScrollY = useRef(0);

  const handleProfileClick = useCallback(() => {
    setIsProfileOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;

      if (currentY > lastScrollY.current && currentY > 80) {
        setHidden(true);
      } else {
        setHidden(false);
      }

      lastScrollY.current = currentY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <>
      <header
        className={`
          fixed top-3 sm:top-4 left-0 right-0 z-40
          px-3 sm:px-6 lg:px-8
          transition-transform duration-300 ease-in-out
          ${hidden ? "-translate-y-[120%]" : "translate-y-0"}
        `}
      >
        <div
          className="
            max-w-6xl mx-auto
            h-14 sm:h-16
            bg-[#FFFDF8]/95
            backdrop-blur-md
            border border-[#EEE9DA]
            rounded-2xl sm:rounded-3xl
            shadow-sm
            px-3 sm:px-6 lg:px-8
            flex items-center justify-between
          "
        >
          {/* LEFT */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">

            {/* MENU */}
            <button
              onClick={openSidebar}
              className="
                shrink-0
                flex items-center justify-center
                w-9 h-9 sm:w-10 sm:h-10
                rounded-xl
                bg-[#F5F1E7]
                border border-[#E7E1D3]
                text-[#173B5C]
                hover:text-[#16263A]
                hover:bg-[#E7E1D3]
                active:scale-95
                transition-all
              "
              title="Open Navigation Menu"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* LOGO */}
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="
                  shrink-0
                  w-10 h-10 sm:w-12 sm:h-12
                  rounded-full
                  bg-white dark:bg-white
                  flex items-center justify-center
                  border border-[#E7E1D3]
                  overflow-hidden
                  p-1
                "
              >
                <img
                  src="/Logo.png"
                  alt="MaxVolt Energy"
                  className="w-full h-full object-contain"
                />
              </div>

              {/* BRAND TEXT */}
              <div className="hidden sm:block min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="font-bold text-sm lg:text-base text-[#16263A] truncate">
                    MaxSpace
                  </h1>

                  {roleConfig && (
                    <span className="hidden md:inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#FBF1C9] text-[#A77A08] border border-[#F0E6C8] uppercase tracking-wide">
                      <roleConfig.icon className="w-2.5 h-2.5" />
                      {roleConfig.label}
                    </span>
                  )}
                </div>

                <p className="text-[8px] lg:text-[9px] text-[#747B83] truncate">
                  {role === "admin"
                    ? "Service Management Console"
                    : role === "battery-technician"
                    ? "Battery Service Operations"
                    : "Digital Product Passport"}
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">

            {showScanner && (
              <button
                onClick={handleOpenScanner}
                className="
                  w-9 h-9 sm:w-10 sm:h-10
                  rounded-xl
                  bg-[#F5F1E7]
                  border border-[#E7E1D3]
                  flex items-center justify-center
                  text-[#173B5C]
                  hover:bg-[#E7E1D3]
                  transition
                "
                title="Scan Battery"
                aria-label="Scan Battery"
              >
                <QrCode className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            )}

            {/* NOTIFICATIONS */}
            <button
              className="
                hidden sm:flex
                w-10 h-10
                rounded-xl
                bg-[#F5F1E7]
                border border-[#E7E1D3]
                items-center justify-center
                text-[#747B83]
                hover:bg-[#E7E1D3]
                transition
                relative
              "
              title="Notifications"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4 sm:w-5 sm:h-5" />

              {role === "admin" && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#B48611]" />
              )}
            </button>

            {/* USER PROFILE DROPDOWN */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={handleProfileClick}
                className="
                  flex items-center gap-1.5
                  w-auto h-9 sm:h-10
                  px-1.5 sm:px-2
                  rounded-xl
                  bg-[#F5F1E7]
                  border border-[#E7E1D3]
                  hover:bg-[#E7E1D3]
                  transition
                "
                title="Profile Menu"
                aria-label="Profile Menu"
                aria-expanded={isProfileOpen}
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#173B5C] text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {name ? name.charAt(0).toUpperCase() : "U"}
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-[#747B83] transition-transform duration-200 ${
                    isProfileOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* DROPDOWN MENU */}
              {isProfileOpen && (
                <div
                  className="
                    absolute right-0 top-full mt-2
                    w-48
                    bg-white
                    border border-[#EEE9DA]
                    rounded-xl
                    shadow-lg
                    py-1.5
                    z-50
                    animate-in fade-in slide-in-from-top-2 duration-150
                  "
                >
                  {/* Profile header */}
                  <div className="px-3.5 py-2.5 border-b border-[#EEE9DA]">
                    <p className="text-sm font-semibold text-[#16263A] truncate">
                      {name}
                    </p>
                    <p className="text-xs text-[#747B83] truncate">
                      {email || "no email available"}
                    </p>
                  </div>

                  {/* Profile option */}
                  <button
                    onClick={handleNavigateProfile}
                    className="
                      w-full flex items-center gap-2.5
                      px-3.5 py-2.5
                      text-sm text-[#16263A]
                      hover:bg-[#F5F1E7]
                      transition
                      text-left
                    "
                  >
                    <User className="w-4 h-4 text-[#747B83]" />
                    {role === "battery-technician" ? "My Services" : "Profile"}
                  </button>

                  {/* Logout option */}
                  <button
                    onClick={handleLogout}
                    className="
                      w-full flex items-center gap-2.5
                      px-3.5 py-2.5
                      text-sm text-[#C0392B]
                      hover:bg-red-50
                      transition
                      text-left
                    "
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              )}
            </div>

            {/* GET APP — only for the user panel */}
            {role === "user" && (
              <DownloadAppButton
                className="
                  group
                  flex items-center justify-center
                  gap-1.5
                  h-9 sm:h-10
                  px-2.5 sm:px-3
                  rounded-xl
                  bg-[#173B5C]
                  text-white
                  border border-[#173B5C]
                  hover:bg-[#102F4A]
                  transition
                  text-xs sm:text-sm
                  whitespace-nowrap
                "
                iconClassName="w-4 h-4 sm:w-5 sm:h-5"
              >
                <span className="group-hover:hidden">
                  <span className="hidden sm:inline">Download</span>
                  <span className="sm:hidden">Get</span>
                </span>

                <span className="hidden group-hover:inline">
                  Get App
                </span>
              </DownloadAppButton>
            )}
          </div>
        </div>
      </header>

      {/* HEADER SPACER */}
      <div className="h-[68px] sm:h-[80px]" />
    </>
  );
};

export default Header;