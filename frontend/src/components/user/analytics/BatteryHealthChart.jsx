import React from "react";
import { HeartPulse } from "lucide-react";
import { Card, SectionHeader } from "../../common";

const BatteryHealthChart = ({ batteries }) => {
  const data = batteries.map((battery) => ({
    name:
      battery.name ||
      battery.modelName ||
      battery.batteryName ||
      battery.serialNumber ||
      "Battery",
    health: Number(
      battery.stateOfHealth ??
        battery.health ??
        battery.healthPercentage ??
        battery.soc ??
        0
    ),
  }));

  return (
    <Card padded={false}>
      <SectionHeader
        icon={HeartPulse}
        title="Battery Health"
        subtitle="Current health percentage"
      />

      <div className="p-6 space-y-5">
        {data.length === 0 ? (
          <div className="text-center py-10 text-[#747B83]">
            No battery data available
          </div>
        ) : (
          data.map((item, index) => (
            <div key={`${item.name}-${index}`}>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-[#747B83] truncate">
                  {item.name}
                </span>

                <span className="text-sm font-bold text-[#16263A]">
                  {item.health}%
                </span>
              </div>

              <div className="h-3 bg-[#F5F1E7] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#B48611] rounded-full transition-all"
                  style={{
                    width: `${Math.min(
                      Math.max(item.health, 0),
                      100
                    )}%`,
                  }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
};

export default React.memo(BatteryHealthChart);
