import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  QrCode,
  Bell,
  Menu,
  LogOut,
} from "lucide-react";

import { useBattery } from "../../context/BatteryContext";
import DownloadAppButton from "./DownloadAppButton";

const Header = () => {
  const {
    openScanner,
    userProfile,
    setIsSidebarOpen,
    signOut,
  } = useBattery();

  const navigate = useNavigate();

  const handleSignOut = () => {
    signOut();
    navigate("/signin");
  };

  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);

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
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <header
        className={`
          fixed top-3 sm:top-4 left-0 right-0 z-40 px-4 sm:px-6 lg:px-8 mb-5 sm:mb-6 
          transition-transform duration-300 ease-in-out
          ${hidden ? "-translate-y-[120%]" : "translate-y-0"}
        `}
      >
        <div className="max-w-5xl mx-auto h-14 sm:h-16 bg-[#FFFDF8]/95 backdrop-blur-md border border-[#EEE9DA] rounded-2xl sm:rounded-3xl shadow-sm px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          {/* LEFT */}
          <div className="flex items-center gap-3">
            {/* MENU BUTTON */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="
                flex items-center justify-center
                w-10 h-10
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
              <Menu className="w-5 h-5" />
            </button>

            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-[#F5F1E7] flex items-center justify-center border-[#16263A] border overflow-hidden">
                <img
                  src="/Logo.jpeg"
                  alt="logo"
                  className="w-full h-full object-scale-down"
                />
              </div>

              <div className="hidden sm:block">
                <h1 className="font-bold text-base text-[#16263A]">
                  MaxSpace
                </h1>

                <p className="text-[9px] text-[#747B83]">
                  Digital Product Passport
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Scan */}
            <button
              onClick={openScanner}
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
            >
              <QrCode className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Notifications */}
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
            >
              <Bell className="w-4 h-4 sm:w-5 sm:h-5" />

              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#B48611]" />
            </button>

            {/* User */}
            <div className="hidden sm:flex items-center gap-2 ml-1">
              <div className="w-8 h-8 rounded-full bg-[#173B5C] text-white flex items-center justify-center text-xs font-bold">
                {userProfile?.name
                  ? userProfile.name.charAt(0).toUpperCase()
                  : "U"}
              </div>
            </div>

            {/* Sign Out */}
            <DownloadAppButton
              className="flex items-center justify-center gap-1.5 h-10 px-3 rounded-xl bg-[#173B5C] text-white border border-[#173B5C] hover:bg-[#102F4A] transition"
              iconClassName="w-4 h-4 sm:w-5 sm:h-5"
            >
              <span className="hidden lg:inline text-xs font-bold">Download</span>
            </DownloadAppButton>

            <button
              onClick={handleSignOut}
              className="
                flex items-center justify-center gap-1.5
                h-10 px-3
                rounded-xl
                bg-[#F5F1E7]
                border border-[#E7E1D3]
                text-[#747B83]
                hover:bg-red-50 hover:text-red-700 hover:border-red-200
                transition
              "
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden lg:inline text-xs font-bold">
                Sign Out
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Spacer to prevent content from going behind the fixed header */}
      <div className="h-[72px] sm:h-[80px]" />
    </>
  );
};

export default Header;