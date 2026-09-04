import React from "react";

const BatteryHealthChart = ({ batteries }) => {
  const data = batteries.map((battery) => ({
    name:
      battery.name ||
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
    <div className="bg-[#FFFDF8] border border-[#EEE9DA] rounded-3xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-[#16263A]">
            Battery Health
          </h2>

          <p className="text-sm text-[#747B83]">
            Current health percentage
          </p>
        </div>
      </div>

      <div className="space-y-5">
        {data.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            No battery data available
          </div>
        ) : (
          data.map((item, index) => (
            <div key={`${item.name}-${index}`}>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-slate-700 truncate">
                  {item.name}
                </span>

                <span className="text-sm font-bold text-slate-900">
                  {item.health}%
                </span>
              </div>

              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#F4C430] rounded-full transition-all"
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
    </div>
  );
};

export default BatteryHealthChart;