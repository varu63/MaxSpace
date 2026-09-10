import React from "react";
import {
  FileText,
  Eye,
  Wrench,
  Layers,
  Activity,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useBattery } from "../../../context/BatteryContext";

const BatteryCard = ({ battery }) => {
  const navigate = useNavigate();
  const { getBatteryServiceStatus } = useBattery();

  const status = getBatteryServiceStatus(battery);

  return (
    <div className="rounded-3xl bg-[#FFFDF8] border border-[#EEE9DA] p-5 shadow-sm hover:shadow-md transition-shadow">
      {/* Top */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="inline-flex items-center rounded-full bg-[#173B5C] px-3 py-1 text-[10px] font-semibold text-white tracking-wide">
            {battery.id}
          </span>

          <h3 className="mt-2 text-lg font-bold text-[#16263A]">
            {battery.model || battery.modelName}
          </h3>
        </div>

        <div className="text-right">
          <p className="text-[10px] text-[#747B83]">Chemistry</p>
          <p className="mt-0.5 font-bold text-sm text-[#16263A]">
            {battery.chemistry}
          </p>
        </div>
      </div>

      {/* Information */}
      <div className="grid grid-cols-2 gap-3 mt-5">
        <div className="flex items-center gap-3 rounded-2xl bg-[#F5F1E7] border border-[#E7E1D3] p-4">
          <div className="w-9 h-9 rounded-lg bg-[#FFFDF8] border border-[#E7E1D3] flex items-center justify-center shrink-0">
            <Layers className="w-4 h-4 text-[#173B5C]" />
          </div>

          <div>
            <p className="text-xs text-[#747B83]">Total Cells</p>
            <p className="mt-0.5 text-lg font-bold text-[#16263A]">
              {battery.cells}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl bg-[#F5F1E7] border border-[#E7E1D3] p-4">
          <div className="w-9 h-9 rounded-lg bg-[#FFFDF8] border border-[#E7E1D3] flex items-center justify-center shrink-0">
            <Activity className="w-4 h-4 text-[#B48611]" />
          </div>

          <div>
            <p className="text-xs text-[#747B83]">Service Status</p>
            <p className="mt-0.5 text-sm font-bold text-[#B48611]">
              {status}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <button
          className="h-10 rounded-xl border-2 border-[#E7E1D3] bg-[#FFFDF8] text-[#16263A] text-xs font-semibold hover:bg-[#F5F1E7] transition"
          onClick={() => navigate(`/battery/${battery.id}`)}
        >
          <span className="flex items-center justify-center gap-1.5">
            <Eye className="w-3.5 h-3.5" />
            View Details
          </span>
        </button>

        <button
          className="h-10 rounded-xl bg-[#173B5C] text-white text-xs font-semibold hover:bg-[#102F4A] transition"
          onClick={() => navigate("/services")}
        >
          <span className="flex items-center justify-center gap-1.5">
            <Wrench className="w-3.5 h-3.5" />
            Request Service
          </span>
        </button>
      </div>

      {/* Passport */}
      <button
        className="w-full mt-3 h-10 rounded-xl border-2 border-[#B48611] text-[#B48611] text-xs font-semibold hover:bg-[#FBF1C9] transition"
        onClick={() => navigate(`/battery/${battery.id}/passport`)}
      >
        <span className="flex items-center justify-center gap-1.5">
          <FileText className="w-3.5 h-3.5" />
          Battery Passport
        </span>
      </button>
    </div>
  );
};

export default React.memo(BatteryCard);
