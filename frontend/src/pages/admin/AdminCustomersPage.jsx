import React, { useState, useMemo } from "react";
import { Search, Mail, Users, Calendar, Wrench, CheckCircle2 } from "lucide-react";

import { useAdmin } from "../../context/AdminContext";
import { PageHeader, Card } from "../../components/common";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import StatusBadge from "../../components/admin/StatusBadge";
import { formatDate } from "../../components/admin/adminUtils";

const AdminCustomersPage = () => {
  const { customers, loading } = useAdmin();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let list = [...customers];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          (c.name || "").toLowerCase().includes(q) ||
          (c.email || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [customers, search]);

  if (loading && customers.length === 0) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Users}
        title="Customers"
        subtitle={`${customers.length} registered customer accounts`}
      />

      {/* Search */}
      <div className="flex items-center gap-2.5 px-3.5 rounded-xl bg-[#FFFDF8] border border-[#E7E1D3] max-w-md focus-within:border-[#173B5C] transition-colors">
        <Search className="w-4 h-4 text-[#8A9096] shrink-0" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full py-3 bg-transparent text-sm text-[#16263A] placeholder:text-[#8A9096] focus:outline-none"
        />
      </div>

      {/* Table */}
      <Card padded={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F5F1E7] text-[#747B83] text-[11px] font-bold uppercase tracking-wider">
                <th className="px-5 py-3 text-left">Customer</th>
                <th className="px-5 py-3 text-left">Email</th>
                <th className="px-5 py-3 text-left">Services</th>
                <th className="px-5 py-3 text-left">Last Service</th>
                <th className="px-5 py-3 text-left">Account Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEE9DA]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-5 py-12 text-center text-[#747B83]">
                    No customers found.
                  </td>
                </tr>
              ) : (
                filtered.map((customer) => (
                  <tr key={customer.id} className="hover:bg-[#F5F1E7]/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#173B5C] text-[#FBF1C9] flex items-center justify-center text-xs font-black shrink-0">
                          {customer.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <span className="font-semibold text-[#16263A]">
                          {customer.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="flex items-center gap-1.5 text-xs text-[#747B83]">
                        <Mail className="w-3.5 h-3.5 text-[#8A7A4A]" />
                        {customer.email}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#16263A]">
                        <Wrench className="w-3.5 h-3.5 text-[#B48611]" />
                        {customer.serviceCount}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {customer.lastService ? (
                        <div>
                          <span className="text-xs font-semibold text-[#16263A] font-mono">
                            {customer.lastService.ticketNumber}
                          </span>
                          <span className="block text-[11px] text-[#8A9096] flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3" />
                            {formatDate(customer.lastService.date)}
                          </span>
                          <span className="mt-1 block">
                            <StatusBadge status={customer.lastService.status} />
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-[#8A9096]">No services yet</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className="chip border bg-green-50 text-green-700 border-green-200">
                        <CheckCircle2 className="w-3 h-3" />
                        {customer.accountStatus}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default AdminCustomersPage;