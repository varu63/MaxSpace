import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Battery,
  Calendar,
  MapPin,
  Shield,
  Activity,
  Thermometer,
  Zap,
  Weight,
  Ruler,
  Hash,
  FileText,
  Wrench,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { useBattery } from "../context/BatteryContext";

const DetailRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-3 py-3 border-b border-[#EEE9DA] last:border-b-0">
    <div className="w-9 h-9 rounded-lg bg-[#F5F1E7] flex items-center justify-center shrink-0">
      <Icon className="w-4 h-4 text-[#173B5C]" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs text-[#737983]">{label}</p>
      <p className="text-sm font-semibold text-[#16263A] truncate">{value}</p>
    </div>
  </div>
);

const InfoBlock = ({ title, children }) => (
  <div className="rounded-2xl bg-[#FFFDF8] border border-[#EEE9DA] p-5 shadow-sm">
    <h3 className="text-sm font-bold text-[#9A8240] uppercase tracking-wide mb-3">{title}</h3>
    <div>{children}</div>
  </div>
);

export default function BatteryDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { batteries = [] } = useBattery();

  const battery = batteries.find((b) => b.id === id);

  if (!battery) {
    return (
      <div className="w-full space-y-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm font-semibold text-[#173B5C] hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Go Back
        </button>
        <div className="rounded-2xl bg-[#FFFDF8] border border-[#EEE9DA] p-12 text-center">
          <Battery className="w-12 h-12 mx-auto text-[#7D858C] mb-4" />
          <h2 className="text-xl font-bold mb-2">Battery Not Found</h2>
          <p className="text-sm text-[#747B83]">
            The battery with ID "{id}" was not found in the fleet.
          </p>
          <button
            onClick={() => navigate("/home")}
            className="mt-6 h-11 px-6 rounded-xl bg-[#173B5C] text-white font-semibold hover:bg-[#102F4A] transition"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const soh = Number(battery.stateOfHealth) || 0;
  const soc = Number(battery.stateOfCharge) || 0;
  const cycles = Number(battery.cycleCount) || 0;
  const maxCycles = Number(battery.maxRatedCycles) || 0;

  const sohColor =
    soh >= 90 ? "text-green-600" : soh >= 80 ? "text-yellow-600" : "text-red-500";

  const sohBg =
    soh >= 90 ? "bg-green-500" : soh >= 80 ? "bg-yellow-500" : "bg-red-500";

  const warrantyStatus = battery.warranty?.status || "N/A";
  const warrantyColor =
    warrantyStatus === "Active"
      ? "bg-green-100 text-green-700"
      : warrantyStatus === "Expiring Soon"
        ? "bg-yellow-100 text-yellow-700"
        : "bg-red-100 text-red-700";

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
            {battery.id}
          </span>
          <h1 className="mt-2 text-2xl lg:text-3xl font-bold">{battery.modelName}</h1>
          <p className="mt-1 text-sm text-[#6C747D]">{battery.type}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate(`/battery/${battery.id}/passport`)}
            className="h-10 px-5 rounded-xl border-2 border-[#B48A18] text-[#B48A18] text-xs font-semibold hover:bg-[#FBF7E8] transition flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" />
            Battery Passport
          </button>
          <button
            onClick={() => navigate("/services")}
            className="h-10 px-5 rounded-xl bg-[#173B5C] text-white text-xs font-semibold hover:bg-[#102F4A] transition flex items-center gap-1.5"
          >
            <Wrench className="w-3.5 h-3.5" />
            Book Service
          </button>
        </div>
      </div>

      {/* Health Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-[#FFFDF8] border border-[#EEE9DA] p-4 text-center shadow-sm">
          <p className="text-xs text-[#737983] mb-1">State of Health</p>
          <p className={`text-2xl font-bold ${sohColor}`}>{soh}%</p>
          <div className="mt-2 h-1.5 rounded-full bg-gray-200 overflow-hidden">
            <div className={`h-full rounded-full ${sohBg}`} style={{ width: `${soh}%` }} />
          </div>
        </div>
        <div className="rounded-2xl bg-[#FFFDF8] border border-[#EEE9DA] p-4 text-center shadow-sm">
          <p className="text-xs text-[#737983] mb-1">State of Charge</p>
          <p className="text-2xl font-bold text-[#173B5C]">{soc}%</p>
          <div className="mt-2 h-1.5 rounded-full bg-gray-200 overflow-hidden">
            <div className="h-full rounded-full bg-[#173B5C]" style={{ width: `${soc}%` }} />
          </div>
        </div>
        <div className="rounded-2xl bg-[#FFFDF8] border border-[#EEE9DA] p-4 text-center shadow-sm">
          <p className="text-xs text-[#737983] mb-1">Cycle Count</p>
          <p className="text-2xl font-bold text-[#16263A]">{cycles}</p>
          <p className="text-[10px] text-[#737983] mt-1">of {maxCycles} rated</p>
        </div>
        <div className="rounded-2xl bg-[#FFFDF8] border border-[#EEE9DA] p-4 text-center shadow-sm">
          <p className="text-xs text-[#737983] mb-1">Warranty</p>
          <span className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-semibold ${warrantyColor}`}>
            {warrantyStatus}
          </span>
          <p className="text-[10px] text-[#737983] mt-1">
            {battery.warranty?.remainingDays > 0
              ? `${battery.warranty.remainingDays} days left`
              : "Expired"}
          </p>
        </div>
      </div>

      {/* Specifications */}
      <InfoBlock title="Battery Specifications">
        <DetailRow icon={Battery} label="Model" value={battery.modelName} />
        <DetailRow icon={Zap} label="Chemistry" value={battery.chemistry} />
        <DetailRow icon={Zap} label="Nominal Voltage" value={battery.nominalVoltage} />
        <DetailRow icon={Activity} label="Capacity" value={`${battery.capacityKwh} kWh`} />
        <DetailRow icon={Weight} label="Weight" value={`${battery.weightKg} kg`} />
        <DetailRow icon={Ruler} label="Dimensions" value={battery.dimensionsMm} />
        <DetailRow icon={Thermometer} label="Operating Temp" value={`${battery.operatingTempC}°C`} />
        <DetailRow icon={Activity} label="Internal Resistance" value={`${battery.internalResistanceMOhms} mΩ`} />
      </InfoBlock>

      {/* Manufacturing */}
      <InfoBlock title="Manufacturing & Origin">
        <DetailRow icon={Calendar} label="Manufacture Date" value={battery.manufactureDate} />
        <DetailRow icon={MapPin} label="Assembly Location" value={battery.assemblyLocation} />
        <DetailRow icon={Hash} label="Serial Number" value={battery.serialNumber} />
        <DetailRow icon={Hash} label="Barcode" value={battery.barcode} />
        <DetailRow icon={Shield} label="Manufacturer" value={battery.manufacturer} />
      </InfoBlock>

      {/* Warranty Details */}
      {battery.warranty && (
        <InfoBlock title="Warranty Information">
          <DetailRow icon={Shield} label="Status" value={battery.warranty.status} />
          <DetailRow icon={Calendar} label="Start Date" value={battery.warranty.startDate} />
          <DetailRow icon={Calendar} label="End Date" value={battery.warranty.endDate} />
          <DetailRow icon={FileText} label="Terms" value={battery.warranty.terms} />
          <DetailRow icon={Shield} label="Provider" value={battery.warranty.provider} />
          <DetailRow icon={Hash} label="Certificate" value={battery.warranty.certificateNumber} />
        </InfoBlock>
      )}

      {/* Compliance */}
      <InfoBlock title="Compliance Standards">
        <div className="flex flex-wrap gap-2">
          {battery.complianceStandards?.map((std, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#F5F1E7] text-xs font-semibold text-[#16263A]"
            >
              <CheckCircle2 className="w-3 h-3 text-green-600" />
              {std}
            </span>
          ))}
        </div>
      </InfoBlock>

      {/* Dismantling */}
      <InfoBlock title="Dismantling & Safety">
        <div className="rounded-xl bg-[#FFF8E7] border border-[#F0E6C8] p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-[#B48611] mt-0.5 shrink-0" />
            <p className="text-sm text-[#16263A] leading-relaxed">{battery.dismantlingManual}</p>
          </div>
        </div>
      </InfoBlock>

      {/* Recycled Content */}
      <InfoBlock title="Recycled Content">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {battery.recycledContent &&
            Object.entries(battery.recycledContent).map(([material, percent]) => (
              <div key={material} className="rounded-xl bg-[#F5F1E7] p-3 text-center">
                <p className="text-xs text-[#737983] capitalize">{material}</p>
                <p className="mt-1 text-lg font-bold text-[#16263A]">{percent}%</p>
              </div>
            ))}
        </div>
      </InfoBlock>

      {/* Health History */}
      {battery.healthHistory && battery.healthHistory.length > 0 && (
        <InfoBlock title="Health History">
          <div className="space-y-2">
            {battery.healthHistory.map((entry, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-[#173B5C] shrink-0" />
                <span className="text-xs text-[#737983] w-20 shrink-0">{entry.date}</span>
                <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#173B5C]"
                    style={{ width: `${entry.soh}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-[#16263A] w-12 text-right">{entry.soh}%</span>
              </div>
            ))}
          </div>
        </InfoBlock>
      )}
    </div>
  );
}
