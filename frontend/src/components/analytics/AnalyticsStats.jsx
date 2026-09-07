import React from "react";
import {
  Battery,
  Activity,
  Wrench,
  TrendingUp,
} from "lucide-react";
import { StatCard } from "../common";

const AnalyticsStats = ({ stats }) => {
  const cards = [
    {
      label: "Total Batteries",
      value: stats.totalBatteries,
      description: "Registered batteries",
      icon: Battery,
    },
    {
      label: "Healthy Batteries",
      value: stats.healthyBatteries,
      description: "Good condition",
      icon: Activity,
    },
    {
      label: "Total Services",
      value: stats.totalServices,
      description: "Service records",
      icon: Wrench,
    },
    {
      label: "Avg. Health",
      value: `${stats.averageHealth}%`,
      description: "Battery health",
      icon: TrendingUp,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
      {cards.map((card) => (
        <StatCard
          key={card.label}
          icon={card.icon}
          value={card.value}
          label={card.label}
          description={card.description}
        />
      ))}
    </div>
  );
};

export default React.memo(AnalyticsStats);
