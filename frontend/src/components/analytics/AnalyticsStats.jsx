import React from "react";
import {
  Battery,
  Activity,
  Wrench,
  TrendingUp,
} from "lucide-react";

const AnalyticsStats = ({ stats }) => {
  const cards = [
    {
      title: "Total Batteries",
      value: stats.totalBatteries,
      subtitle: "Registered batteries",
      icon: Battery,
    },
    {
      title: "Healthy Batteries",
      value: stats.healthyBatteries,
      subtitle: "Good condition",
      icon: Activity,
    },
    {
      title: "Total Services",
      value: stats.totalServices,
      subtitle: "Service records",
      icon: Wrench,
    },
    {
      title: "Avg. Health",
      value: `${stats.averageHealth}%`,
      subtitle: "Battery health",
      icon: TrendingUp,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <div
            key={card.title}
            className="bg-[#FFFDF8] border border-[#EEE9DA] rounded-3xl p-6 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#8A7A4A]">
                  {card.title}
                </p>

                <h3 className="text-3xl font-bold text-[#16263A] mt-2">
                  {card.value}
                </h3>

                <p className="text-xs text-[#747B83] mt-1">
                  {card.subtitle}
                </p>
              </div>

              <div className="w-12 h-12 rounded-2xl bg-[#173B5C] flex items-center justify-center shadow-sm">
                <Icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AnalyticsStats;