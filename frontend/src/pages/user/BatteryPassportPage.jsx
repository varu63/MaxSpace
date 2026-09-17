import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ShieldCheck,
  Battery,
  Factory,
  Hash,
  Layers,
  Leaf,
  Activity,
  FileText,
  Wrench,
  CheckCircle2,
  MapPin,
  Award,
  Gauge,
  RefreshCcw,
  AlertTriangle,
} from "lucide-react";

import { useBattery } from "../../context/BatteryContext";
import { DetailRow, InfoBlock, LoadingSpinner } from "../../components/common";
import { fetchBatteryPassport } from "../../services";

/* Render every value that exists in the database; keep a clear
   placeholder only when the schema has no matching field yet. */
const valueOr = (value, fallback = "—") =>
  value === null || value === undefined || value === "" ? fallback : value;

const formatDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

export default function BatteryPassportPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useBattery();

  const [passport, setPassport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPassport = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchBatteryPassport(id);
      setPassport(data);
    } catch (err) {
      setError(err?.message || "Could not load the battery passport.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadPassport();
  }, [loadPassport]);

  const battery = passport?.battery;
  const serviceHistory = passport?.serviceHistory || [];

  const derived = useMemo(() => {
    if (!battery || !passport) return null;
    const recycled = battery.recycledContent || {};
    const warranty = battery.warranty || {};
    const health = (battery.healthHistory || []).slice().reverse();
    const history = passport.serviceHistory || [];
    return {
      recycled,
      warranty,
      health,
      lastServiceDate: battery.lastServiceDate || history[0]?.scheduledDate || null,
    };
  }, [battery, passport]);

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-[#F8F2DE] px-4 sm:px-8 md:px-16 lg:px-32 xl:px-48 py-8">
        <div className="w-full max-w-5xl mx-auto">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (error || !battery) {
    return (
      <div className="min-h-screen w-full bg-[#F8F2DE] px-4 sm:px-8 md:px-16 lg:px-32 xl:px-48 py-8">
        <div className="w-full max-w-5xl mx-auto">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#173B5C] hover:text-[#B48611] transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <div className="rounded-2xl bg-[#FBEDED] border border-[#F2C4C0] p-8 text-center shadow-sm">
            <div className="w-14 h-14 rounded-full bg-[#C0392B] text-white flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold text-[#16263A]">
              Battery Passport Unavailable
            </h2>
            <p className="mt-2 text-sm text-[#747B83] max-w-md mx-auto">
              {error || "No battery record was found for this identifier in the database."}
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="px-5 py-2.5 rounded-xl bg-[#FFFDF8] border border-[#E7E1D3] text-[#16263A] text-xs font-bold hover:bg-[#F5F1E7] transition-colors"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={loadPassport}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#173B5C] hover:bg-[#102F4A] text-white text-xs font-black transition-all"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const w = derived.warranty;
  const rc = derived.recycled;

  return (
    <div className="min-h-screen w-full bg-[#F8F2DE] px-4 sm:px-8 md:px-16 lg:px-32 xl:px-48 py-8">
      <div className="w-full max-w-5xl mx-auto space-y-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#173B5C] hover:text-[#B48611] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="inline-flex items-center rounded-full bg-[#173B5C] px-3 py-1 text-[10px] font-semibold text-white tracking-wide">
              {battery.id}
            </span>
            <h1 className="mt-3 text-2xl sm:text-3xl font-bold text-[#16263A]">
              Battery Passport
            </h1>
            <p className="mt-1 text-sm text-[#747B83]">
              Digital Battery Passport &middot; Compliance Record
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-[#FFFDF8] border-2 border-[#D4C9A0] shadow-sm overflow-hidden">
          <div className="flex items-start justify-between gap-4 px-5 sm:px-6 py-5">
            <div>
              <h2 className="text-sm font-bold text-[#16263A] tracking-wide">
                BATTERY PACK AADHAAR
              </h2>
              <p className="text-[10px] text-[#747B83] mt-1">
                Digital Battery Passport &middot; Compliance Record
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#B48611] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 px-5 sm:px-6 pb-6">
            <div className="rounded-xl bg-[#F5F1E7] p-4">
              <p className="text-[10px] text-[#747B83] font-semibold uppercase">Battery ID</p>
              <p className="text-sm font-bold text-[#16263A] mt-1 break-all">{valueOr(battery.id)}</p>
            </div>
            <div className="rounded-xl bg-[#F5F1E7] p-4">
              <p className="text-[10px] text-[#747B83] font-semibold uppercase">Model</p>
              <p className="text-sm font-bold text-[#16263A] mt-1">{valueOr(battery.model || battery.modelName)}</p>
            </div>
            <div className="rounded-xl bg-[#F5F1E7] p-4">
              <p className="text-[10px] text-[#747B83] font-semibold uppercase">Chemistry</p>
              <p className="text-sm font-bold text-[#16263A] mt-1">{valueOr(battery.chemistry)}</p>
            </div>
            <div className="rounded-xl bg-[#F5F1E7] p-4">
              <p className="text-[10px] text-[#747B83] font-semibold uppercase">Total Cells</p>
              <p className="text-sm font-bold text-[#16263A] mt-1">
                {valueOr(battery.cells ?? battery.totalCells)}
              </p>
            </div>
          </div>
        </div>

        <InfoBlock title="Manufacturer Identifier" icon={Factory} variant="passport">
          <DetailRow icon={Factory} label="Manufacturer" value={valueOr(battery.manufacturer)} variant="passport" />
          <DetailRow icon={MapPin} label="Assembly Location" value={valueOr(battery.assemblyLocation || battery.location)} variant="passport" />
          <DetailRow icon={Factory} label="Model Name" value={valueOr(battery.modelName || battery.name)} variant="passport" />
        </InfoBlock>

        <InfoBlock title="Battery Descriptor" icon={Battery} variant="passport">
          <DetailRow icon={Battery} label="Battery Category" value={valueOr(battery.type)} variant="passport" />
          <DetailRow icon={Battery} label="Nominal Voltage" value={valueOr(battery.nominalVoltage || battery.voltage)} variant="passport" />
          <DetailRow icon={Battery} label="Capacity" value={valueOr(battery.capacity || (battery.capacityKwh ? `${battery.capacityKwh} kWh` : null))} variant="passport" />
          <DetailRow icon={Layers} label="Battery Chemistry" value={valueOr(battery.chemistry)} variant="passport" />
          <DetailRow icon={Battery} label="Weight" value={battery.weightKg ? `${battery.weightKg} kg` : "—"} variant="passport" />
          <DetailRow icon={Battery} label="Dimensions (mm)" value={valueOr(battery.dimensionsMm)} variant="passport" />
        </InfoBlock>

        <InfoBlock title="Battery Identifier" icon={Hash} variant="passport">
          <DetailRow
            icon={Hash}
            label="Date of Manufacturing"
            value={formatDate(battery.manufactureDate)}
            variant="passport"
          />
          <DetailRow
            icon={Hash}
            label="Sequential Production Number"
            value={valueOr(battery.serialNumber)}
            variant="passport"
          />
          <DetailRow icon={Hash} label="Barcode / BPAN" value={valueOr(battery.barcode)} variant="passport" />
          <DetailRow icon={Hash} label="Modal ID (QR)" value={valueOr(battery.modalId)} variant="passport" />
          <DetailRow icon={Hash} label="Battery Type" value={valueOr(battery.type)} variant="passport" />
        </InfoBlock>

        <InfoBlock title="Material Composition" icon={Layers} variant="passport">
          <DetailRow
            icon={Layers}
            label="Number of Cells per Battery"
            value={valueOr(battery.cells ?? battery.totalCells)}
            variant="passport"
          />
          <DetailRow
            icon={Activity}
            label="Internal Resistance of Battery Pack"
            value={battery.internalResistanceMOhms ? `${battery.internalResistanceMOhms} mOhm` : "—"}
            variant="passport"
          />
          <DetailRow icon={Layers} label="Cell Type" value={valueOr(battery.chemistry)} variant="passport" />
          <DetailRow
            icon={Leaf}
            label="Recycled Content (Cobalt)"
            value={rc.cobalt !== undefined ? `${rc.cobalt}%` : "—"}
            variant="passport"
          />
          <DetailRow
            icon={Leaf}
            label="Recycled Content (Nickel)"
            value={rc.nickel !== undefined ? `${rc.nickel}%` : "—"}
            variant="passport"
          />
          <DetailRow
            icon={Leaf}
            label="Recycled Content (Lithium)"
            value={rc.lithium !== undefined ? `${rc.lithium}%` : "—"}
            variant="passport"
          />
          <DetailRow
            icon={Leaf}
            label="Recycled Content (Lead)"
            value={rc.lead !== undefined ? `${rc.lead}%` : "—"}
            variant="passport"
          />
        </InfoBlock>

        <InfoBlock title="Current Status & Health" icon={Activity} variant="passport">
          <DetailRow icon={Activity} label="State of Health (SoH)" value={battery.stateOfHealth != null ? `${battery.stateOfHealth}%` : "—"} variant="passport" />
          <DetailRow icon={Gauge} label="State of Charge (SoC)" value={battery.stateOfCharge != null ? `${battery.stateOfCharge}%` : "—"} variant="passport" />
          <DetailRow icon={Activity} label="Cycle Count" value={valueOr(battery.cycleCount)} variant="passport" />
          <DetailRow icon={Activity} label="Max Rated Cycles" value={valueOr(battery.maxRatedCycles)} variant="passport" />
          <DetailRow icon={Activity} label="Operating Temperature" value={battery.operatingTempC != null ? `${battery.operatingTempC}°C` : "—"} variant="passport" />
          <DetailRow icon={Activity} label="Hang Status (QR)" value={valueOr(battery.hangStatus)} variant="passport" />
          <DetailRow icon={Activity} label="Overall Status (QR)" value={valueOr(battery.overallStatus)} variant="passport" />
          <DetailRow icon={MapPin} label="Current Location" value={valueOr(battery.location)} variant="passport" />
          <DetailRow icon={Wrench} label="Last Service Date" value={formatDate(derived.lastServiceDate)} variant="passport" />
        </InfoBlock>

        <InfoBlock title="Warranty" icon={Award} variant="passport">
          <DetailRow icon={Award} label="Warranty Status" value={valueOr(w.status)} variant="passport" />
          <DetailRow icon={Award} label="Provider" value={valueOr(w.provider)} variant="passport" />
          <DetailRow icon={Award} label="Certificate Number" value={valueOr(w.certificateNumber)} variant="passport" />
          <DetailRow icon={Award} label="Start Date" value={formatDate(w.startDate)} variant="passport" />
          <DetailRow icon={Award} label="Expiry Date" value={formatDate(w.endDate)} variant="passport" />
          <DetailRow icon={Award} label="Remaining Days" value={valueOr(w.remainingDays)} variant="passport" />
          <DetailRow icon={Award} label="Coverage Terms" value={valueOr(w.terms)} variant="passport" />
        </InfoBlock>

        <InfoBlock title="Service & Maintenance History" icon={Wrench} variant="passport">
          {serviceHistory.length === 0 ? (
            <DetailRow icon={FileText} label="Maintenance Records" value="No service records on file yet." variant="passport" />
          ) : (
            serviceHistory.map((service) => (
              <div key={service.id} className="border-b border-[#EEE9DA] last:border-b-0 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#F5F1E7] flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-[#173B5C]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#16263A]">{service.serviceType}</p>
                    <p className="text-xs text-[#747B83] mt-0.5">
                      {service.ticketNumber} &middot; {formatDate(service.scheduledDate)} at {valueOr(service.scheduledTime)} &middot; {valueOr(service.status)}
                    </p>
                  </div>
                </div>
                <div className="mt-2 ml-12 text-xs text-[#747B83] space-y-1">
                  <p><span className="font-semibold text-[#16263A]">Center:</span> {valueOr(service.center)} &middot; <span className="font-semibold text-[#16263A]">Technician:</span> {valueOr(service.technician)}</p>
                  <p><span className="font-semibold text-[#16263A]">Cost:</span> {valueOr(service.cost)}</p>
                  {service.notes && <p className="italic">{service.notes}</p>}
                </div>
              </div>
            ))
          )}
        </InfoBlock>

        <InfoBlock title="Lifecycle, Compliance & Carbon Footprint" icon={Leaf} variant="passport">
          <DetailRow icon={Leaf} label="Total Carbon Footprint" value={battery.carbonFootprintKgPerKwh != null ? `${battery.carbonFootprintKgPerKwh} kgCO₂e/kWh` : "—"} variant="passport" />
          <DetailRow icon={FileText} label="Compliance Standards" value={Array.isArray(battery.complianceStandards) ? battery.complianceStandards.join(" • ") : valueOr(battery.complianceStandards)} variant="passport" />
          <DetailRow icon={Wrench} label="Dismantling Instructions" value={valueOr(battery.dismantlingManual)} variant="passport" />
          <DetailRow icon={Activity} label="Health Timeline" value={derived.health.map((h) => `${h.date}: ${h.soh}%`).join(" → ") || "—"} variant="passport" />
        </InfoBlock>

        <div className="rounded-2xl bg-[#FBF1C9] border border-[#F0E6C8] p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-[#B48611] mt-0.5 shrink-0" />
            <p className="text-sm text-[#16263A] leading-relaxed">
              Passport generated from the live fleet database record {battery.id} (
              {valueOr(battery.barcode)}) at {new Date(passport.generatedAt).toLocaleString()}. Related
              service &amp; maintenance history is included from the <span className="font-mono">services</span> database table.
            </p>
          </div>
        </div>

        <div className="h-6" />
      </div>
    </div>
  );
}