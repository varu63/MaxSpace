import { useState } from "react";
import { Modal, ModalHeader } from "../../common/Modal";
import { Battery, PlusCircle } from "lucide-react";
import { useBattery } from "../../../context/BatteryContext";

const BATTERY_TYPES = [
  "Electric Vehicle (EV)",
  "Stationary Storage (ESS)",
  "Marine",
  "Backup / UPS",
  "Other",
];

const EMPTY_FORM = {
  modelName: "",
  type: "Electric Vehicle (EV)",
  manufacturer: "",
  chemistry: "LFP (Lithium Iron Phosphate)",
  barcode: "",
  serialNumber: "",
  capacityKwh: "",
  stateOfHealth: "",
  stateOfCharge: "",
  modalId: "",
  hangStatus: "",
  overallStatus: "",
};

const AddBatteryModal = () => {
  const { isAddBatteryOpen, addBatteryPrefill, closeAddBattery, addBattery } =
    useBattery();

  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [prevOpen, setPrevOpen] = useState(isAddBatteryOpen);

  if (isAddBatteryOpen && !prevOpen) {
    setPrevOpen(true);
    setSubmitting(false);
    setForm({
      ...EMPTY_FORM,
      modelName: addBatteryPrefill?.modelName || "",
      barcode: addBatteryPrefill?.barcode || "",
      serialNumber: addBatteryPrefill?.serialNumber || "",
      modalId: addBatteryPrefill?.modalId || "",
      hangStatus: addBatteryPrefill?.hangStatus || "",
      overallStatus: addBatteryPrefill?.overallStatus || "",
    });
  } else if (!isAddBatteryOpen && prevOpen) {
    setPrevOpen(false);
  }

  if (!isAddBatteryOpen) return null;

  const handleChange = (field) => (event) => {
    setForm((previous) => ({ ...previous, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.modelName.trim() || !form.barcode.trim()) return;

    setSubmitting(true);
    const created = await addBattery({
      modelName: form.modelName.trim(),
      type: form.type,
      manufacturer: form.manufacturer.trim() || undefined,
      chemistry: form.chemistry.trim() || undefined,
      barcode: form.barcode.trim(),
      serialNumber: form.serialNumber.trim() || undefined,
      capacityKwh: Number(form.capacityKwh) || undefined,
      stateOfHealth: Number(form.stateOfHealth) || undefined,
      stateOfCharge: Number(form.stateOfCharge) || undefined,
      modalId: form.modalId.trim() || undefined,
      hangStatus: form.hangStatus.trim() || undefined,
      overallStatus: form.overallStatus.trim() || undefined,
    });
    setSubmitting(false);

    if (created) {
      closeAddBattery();
    }
  };

  return (
    <Modal isOpen={isAddBatteryOpen} onClose={closeAddBattery} z={9999}>
      <div className="relative w-full max-w-3xl max-h-[95vh] flex flex-col bg-[#FFFDF8] rounded-2xl shadow-2xl overflow-hidden">
        <ModalHeader
          title="Register New Battery"
          subtitle="NEW BATTERY PASSPORT"
          onClose={closeAddBattery}
        />

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 sm:p-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-sm font-semibold mb-2" htmlFor="modelName">
                Model Name <span className="text-red-500">*</span>
              </label>
              <input
                id="modelName"
                type="text"
                value={form.modelName}
                onChange={handleChange("modelName")}
                placeholder="e.g. CATL 100kWh Battery Pack"
                required
                className="w-full h-12 px-4 rounded-xl bg-[#FFFDF8] border border-[#E7E1D3] outline-none focus:border-[#173B5C]"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2" htmlFor="type">
                Battery Type
              </label>
              <select
                id="type"
                name="type"
                value={form.type}
                onChange={handleChange("type")}
                className="w-full h-12 px-4 rounded-xl bg-[#FFFDF8] border border-[#E7E1D3] outline-none focus:border-[#173B5C]"
              >
                {BATTERY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2" htmlFor="barcode">
                Barcode / QR Code <span className="text-red-500">*</span>
              </label>
              <input
                id="barcode"
                type="text"
                value={form.barcode}
                onChange={handleChange("barcode")}
                placeholder="e.g. BATT-CATL-LFP-9901"
                required
                className="w-full h-12 px-4 rounded-xl bg-[#FFFDF8] border border-[#E7E1D3] outline-none focus:border-[#173B5C]"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2" htmlFor="serialNumber">
                Serial Number
              </label>
              <input
                id="serialNumber"
                type="text"
                value={form.serialNumber}
                onChange={handleChange("serialNumber")}
                placeholder="e.g. SN-2026-EV-12345"
                className="w-full h-12 px-4 rounded-xl bg-[#FFFDF8] border border-[#E7E1D3] outline-none focus:border-[#173B5C]"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2" htmlFor="manufacturer">
                Manufacturer
              </label>
              <input
                id="manufacturer"
                type="text"
                value={form.manufacturer}
                onChange={handleChange("manufacturer")}
                placeholder="e.g. CATL"
                className="w-full h-12 px-4 rounded-xl bg-[#FFFDF8] border border-[#E7E1D3] outline-none focus:border-[#173B5C]"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2" htmlFor="chemistry">
                Chemistry
              </label>
              <input
                id="chemistry"
                type="text"
                value={form.chemistry}
                onChange={handleChange("chemistry")}
                placeholder="e.g. LFP (Lithium Iron Phosphate)"
                className="w-full h-12 px-4 rounded-xl bg-[#FFFDF8] border border-[#E7E1D3] outline-none focus:border-[#173B5C]"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2" htmlFor="capacityKwh">
                Capacity (kWh)
              </label>
              <input
                id="capacityKwh"
                type="number"
                min="0"
                step="0.1"
                value={form.capacityKwh}
                onChange={handleChange("capacityKwh")}
                placeholder="e.g. 100"
                className="w-full h-12 px-4 rounded-xl bg-[#FFFDF8] border border-[#E7E1D3] outline-none focus:border-[#173B5C]"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2" htmlFor="stateOfHealth">
                State of Health (%)
              </label>
              <input
                id="stateOfHealth"
                type="number"
                min="0"
                max="100"
                value={form.stateOfHealth}
                onChange={handleChange("stateOfHealth")}
                placeholder="e.g. 100"
                className="w-full h-12 px-4 rounded-xl bg-[#FFFDF8] border border-[#E7E1D3] outline-none focus:border-[#173B5C]"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2" htmlFor="stateOfCharge">
                State of Charge (%)
              </label>
              <input
                id="stateOfCharge"
                type="number"
                min="0"
                max="100"
                value={form.stateOfCharge}
                onChange={handleChange("stateOfCharge")}
                placeholder="e.g. 85"
                className="w-full h-12 px-4 rounded-xl bg-[#FFFDF8] border border-[#E7E1D3] outline-none focus:border-[#173B5C]"
              />
            </div>
          </div>

          <div className="rounded-2xl bg-[#FBF1C9] border border-[#F0E6C8] p-4 text-sm text-[#16263A] mb-6">
            <div className="flex items-start gap-2">
              <Battery className="w-4 h-4 text-[#B48611] mt-0.5 shrink-0" />
              <p>
                A new EU Digital Battery Passport will be minted with EU DPP
                2023/1542 compliance fields and a 3-year warranty record.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={closeAddBattery}
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
                  Registering…
                </>
              ) : (
                <>
                  <PlusCircle className="w-5 h-5" />
                  Mint Battery Passport
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default AddBatteryModal;