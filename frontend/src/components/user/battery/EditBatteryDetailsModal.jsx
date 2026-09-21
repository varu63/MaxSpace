import { useState } from "react";
import { Modal, ModalHeader } from "../../common/Modal";
import { Save, PlusCircle, X, Factory, MapPin, FileText } from "lucide-react";
import { useBattery } from "../../../context/BatteryContext";

const WARRANTY_STATUSES = ["Active", "Expiring Soon", "Expired", "Not Covered"];

const inputClass =
  "w-full h-11 px-4 rounded-xl bg-[#FFFDF8] border border-[#E7E1D3] outline-none focus:border-[#173B5C] text-sm";

const EditBatteryDetailsModal = ({ battery, isOpen, onClose }) => {
  const { updateBattery } = useBattery();

  const [form, setForm] = useState(() => initialForm(battery));
  const [recycledRows, setRecycledRows] = useState(() =>
    rowsFromRecycled(battery?.recycledContent || {})
  );
  const [submitting, setSubmitting] = useState(false);
  const [prevOpen, setPrevOpen] = useState(isOpen);

  if (isOpen && !prevOpen) {
    setPrevOpen(true);
    setSubmitting(false);
    setForm(initialForm(battery));
    setRecycledRows(rowsFromRecycled(battery?.recycledContent || {}));
  } else if (!isOpen && prevOpen) {
    setPrevOpen(false);
  }

  if (!isOpen) return null;

  const set = (field) => (event) =>
    setForm((previous) => ({ ...previous, [field]: event.target.value }));

  const setWarranty = (field) => (event) =>
    setForm((previous) => ({
      ...previous,
      warranty: { ...previous.warranty, [field]: event.target.value },
    }));

  const handleCompliance = (event) =>
    setForm((previous) => ({
      ...previous,
      complianceStandards: event.target.value,
    }));

  const updateRecycledRow = (index, field) => (event) =>
    setRecycledRows((previous) =>
      previous.map((row, i) => (i === index ? { ...row, [field]: event.target.value } : row))
    );

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);

    const recycledContent = {};
    recycledRows.forEach((row) => {
      const material = row.material.trim();
      const percent = Number(row.percent);
      if (material && percent >= 0) recycledContent[material] = percent;
    });

    const payload = {
      manufacturer: form.manufacturer.trim() || null,
      assemblyLocation: form.assemblyLocation.trim() || null,
      warranty:
        form.warranty.status || form.warranty.provider || form.warranty.certificateNumber
          ? form.warranty
          : {},
      complianceStandards: form.complianceStandards
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      dismantlingManual: form.dismantlingManual.trim() || null,
      recycledContent,
    };

    const updated = await updateBattery(battery.id, payload);
    setSubmitting(false);
    if (updated) {
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} z={9999}>
      <div className="relative w-full max-w-3xl max-h-[95vh] flex flex-col bg-[#FFFDF8] rounded-2xl shadow-2xl overflow-hidden">
        <ModalHeader title="Edit Battery Details" subtitle="MANUFACTURING, WARRANTY & COMPLIANCE" onClose={onClose} />

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 sm:p-8">
          <div className="rounded-2xl bg-[#FBF1C9] border border-[#F0E6C8] p-4 text-sm text-[#16263A] mb-6">
            <div className="flex items-start gap-2">
              <FileText className="w-4 h-4 text-[#B48611] mt-0.5 shrink-0" />
              <p>
                These fields are optional and may be empty for some batteries.
                Enter the real values here — they are saved to the battery and shown immediately.
              </p>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-bold text-[#173B5C] mb-3 flex items-center gap-2">
              <Factory className="w-4 h-4" /> Manufacturing &amp; Origin
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-2" htmlFor="manufacturer">
                  Manufacturer
                </label>
                <input
                  id="manufacturer"
                  type="text"
                  value={form.manufacturer}
                  onChange={set("manufacturer")}
                  placeholder="e.g. MaxVolt Energy Ltd."
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2" htmlFor="assemblyLocation">
                  Assembly Location
                </label>
                <input
                  id="assemblyLocation"
                  type="text"
                  value={form.assemblyLocation}
                  onChange={set("assemblyLocation")}
                  placeholder="e.g. Noida Plant, Uttar Pradesh, India"
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-bold text-[#173B5C] mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" /> Warranty Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-2" htmlFor="warrantyStatus">
                  Status
                </label>
                <select
                  id="warrantyStatus"
                  value={form.warranty.status}
                  onChange={setWarranty("status")}
                  className={inputClass}
                >
                  <option value="">—</option>
                  {WARRANTY_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2" htmlFor="warrantyProvider">
                  Provider
                </label>
                <input
                  id="warrantyProvider"
                  type="text"
                  value={form.warranty.provider}
                  onChange={setWarranty("provider")}
                  placeholder="e.g. MaxVolt Warranty Services"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2" htmlFor="warrantyStart">
                  Start Date
                </label>
                <input
                  id="warrantyStart"
                  type="date"
                  value={form.warranty.startDate}
                  onChange={setWarranty("startDate")}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2" htmlFor="warrantyEnd">
                  End Date
                </label>
                <input
                  id="warrantyEnd"
                  type="date"
                  value={form.warranty.endDate}
                  onChange={setWarranty("endDate")}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2" htmlFor="warrantyTerms">
                  Terms
                </label>
                <input
                  id="warrantyTerms"
                  type="text"
                  value={form.warranty.terms}
                  onChange={setWarranty("terms")}
                  placeholder="e.g. 3 years or 1500 cycles"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2" htmlFor="warrantyCertificate">
                  Certificate
                </label>
                <input
                  id="warrantyCertificate"
                  type="text"
                  value={form.warranty.certificateNumber}
                  onChange={setWarranty("certificateNumber")}
                  placeholder="e.g. MW-2026-0001"
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-bold text-[#173B5C] mb-3">Compliance Standards</h3>
            <input
              id="complianceStandards"
              type="text"
              value={form.complianceStandards}
              onChange={handleCompliance}
              placeholder="e.g. IEC 62619, UN 38.3, ISO 26262, EU Reg 2023/1542"
              className={inputClass}
            />
            <p className="mt-1 text-xs text-[#747B83]">Comma-separated list of standards.</p>
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-bold text-[#173B5C] mb-3">Recycled Content</h3>
            <div className="space-y-3">
              {recycledRows.map((row, index) => (
                <div key={index} className="flex items-center gap-3">
                  <input
                    type="text"
                    value={row.material}
                    onChange={updateRecycledRow(index, "material")}
                    placeholder="Material (e.g. lithium)"
                    className="flex-1 h-11 px-4 rounded-xl bg-[#FFFDF8] border border-[#E7E1D3] outline-none focus:border-[#173B5C] text-sm"
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={row.percent}
                    onChange={updateRecycledRow(index, "percent")}
                    placeholder="%"
                    className="w-24 h-11 px-4 rounded-xl bg-[#FFFDF8] border border-[#E7E1D3] outline-none focus:border-[#173B5C] text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setRecycledRows((p) => p.filter((_, i) => i !== index))}
                    className="p-2 text-[#747B83] hover:text-red-500 transition"
                    aria-label="Remove material"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setRecycledRows((previous) => [...previous, { material: "", percent: "" }])}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#173B5C] hover:underline"
            >
              <PlusCircle className="w-4 h-4" /> Add material
            </button>
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-bold text-[#173B5C] mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Dismantling &amp; Safety
            </h3>
            <textarea
              id="dismantlingManual"
              value={form.dismantlingManual}
              onChange={set("dismantlingManual")}
              rows={3}
              placeholder="Disassembly and safety instructions for this battery."
              className="w-full px-4 py-3 rounded-xl bg-[#FFFDF8] border border-[#E7E1D3] outline-none focus:border-[#173B5C] text-sm resize-y"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-12 rounded-xl bg-[#F5F1E7] text-[#747B83] font-semibold hover:bg-[#E7E1D3] transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 h-12 rounded-xl bg-[#173B5C] text-white font-semibold flex items-center justify-center gap-2 hover:bg-[#102F4A] transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Details
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

const initialForm = (battery) => ({
  manufacturer: battery?.manufacturer || "",
  assemblyLocation: battery?.assemblyLocation || "",
  warranty: {
    status: battery?.warranty?.status && battery.warranty.status !== "N/A" ? battery.warranty.status : "",
    provider: battery?.warranty?.provider || "",
    startDate: battery?.warranty?.startDate || "",
    endDate: battery?.warranty?.endDate || "",
    terms: battery?.warranty?.terms || "",
    certificateNumber: battery?.warranty?.certificateNumber || "",
  },
  complianceStandards: Array.isArray(battery?.complianceStandards)
    ? battery.complianceStandards.join(", ")
    : "",
  dismantlingManual: battery?.dismantlingManual || "",
});

const rowsFromRecycled = (recycledContent) => {
  const entries = Object.entries(recycledContent || {});
  return entries.length
    ? entries.map(([material, percent]) => ({ material, percent: String(percent) }))
    : [{ material: "", percent: "" }];
};

export default EditBatteryDetailsModal;