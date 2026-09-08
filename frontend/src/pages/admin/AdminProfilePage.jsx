import React from "react";
import { useNavigate } from "react-router-dom";
import { Mail, UserCircle, ShieldCheck, LogOut, IdCard } from "lucide-react";

import { useAdmin } from "../../context/AdminContext";
import { PageHeader, Card } from "../../components/common";
import { getAvatarText } from "../../components/admin/adminUtils";

const AdminProfilePage = () => {
  const { adminUser, adminLogout } = useAdmin();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await adminLogout();
    navigate("/admin/login", { replace: true });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={UserCircle}
        title="Admin Profile"
        subtitle="Your administrator account details"
      />

      <div className="max-w-2xl">
        <Card>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-[#173B5C] text-[#FBF1C9] flex items-center justify-center text-xl font-black">
              {getAvatarText(adminUser?.name)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#16263A]">
                {adminUser?.name || "Admin"}
              </h2>
              <span className="chip border bg-[#FBF1C9] text-[#A77A08] border-[#F0E6C8] mt-1">
                <ShieldCheck className="w-3 h-3" />
                ADMIN
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {[
              { label: "Name", value: adminUser?.name || "—", icon: IdCard },
              { label: "Email", value: adminUser?.email || "—", icon: Mail },
              { label: "Role", value: "Administrator", icon: ShieldCheck },
            ].map((row) => {
              const Icon = row.icon;
              return (
                <div
                  key={row.label}
                  className="rounded-2xl bg-[#F5F1E7] border border-[#E7E1D3] p-4 flex items-center gap-3"
                >
                  <div className="w-9 h-9 rounded-lg bg-[#FFFDF8] border border-[#E7E1D3] flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-[#173B5C]" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-[#8A9096] uppercase tracking-wide">
                      {row.label}
                    </p>
                    <p className="text-sm font-semibold text-[#16263A]">
                      {row.value}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 pt-6 border-t border-[#EEE9DA]">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-50 text-red-700 border border-red-200 font-bold text-sm hover:bg-red-100 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdminProfilePage;