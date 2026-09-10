import React from "react";
import { Battery, Wrench, ShieldCheck, AlertTriangle } from "lucide-react";
import { StatCard } from "../../common";

const ServiceStats = ({ stats = {} }) => {
  return (
    <div className="w-full grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-7">
      <StatCard
        icon={Battery}
        tone="primary"
        label="Total Batteries"
        value={stats.total ?? stats.totalBatteries ?? 0}
      />
      <StatCard
        icon={Wrench}
        tone="primary"
        label="Active Services"
        value={stats.active ?? 0}
      />
      <StatCard
        icon={ShieldCheck}
        tone="primary"
        label="Warranty Active"
        value={stats.warranty ?? stats.warrantyActive ?? 0}
      />
      <StatCard
        icon={AlertTriangle}
        tone="accent"
        label="Needs Attention"
        value={stats.attention ?? stats.needsAttention ?? 0}
      />
    </div>
  );
};

export default React.memo(ServiceStats);

