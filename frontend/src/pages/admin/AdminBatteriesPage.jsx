import { useState, useEffect, useMemo } from "react";
import { Battery, Search, X, ExternalLink } from "lucide-react";

import { useAdmin } from "../../context/AdminContext";
import { PageHeader, Card, Pagination } from "../../components/common";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import Modal from "../../components/common/Modal";
import { formatDate } from "../../components/admin/adminUtils";
import { fetchAdminBatteriesPaginated, getErrorMessage } from "../../services/adminApi";

const humanize = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

const AdminBatteriesPage = () => {
  const { loading: contextLoading } = useAdmin();
  const [search, setSearch] = useState("");
  const [batteries, setBatteries] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState(null);

  const total = pagination?.total ?? batteries.length;

  const fetchPage = async (nextPage = 1, opts = {}) => {
    setFetching(true);
    try {
      const result = await fetchAdminBatteriesPaginated({
        page: nextPage,
        limit: 10,
        search: opts.search !== undefined ? opts.search : search,
      });
      setBatteries(result.data || []);
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

  const detailRows = useMemo(() => {
    if (!detail) return [];
    const skip = ["owner", "healthHistory"];
    return Object.entries(detail)
      .filter(([key]) => !skip.includes(key))
      .map(([key, value]) => ({ key, value: humanize(value) }));
  }, [detail]);

  if ((fetching || contextLoading) && batteries.length === 0) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        icon={Battery}
        title="Batteries"
        subtitle={`${total} registered batter${total === 1 ? "y" : "ies"} in the fleet — read-only registry`}
      />

      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A9096]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, barcode, serial, owner…"
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
                <th className="px-6 py-4 text-left">Battery</th>
                <th className="px-6 py-4 text-left">Barcode / Serial</th>
                <th className="px-6 py-4 text-left">Owner</th>
                <th className="px-6 py-4 text-left">Chemistry</th>
                <th className="px-6 py-4 text-left">SoH</th>
                <th className="px-6 py-4 text-left">Capacity</th>
                <th className="px-6 py-4 text-left">Created</th>
                <th className="px-6 py-4 text-left"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEE9DA]">
              {batteries.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-14 text-center text-[#747B83]">
                    <Battery className="w-8 h-8 text-[#8A9096] mx-auto mb-2 opacity-50" />
                    <p className="font-semibold text-sm">No batteries found</p>
                    <p className="text-xs text-[#8A9096] mt-0.5">Try adjusting your search query</p>
                  </td>
                </tr>
              ) : (
                batteries.map((batt) => (
                  <tr key={batt.id} className="hover:bg-[#F5F1E7]/60 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-2xl bg-[#173B5C] text-[#FBF1C9] flex items-center justify-center text-xs font-black shrink-0">
                          {String(batt.name || "?")
                            .split(/\s+/)
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-[#16263A]">
                            {batt.name || "—"}
                          </p>
                          <p className="text-[11px] text-[#8A9096] font-mono">{batt.id}</p>
                          {batt.modelName && batt.modelName !== batt.name && (
                            <p className="text-[11px] text-[#8A7A4A]">{batt.modelName}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs font-mono text-[#16263A]">{batt.barcode || "—"}</p>
                      <p className="text-[11px] font-mono text-[#8A9096]">{batt.serialNumber || "—"}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs font-bold text-[#16263A]">{batt.ownerName || "—"}</p>
                      <p className="text-[11px] text-[#8A9096]">{batt.ownerEmail || "no owner"}</p>
                    </td>
                    <td className="px-6 py-4 text-xs text-[#747B83]">{batt.chemistry || "—"}</td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-[#16263A]">
                        {batt.stateOfHealth != null ? `${batt.stateOfHealth}%` : "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-[#747B83]">
                      {batt.capacity || (batt.capacityKwh != null ? `${batt.capacityKwh} kWh` : "—")}
                    </td>
                    <td className="px-6 py-4 text-xs text-[#747B83]">{formatDate(batt.createdAt)}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => setDetail(batt)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#173B5C] hover:text-[#0D2B45]"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> View all
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Pagination pagination={pagination} onPageChange={fetchPage} />

      {detail && (
        <Modal isOpen={!!detail} onClose={() => setDetail(null)} z={50}>
          <div className="w-full max-w-2xl min-h-full flex flex-col justify-center py-10">
            <div className="relative w-full bg-[#FFFDF8] rounded-3xl shadow-2xl p-6">
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <h3 className="text-lg font-black text-[#173B5C]">Battery Details</h3>
                  <p className="text-xs text-[#8A9096] mt-0.5 font-mono">{detail.id}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDetail(null)}
                  className="text-[#8A9096] hover:text-[#16263A]"
                  aria-label="Close details"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {detail.owner && (
                <div className="mb-4 rounded-2xl border border-[#E7E1D3] bg-[#F5F1E7] px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wider text-[#747B83] font-semibold mb-1">
                    Owner
                  </p>
                  <p className="text-sm font-bold text-[#16263A]">
                    {detail.owner.name || "—"}
                    <span className="font-normal text-[#8A9096]"> · {detail.owner.email || "—"}</span>
                  </p>
                  <p className="text-[11px] text-[#8A9096] font-mono">
                    {detail.owner.id} · username: {detail.owner.username || "—"} · role: {detail.owner.role || "—"}
                  </p>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                {detailRows.map((row) => (
                  <div key={row.key} className="border-b border-[#EEE9DA] pb-2">
                    <p className="text-[11px] uppercase tracking-wider text-[#747B83] font-semibold">
                      {row.key.replace(/[A-Z]/g, (m) => " " + m.toLowerCase())}
                    </p>
                    <p className="text-sm text-[#16263A] break-words">{row.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AdminBatteriesPage;