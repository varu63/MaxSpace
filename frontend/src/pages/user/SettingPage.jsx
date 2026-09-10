import React, { useEffect, useState } from "react";
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
  Download,
  KeyRound,
  FileText,
  RefreshCcw,
  CheckCircle2,
  X,
  Trash2,
  Building2,
  MapPin,
  AtSign,
} from "lucide-react";
import { useBattery } from "../context/BatteryContext";
import { changePassword as changePasswordApi, getErrorMessage } from "../services/api";

const DEFAULT_SETTINGS = {
  emailNotifications: true,
  serviceReminders: true,
  batteryAlerts: true,
  maintenanceAlerts: true,
  twoFactorAuth: false,
  darkMode: false,
  autoBackup: true,
  accentColor: "navy",
};

const STORAGE_KEY = "appSettings";

const ACCENT_COLORS = [
  { key: "navy", label: "Navy", value: "#173B5C" },
  { key: "gold", label: "Gold", value: "#B48611" },
  { key: "emerald", label: "Emerald", value: "#0F766E" },
  { key: "rose", label: "Rose", value: "#BE123C" },
];

const Toggle = ({ enabled, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`relative w-12 h-6 rounded-full transition-colors ${
      enabled ? "bg-[#173B5C]" : "bg-[#E7E1D3]"
    }`}
  >
    <span
      className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
        enabled ? "translate-x-7" : "translate-x-1"
      }`}
    />
  </button>
);

const SettingRow = ({
  icon: Icon,
  title,
  description,
  control,
}) => (
  <div className="px-6 py-5 flex items-center justify-between gap-4">
    <div className="flex items-start gap-3 min-w-0">
      {Icon && (
        <Icon className="w-5 h-5 text-[#8A7A4A] mt-0.5 shrink-0" />
      )}
      <div>
        <h3 className="font-semibold text-[#16263A]">
          {title}
        </h3>
        {description && (
          <p className="text-sm text-[#747B83] mt-1">
            {description}
          </p>
        )}
      </div>
    </div>
    <div className="shrink-0">{control}</div>
  </div>
);

const Field = ({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
}) => (
  <div>
    <label className="block text-sm font-semibold text-[#16263A] mb-1.5">
      {label}
    </label>
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full px-4 py-2.5 rounded-2xl border border-[#EEE9DA] bg-[#FFFDF8] text-[#16263A] text-sm focus:outline-none focus:ring-2 focus:ring-[#173B5C] focus:border-transparent transition"
    />
  </div>
);

const SettingsPage = () => {
  const {
    userProfile,
    updateProfile,
    resetToSampleData,
    addToast,
    batteries,
    services,
  } = useBattery();

  const [activeSection, setActiveSection] =
    useState("general");

  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return {
          ...DEFAULT_SETTINGS,
          ...JSON.parse(saved),
        };
      }
    } catch (error) {
      console.error("Failed to load settings", error);
    }
    return DEFAULT_SETTINGS;
  });

  const [saved, setSaved] = useState(false);

  const [profileForm, setProfileForm] = useState({
    name: userProfile?.name || "",
    title: userProfile?.title || "",
    email: userProfile?.email || "",
    phone: userProfile?.phone || "",
    location: userProfile?.location || "",
  });

  const [isPasswordModalOpen, setIsPasswordModalOpen] =
    useState(false);

  const [passwordForm, setPasswordForm] = useState({
    current: "",
    next: "",
    confirm: "",
  });

  const [isResetModalOpen, setIsResetModalOpen] =
    useState(false);

  /* =====================================================
     THEME SYNC
  ===================================================== */

  const applyTheme = (darkMode) => {
    document.documentElement.classList.toggle(
      "dark",
      Boolean(darkMode)
    );
  };

  useEffect(() => {
    applyTheme(settings.darkMode);
  }, [settings.darkMode]);

  /* =====================================================
     GENERAL SETTINGS
  ===================================================== */

  const handleToggle = (key) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
    setSaved(false);
  };

  const handleAccentChange = (key) => {
    setSettings((prev) => ({
      ...prev,
      accentColor: key,
    }));
    setSaved(false);
  };

  const handleSave = () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(settings)
    );
    applyTheme(settings.darkMode);

    setSaved(true);
    addToast(
      "Settings Saved",
      "Your preferences have been stored on this device."
    );

    setTimeout(() => {
      setSaved(false);
    }, 2500);
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(DEFAULT_SETTINGS)
    );
    applyTheme(DEFAULT_SETTINGS.darkMode);

    addToast(
      "Settings Reset",
      "All preferences were restored to defaults.",
      "info"
    );
  };

  /* =====================================================
     ACCOUNT
  ===================================================== */

  const handleProfileChange = (key) => (event) => {
    setProfileForm((prev) => ({
      ...prev,
      [key]: event.target.value,
    }));
  };

  const handleProfileSave = () => {
    updateProfile({
      name: profileForm.name,
      title: profileForm.title,
      email: profileForm.email,
      phone: profileForm.phone,
      location: profileForm.location,
    });

    addToast(
      "Account Updated",
      "Your account details have been saved."
    );
  };

  /* =====================================================
     SECURITY
  ===================================================== */

  const openPasswordModal = () => {
    setPasswordForm({
      current: "",
      next: "",
      confirm: "",
    });
    setIsPasswordModalOpen(true);
  };

  const closePasswordModal = () => {
    setIsPasswordModalOpen(false);
  };

  const handlePasswordChange = (key) => (event) => {
    setPasswordForm((prev) => ({
      ...prev,
      [key]: event.target.value,
    }));
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();

    if (!passwordForm.current || !passwordForm.next) {
      addToast(
        "Missing Fields",
        "Please fill in all password fields.",
        "warning"
      );
      return;
    }

    if (passwordForm.next.length < 6) {
      addToast(
        "Weak Password",
        "New password must be at least 6 characters.",
        "warning"
      );
      return;
    }

    if (passwordForm.next !== passwordForm.confirm) {
      addToast(
        "Passwords Don't Match",
        "The new password and confirmation do not match.",
        "warning"
      );
      return;
    }

    try {
      // Persist the new password to the backend
      await changePasswordApi({
        currentPassword: passwordForm.current,
        newPassword: passwordForm.next,
      });
      addToast(
        "Password Changed",
        "Your password was updated successfully."
      );
      closePasswordModal();
    } catch (error) {
      addToast(
        "Password Change Failed",
        getErrorMessage(error),
        "error"
      );
    }
  };

  /* =====================================================
     DATA & BACKUP
  ===================================================== */

  const handleExportData = () => {
    const payload = {
      app: "MaxSpace Battery Passport System",
      exportedAt: new Date().toISOString(),
      settings,
      userProfile,
      batteries,
      services,
    };

    const blob = new Blob(
      [JSON.stringify(payload, null, 2)],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `maxspace-export-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    addToast(
      "Export Complete",
      "Your data was downloaded as a JSON file."
    );
  };

  const openResetModal = () => {
    setIsResetModalOpen(true);
  };

  const closeResetModal = () => {
    setIsResetModalOpen(false);
  };

  const handleClearData = () => {
    resetToSampleData();
    closeResetModal();
  };

  /* =====================================================
     NAV ITEMS
  ===================================================== */

  const navItems = [
    {
      id: "general",
      label: "General",
      icon: Settings,
    },
    {
      id: "account",
      label: "Account",
      icon: User,
    },
    {
      id: "notifications",
      label: "Notifications",
      icon: Bell,
    },
    {
      id: "security",
      label: "Security",
      icon: Shield,
    },
    {
      id: "appearance",
      label: "Appearance",
      icon: Palette,
    },
    {
      id: "data",
      label: "Data & Backup",
      icon: Database,
    },
  ];

  const activeAccent =
    ACCENT_COLORS.find(
      (color) => color.key === settings.accentColor
    ) || ACCENT_COLORS[0];

  return (
    <div className="w-full space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl text-white flex items-center justify-center shadow-sm"
              style={{ backgroundColor: activeAccent.value }}
            >
              <Settings className="w-6 h-6" />
            </div>

            <div>
              <h1 className="text-3xl font-bold text-[#16263A]">
                Settings
              </h1>

              <p className="text-sm text-[#747B83] mt-1">
                Manage your account, notifications and
                application preferences
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
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
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#173B5C] text-white font-semibold hover:bg-[#102F4A] shadow-sm transition"
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      </div>

      {/* Success message */}
      {saved && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-800 font-medium flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5" />
          Settings saved successfully.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left navigation */}
        <div className="bg-[#FFFDF8] rounded-3xl border border-[#EEE9DA] p-5 shadow-sm h-fit">
          <p className="px-4 pb-3 text-[11px] font-bold uppercase tracking-wider text-[#747B83]">
            Settings Sections
          </p>

          <div className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition ${
                    isActive
                      ? "bg-[#173B5C] text-white font-semibold shadow-sm"
                      : "text-[#16263A] hover:bg-[#F5F1E7]"
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 ${
                      isActive
                        ? "text-white"
                        : "text-[#8A7A4A]"
                    }`}
                  />
                  <span className="font-semibold">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-6 px-4 py-4 rounded-2xl bg-[#F5F1E7] border border-[#EEE9DA] text-xs text-[#747B83]">
            <p className="font-semibold text-[#8A7A4A] mb-1">
              💡 Tip
            </p>
            Changes are applied to this browser and saved
            locally. Use Data &amp; Backup to export your
            records.
          </div>
        </div>

        {/* Settings content */}
        <div className="lg:col-span-2 space-y-6">
          {/* ==============================================
              GENERAL
          ============================================== */}
          {activeSection === "general" && (
            <>
              <section className="bg-[#FFFDF8] rounded-3xl border border-[#EEE9DA] shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-[#EEE9DA]">
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

                <div className="divide-y divide-[#EEE9DA]">
                  <SettingRow
                    icon={Database}
                    title="Automatic Backup"
                    description="Automatically save your battery and service data"
                    control={
                      <Toggle
                        enabled={settings.autoBackup}
                        onClick={() =>
                          handleToggle("autoBackup")
                        }
                      />
                    }
                  />

                  <SettingRow
                    icon={settings.darkMode ? Moon : Sun}
                    title="Dark Mode"
                    description="Use a darker interface throughout the application"
                    control={
                      <Toggle
                        enabled={settings.darkMode}
                        onClick={() =>
                          handleToggle("darkMode")
                        }
                      />
                    }
                  />
                </div>
              </section>
            </>
          )}

          {/* ==============================================
              ACCOUNT
          ============================================== */}
          {activeSection === "account" && (
            <section className="bg-[#FFFDF8] rounded-3xl border border-[#EEE9DA] shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-[#EEE9DA] flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-[#8A7A4A]" />

                  <div>
                    <h2 className="font-bold text-lg text-[#16263A]">
                      Account Details
                    </h2>

                    <p className="text-sm text-[#747B83]">
                      Update your operator profile information
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <img
                    src={userProfile?.avatar}
                    alt={userProfile?.name}
                    className="w-14 h-14 rounded-2xl object-cover ring-2 ring-[#EEE9DA]"
                  />

                  <div className="text-right">
                    <p className="font-bold text-[#16263A]">
                      {userProfile?.name}
                    </p>
                    <p className="text-xs text-[#747B83]">
                      Member since {userProfile?.memberSince}
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-6 py-5 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field
                    label="Full Name"
                    value={profileForm.name}
                    onChange={handleProfileChange("name")}
                  />
                  <Field
                    label="Job Title"
                    value={profileForm.title}
                    onChange={handleProfileChange("title")}
                  />
                  <Field
                    label="Location"
                    value={profileForm.location}
                    onChange={handleProfileChange("location")}
                  />
                  <Field
                    label="Email"
                    type="email"
                    value={profileForm.email}
                    onChange={handleProfileChange("email")}
                  />
                  <Field
                    label="Phone"
                    type="tel"
                    value={profileForm.phone}
                    onChange={handleProfileChange("phone")}
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleProfileSave}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#173B5C] text-white font-semibold hover:bg-[#102F4A] shadow-sm transition"
                  >
                    <Save className="w-4 h-4" />
                    Update Account
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-[#EEE9DA]">
                  <div className="flex items-center gap-2 text-sm text-[#747B83]">
                    <Building2 className="w-4 h-4 text-[#8A7A4A]" />
                    {userProfile?.fleetType}
                  </div>

                  <div className="flex items-center gap-2 text-sm text-[#747B83]">
                    <MapPin className="w-4 h-4 text-[#8A7A4A]" />
                    {userProfile?.location}
                  </div>

                  <div className="flex items-center gap-2 text-sm text-[#747B83]">
                    <AtSign className="w-4 h-4 text-[#8A7A4A]" />
                    {userProfile?.euOperatorId}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ==============================================
              NOTIFICATIONS
          ============================================== */}
          {activeSection === "notifications" && (
            <section className="bg-[#FFFDF8] rounded-3xl border border-[#EEE9DA] shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-[#EEE9DA]">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-[#8A7A4A]" />

                  <div>
                    <h2 className="font-bold text-lg text-[#16263A]">
                      Notifications
                    </h2>

                    <p className="text-sm text-[#747B83]">
                      Choose which notifications you want to
                      receive
                    </p>
                  </div>
                </div>
              </div>

              <div className="divide-y divide-[#EEE9DA]">
                <SettingRow
                  icon={Mail}
                  title="Email Notifications"
                  description="Receive important updates by email"
                  control={
                    <Toggle
                      enabled={settings.emailNotifications}
                      onClick={() =>
                        handleToggle("emailNotifications")
                      }
                    />
                  }
                />

                <SettingRow
                  icon={Smartphone}
                  title="Service Reminders"
                  description="Get reminders about upcoming battery services"
                  control={
                    <Toggle
                      enabled={settings.serviceReminders}
                      onClick={() =>
                        handleToggle("serviceReminders")
                      }
                    />
                  }
                />

                <SettingRow
                  icon={Shield}
                  title="Battery Health Alerts"
                  description="Notify you when battery health requires attention"
                  control={
                    <Toggle
                      enabled={settings.batteryAlerts}
                      onClick={() =>
                        handleToggle("batteryAlerts")
                      }
                    />
                  }
                />

                <SettingRow
                  icon={Settings}
                  title="Maintenance Alerts"
                  description="Receive maintenance and diagnostic alerts"
                  control={
                    <Toggle
                      enabled={settings.maintenanceAlerts}
                      onClick={() =>
                        handleToggle("maintenanceAlerts")
                      }
                    />
                  }
                />
              </div>
            </section>
          )}

          {/* ==============================================
              SECURITY
          ============================================== */}
          {activeSection === "security" && (
            <section className="bg-[#FFFDF8] rounded-3xl border border-[#EEE9DA] shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-[#EEE9DA]">
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

              <div className="divide-y divide-[#EEE9DA]">
                <SettingRow
                  icon={Lock}
                  title="Two-Factor Authentication"
                  description="Add an extra layer of protection to your account"
                  control={
                    <Toggle
                      enabled={settings.twoFactorAuth}
                      onClick={() =>
                        handleToggle("twoFactorAuth")
                      }
                    />
                  }
                />

                <div className="px-6 py-5 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-start gap-3">
                    <KeyRound className="w-5 h-5 text-[#8A7A4A] mt-0.5" />

                    <div>
                      <h3 className="font-semibold text-[#16263A]">
                        Password
                      </h3>

                      <p className="text-sm text-[#747B83] mt-1">
                        Use a strong password with at least 6
                        characters
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={openPasswordModal}
                    className="px-5 py-2.5 rounded-2xl border border-[#EEE9DA] bg-[#FFFDF8] text-[#16263A] font-semibold hover:bg-[#F5F1E7] transition shadow-sm"
                  >
                    Change Password
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* ==============================================
              APPEARANCE
          ============================================== */}
          {activeSection === "appearance" && (
            <>
              <section className="bg-[#FFFDF8] rounded-3xl border border-[#EEE9DA] shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-[#EEE9DA]">
                  <div className="flex items-center gap-3">
                    <Palette className="w-5 h-5 text-[#8A7A4A]" />

                    <div>
                      <h2 className="font-bold text-lg text-[#16263A]">
                        Theme
                      </h2>

                      <p className="text-sm text-[#747B83]">
                        Switch between light and dark interface
                      </p>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() =>
                        settings.darkMode
                          ? handleToggle("darkMode")
                          : null
                      }
                      className={`flex items-center gap-3 p-4 rounded-2xl border transition ${
                        !settings.darkMode
                          ? "border-[#173B5C] bg-[#F5F1E7] shadow-sm"
                          : "border-[#EEE9DA] bg-[#FFFDF8] hover:bg-[#F5F1E7]"
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-[#FFFDF8] border border-[#E7E1D3] flex items-center justify-center shadow-sm">
                        <Sun className="w-5 h-5 text-[#8A7A4A]" />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-[#16263A] text-sm">
                          Light Mode
                        </p>
                        <p className="text-xs text-[#747B83]">
                          Bright and airy default theme
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        !settings.darkMode
                          ? handleToggle("darkMode")
                          : null
                      }
                      className={`flex items-center gap-3 p-4 rounded-2xl border transition ${
                        settings.darkMode
                          ? "border-[#173B5C] bg-[#F5F1E7] shadow-sm"
                          : "border-[#EEE9DA] bg-[#FFFDF8] hover:bg-[#F5F1E7]"
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-[#16263A] border border-[#102F4A] flex items-center justify-center shadow-sm">
                        <Moon className="w-5 h-5 text-yellow-300" />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-[#16263A] text-sm">
                          Dark Mode
                        </p>
                        <p className="text-xs text-[#747B83]">
                          Reduce glare, easier on the eyes
                        </p>
                      </div>
                    </button>
                  </div>
                </div>
              </section>

              <section className="bg-[#FFFDF8] rounded-3xl border border-[#EEE9DA] shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-[#EEE9DA]">
                  <div className="flex items-center gap-3">
                    <Settings className="w-5 h-5 text-[#8A7A4A]" />

                    <div>
                      <h2 className="font-bold text-lg text-[#16263A]">
                        Accent Color
                      </h2>

                      <p className="text-sm text-[#747B83]">
                        Pick the primary color used across
                        buttons and highlights
                      </p>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-5">
                  <div className="flex flex-wrap gap-3">
                    {ACCENT_COLORS.map((color) => (
                      <button
                        key={color.key}
                        type="button"
                        onClick={() =>
                          handleAccentChange(color.key)
                        }
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border font-semibold text-sm transition ${
                          settings.accentColor === color.key
                            ? "border-transparent text-white shadow-sm"
                            : "border-[#EEE9DA] bg-[#FFFDF8] text-[#16263A] hover:bg-[#F5F1E7]"
                        }`}
                        style={
                          settings.accentColor === color.key
                            ? { backgroundColor: color.value }
                            : undefined
                        }
                      >
                        <span
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: color.value }}
                        />
                        {color.label}
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            </>
          )}

          {/* ==============================================
              DATA & BACKUP
          ============================================== */}
          {activeSection === "data" && (
            <>
              <section className="bg-[#FFFDF8] rounded-3xl border border-[#EEE9DA] shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-[#EEE9DA]">
                  <div className="flex items-center gap-3">
                    <Database className="w-5 h-5 text-[#8A7A4A]" />

                    <div>
                      <h2 className="font-bold text-lg text-[#16263A]">
                        Automatic Backup
                      </h2>

                      <p className="text-sm text-[#747B83]">
                        Keep your battery and service records
                        saved on this device
                      </p>
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-[#EEE9DA]">
                  <SettingRow
                    icon={Database}
                    title="Automatic Backup"
                    description="Persist all application data locally as you work"
                    control={
                      <Toggle
                        enabled={settings.autoBackup}
                        onClick={() =>
                          handleToggle("autoBackup")
                        }
                      />
                    }
                  />

                  <div className="px-6 py-5 flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-start gap-3">
                      <FileText className="w-5 h-5 text-[#8A7A4A] mt-0.5" />

                      <div>
                        <h3 className="font-semibold text-[#16263A]">
                          Data Summary
                        </h3>

                        <p className="text-sm text-[#747B83] mt-1">
                          {batteries.length} batteries ·{" "}
                          {services.length} service records · 1
                          operator profile
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="bg-[#FFFDF8] rounded-3xl border border-[#EEE9DA] shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-[#EEE9DA]">
                  <div className="flex items-center gap-3">
                    <Download className="w-5 h-5 text-[#8A7A4A]" />

                    <div>
                      <h2 className="font-bold text-lg text-[#16263A]">
                        Backup &amp; Restore
                      </h2>

                      <p className="text-sm text-[#747B83]">
                        Export your records as a JSON file or
                        restore the sample dataset
                      </p>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={handleExportData}
                    className="flex flex-col items-start gap-2 p-5 rounded-2xl border border-[#EEE9DA] bg-[#FFFDF8] hover:bg-[#F5F1E7] transition shadow-sm text-left"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#173B5C] text-white flex items-center justify-center">
                      <Download className="w-5 h-5" />
                    </div>

                    <span className="font-bold text-[#16263A]">
                      Export Data
                    </span>

                    <span className="text-sm text-[#747B83]">
                      Download all settings, batteries, services
                      and profile info as JSON.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={openResetModal}
                    className="flex flex-col items-start gap-2 p-5 rounded-2xl border border-red-200 bg-red-50 hover:bg-red-100 transition shadow-sm text-left"
                  >
                    <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center">
                      <RefreshCcw className="w-5 h-5" />
                    </div>

                    <span className="font-bold text-red-700">
                      Restore Sample Data
                    </span>

                    <span className="text-sm text-red-600">
                      Replace all current records with the
                      original EU DPP sample dataset.
                    </span>
                  </button>
                </div>
              </section>
            </>
          )}
        </div>
      </div>

      {/* Change Password Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex overflow-y-auto p-4">
          <div
            className="absolute inset-0 bg-[#16263A]/60 backdrop-blur-sm"
            onClick={closePasswordModal}
          />

          <div className="relative w-full max-w-md m-auto max-h-[90vh] overflow-y-auto bg-[#FFFDF8] rounded-3xl border border-[#EEE9DA] shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#173B5C] text-white flex items-center justify-center">
                  <Lock className="w-5 h-5" />
                </div>

                <div>
                  <h3 className="font-bold text-lg text-[#16263A]">
                    Change Password
                  </h3>

                  <p className="text-sm text-[#747B83]">
                    Set a new password for your account
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closePasswordModal}
                className="p-2 rounded-xl text-[#747B83] hover:bg-[#F5F1E7] transition"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handlePasswordSubmit}
              className="space-y-4"
            >
              <Field
                label="Current Password"
                type="password"
                placeholder="Enter current password"
                value={passwordForm.current}
                onChange={handlePasswordChange("current")}
              />

              <Field
                label="New Password"
                type="password"
                placeholder="At least 6 characters"
                value={passwordForm.next}
                onChange={handlePasswordChange("next")}
              />

              <Field
                label="Confirm New Password"
                type="password"
                placeholder="Repeat new password"
                value={passwordForm.confirm}
                onChange={handlePasswordChange("confirm")}
              />

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closePasswordModal}
                  className="flex-1 px-5 py-2.5 rounded-2xl border border-[#EEE9DA] text-[#16263A] font-semibold hover:bg-[#F5F1E7] transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="flex-1 px-5 py-2.5 rounded-2xl bg-[#173B5C] text-white font-semibold hover:bg-[#102F4A] transition"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Restore sample data confirmation modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex overflow-y-auto p-4">
          <div
            className="absolute inset-0 bg-[#16263A]/60 backdrop-blur-sm"
            onClick={closeResetModal}
          />

          <div className="relative w-full max-w-md m-auto max-h-[90vh] overflow-y-auto bg-[#FFFDF8] rounded-3xl border border-[#EEE9DA] shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-red-600 text-white flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>

              <div>
                <h3 className="font-bold text-lg text-[#16263A]">
                  Restore Sample Data?
                </h3>

                <p className="text-sm text-[#747B83]">
                  This will replace all current records with the
                  original sample dataset.
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={closeResetModal}
                className="flex-1 px-5 py-2.5 rounded-2xl border border-[#EEE9DA] text-[#16263A] font-semibold hover:bg-[#F5F1E7] transition"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleClearData}
                className="flex-1 px-5 py-2.5 rounded-2xl bg-red-600 text-white font-semibold hover:bg-red-700 transition"
              >
                Yes, Restore
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;