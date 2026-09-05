
import React, { useState } from "react";
import { useBattery } from "../../context/BatteryContext";
import { EditProfileModal } from "./EditProfileModal";

import {
  User,
  Mail,
  Phone,
  Building2,
  MapPin,
  ShieldCheck,
  Bell,
  History,
  Download,
  Edit3,
  Globe,
  Lock,
  Battery,
  HeartPulse,
  Award,
  ChevronRight,
  CheckCircle2,
  FileText,
} from "lucide-react";

export const UserProfileView = () => {
  const {
    userProfile,
    updateProfile,
    batteries = [],
    stats = {},
    addToast,
  } = useBattery();

  const [isEditModalOpen, setIsEditModalOpen] =
    useState(false);

  /*
   * Safe profile values
   */
  const profile = userProfile || {};

  const notificationSettings =
    profile.notificationSettings || {};

  /*
   * Toggle notification setting
   */
  const toggleNotification = (key) => {
    const updated = {
      ...notificationSettings,
      [key]: !notificationSettings[key],
    };

    updateProfile({
      notificationSettings: updated,
    });
  };

  /*
   * Export complete fleet data
   */
  const handleExportAllPassports = () => {
    const exportData = {
      user: profile,
      exportDate: new Date().toISOString(),
      standard:
        "EU Battery Regulation 2023/1542 (DPP v2.4)",
      fleetCount: batteries.length,
      totalCapacityKwh:
        stats.totalCapacityKwh || 0,
      batteries,
    };

    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(
        JSON.stringify(exportData, null, 2)
      );

    const downloadAnchor =
      document.createElement("a");

    downloadAnchor.setAttribute(
      "href",
      dataStr
    );

    downloadAnchor.setAttribute(
      "download",
      "MAXSPACE-FLEET-PASSPORTS-EXPORT.json"
    );

    document.body.appendChild(
      downloadAnchor
    );

    downloadAnchor.click();

    downloadAnchor.remove();

    addToast?.(
      "Fleet Archive Downloaded",
      "Full EU DPP passports archive generated."
    );
  };

  /*
   * Notification rows
   */
  const notificationOptions = [
    {
      key: "warrantyAlerts",
      title: "Warranty Expiration",
      description:
        "Receive alerts 30 days before battery warranty expiration.",
    },
    {
      key: "healthThresholdAlerts",
      title: "Health Degradation",
      description:
        "Get notified when battery SoH drops below 80%.",
    },
    {
      key: "serviceReminders",
      title: "Service Appointments",
      description:
        "Receive updates when service diagnostics change.",
    },
    {
      key: "euComplianceUpdates",
      title: "EU Compliance",
      description:
        "Receive DPP and regulatory compliance updates.",
    },
  ];

  return (
    <div className="space-y-8 pb-10">

      {/* =====================================================
          PROFILE HERO
      ====================================================== */}
      <section className="relative overflow-hidden rounded-3xl bg-[#FFFDF8] border border-[#EEE9DA] text-[#16263A] shadow-sm p-6 sm:p-8">
        <div className="flex flex-col items-center text-center">
          {/* Avatar with edit badge */}
          <div className="relative mb-4">
            <img
              src={
                profile.avatar ||
                "https://ui-avatars.com/api/?name=User&background=173B5C&color=fff"
              }
              alt={profile.name || "User"}
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover border-4 border-[#F5F1E7] shadow-md mx-auto"
            />
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#173B5C] text-white flex items-center justify-center shadow hover:bg-[#122e49] transition"
              title="Edit Profile"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          </div>

          {/* Name & Role */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#16263A]">
              {profile.name || "admin"}
            </h1>
            <span className="px-3 py-1 rounded-full bg-yellow-400/20 text-[#8A7A4A] border border-yellow-400/30 text-[11px] font-black">
              DPP OPERATOR
            </span>
          </div>

          <p className="mt-1 text-sm font-semibold text-[#8A7A4A]">
            {profile.title || "Administrator"}
          </p>

          {/* Contact Details Centered */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-[#747B83]">
            <span className="flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-[#8A7A4A]" />
              {profile.phone || "N/A"}
            </span>
            <span className="flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-[#8A7A4A]" />
              {profile.email || "N/A"}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-[#8A7A4A]" />
              {profile.location || "N/A"}
            </span>
          </div>

          {/* EU Operator ID & Actions */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#F5F1E7] border border-[#EEE9DA] text-xs font-mono text-[#16263A]">
              <Globe className="w-4 h-4 text-[#8A7A4A]" />
              EU Operator ID:
              <strong className="text-[#173B5C]">{profile.euOperatorId || "EU-DPP-8821"}</strong>
            </div>

            <button
              onClick={() => setIsEditModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#173B5C] text-white font-semibold text-xs shadow-sm hover:bg-[#122e49] transition"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit Profile
            </button>

            <button
              onClick={handleExportAllPassports}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FFFDF8] border border-[#EEE9DA] text-[#16263A] hover:bg-[#F5F1E7] font-semibold text-xs shadow-sm transition"
            >
              <Download className="w-3.5 h-3.5 text-[#8A7A4A]" />
              Export Passports
            </button>
          </div>

          {/* Fleet Summary Mini Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full mt-6 pt-6 border-t border-[#ECE7DA]">
            <div className="rounded-2xl bg-[#F5F1E7] border border-[#EEE9DA] p-4 text-center">
              <Battery className="w-5 h-5 text-[#173B5C] mx-auto" />
              <p className="mt-2 text-xs text-[#747B83]">Registered Batteries</p>
              <p className="mt-1 text-2xl font-bold text-[#16263A]">{stats.totalBatteries ?? batteries.length}</p>
            </div>

            <div className="rounded-2xl bg-[#F5F1E7] border border-[#EEE9DA] p-4 text-center">
              <History className="w-5 h-5 text-[#B48611] mx-auto" />
              <p className="mt-2 text-xs text-[#747B83]">Service Records</p>
              <p className="mt-1 text-2xl font-bold text-[#16263A]">{stats.totalServices || 759}</p>
            </div>

            <div className="rounded-2xl bg-[#F5F1E7] border border-[#EEE9DA] p-4 text-center">
              <HeartPulse className="w-5 h-5 text-[#173B5C] mx-auto" />
              <p className="mt-2 text-xs text-[#747B83]">Fleet SoH</p>
              <p className="mt-1 text-2xl font-bold text-[#16263A]">{stats.avgHealth || 92}%</p>
            </div>

            <div className="rounded-2xl bg-[#F5F1E7] border border-[#EEE9DA] p-4 text-center">
              <Award className="w-5 h-5 text-[#B48611] mx-auto" />
              <p className="mt-2 text-xs text-[#747B83]">Active Warranties</p>
              <p className="mt-1 text-2xl font-bold text-[#16263A]">{stats.activeWarranties || 0}</p>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          ACCOUNT + SECURITY
      ====================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <section className="
          rounded-3xl
          bg-[#FFFDF8]
          border border-[#EEE8D8]
          shadow-sm
          overflow-hidden
        ">

          <div className="
            p-6
            border-b border-[#ECE7DA]
            flex items-center gap-3
          ">
            <div className="
              w-11 h-11
              rounded-xl
              bg-[#173B5C]
              flex items-center justify-center
            ">
              <User className="w-5 h-5 text-white" />
            </div>

            <div>
              <h2 className="font-bold text-lg">
                Account Information
              </h2>

              <p className="text-xs text-[#747B83]">
                Personal and organization details
              </p>
            </div>
          </div>

          <div className="p-6 space-y-3">

            <InfoRow
              icon={Mail}
              label="Email"
              value={profile.email || "Not available"}
            />

            <InfoRow
              icon={Phone}
              label="Phone"
              value={profile.phone || "Not available"}
            />


            <InfoRow
              icon={MapPin}
              label="Location"
              value={
                profile.location ||
                "Not available"
              }
            />

            <div className="
              flex items-center justify-between gap-4
              p-4
              rounded-2xl
              bg-[#F5F1E7]
              border border-[#E7E1D3]
            ">

              <div className="flex items-center gap-3">
                <div className="
                  w-9 h-9
                  rounded-lg
                  bg-green-100
                  flex items-center justify-center
                ">
                  <Lock className="w-4 h-4 text-green-700" />
                </div>

                <div>
                  <p className="text-xs font-semibold">
                    Security
                  </p>

                  <p className="text-[11px] text-[#747B83]">
                    Cryptographic Key
                  </p>
                </div>
              </div>

              <span className="
                flex items-center gap-1.5
                px-2.5 py-1
                rounded-full
                bg-green-100
                text-green-700
                text-[11px]
                font-bold
              ">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Valid
              </span>

            </div>

          </div>
        </section>

        {/* ===================================================
            NOTIFICATION SETTINGS
        ==================================================== */}
        <section className="
          rounded-3xl
          bg-[#FFFDF8]
          border border-[#EEE8D8]
          shadow-sm
          overflow-hidden
        ">

          <div className="
            p-6
            border-b border-[#ECE7DA]
            flex items-center gap-3
          ">
            <div className="
              w-11 h-11
              rounded-xl
              bg-yellow-400
              flex items-center justify-center
            ">
              <Bell className="w-5 h-5 text-[#16263A]" />
            </div>

            <div>
              <h2 className="font-bold text-lg">
                Notifications
              </h2>

              <p className="text-xs text-[#747B83]">
                Manage your alerts and updates
              </p>
            </div>
          </div>

          <div className="p-6 space-y-3">

            {notificationOptions.map(
              (item) => (
                <div
                  key={item.key}
                  className="
                    flex items-center justify-between gap-4
                    p-4
                    rounded-2xl
                    bg-[#F5F1E7]
                    border border-[#E7E1D3]
                  "
                >

                  <div className="min-w-0">
                    <p className="font-semibold text-sm">
                      {item.title}
                    </p>

                    <p className="mt-1 text-[11px] text-[#747B83]">
                      {item.description}
                    </p>
                  </div>

                  <button
                    type="button"
                    aria-label={`Toggle ${item.title}`}
                    onClick={() =>
                      toggleNotification(
                        item.key
                      )
                    }
                    className={`
                      shrink-0
                      w-12 h-6
                      rounded-full
                      p-1
                      flex items-center
                      transition-all
                      ${
                        notificationSettings[
                          item.key
                        ]
                          ? "bg-yellow-400 justify-end"
                          : "bg-slate-300 justify-start"
                      }
                    `}
                  >
                    <span className="
                      w-4 h-4
                      rounded-full
                      bg-[#16263A]
                      shadow"
                    />
                  </button>

                </div>
              )
            )}

          </div>
        </section>
      </div>

      {/* =====================================================
          COMPLIANCE CARD
      ====================================================== */}
      <section className="
        rounded-3xl
        bg-[#FFFDF8]
        border border-[#EEE8D8]
        shadow-sm
        p-6 md:p-7
      ">

        <div className="
          flex flex-col md:flex-row
          md:items-center
          md:justify-between
          gap-5
        ">

          <div className="flex items-center gap-4">

            <div className="
              w-12 h-12
              rounded-xl
              bg-[#173B5C]
              flex items-center justify-center
            ">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>

            <div>
              <h2 className="font-bold text-lg">
                EU Battery Passport Compliance
              </h2>

              <p className="mt-1 text-sm text-[#747B83]">
                Digital Product Passport standard
                and operator credentials.
              </p>
            </div>

          </div>

          <div className="
            flex items-center gap-2
            px-4 py-2.5
            rounded-xl
            bg-green-50
            border border-green-200
            text-green-700
            text-sm
            font-bold
          ">
            <CheckCircle2 className="w-4 h-4" />
            Compliance Active
          </div>

        </div>

        <div className="
          grid grid-cols-1 md:grid-cols-3
          gap-4
          mt-6
        ">

          <ComplianceItem
            title="DPP Standard"
            value="EU 2023/1542"
          />

          <ComplianceItem
            title="Passport Version"
            value="DPP v2.4"
          />

          <ComplianceItem
            title="Key Algorithm"
            value="ECDSA P-256"
          />

        </div>
      </section>

      {/* =====================================================
          ACTIVITY LOG
      ====================================================== */}
      <section className="
        rounded-3xl
        bg-[#FFFDF8]
        border border-[#EEE8D8]
        shadow-sm
        overflow-hidden
      ">

        <div className="
          p-6 md:p-7
          border-b border-[#ECE7DA]
          flex flex-col sm:flex-row
          sm:items-center
          sm:justify-between
          gap-4
        ">

          <div className="flex items-center gap-3">

            <div className="
              w-11 h-11
              rounded-xl
              bg-[#173B5C]
              flex items-center justify-center
            ">
              <History className="w-5 h-5 text-white" />
            </div>

            <div>
              <h2 className="font-bold text-lg">
                System Activity
              </h2>

              <p className="text-xs text-[#747B83]">
                Recent passport, scan and service activity
              </p>
            </div>

          </div>

          <span className="
            inline-flex items-center gap-2
            text-xs
            font-semibold
            text-green-700
          ">
            <span className="
              w-2 h-2
              rounded-full
              bg-green-500
            " />

            Live Logging
          </span>

        </div>

        <div className="p-6 md:p-7">

          {profile.activityLogs?.length > 0 ? (
            <div className="space-y-3">

              {profile.activityLogs.map(
                (log) => (
                  <div
                    key={log.id}
                    className="
                      flex items-start
                      justify-between
                      gap-4
                      p-4
                      rounded-2xl
                      bg-[#F5F1E7]
                      border border-[#E7E1D3]
                    "
                  >

                    <div className="flex items-start gap-3">

                      <div className="
                        w-9 h-9
                        rounded-lg
                        bg-white
                        border border-[#E7E1D3]
                        flex items-center justify-center
                        shrink-0
                      ">
                        <FileText className="w-4 h-4 text-[#173B5C]" />
                      </div>

                      <div>
                        <h4 className="text-sm font-bold">
                          {log.action}
                        </h4>

                        <p className="mt-1 text-xs text-[#747B83]">
                          {log.details}
                        </p>
                      </div>

                    </div>

                    <span className="
                      shrink-0
                      text-[10px]
                      font-mono
                      text-[#858C92]
                    ">
                      {log.timestamp}
                    </span>

                  </div>
                )
              )}

            </div>
          ) : (
            <div className="
              py-10
              text-center
              text-[#747B83]
            ">
              <History className="
                w-8 h-8
                mx-auto
                text-[#A0A5AA]
              " />

              <p className="mt-3 font-semibold">
                No activity recorded
              </p>

              <p className="mt-1 text-xs">
                Your system activity will appear here.
              </p>
            </div>
          )}

        </div>
      </section>

      {/* =====================================================
          EDIT PROFILE MODAL
      ====================================================== */}
      <EditProfileModal
        isOpen={isEditModalOpen}
        onClose={() =>
          setIsEditModalOpen(false)
        }
      />

    </div>
  );
};


/* ============================================================
   INFO ROW COMPONENT
============================================================ */

const InfoRow = ({
  icon: Icon,
  label,
  value,
}) => {
  return (
    <div className="
      flex items-center
      justify-between
      gap-4
      p-4
      rounded-2xl
      bg-[#F5F1E7]
      border border-[#E7E1D3]
    ">

      <div className="flex items-center gap-3">

        <div className="
          w-9 h-9
          rounded-lg
          bg-white
          border border-[#E7E1D3]
          flex items-center justify-center
        ">
          <Icon className="w-4 h-4 text-[#173B5C]" />
        </div>

        <span className="text-sm text-[#69717A]">
          {label}
        </span>

      </div>

      <span className="
        text-sm
        font-semibold
        text-[#16263A]
        text-right
        break-all
      ">
        {value}
      </span>

    </div>
  );
};


/* ============================================================
   COMPLIANCE ITEM
============================================================ */

const ComplianceItem = ({
  title,
  value,
}) => {
  return (
    <div className="
      rounded-2xl
      bg-[#F5F1E7]
      border border-[#E7E1D3]
      p-4
    ">

      <p className="text-xs text-[#747B83]">
        {title}
      </p>

      <div className="
        mt-2
        flex items-center
        justify-between
        gap-2
      ">

        <span className="font-bold text-sm">
          {value}
        </span>

        <ChevronRight className="
          w-4 h-4
          text-[#A0A5AA]
        " />

      </div>

    </div>
  );
};


export default UserProfileView;
