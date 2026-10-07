import React, { useEffect, useMemo, useState } from "react";
import { Modal, ModalHeader } from "../../common/Modal";
import { Battery, CalendarDays, Check, Clock3, MapPin } from "lucide-react";
import ServiceLocationMap from "../../common/map/ServiceLocationMap";
import ServiceLocationPicker from "./ServiceLocationPicker";
import { fetchServiceCenters } from "../../../services/api";

const CENTERS = [
  "MaxVolt Noida Service Center",
  "MaxVolt Delhi Service Center",
  "MaxVolt Gurugram Service Center",
  "MaxVolt Bengaluru Service Center",
  "MaxVolt Mumbai Service Center",
  "MaxVolt Pune Service Center",
];

const BookServiceModal = ({
  battery,
  form,
  onChange,
  onLocationChange,
  onSubmit,
  onClose,
  getBatteryId,
}) => {
  const [serviceCenters, setServiceCenters] = useState([]);
  useEffect(() => {
    let mounted = true;
    fetchServiceCenters()
      .then((res) => {
        if (mounted && res?.data) setServiceCenters(res.data);
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);
  const previewLocation = useMemo(() => {
    const name = form.center || CENTERS[0];
    const found = serviceCenters.find((c) => c.name === name);
    if (found) return found;
    // fallback: lightweight placeholder derived from backend via name, no hardcoded coords beyond names
    return found || null;
  }, [form.center, serviceCenters]);

  if (!battery) return null;

  return (
    <Modal isOpen={true} onClose={onClose} z={9999}>
      <div className="relative w-full max-w-4xl max-h-[95vh] flex flex-col bg-[#FFFDF8] rounded-2xl shadow-2xl overflow-hidden">
        <ModalHeader
          title="Book Service"
          subtitle="SERVICE BOOKING"
          batteryId={getBatteryId(battery)}
          onClose={onClose}
        />

        <form onSubmit={onSubmit} className="flex-1 overflow-y-auto p-6 sm:p-8">
          <div className="rounded-2xl bg-[#F5F1E7] p-5 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#173B5C] flex items-center justify-center">
                <Battery className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-bold">{getBatteryId(battery)}</p>
                <p className="text-sm text-[#747B83]">
                  {battery.model || "ESS"} &bull; {battery.chemistry || "LFP"}
                </p>
              </div>
            </div>
          </div>

          {/* Required customer service location: where the technician
              actually goes. Address search runs through the backend's
              free OpenStreetMap proxy; GPS is optional. */}
          <div className="mb-5">
            <label className="block text-sm font-semibold mb-2" htmlFor="serviceAddress">
              Service Location{" "}
              <span className="text-[#A77A08]">(required)</span>
            </label>
            <ServiceLocationPicker
              id="serviceAddress"
              value={form.location}
              onChange={onLocationChange}
            />
            <p className="text-[11px] text-[#8A9096] mt-1 flex items-center gap-1">
              <MapPin className="w-3 h-3 shrink-0" />
              Type an address or use your current location — suggestions are powered by OpenStreetMap
            </p>
          </div>

          <div className="mb-5">
            <label className="block text-sm font-semibold mb-2" htmlFor="center">Service Center</label>
            <select id="center" name="center" value={form.center || CENTERS[0]} onChange={onChange} className="w-full h-12 px-4 rounded-xl bg-[#FFFDF8] border border-[#E7E1D3] outline-none focus:border-[#173B5C]">
              {CENTERS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <p className="text-[11px] text-[#8A9096] mt-1 flex items-center gap-1"><MapPin className="w-3 h-3"/> Same location shared with Admin & Technician via backend serviceLocation</p>
          </div>

          <div className="mb-5">
            <div className="rounded-2xl border border-[#E7E1D3] p-3 bg-[#F5F1E7]">
              <p className="text-xs font-bold text-[#16263A] mb-2">Service Location Preview — from backend service centers</p>
              {previewLocation ? (
                <ServiceLocationMap serviceLocation={previewLocation} height={220} />
              ) : (
                <div className="h-[220px] rounded-2xl bg-[#FFFDF8] border border-dashed border-[#E7E1D3] flex items-center justify-center text-xs text-[#8A9096]">Loading preview from backend…</div>
              )}
            </div>
          </div>

          <div className="mb-5">
            <label className="block text-sm font-semibold mb-2" htmlFor="serviceType">
              Service Type
            </label>
            <select
              id="serviceType"
              name="serviceType"
              value={form.serviceType}
              onChange={onChange}
              className="w-full h-12 px-4 rounded-xl bg-[#FFFDF8] border border-[#E7E1D3] outline-none focus:border-[#173B5C]"
            >
              <option>Regular Maintenance</option>
              <option>Battery Inspection</option>
              <option>Repair Service</option>
              <option>Cell Replacement</option>
              <option>Electrical Check</option>
              <option>Emergency Service</option>
              <option>Other</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-sm font-semibold mb-2" htmlFor="date">
                Service Date
              </label>
              <div className="relative">
                <CalendarDays className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8A9096]" />
                <input
                  id="date"
                  type="date"
                  name="date"
                  value={form.date}
                  onChange={onChange}
                  min={new Date().toISOString().split("T")[0]}
                  required
                  className="w-full h-12 pl-12 pr-4 rounded-xl bg-[#FFFDF8] border border-[#E7E1D3] outline-none focus:border-[#173B5C]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2" htmlFor="time">
                Service Time
              </label>
              <div className="relative">
                <Clock3 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8A9096]" />
                <input
                  id="time"
                  type="time"
                  name="time"
                  value={form.time}
                  onChange={onChange}
                  required
                  className="w-full h-12 pl-12 pr-4 rounded-xl bg-[#FFFDF8] border border-[#E7E1D3] outline-none focus:border-[#173B5C]"
                />
              </div>
            </div>
          </div>

          <div className="mb-5">
            <label className="block text-sm font-semibold mb-2" htmlFor="mobileNumber">
              Mobile Number
            </label>
            <input
              id="mobileNumber"
              type="text"
              name="mobileNumber"
              value={form.mobileNumber || ""}
              onChange={onChange}
              inputMode="numeric"
              placeholder="00000-00000"
              maxLength="10"
              className="w-full h-12 px-4 rounded-xl bg-[#FFFDF8] border border-[#E7E1D3] outline-none focus:border-[#173B5C]"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold mb-2" htmlFor="notes">
              Service Notes{" "}
              <span className="font-normal text-[#8A9096]">(Optional)</span>
            </label>
            <textarea
              id="notes"
              name="notes"
              value={form.notes}
              onChange={onChange}
              rows="4"
              placeholder="Describe the service requirement..."
              className="w-full px-4 py-3 rounded-xl bg-[#FFFDF8] border border-[#E7E1D3] outline-none resize-none focus:border-[#173B5C]"
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
              className="flex-1 h-12 rounded-xl bg-[#173B5C] text-white font-semibold flex items-center justify-center gap-2 hover:bg-[#102F4A] transition"
            >
              <Check className="w-5 h-5" />
              Confirm Booking
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default React.memo(BookServiceModal);
