import { useState, useEffect } from "react";
import { UserRound, Search, X, Mail, KeyRound, Clock } from "lucide-react";

import { useAdmin } from "../../context/AdminContext";
import { PageHeader, Card, Pagination } from "../../components/common";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import { formatDate } from "../../components/admin/adminUtils";
import { fetchUsersPaginated, getErrorMessage } from "../../services/adminApi";

const roleStyles = {
  ADMIN: "bg-[#173B5C] text-[#FBF1C9] border-[#173B5C]",
  EMPLOYEE: "bg-amber-50 text-amber-800 border-amber-300",
  USER: "bg-green-50 text-green-700 border-green-200",
};

const AdminUsersPage = () => {
  const { loading: contextLoading } = useAdmin();
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState("");

  const total = pagination?.total ?? users.length;

  const fetchPage = async (nextPage = 1, opts = {}) => {
    setFetching(true);
    try {
      const result = await fetchUsersPaginated({
        page: nextPage,
        limit: 10,
        search: opts.search !== undefined ? opts.search : search,
      });
      setUsers(result.data || []);
      setPagination(result.pagination || null);
      setError("");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchPage(1, { search }), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  if ((fetching || contextLoading) && users.length === 0) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        icon={UserRound}
        title="Users"
        subtitle={`${total} account${total === 1 ? "" : "s"} across all roles — read-only registry`}
      />

      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A9096]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, username, email or role…"
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

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
          {error}
        </div>
      )}

      <Card padded={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F5F1E7] text-[#747B83] text-xs font-semibold uppercase tracking-wider border-b border-[#EEE9DA]">
                <th className="px-6 py-4 text-left">Account</th>
                <th className="px-6 py-4 text-left">Role</th>
                <th className="px-6 py-4 text-left">Username</th>
                <th className="px-6 py-4 text-left">Full Name</th>
                <th className="px-6 py-4 text-left">Email</th>
                <th className="px-6 py-4 text-left">Technician</th>
                <th className="px-6 py-4 text-left">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEE9DA]">
              {users.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-14 text-center text-[#747B83]">
                    <UserRound className="w-8 h-8 text-[#8A9096] mx-auto mb-2 opacity-50" />
                    <p className="font-semibold text-sm">No accounts found</p>
                    <p className="text-xs text-[#8A9096] mt-0.5">Try adjusting your search query</p>
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-[#F5F1E7]/60 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-2xl bg-[#173B5C] text-[#FBF1C9] flex items-center justify-center text-xs font-black shrink-0">
                          {String(user.name || "?")
                            .split(/\s+/)
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-[#16263A]">{user.name || "—"}</p>
                          <p className="text-[11px] text-[#8A9096] font-mono">{user.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${roleStyles[user.role] || "bg-[#F5F1E7] text-[#16263A]"}`}>
                        {user.role || "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 text-xs font-mono text-[#16263A]">
                        <KeyRound className="w-3.5 h-3.5 text-[#8A7A4A]" />
                        {user.username || "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-[#747B83]">{user.fullName || user.name || "—"}</td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-2 text-xs text-[#747B83]">
                        <Mail className="w-3.5 h-3.5 text-[#8A7A4A] shrink-0" />
                        {user.email || "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {user.servicePerson ? (
                        <span className="text-xs">
                          <p className="font-bold text-[#16263A]">{user.servicePerson.name || user.name}</p>
                          <p className="text-[11px] text-[#8A9096]">
                            {user.servicePerson.technicianId} · {user.servicePerson.status}
                          </p>
                        </span>
                      ) : (
                        <span className="text-xs text-[#8A9096]">Not a technician</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-1.5 text-xs text-[#747B83]">
                        <Clock className="w-3.5 h-3.5 text-[#8A7A4A]" />
                        {formatDate(user.createdAt)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Pagination pagination={pagination} onPageChange={fetchPage} />
    </div>
  );
};

export default AdminUsersPage;