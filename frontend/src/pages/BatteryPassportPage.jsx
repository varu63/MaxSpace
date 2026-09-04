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
} from "lucide-react";
import { useBattery } from "../context/BatteryContext";

const DetailRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-3 py-3 border-b border-[#EEE9DA] last:border-b-0">
    <div className="w-9 h-9 rounded-lg bg-[#F5F1E7] flex items-center justify-center shrink-0">
      <Icon className="w-4 h-4 text-[#173B5C]" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs text-[#737983]">{label}</p>
      <p className="text-sm font-semibold text-[#16263A]">{value}</p>
    </div>
  </div>
);

const InfoBlock = ({ title, icon: Icon, children }) => (
  <div className="rounded-2xl bg-[#FFFDF8] border border-[#EEE9DA] p-5 shadow-sm">
    <h3 className="text-sm font-bold text-[#9A8240] uppercase tracking-wide mb-3 flex items-center gap-2">
      {Icon && <Icon className="w-4 h-4 text-[#B48A18]" />}
      {title}
    </h3>
    <div>{children}</div>
  </div>
);

export default function BatteryPassportPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { batteries = [] } = useBattery();

  const battery = batteries.find((b) => b.id === id);
  const batteryId = battery?.id || id || "MVAE0014036";

  return (
    <div className="w-full space-y-6">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm font-semibold text-[#173B5C] hover:underline"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="inline-flex items-center rounded-full bg-[#173B5C] px-3 py-1 text-[10px] font-semibold text-white tracking-wide">
            {batteryId}
          </span>
          <h1 className="mt-2 text-2xl lg:text-3xl font-bold">Battery Passport</h1>
          <p className="mt-1 text-sm text-[#6C747D]">
            Digital Battery Passport · Compliance Record
          </p>
        </div>
      </div>

      {/* Summary Card */}
      <div className="rounded-2xl bg-[#FFFDF8] border-2 border-[#D4C9A0] p-5 shadow-sm">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-[#16263A] tracking-wide">
              BATTERY PACK AADHAAR
            </h2>
            <p className="text-[10px] text-[#737983] mt-0.5">
              Digital Battery Passport · Compliance Record
            </p>
          </div>
          <div className="w-9 h-9 rounded-full bg-[#D4A843] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl bg-[#F5F1E7] p-3">
            <p className="text-[10px] text-[#737983] font-semibold uppercase">Battery ID</p>
            <p className="text-sm font-bold text-[#16263A] mt-0.5 break-all">{batteryId}</p>
          </div>
          <div className="rounded-xl bg-[#F5F1E7] p-3">
            <p className="text-[10px] text-[#737983] font-semibold uppercase">Model</p>
            <p className="text-sm font-bold text-[#16263A] mt-0.5">ESS</p>
          </div>
          <div className="rounded-xl bg-[#F5F1E7] p-3">
            <p className="text-[10px] text-[#737983] font-semibold uppercase">Chemistry</p>
            <p className="text-sm font-bold text-[#16263A] mt-0.5">LFP</p>
          </div>
          <div className="rounded-xl bg-[#F5F1E7] p-3">
            <p className="text-[10px] text-[#737983] font-semibold uppercase">Total Cells</p>
            <p className="text-sm font-bold text-[#16263A] mt-0.5">4</p>
          </div>
        </div>
      </div>

      {/* 1. MANUFACTURER IDENTIFIER */}
      <InfoBlock title="Manufacturer Identifier" icon={Factory}>
        <DetailRow icon={Factory} label="Country Code" value="N/A" />
        <DetailRow icon={Factory} label="Manufacturer Identifier" value="N/A" />
      </InfoBlock>

      {/* 2. BATTERY DESCRIPTOR */}
      <InfoBlock title="Battery Descriptor" icon={Battery}>
        <DetailRow icon={Battery} label="Nominal Voltage" value="~ 13.34 V" />
        <DetailRow icon={ShieldCheck} label="Extinguisher Class" value="Class L" />
        <DetailRow icon={Layers} label="Battery Chemistry" value="N/A" />
        <DetailRow icon={Layers} label="Cell Origin" value="N/A" />
      </InfoBlock>

      {/* 3. BATTERY IDENTIFIER */}
      <InfoBlock title="Battery Identifier" icon={Hash}>
        <DetailRow icon={Hash} label="Date of Manufacturing" value="~ 2026-03-30 07:29:02.114386" />
        <DetailRow icon={Hash} label="Sequential Production Number" value={`~ ${batteryId}`} />
        <DetailRow icon={Hash} label="Factory Code" value="N/A" />
      </InfoBlock>

      {/* 4. MATERIAL COMPOSITION */}
      <InfoBlock title="Material Composition" icon={Layers}>
        <DetailRow icon={Layers} label="Number of Cells per Battery" value="4" />
        <DetailRow icon={Activity} label="Internal Resistance of Battery Pack" value="16.19 mOhm" />
        <DetailRow icon={Layers} label="Cell Type" value="LFP" />
        <DetailRow icon={Battery} label="BMS Model" value="~ 4S 100A DALY" />
        <DetailRow icon={Layers} label="Cell Form Factor" value="Prismatic Cell (LFP)" />
        <DetailRow icon={Layers} label="Type of Construction of Battery Pack" value="Side by Side Battery Module Placement" />
        <DetailRow icon={Layers} label="Type of Construction of Module" value="Linear Alternate terminal Cell arrangement" />
        <DetailRow icon={Activity} label="Type of Cooling System" value="None / air-cooled by ambient conditions" />
        <DetailRow icon={Wrench} label="Disassembly Method" value="Manual discharge, cut-open casing, separate electrodes" />
        <DetailRow icon={Leaf} label="Circularity Method" value="Recycling / hydrometallurgical recovery, Direct, Pyro or other" />
        <DetailRow icon={Leaf} label="Recyclability" value="High; typically 85-95% material recovery potential" />
        <DetailRow icon={Layers} label="Material: Anode" value="Graphite on copper foil" />
        <DetailRow icon={Layers} label="Material: Cathode" value="LFP (LiFePO4) on aluminum foil" />
        <DetailRow icon={Layers} label="Material: Electrolyte" value="Liquid lithium-salt electrolyte" />
        <DetailRow icon={Layers} label="Material: Separator" value="Microporous polymer separator" />
        <DetailRow icon={Layers} label="Material: Current Collector" value="Copper (anode), aluminum (cathode)" />
        <DetailRow icon={Layers} label="Material: Battery Casing" value="Mild Steel & Aluminium" />
        <DetailRow icon={Layers} label="Material: Potting / Warranty / Contents" value="N/A" />
      </InfoBlock>

      {/* 5. CARBON FOOTPRINT */}
      <InfoBlock title="Carbon Footprint" icon={Leaf}>
        <DetailRow icon={Leaf} label="Total Battery Carbon Footprint Scaled" value="41-89 kgCO2e/kWh; working value ~55-65" />
        <DetailRow icon={Leaf} label="Raw Material Acquisition Stage (%)" value="35-55% of total" />
        <DetailRow icon={Leaf} label="Manufacturing Stage (%)" value="35-50% of total" />
        <DetailRow icon={Leaf} label="Distribution Stage (%)" value="1-5% of total" />
        <DetailRow icon={Leaf} label="End of Life & Recycling Stage (%)" value="(-5% to +5%), depending on recovery credit" />
      </InfoBlock>

      {/* 6. DYNAMIC DATA */}
      <InfoBlock title="Dynamic Data" icon={Activity}>
        <DetailRow icon={Activity} label="Battery Category" value="ESS" />
        <DetailRow icon={FileText} label="Date & Time Stamp" value="2026-04-07 13:40:43.542116" />
        <DetailRow icon={FileText} label="BPAN" value="N/A" />
      </InfoBlock>

      {/* Footer Note */}
      <div className="rounded-2xl bg-[#FFF8E7] border border-[#F0E6C8] p-4">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#B48611] mt-0.5 shrink-0" />
          <p className="text-sm text-[#16263A] leading-relaxed">
            This record reflects fields available in MAXTRACEDB and the Battery Pack
            Aadhaar reference mapping. Values marked '~' are derived or proxy fields;
            fields marked 'Not available' have no corresponding source yet.
          </p>
        </div>
      </div>
    </div>
  );
}