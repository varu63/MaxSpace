import React from "react";

const InfoBlock = ({ title, icon: Icon, children, variant = "default" }) => {
  if (variant === "passport") {
    return (
      <section className="rounded-2xl bg-[#FFFDF8] border border-[#EEE9DA] shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-[#EEE9DA] bg-[#F5F1E7]">
          {Icon && (
            <div className="w-8 h-8 rounded-lg bg-[#F5F1E7] flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4 text-[#B48611]" />
            </div>
          )}
          <h3 className="text-sm font-bold text-[#9A8240] uppercase tracking-wide">{title}</h3>
        </div>
        <div className="px-5">{children}</div>
      </section>
    );
  }

  return (
    <div className="rounded-2xl bg-[#FFFDF8] border border-[#EEE9DA] p-5 shadow-sm">
      <h3 className="text-sm font-bold text-[#9A8240] uppercase tracking-wide mb-3">{title}</h3>
      <div>{children}</div>
    </div>
  );
};

export default React.memo(InfoBlock);
