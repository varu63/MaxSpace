import React from "react";

const DetailRow = ({ icon: Icon, label, value, variant = "default" }) => {
  if (variant === "passport") {
    return (
      <div className="flex items-start gap-3 py-4 border-b border-[#EEE9DA] last:border-b-0">
        <div className="w-9 h-9 rounded-lg bg-[#F5F1E7] flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-[#173B5C]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-[#747B83] mb-1">{label}</p>
          <p className="text-sm font-semibold text-[#16263A] leading-relaxed break-words">{value}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 py-3 border-b border-[#EEE9DA] last:border-b-0">
      <div className="w-9 h-9 rounded-lg bg-[#F5F1E7] flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-[#173B5C]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-[#747B83]">{label}</p>
        <p className="text-sm font-semibold text-[#16263A] truncate">{value}</p>
      </div>
    </div>
  );
};

export default React.memo(DetailRow);
