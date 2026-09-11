import { useState, useMemo } from "react";
import { Search, Mail, Users, Calendar, Wrench, CheckCircle2, X } from "lucide-react";

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
    <div className="space-y-8">
      <PageHeader
        icon={Users}
        title="Customers"
        subtitle={`${customers.length} registered customer accounts`}
      />

      {/* Search & Filter bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A9096]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by customer name or email…"
          className="w-full h-12 pl-11 pr-10 rounded-2xl bg-[#FFFDF8] border border-[#E7E1D3] outline-none text-sm text-[#16263A] placeholder:text-[#8A9096] focus:border-[#173B5C] transition shadow-sm"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8A9096] hover:text-[#16263A]"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Table */}
      <Card padded={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F5F1E7] text-[#747B83] text-xs font-semibold uppercase tracking-wider border-b border-[#EEE9DA]">
                <th className="px-6 py-4 text-left">Customer</th>
                <th className="px-6 py-4 text-left">Email Address</th>
                <th className="px-6 py-4 text-left">Total Services</th>
                <th className="px-6 py-4 text-left">Last Service</th>
                <th className="px-6 py-4 text-left">Account Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEE9DA]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-14 text-center text-[#747B83]">
                    <Users className="w-8 h-8 text-[#8A9096] mx-auto mb-2 opacity-50" />
                    <p className="font-semibold text-sm">No customers found</p>
                    <p className="text-xs text-[#8A9096] mt-0.5">Try adjusting your search query</p>
                  </td>
                </tr>
              ) : (
                filtered.map((customer) => (
                  <tr key={customer.id} className="hover:bg-[#F5F1E7]/60 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-2xl bg-[#173B5C] text-[#FBF1C9] flex items-center justify-center text-xs font-black shrink-0">
                          {customer.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <span className="font-bold text-sm text-[#16263A]">
                          {customer.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-2 text-xs text-[#747B83]">
                        <Mail className="w-3.5 h-3.5 text-[#8A7A4A] shrink-0" />
                        {customer.email}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#16263A] bg-[#F5F1E7] px-3 py-1.5 rounded-xl border border-[#E7E1D3]">
                        <Wrench className="w-3.5 h-3.5 text-[#B48611]" />
                        {customer.serviceCount} {customer.serviceCount === 1 ? 'service' : 'services'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {customer.lastService ? (
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-[#16263A] font-mono">
                            {customer.lastService.ticketNumber}
                          </span>
                          <span className="text-[11px] text-[#8A9096] flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-[#8A7A4A]" />
                            {formatDate(customer.lastService.date)}
                          </span>
                          <div>
                            <StatusBadge status={customer.lastService.status} />
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-[#8A9096]">No services booked</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
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
