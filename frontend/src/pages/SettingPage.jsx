import React, { useState } from "react";
import {
  Settings,
  User,
  Bell,
  Shield,
  Palette,
  Database,
  Moon,
  Sun,
  Mail,
  Smartphone,
  Lock,
  Save,
  RotateCcw,
} from "lucide-react";

const SettingsPage = () => {
  const [settings, setSettings] = useState({
    emailNotifications: true,
    serviceReminders: true,
    batteryAlerts: true,
    maintenanceAlerts: true,
    twoFactorAuth: false,
    darkMode: false,
    autoBackup: true,
  });

  const [saved, setSaved] = useState(false);

  const handleToggle = (key) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));

    setSaved(false);
  };

  const handleSave = () => {
    localStorage.setItem("appSettings", JSON.stringify(settings));

    setSaved(true);

    setTimeout(() => {
      setSaved(false);
    }, 2500);
  };

  const handleReset = () => {
    const defaultSettings = {
      emailNotifications: true,
      serviceReminders: true,
      batteryAlerts: true,
      maintenanceAlerts: true,
      twoFactorAuth: false,
      darkMode: false,
      autoBackup: true,
    };

    setSettings(defaultSettings);
    localStorage.setItem(
      "appSettings",
      JSON.stringify(defaultSettings)
    );
  };

  const Toggle = ({ enabled, onClick }) => (
    <button
      type="button"
      onClick={onClick}
      className={`relative w-12 h-6 rounded-full transition-colors ${
        enabled ? "bg-[#173B5C]" : "bg-slate-300"
      }`}
    >
      <span
        className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
          enabled ? "translate-x-7" : "translate-x-1"
        }`}
      />
    </button>
  );

  return (
    <div className="w-full space-y-8">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#173B5C] text-white flex items-center justify-center shadow-sm">
              <Settings className="w-6 h-6" />
            </div>

            <div>
              <h1 className="text-3xl font-bold text-[#16263A]">
                Settings
              </h1>

              <p className="text-sm text-[#747B83] mt-1">
                Manage your account, notifications and application preferences
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-[#EEE9DA] bg-[#FFFDF8] text-[#16263A] font-medium hover:bg-[#F5F1E7] shadow-sm transition"
          >
            <RotateCcw className="w-4 h-4 text-[#8A7A4A]" />
            Reset
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#173B5C] text-white font-semibold hover:bg-[#122e49] shadow-sm transition"
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      </div>

      {/* Success message */}
      {saved && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-800 font-medium">
          ✓ Settings saved successfully.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left navigation */}
        <div className="bg-[#FFFDF8] rounded-3xl border border-[#EEE9DA] p-5 shadow-sm h-fit">
          <div className="space-y-2">

            <button
              type="button"
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#173B5C] text-white text-left font-semibold shadow-sm"
            >
              <Settings className="w-5 h-5" />
              <span className="font-semibold">General</span>
            </button>

            <button
              type="button"
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[#16263A] hover:bg-[#F5F1E7] text-left transition"
            >
              <User className="w-5 h-5 text-[#8A7A4A]" />
              <span>Account</span>
            </button>

            <button
              type="button"
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[#16263A] hover:bg-[#F5F1E7] text-left transition"
            >
              <Bell className="w-5 h-5 text-[#8A7A4A]" />
              <span>Notifications</span>
            </button>

            <button
              type="button"
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[#16263A] hover:bg-[#F5F1E7] text-left transition"
            >
              <Shield className="w-5 h-5 text-[#8A7A4A]" />
              <span>Security</span>
            </button>

            <button
              type="button"
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[#16263A] hover:bg-[#F5F1E7] text-left transition"
            >
              <Palette className="w-5 h-5 text-[#8A7A4A]" />
              <span>Appearance</span>
            </button>

            <button
              type="button"
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[#16263A] hover:bg-[#F5F1E7] text-left transition"
            >
              <Database className="w-5 h-5 text-[#8A7A4A]" />
              <span>Data & Backup</span>
            </button>

          </div>
        </div>

        {/* Settings content */}
        <div className="lg:col-span-2 space-y-6">

          {/* General */}
          <section className="bg-[#FFFDF8] rounded-3xl border border-[#EEE9DA] shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-[#ECE7DA]">
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5 text-[#8A7A4A]" />

                <div>
                  <h2 className="font-bold text-lg text-[#16263A]">
                    General Settings
                  </h2>

                  <p className="text-sm text-[#747B83]">
                    Configure basic application preferences
                  </p>
                </div>
              </div>
            </div>

            <div className="divide-y divide-[#ECE7DA]">

              <div className="px-6 py-5 flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-[#16263A]">
                    Automatic Backup
                  </h3>

                  <p className="text-sm text-[#747B83] mt-1">
                    Automatically save your battery and service data
                  </p>
                </div>

                <Toggle
                  enabled={settings.autoBackup}
                  onClick={() => handleToggle("autoBackup")}
                />
              </div>

              <div className="px-6 py-5 flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-[#F5F1E7]">
                    {settings.darkMode ? (
                      <Moon className="w-5 h-5 text-[#8A7A4A]" />
                    ) : (
                      <Sun className="w-5 h-5 text-[#8A7A4A]" />
                    )}
                  </div>

                  <div>
                    <h3 className="font-semibold text-[#16263A]">
                      Dark Mode
                    </h3>

                    <p className="text-sm text-[#747B83] mt-1">
                      Use a darker interface throughout the application
                    </p>
                  </div>
                </div>

                <Toggle
                  enabled={settings.darkMode}
                  onClick={() => handleToggle("darkMode")}
                />
              </div>

            </div>
          </section>

          {/* Notifications */}
          <section className="bg-[#FFFDF8] rounded-3xl border border-[#EEE9DA] shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-[#ECE7DA]">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-[#8A7A4A]" />

                <div>
                  <h2 className="font-bold text-lg text-[#16263A]">
                    Notifications
                  </h2>

                  <p className="text-sm text-[#747B83]">
                    Choose which notifications you want to receive
                  </p>
                </div>
              </div>
            </div>

            <div className="divide-y divide-[#ECE7DA]">

              <div className="px-6 py-5 flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-[#8A7A4A] mt-1" />

                  <div>
                    <h3 className="font-semibold text-[#16263A]">
                      Email Notifications
                    </h3>

                    <p className="text-sm text-[#747B83]">
                      Receive important updates by email
                    </p>
                  </div>
                </div>

                <Toggle
                  enabled={settings.emailNotifications}
                  onClick={() => handleToggle("emailNotifications")}
                />
              </div>

              <div className="px-6 py-5 flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Smartphone className="w-5 h-5 text-[#8A7A4A] mt-1" />

                  <div>
                    <h3 className="font-semibold text-[#16263A]">
                      Service Reminders
                    </h3>

                    <p className="text-sm text-[#747B83]">
                      Get reminders about upcoming battery services
                    </p>
                  </div>
                </div>

                <Toggle
                  enabled={settings.serviceReminders}
                  onClick={() => handleToggle("serviceReminders")}
                />
              </div>

              <div className="px-6 py-5 flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-[#16263A]">
                    Battery Health Alerts
                  </h3>

                  <p className="text-sm text-[#747B83]">
                    Notify you when battery health requires attention
                  </p>
                </div>

                <Toggle
                  enabled={settings.batteryAlerts}
                  onClick={() => handleToggle("batteryAlerts")}
                />
              </div>

              <div className="px-6 py-5 flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-[#16263A]">
                    Maintenance Alerts
                  </h3>

                  <p className="text-sm text-[#747B83]">
                    Receive maintenance and diagnostic alerts
                  </p>
                </div>

                <Toggle
                  enabled={settings.maintenanceAlerts}
                  onClick={() => handleToggle("maintenanceAlerts")}
                />
              </div>

            </div>
          </section>

          {/* Security */}
          <section className="bg-[#FFFDF8] rounded-3xl border border-[#EEE9DA] shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-[#ECE7DA]">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-[#8A7A4A]" />

                <div>
                  <h2 className="font-bold text-lg text-[#16263A]">
                    Security
                  </h2>

                  <p className="text-sm text-[#747B83]">
                    Keep your account and battery data secure
                  </p>
                </div>
              </div>
            </div>

            <div className="divide-y divide-[#ECE7DA]">

              <div className="px-6 py-5 flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Lock className="w-5 h-5 text-[#8A7A4A] mt-1" />

                  <div>
                    <h3 className="font-semibold text-[#16263A]">
                      Two-Factor Authentication
                    </h3>

                    <p className="text-sm text-[#747B83]">
                      Add an extra layer of protection to your account
                    </p>
                  </div>
                </div>

                <Toggle
                  enabled={settings.twoFactorAuth}
                  onClick={() => handleToggle("twoFactorAuth")}
                />
              </div>

              <div className="px-6 py-5">
                <button
                  type="button"
                  className="px-5 py-2.5 rounded-2xl border border-[#EEE9DA] bg-[#FFFDF8] text-[#16263A] font-semibold hover:bg-[#F5F1E7] transition shadow-sm"
                >
                  Change Password
                </button>
              </div>

            </div>
          </section>

        </div>
      </div>
    </div>
  );
};

export default SettingsPage;