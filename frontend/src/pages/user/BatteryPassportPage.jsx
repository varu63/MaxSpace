import { useMemo } from "react";
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

import { useBattery } from "../../context/BatteryContext";
import { DetailRow, InfoBlock } from "../../components/common";

export default function BatteryPassportPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { batteries = [] } = useBattery();

  const battery = useMemo(
    () => batteries.find((b) => String(b.id) === String(id)),
    [batteries, id]
  );

  const batteryId = battery?.id || id || "batt-1";

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
              {batteryId}
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
              <p className="text-sm font-bold text-[#16263A] mt-1 break-all">{batteryId}</p>
            </div>
            <div className="rounded-xl bg-[#F5F1E7] p-4">
              <p className="text-[10px] text-[#747B83] font-semibold uppercase">Model</p>
              <p className="text-sm font-bold text-[#16263A] mt-1">{battery?.model || "ESS"}</p>
            </div>
            <div className="rounded-xl bg-[#F5F1E7] p-4">
              <p className="text-[10px] text-[#747B83] font-semibold uppercase">Chemistry</p>
              <p className="text-sm font-bold text-[#16263A] mt-1">{battery?.chemistry || "LFP"}</p>
            </div>
            <div className="rounded-xl bg-[#F5F1E7] p-4">
              <p className="text-[10px] text-[#747B83] font-semibold uppercase">Total Cells</p>
              <p className="text-sm font-bold text-[#16263A] mt-1">
                {battery?.cells || battery?.totalCells || 4}
              </p>
            </div>
          </div>
        </div>

        <InfoBlock title="Manufacturer Identifier" icon={Factory} variant="passport">
          <DetailRow icon={Factory} label="Country Code" value="N/A" variant="passport" />
          <DetailRow icon={Factory} label="Manufacturer Identifier" value="N/A" variant="passport" />
        </InfoBlock>

        <InfoBlock title="Battery Descriptor" icon={Battery} variant="passport">
          <DetailRow icon={Battery} label="Nominal Voltage" value="~ 13.34 V" variant="passport" />
          <DetailRow icon={ShieldCheck} label="Extinguisher Class" value="Class L" variant="passport" />
          <DetailRow icon={Layers} label="Battery Chemistry" value={battery?.chemistry || "N/A"} variant="passport" />
          <DetailRow icon={Layers} label="Cell Origin" value="N/A" variant="passport" />
        </InfoBlock>

        <InfoBlock title="Battery Identifier" icon={Hash} variant="passport">
          <DetailRow
            icon={Hash}
            label="Date of Manufacturing"
            value={battery?.manufactureDate || "~ 2026-03-30 07:29:02.114386"}
            variant="passport"
          />
          <DetailRow
            icon={Hash}
            label="Sequential Production Number"
            value={battery?.serialNumber || `~ ${batteryId}`}
            variant="passport"
          />
          <DetailRow icon={Hash} label="Factory Code" value="N/A" variant="passport" />
        </InfoBlock>

        <InfoBlock title="Material Composition" icon={Layers} variant="passport">
          <DetailRow
            icon={Layers}
            label="Number of Cells per Battery"
            value={battery?.cells || battery?.totalCells || "4"}
            variant="passport"
          />
          <DetailRow
            icon={Activity}
            label="Internal Resistance of Battery Pack"
            value={battery?.internalResistanceMOhms ? `${battery.internalResistanceMOhms} mOhm` : "16.19 mOhm"}
            variant="passport"
          />
          <DetailRow icon={Layers} label="Cell Type" value={battery?.chemistry || "LFP"} variant="passport" />
          <DetailRow icon={Battery} label="BMS Model" value="~ 4S 100A DALY" variant="passport" />
          <DetailRow icon={Layers} label="Cell Form Factor" value="Prismatic Cell (LFP)" variant="passport" />
          <DetailRow icon={Layers} label="Type of Construction of Battery Pack" value="Side by Side Battery Module Placement" variant="passport" />
          <DetailRow icon={Layers} label="Type of Construction of Module" value="Linear Alternate terminal Cell arrangement" variant="passport" />
          <DetailRow icon={Activity} label="Type of Cooling System" value="None / air-cooled by ambient conditions" variant="passport" />
          <DetailRow icon={Wrench} label="Disassembly Method" value="Manual discharge, cut-open casing, separate electrodes" variant="passport" />
          <DetailRow icon={Leaf} label="Circularity Method" value="Recycling / hydrometallurgical recovery, Direct, Pyro or other" variant="passport" />
          <DetailRow icon={Leaf} label="Recyclability" value="High; typically 85-95% material recovery potential" variant="passport" />
          <DetailRow icon={Layers} label="Material: Anode" value="Graphite on copper foil" variant="passport" />
          <DetailRow icon={Layers} label="Material: Cathode" value="LFP (LiFePO4) on aluminum foil" variant="passport" />
          <DetailRow icon={Layers} label="Material: Electrolyte" value="Liquid lithium-salt electrolyte" variant="passport" />
          <DetailRow icon={Layers} label="Material: Separator" value="Microporous polymer separator" variant="passport" />
          <DetailRow icon={Layers} label="Material: Current Collector" value="Copper (anode), aluminum (cathode)" variant="passport" />
          <DetailRow icon={Layers} label="Material: Battery Casing" value="Mild Steel & Aluminium" variant="passport" />
          <DetailRow icon={Layers} label="Material: Potting / Warranty / Contents" value="N/A" variant="passport" />
        </InfoBlock>

        <InfoBlock title="Carbon Footprint" icon={Leaf} variant="passport">
          <DetailRow icon={Leaf} label="Total Battery Carbon Footprint Scaled" value="41-89 kgCO2e/kWh; working value ~55-65" variant="passport" />
          <DetailRow icon={Leaf} label="Raw Material Acquisition Stage (%)" value="35-55% of total" variant="passport" />
          <DetailRow icon={Leaf} label="Manufacturing Stage (%)" value="35-50% of total" variant="passport" />
          <DetailRow icon={Leaf} label="Distribution Stage (%)" value="1-5% of total" variant="passport" />
          <DetailRow icon={Leaf} label="End of Life & Recycling Stage (%)" value="(-5% to +5%), depending on recovery credit" variant="passport" />
        </InfoBlock>

        <InfoBlock title="Dynamic Data" icon={Activity} variant="passport">
          <DetailRow icon={Activity} label="Battery Category" value={battery?.type || "ESS"} variant="passport" />
          <DetailRow icon={FileText} label="Date & Time Stamp" value="2026-04-07 13:40:43.542116" variant="passport" />
          <DetailRow icon={FileText} label="BPAN" value={battery?.barcode || "N/A"} variant="passport" />
        </InfoBlock>

        <div className="rounded-2xl bg-[#FBF1C9] border border-[#F0E6C8] p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-[#B48611] mt-0.5 shrink-0" />
            <p className="text-sm text-[#16263A] leading-relaxed">
              This record reflects fields available in MAXTRACEDB and the Battery Pack Aadhaar
              reference mapping. Values marked &apos;~&apos; are derived or proxy fields; fields marked
              &apos;Not available&apos; have no corresponding source yet.
            </p>
          </div>
        </div>

        <div className="h-6" />
      </div>
    </div>
  );
}
