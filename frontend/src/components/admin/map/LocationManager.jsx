/* ============================================================
   LOCATION MANAGER · admin only
   The real-location registry behind the map: list recorded rows,
   record/update a battery's location, view the append-only movement
   history, and untrack a battery (delete). Every create/delete
   requires the ADMIN token — the backend validates input and writes
   the audit history row. Nothing auto-generates coordinates.
   ============================================================ */
import { useEffect, useMemo, useState } from "react";
import {
  History,
  MapPinPlus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  fetchMapLocations,
  fetchMapLocation,
  saveMapLocation,
  deleteMapLocation,
} from "../../../services";
import { LOCATION_TYPES } from "../../common/map/mapConfig";

const inputClass =
  "w-full text-[12px] font-semibold bg-[#FFFDF8] border border-[#E7E1D3] rounded-xl px-3 py-2 text-[#16263A] outline-none focus:border-[#B48611]";

const field = (label, node) => (
  <label className="flex flex-col gap-1 min-w-0">
    <span className="text-[10px] font-bold uppercase tracking-wider text-[#8A9096]">{label}</span>
    {node}
  </label>
);

const EMPTY_FORM = {
  siteName: "",
  locationType: "Warehouse",
  address: "",
  city: "",
  state: "",
  country: "",
  latitude: "",
  longitude: "",
  reason: "",
};

const LocationManager = ({ onChanged }) => {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [listLoading, setListLoading] = useState(true);
  const [detail, setDetail] = useState(null); // { location, history }
  const [form, setForm] = useState(EMPTY_FORM);
  const [detailBatteryId, setDetailBatteryId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const loadList = async (term = "") => {
    setListLoading(true);
    try {
      const res = await fetchMapLocations({ search: term, page: 1, limit: 100, sort: "updatedAt", order: "desc" });
      setRows(res?.data || []);
    } catch (err) {
      setMessage({ tone: "error", text: err.message });
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = () => {
    loadList(search);
    if (onChanged) onChanged();
  };

  const openDetail = async (batteryId) => {
    setDetailBatteryId(batteryId);
    setMessage(null);
    try {
      const res = await fetchMapLocation(batteryId);
      setDetail(res?.data || null);
    } catch (err) {
      setDetail(null);
      setMessage({ tone: "error", text: err.message });
    }
  };

  const closeDetail = () => {
    setDetail(null);
    setDetailBatteryId("");
  };

  const saveForm = async (e) => {
    e.preventDefault();
    const target = detailBatteryId.trim();
    if (!target) {
      setMessage({ tone: "error", text: "Enter the battery ID to record its location." });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const payload = {
        siteName: form.siteName || undefined,
        locationType: form.locationType,
        address: form.address || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        country: form.country || undefined,
        reason: form.reason || undefined,
      };
      if (form.latitude !== "" && form.longitude !== "") {
        payload.latitude = Number(form.latitude);
        payload.longitude = Number(form.longitude);
      }
      await saveMapLocation(target, payload);
      setMessage({ tone: "ok", text: `Location recorded for ${target}.` });
      setForm(EMPTY_FORM);
      setDetailBatteryId("");
      setDetail(null);
      refresh();
    } catch (err) {
      setMessage({ tone: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const untrack = async (batteryId) => {
    if (!window.confirm(`Remove the recorded location of ${batteryId}? This does not delete the battery.`)) return;
    setBusy(true);
    setMessage(null);
    try {
      await deleteMapLocation(batteryId);
      setMessage({ tone: "ok", text: `Untracked ${batteryId}.` });
      if (detailBatteryId === batteryId) {
        setDetail(null);
        setDetailBatteryId("");
      }
      refresh();
    } catch (err) {
      setMessage({ tone: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const history = useMemo(
    () =>
      (detail?.history || []).map((h, i) => (
        <li key={`${h.id}-${i}`} className="border border-[#EEE9DA] rounded-xl p-3 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-black uppercase tracking-wide text-[#8A9096]">
              Move {detail?.history?.length - i}
            </p>
            <span className="text-[10px] font-mono text-[#747B83]">
              {h.movedAt ? new Date(h.movedAt).toLocaleString() : "—"}
            </span>
          </div>
          <p className="text-[12px] font-semibold text-[#16263A]">
            {h.previousLocation ? locLine(h.previousLocation) : "No previous location"}
            <span className="text-[#8A9096] mx-1.5">→</span>
            {h.newLocation ? locLine(h.newLocation) : "—"}
          </p>
          <p className="text-[11px] text-[#747B83]">
            {h.reason ? `Reason: ${h.reason}` : "No reason recorded"}
            {h.createdBy ? ` · by ${h.createdBy}` : ""}
          </p>
        </li>
      )),
    [detail]
  );

  return (
    <div className="panel p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-black text-[#16263A] flex items-center gap-2">
            <MapPinPlus className="w-5 h-5 text-[#B48611]" />
            Manage Battery Locations
          </h2>
          <p className="text-[12px] text-[#747B83]">
            Record a battery&apos;s real locations and track its movement history. Coordinates are never generated automatically.
          </p>
        </div>
        {message && (
          <span
            className={`text-[12px] font-bold px-3 py-1.5 rounded-xl border ${
              message.tone === "ok"
                ? "bg-green-50 text-green-800 border-green-200"
                : "bg-red-50 text-red-800 border-red-200"
            }`}
          >
            {message.text}
          </span>
        )}
      </div>

      {/* Record / update form */}
      <form onSubmit={saveForm} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
        <div className="sm:col-span-2">
          {field("Battery ID (required)", <input className={inputClass} value={detailBatteryId} onChange={(e) => setDetailBatteryId(e.target.value)} placeholder="e.g. MVAE0014036" />)}
        </div>
        {field("Site name", <input className={inputClass} value={form.siteName} onChange={(e) => setForm({ ...form, siteName: e.target.value })} />)}
        {field("Location type", (
          <select className={inputClass} value={form.locationType} onChange={(e) => setForm({ ...form, locationType: e.target.value })}>
            {LOCATION_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        ))}
        {field("Address", <input className={inputClass} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />)}
        {field("City", <input className={inputClass} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />)}
        {field("State", <input className={inputClass} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />)}
        {field("Country", <input className={inputClass} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />)}
        {field("Latitude", <input className={inputClass} type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder="optional pair" />)}
        {field("Longitude", <input className={inputClass} type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder="optional pair" />)}
        {field("Reason (audit)", <input className={inputClass} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="why this location change" />)}
        <button
          type="submit"
          disabled={busy}
          className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#173B5C] text-[#FBF1C9] text-[12px] font-bold hover:bg-[#102F4A] transition-colors disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          {busy ? "Saving…" : "Record"}
        </button>
      </form>

      {/* Registry list + detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-[#8A9096] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadList(search)}
              placeholder="Filter registry by battery / site / city…"
              className={`${inputClass} pl-9`}
            />
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {listLoading ? (
              <p className="text-[12px] font-semibold text-[#747B83]">Loading registered locations…</p>
            ) : rows.length === 0 ? (
              <p className="text-[12px] font-semibold text-[#747B83]">No locations recorded yet.</p>
            ) : (
              rows.map((row) => (
                <div key={`${row.batteryId}-${row.id}`} className="border border-[#EEE9DA] rounded-xl p-3 flex items-center justify-between gap-2 soft-row">
                  <button type="button" onClick={() => openDetail(row.batteryId)} className="text-left min-w-0 flex-1">
                    <p className="font-mono font-black text-[12px] text-[#173B5C] truncate">{row.batteryId}</p>
                    <p className="text-[11px] text-[#747B83] truncate">
                      {row.siteName || "No site"} · {[row.city, row.state, row.country].filter(Boolean).join(", ") || "No address"}
                      {row.latitude !== null ? ` · ${row.latitude.toFixed(3)}, ${row.longitude.toFixed(3)}` : ""}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => untrack(row.batteryId)}
                    disabled={busy}
                    className="p-2 rounded-lg text-red-500 hover:bg-red-50 border border-red-200 disabled:opacity-50"
                    aria-label={`Untrack ${row.batteryId}`}
                    title="Untrack (delete location)"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-3">
          {detail ? (
            <div className="border border-[#E7E1D3] rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono font-black text-[13px] text-[#173B5C]">{detail.batteryId}</p>
                <button type="button" onClick={closeDetail} className="p-1.5 rounded-lg text-[#747B83] hover:bg-[#F5F1E7]" aria-label="Close detail">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
                <p className="text-[#747B83] font-semibold">Site</p>
                <p className="text-[#16263A] font-bold text-right">{detail.siteName || "—"}</p>
                <p className="text-[#747B83] font-semibold">Address</p>
                <p className="text-[#16263A] font-bold text-right">{detail.address || "—"}</p>
                <p className="text-[#747B83] font-semibold">City / State</p>
                <p className="text-[#16263A] font-bold text-right">{[detail.city, detail.state].filter(Boolean).join(", ") || "—"}</p>
                <p className="text-[#747B83] font-semibold">Country</p>
                <p className="text-[#16263A] font-bold text-right">{detail.country || "—"}</p>
                <p className="text-[#747B83] font-semibold">Type</p>
                <p className="text-[#16263A] font-bold text-right">{detail.locationType || "—"}</p>
                <p className="text-[#747B83] font-semibold">Coordinates</p>
                <p className="text-[#16263A] font-bold text-right font-mono">
                  {detail.latitude !== null ? `${detail.latitude}, ${detail.longitude}` : "Address only"}
                </p>
              </div>
              <p className="text-[10px] text-[#747B83] font-medium">
                Last updated {detail.updatedAt ? new Date(detail.updatedAt).toLocaleString() : "—"}
              </p>
            </div>
          ) : (
            <div className="border border-dashed border-[#E7E1D3] rounded-2xl p-4 text-[12px] text-[#747B83] font-semibold flex items-center gap-2">
              <History className="w-4 h-4 shrink-0" />
              Select a battery to see its location and movement history.
            </div>
          )}

          {detail && (
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-[#8A9096] mb-2">Movement History</p>
              {history.length === 0 ? (
                <p className="text-[12px] font-semibold text-[#747B83]">No moves recorded.</p>
              ) : (
                <ul className="space-y-2 max-h-56 overflow-y-auto pr-1">{history}</ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const locLine = (loc) =>
  [loc.siteName, [loc.city, loc.state, loc.country].filter(Boolean).join(", ")]
    .filter(Boolean)
    .join(" · ") ||
  (loc.latitude !== null ? `${loc.latitude}, ${loc.longitude}` : "—");

export default LocationManager;