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
    <div className="space-y-8">
      <PageHeader
        icon={UserCircle}
        title="Admin Profile"
        subtitle="Manage your administrator account credentials and access permissions"
      />

      <div className="max-w-2xl">
        <Card>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-[#173B5C] text-[#FBF1C9] flex items-center justify-center text-xl font-black shrink-0 shadow-sm">
              {getAvatarText(adminUser?.name)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#16263A]">
                {adminUser?.name || "Admin User"}
              </h2>
              <span className="chip border bg-[#FBF1C9] text-[#A77A08] border-[#F0E6C8] mt-1.5 inline-flex items-center gap-1 font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                SYSTEM ADMINISTRATOR
              </span>
            </div>
          </div>

          <div className="space-y-3.5">
            {[
              { label: "Full Name", value: adminUser?.name || "—", icon: IdCard },
              { label: "Email Address", value: adminUser?.email || "—", icon: Mail },
              { label: "Assigned Role", value: "Primary Administrator", icon: ShieldCheck },
            ].map((row) => {
              const Icon = row.icon;
              return (
                <div
                  key={row.label}
                  className="rounded-2xl bg-[#F5F1E7] border border-[#E7E1D3] p-4 flex items-center gap-3.5"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#FFFDF8] border border-[#E7E1D3] flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-[#173B5C]" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#8A9096]">
                      {row.label}
                    </p>
                    <p className="text-sm font-semibold text-[#16263A] mt-0.5">
                      {row.value}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 pt-6 border-t border-[#EEE9DA]">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-red-50 text-red-700 border border-red-200 font-bold text-sm hover:bg-red-100 hover:border-red-300 transition-colors shadow-sm"
            >
              <LogOut className="w-4 h-4" />
              Sign Out of Admin Portal
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdminProfilePage;
