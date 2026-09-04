import {
  FileText,
  Eye,
  Wrench,
} from "lucide-react"
import { useNavigate } from "react-router-dom";

const BatteryCard = ({ battery }) => {
  const navigate = useNavigate();
  return (
    <div className="rounded-2xl bg-[#FFFDF8] border border-[#EEE9DA] p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* Top */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="inline-flex items-center rounded-full bg-[#173B5C] px-3 py-1 text-[10px] font-semibold text-white tracking-wide">
            {battery.id}
          </span>

          <h3 className="mt-2 text-lg font-bold text-[#16263A]">
            {battery.model}
          </h3>
        </div>

        <div className="text-right">
          <p className="text-[10px] text-[#737983]">Chemistry</p>
          <p className="mt-0.5 font-bold text-sm text-[#16263A]">
            {battery.chemistry}
          </p>
        </div>
      </div>

      {/* Information */}
      <div className="grid grid-cols-2 gap-3 mt-3">
        <div className="rounded-xl bg-[#F4F0E5] p-3">
          <p className="text-xs text-[#69717A]">Total Cells</p>
          <p className="mt-1 text-lg font-bold text-[#16263A]">
            {battery.cells}
          </p>
        </div>

        <div className="rounded-xl bg-[#F4F0E5] p-3">
          <p className="text-xs text-[#69717A]">Service Status</p>
          <p className="mt-1 text-sm font-bold text-[#B48611]">
            {battery.status}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3 mt-3">
        <button className="h-10 rounded-full border-2 border-[#D9D9D9] bg-white text-[#16263A] text-xs font-semibold hover:bg-[#F8F6EF] transition"
        onClick={()=>navigate(`/battery/${battery.id}`)}>
          <span className="flex items-center justify-center gap-1.5">
            <Eye className="w-3.5 h-3.5" />
            View Details
          </span>
        </button>

        <button className="h-10 rounded-full bg-[#173B5C] text-white text-xs font-semibold hover:bg-[#102F4A] transition"
        onClick={()=>navigate('/services')}>
          <span className="flex items-center justify-center gap-1.5">
            <Wrench className="w-3.5 h-3.5" />
            Request Service
          </span>
        </button>
      </div>

      {/* Passport */}
      <button className="w-full mt-3 h-10 rounded-full border-2 border-[#B48A18] text-[#B48A18] text-xs font-semibold hover:bg-[#FBF7E8] transition"
      onClick={()=>navigate(`/battery/${battery.id}/passport`)}>
        <span className="flex items-center justify-center gap-1.5">
          <FileText className="w-3.5 h-3.5" />
          Battery Passport
        </span>
      </button>
    </div>
  );
};

export default BatteryCard;
