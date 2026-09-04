import React from "react";
import {
  Wrench,
  Clock3,
  Calendar,
  CheckCircle2,
} from "lucide-react";

const StatCard = ({
  icon: Icon,
  iconClass,
  label,
  value,
  description,
}) => {
  return (
    <div className="bg-[#FFFDF8] border border-[#EEE8D8] rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center ${iconClass}`}
        >
          <Icon className="w-6 h-6 text-white" />
        </div>

        <span className="text-xs font-medium text-[#7A8087]">
          {label}
        </span>
      </div>

      <p className="mt-5 text-3xl font-bold">
        {value}
      </p>

      <p className="mt-1 text-sm text-[#6E757C]">
        {description}
      </p>
    </div>
  );
};

const ServiceStats = ({ stats }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">

      <StatCard
        icon={Wrench}
        iconClass="bg-[#173B5C]"
        label="CURRENT"
        value={stats.active}
        description="Active Service"
      />

      <StatCard
        icon={Clock3}
        iconClass="bg-[#B48611]"
        label="WAITING"
        value={stats.pending}
        description="Pending Requests"
      />

      <StatCard
        icon={Calendar}
        iconClass="bg-purple-600"
        label="SCHEDULED"
        value={stats.booked}
        description="Booked Services"
      />

      <StatCard
        icon={CheckCircle2}
        iconClass="bg-green-600"
        label="TOTAL"
        value={stats.completed}
        description="Completed Services"
      />

    </div>
  );
};

export default ServiceStats;